import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseIntervalSeconds,
  aggregateCandlesToInterval,
  createCandleAggregationCache,
  computeTickDispatchLatencyMs,
} from '../scripts/lib/candle-aggregation-engine.mjs';

function buildBase1mCandles(count = 10080) {
  const startSec = 1_700_000_040; // múltiplo de 60
  const bars = new Array(count);
  let price = 500.0;
  for (let i = 0; i < count; i++) {
    const open = price;
    const delta = ((i % 7) - 3) * 0.25;
    const close = Number((open + delta).toFixed(4));
    const high = Number((Math.max(open, close) + 0.4).toFixed(4));
    const low = Number((Math.min(open, close) - 0.35).toFixed(4));
    bars[i] = {
      time: startSec + i * 60,
      open: open.toFixed(4),
      high: high.toFixed(4),
      low: low.toFixed(4),
      close: close.toFixed(4),
      volume: 100 + (i % 50),
    };
    price = close;
  }
  return bars;
}

test('Subetapa 4.1 (Estresse de CPU em /candles): 200 requisições simultâneas sobre 10.080 barras com 99% Cache Hit O(1) e invariantes OHLCV', () => {
  const baseBars = buildBase1mCandles(10080);
  const cache = createCandleAggregationCache({ ttlMs: 2000, maxEntries: 500 });
  const t0 = 1_700_600_000_000;

  const startHr = performance.now();
  const results5m = [];
  for (let i = 0; i < 200; i++) {
    const res = cache.getAggregatedCandles({
      symbol: 'VOL_50',
      baseBars,
      intervalSec: parseIntervalSeconds('5m'),
      beforeKey: 'latest',
      nowMs: t0 + (i % 10),
    });
    results5m.push(res);
  }
  const elapsedMs = performance.now() - startHr;

  assert.equal(cache.telemetry.requestsTotal, 200);
  assert.equal(
    cache.telemetry.aggregationsComputedTotal,
    1,
    'Apenas 1 agregação pesada deve ser computada para 200 F5 simultâneos'
  );
  assert.equal(cache.telemetry.cacheHitsTotal, 199);
  assert.ok(
    elapsedMs < 150,
    `200 requisições sobre 10.080 barras devem executar em <150ms (levou ${elapsedMs.toFixed(2)}ms)`
  );

  const sample = results5m[0];
  assert.ok(sample.length > 2000, 'Série de 5m a partir de 10.080 barras de 1m deve ter ~2.016 barras');

  // Valida invariantes OHLCV (Skill 03-synthetic-market-engine)
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    const o = parseFloat(b.open);
    const h = parseFloat(b.high);
    const l = parseFloat(b.low);
    const c = parseFloat(b.close);
    assert.ok(h >= Math.max(o, c), `Invariante High >= max(Open, Close) violada no índice ${i}`);
    assert.ok(l <= Math.min(o, c), `Invariante Low <= min(Open, Close) violada no índice ${i}`);
    if (i > 0) {
      assert.ok(b.time > sample[i - 1].time, 'Série agregada deve ser estritamente monotônica crescente');
    }
  }
});

test('Subetapa 4.2 (Invalidação Instantânea por Assinatura OHLCV): atualização de tick na última vela invalida o cache automaticamente', () => {
  const baseBars = buildBase1mCandles(100);
  const cache = createCandleAggregationCache({ ttlMs: 2000 });
  const t0 = 1_700_600_000_000;

  const firstAgg = cache.getAggregatedCandles({
    symbol: 'VOL_100',
    baseBars,
    intervalSec: 300,
    nowMs: t0,
  });
  const initialLastClose = firstAgg[firstAgg.length - 1].close;

  // Novo tick chega 100ms depois (dentro do TTL de 2000ms) e altera o close e high da última vela de 1m
  const lastBase = baseBars[baseBars.length - 1];
  lastBase.close = '999.9900';
  lastBase.high = '999.9900';
  lastBase.volume += 1;

  const secondAgg = cache.getAggregatedCandles({
    symbol: 'VOL_100',
    baseBars,
    intervalSec: 300,
    nowMs: t0 + 100,
  });

  assert.notEqual(secondAgg[secondAgg.length - 1].close, initialLastClose);
  assert.equal(
    secondAgg[secondAgg.length - 1].close,
    '999.9900',
    'Mudança na assinatura da última barra deve recalcular imediatamente sem servir vela defasada'
  );
  assert.equal(cache.telemetry.aggregationsComputedTotal, 2);
});

test('Subetapa 4.3 (Latência Real de Despacho de Tick): computeTickDispatchLatencyMs substitui latency_ms: 0 fixo', () => {
  assert.equal(computeTickDispatchLatencyMs(1000, 1004), 4);
  assert.equal(computeTickDispatchLatencyMs(1000, 1000), 0);
  assert.equal(computeTickDispatchLatencyMs(1005, 1000), 0, 'Clock skew nunca deve gerar latência negativa');
  assert.equal(computeTickDispatchLatencyMs(NaN, 1000), 0);

  const feedFile = fs.readFileSync(path.resolve(process.cwd(), 'scripts/dev-live-feed.mjs'), 'utf8');
  assert.ok(
    feedFile.includes('computeTickDispatchLatencyMs(now, dispatchTime)'),
    'dev-live-feed.mjs deve calcular latency_ms real usando computeTickDispatchLatencyMs'
  );
  assert.ok(
    !feedFile.includes('latency_ms: 0,'),
    'dev-live-feed.mjs não deve mais ter latency_ms: 0 hardcoded no broadcast de ticks'
  );
});

test('Subetapa 4.4 (Code-Splitting Vite e Gzip/Cache Imutável no Nginx): configuração validada', () => {
  const viteConfig = fs.readFileSync(path.resolve(process.cwd(), 'apps/web/vite.config.ts'), 'utf8');
  assert.ok(viteConfig.includes('manualChunks'), 'vite.config.ts deve conter manualChunks');
  assert.ok(viteConfig.includes('vendor-charts'), 'vite.config.ts deve separar lightweight-charts em vendor-charts');
  assert.ok(viteConfig.includes('vendor-motion'), 'vite.config.ts deve separar gsap/lenis em vendor-motion');
  assert.ok(viteConfig.includes('vendor-auth-query'), 'vite.config.ts deve separar oidc-client-ts/react-query');

  const nginxScript = fs.readFileSync(path.resolve(process.cwd(), 'scripts/update-nginx-ssl.mjs'), 'utf8');
  assert.ok(nginxScript.includes('gzip on;'), 'Nginx deve habilitar gzip on;');
  assert.ok(nginxScript.includes('gzip_static on;'), 'Nginx deve habilitar gzip_static on;');
  assert.ok(
    nginxScript.includes('public, max-age=31536000, immutable'),
    'Nginx deve configurar Cache-Control imutável de 1 ano para /assets/'
  );
});
