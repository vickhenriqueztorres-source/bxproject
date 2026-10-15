import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRaw,
  nextEma,
  aggregateRows,
  startSentimentService,
  stopSentimentService,
  getSentiment,
  SENTIMENT_QUERY_SQL,
} from './sentiment-service.mjs';

const TEST_ALIASES = {
  SYNTH_VOL_10: 'VOL_10',
  SYNTH_VOL_25: 'VOL_25',
  SYNTH_VOL_50: 'VOL_50',
  SYNTH_VOL_75: 'VOL_75',
  SYNTH_VOL_100: 'VOL_100',
  SYNTH_CRASH_BOOM_100: 'CRASH_BOOM_100',
};

function resolveTestSymbol(sym) {
  if (!sym) return 'VOL_50';
  return TEST_ALIASES[sym] || sym;
}

describe('Subetapa 1 — Serviço de Sentimento (sentiment-service.mjs)', () => {
  beforeEach(() => {
    stopSentimentService();
    delete process.env.SENTIMENT_ENABLED;
  });

  afterEach(() => {
    stopSentimentService();
    delete process.env.SENTIMENT_ENABLED;
  });

  describe('1. Unitários Matemáticos — computeRaw(up, down, k)', () => {
    it('0/0 → 50 exato', () => {
      assert.equal(computeRaw(0, 0, 10), 50);
    });

    it('3/1 → 54 (±0,5)', () => {
      const val = computeRaw(3, 1, 10);
      assert.ok(Math.abs(val - 54) <= 0.5, `Esperado ~54, obteve ${val}`);
      assert.equal(Math.round(val), 54);
    });

    it('300/100 → 74 (±0,5)', () => {
      const val = computeRaw(300, 100, 10);
      assert.ok(Math.abs(val - 74) <= 0.5, `Esperado ~74, obteve ${val}`);
      assert.equal(Math.round(val), 74);
    });

    it('simetria: computeRaw(a, b) + computeRaw(b, a) === 100', () => {
      for (const [a, b] of [
        [0, 0],
        [5, 2],
        [18, 7],
        [120, 45],
      ]) {
        const sum = computeRaw(a, b, 10) + computeRaw(b, a, 10);
        assert.ok(Math.abs(sum - 100) < 1e-10);
      }
    });
  });

  describe('2. Unitários de Agregação — aggregateRows(rows, resolveSymbol)', () => {
    it('1 usuário com 10 contratos UP conta 1 (não 10)', () => {
      const rows = Array.from({ length: 10 }, (_, idx) => ({
        symbol: 'VOL_50',
        user_id: 'whale-user-1',
        has_up: true,
        has_down: false,
        contract_seq: idx,
      }));
      for (let u = 2; u <= 5; u++) {
        rows.push({
          symbol: 'VOL_50',
          user_id: `user-${u}`,
          has_up: true,
          has_down: false,
        });
      }

      const agg = aggregateRows(rows, resolveTestSymbol);
      const vol50 = agg.get('VOL_50');
      assert.ok(vol50);
      assert.equal(vol50.sample_size, 5);
      assert.equal(vol50.up, 5);
      assert.equal(vol50.down, 0);
      assert.equal(vol50.low_sample, false);
      assert.equal(vol50.bulls_pct, 60);
    });

    it('usuário com UP e DOWN no mesmo ativo conta 0,5 / 0,5', () => {
      const rows = [
        { symbol: 'VOL_50', user_id: 'hedger-1', has_up: true, has_down: true },
        { symbol: 'VOL_50', user_id: 'u2', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u3', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u4', has_up: false, has_down: true },
        { symbol: 'VOL_50', user_id: 'u5', has_up: false, has_down: true },
      ];

      const agg = aggregateRows(rows, resolveTestSymbol);
      const vol50 = agg.get('VOL_50');
      assert.equal(vol50.sample_size, 5);
      assert.equal(vol50.up, 2.5);
      assert.equal(vol50.down, 2.5);
      assert.equal(vol50.bulls_pct, 50);
    });

    it('símbolo legado (SYNTH_VOL_50) é canonicalizado para VOL_50 e deduplica o mesmo usuário', () => {
      const rows = [
        { symbol: 'SYNTH_VOL_50', user_id: 'u1', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u1', has_up: false, has_down: true },
        { symbol: 'SYNTH_VOL_50', user_id: 'u2', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u3', has_up: true, has_down: false },
        { symbol: 'SYNTH_VOL_50', user_id: 'u4', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u5', has_up: true, has_down: false },
      ];

      const agg = aggregateRows(rows, resolveTestSymbol);
      assert.equal(agg.has('SYNTH_VOL_50'), false);
      const vol50 = agg.get('VOL_50');
      assert.ok(vol50);
      assert.equal(vol50.sample_size, 5);
      assert.equal(vol50.up, 4.5);
      assert.equal(vol50.down, 0.5);
      assert.equal(vol50.low_sample, false);
    });

    it('sample_size < 5 → bulls_pct 50 e low_sample true', () => {
      const rows = [
        { symbol: 'EURUSD_OTC', user_id: 'u1', has_up: true, has_down: false },
        { symbol: 'EURUSD_OTC', user_id: 'u2', has_up: true, has_down: false },
        { symbol: 'EURUSD_OTC', user_id: 'u3', has_up: true, has_down: false },
        { symbol: 'EURUSD_OTC', user_id: 'u4', has_up: true, has_down: false },
      ];

      const agg = aggregateRows(rows, resolveTestSymbol);
      const eurusd = agg.get('EURUSD_OTC');
      assert.equal(eurusd.sample_size, 4);
      assert.equal(eurusd.low_sample, true);
      assert.equal(eurusd.bulls_pct, 50);
    });
  });

  describe('3. Unitários de Suavização Temporal — nextEma(prev, raw, dtSec, halfLifeSec)', () => {
    it('primeiro valor (prev = null) assume raw imediatamente', () => {
      assert.equal(nextEma(null, 74, 5, 30), 74);
    });

    it('converge monotonamente para raw com meia-vida de ~30s (α = 1 - exp(-5/30))', () => {
      let ema = 50;
      const target = 80;
      for (let step = 0; step < 6; step++) {
        const next = nextEma(ema, target, 5, 30);
        assert.ok(next > ema);
        assert.ok(next < target);
        ema = next;
      }
      const expectedAfter30s = 50 + (80 - 50) * (1 - Math.exp(-30 / 30));
      assert.ok(Math.abs(ema - expectedAfter30s) < 1e-8);

      for (let step = 0; step < 60; step++) {
        ema = nextEma(ema, target, 5, 30);
      }
      assert.ok(Math.abs(ema - target) < 0.01);
    });
  });

  describe('4. Caos, Resiliência e Privacidade — startSentimentService / getSentiment', () => {
    it('falha de consulta mantém o snapshot anterior, não lança exceção e aplica throttle de 1x/min no log', async () => {
      let shouldFail = false;
      let fakeNow = 1_700_000_000_000;
      const errorLogs = [];

      const validRows = Array.from({ length: 10 }, (_, i) => ({
        symbol: 'VOL_50',
        user_id: `u-${i + 1}`,
        has_up: true,
        has_down: false,
      }));

      const mockPool = {
        query: async (sql) => {
          assert.equal(sql, SENTIMENT_QUERY_SQL);
          if (shouldFail) {
            throw new Error('PG_CONNECTION_LOST');
          }
          return { rows: validRows };
        },
      };

      const svc = startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
        enabled: true,
        intervalMs: 60_000,
        nowFn: () => fakeNow,
        logger: { error: (...args) => errorLogs.push(args) },
      });

      await svc.pollOnce();

      const snapBefore = getSentiment('VOL_50');
      assert.ok(snapBefore);
      assert.equal(snapBefore.bulls_pct, 67);
      assert.equal(snapBefore.low_sample, false);
      assert.equal(snapBefore.sample_size, 10);

      // Simula queda do banco em 5 ciclos consecutivos dentro do mesmo minuto
      shouldFail = true;
      for (let i = 1; i <= 5; i++) {
        fakeNow += 5_000;
        const r = await svc.pollOnce();
        assert.equal(r, null);
      }

      // Snapshot anterior deve permanecer intacto
      const snapDuringOutage = getSentiment('VOL_50');
      assert.deepEqual(snapDuringOutage, snapBefore);

      // Throttle de log: apenas 1 erro registrado dentro da janela de 60s
      assert.equal(errorLogs.length, 1);

      // Avança além de 60s -> deve registrar 2º log
      fakeNow += 60_000;
      await svc.pollOnce();
      assert.equal(errorLogs.length, 2);
    });

    it('proteção contra sobreposição: se a consulta anterior não terminou, pula o ciclo', async () => {
      let activeQueries = 0;
      let maxConcurrentQueries = 0;
      let resolvePendingQuery;

      const mockPool = {
        query: () =>
          new Promise((resolve) => {
            activeQueries++;
            maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);
            resolvePendingQuery = () => {
              activeQueries--;
              resolve({ rows: [] });
            };
          }),
      };

      const svc = startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
        enabled: true,
        intervalMs: 60_000,
      });

      const overlapping1 = await svc.pollOnce();
      const overlapping2 = await svc.pollOnce();
      assert.equal(overlapping1, null);
      assert.equal(overlapping2, null);
      assert.equal(maxConcurrentQueries, 1);

      resolvePendingQuery();
      await new Promise((r) => setTimeout(r, 10));
      assert.equal(activeQueries, 0);
    });

    it('ativo sem contratos abertos converge a EMA para 50', async () => {
      let currentRows = Array.from({ length: 20 }, (_, i) => ({
        symbol: 'VOL_50',
        user_id: `u-${i + 1}`,
        has_up: true,
        has_down: false,
      }));

      const mockPool = {
        query: async () => ({ rows: currentRows }),
      };

      const svc = startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
        enabled: true,
        intervalMs: 60_000,
      });
      await svc.pollOnce();

      // Todos os contratos expiraram (0 linhas abertas), mas surgiram 6 usuários 3 UP / 3 DOWN em seguida
      currentRows = [];
      for (let i = 0; i < 40; i++) {
        await svc.pollOnce();
      }
      // Agora entram 6 usuários (3 UP / 3 DOWN -> raw = 50): a EMA já convergiu para ~50
      currentRows = [
        { symbol: 'VOL_50', user_id: 'u1', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u2', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u3', has_up: true, has_down: false },
        { symbol: 'VOL_50', user_id: 'u4', has_up: false, has_down: true },
        { symbol: 'VOL_50', user_id: 'u5', has_up: false, has_down: true },
        { symbol: 'VOL_50', user_id: 'u6', has_up: false, has_down: true },
      ];
      await svc.pollOnce();
      const snap = getSentiment('VOL_50');
      assert.equal(snap.low_sample, false);
      assert.equal(snap.bulls_pct, 50);
    });

    it('privacidade: nunca expõe sample_size exato quando < 5 (devolve sample_size: 0 e bulls_pct: 50)', async () => {
      const mockPool = {
        query: async () => ({
          rows: [
            { symbol: 'VOL_50', user_id: 'u1', has_up: true, has_down: false },
            { symbol: 'VOL_50', user_id: 'u2', has_up: true, has_down: false },
            { symbol: 'VOL_50', user_id: 'u3', has_up: true, has_down: false },
          ],
        }),
      };

      const svc = startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
        enabled: true,
        intervalMs: 60_000,
      });
      await svc.pollOnce();

      const snap = getSentiment('VOL_50');
      assert.equal(snap.low_sample, true);
      assert.equal(snap.bulls_pct, 50);
      assert.equal(snap.sample_size, 0);
    });

    it('flag desligada (enabled: false ou SENTIMENT_ENABLED=false) não consulta o banco e getSentiment devolve null', async () => {
      let queryCount = 0;
      const mockPool = {
        query: async () => {
          queryCount++;
          return { rows: [] };
        },
      };

      process.env.SENTIMENT_ENABLED = 'false';
      startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
      });

      assert.equal(getSentiment('VOL_50'), null);
      assert.equal(queryCount, 0);
    });
  });

  describe('5. Estresse — 10.000 posições em múltiplos ativos', () => {
    it('agrega 10.000 linhas em menos de 100ms', () => {
      const symbols = ['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'EURUSD_OTC', 'BTCUSD_OTC', 'SYNTH_VOL_50'];
      const rows = Array.from({ length: 10_000 }, (_, i) => ({
        symbol: symbols[i % symbols.length],
        user_id: `user-${i % 1200}`,
        has_up: i % 3 !== 0,
        has_down: i % 5 === 0,
      }));

      const t0 = performance.now();
      const result = aggregateRows(rows, resolveTestSymbol);
      const elapsed = performance.now() - t0;

      assert.ok(result.get('VOL_50'));
      assert.ok(result.get('VOL_50').sample_size > 100);
      assert.ok(elapsed < 100, `Esperado < 100ms, levou ${elapsed}ms`);
    });
  });

  describe('6. Rota HTTP GET /api/sentiment & Segurança de Contrato', () => {
    const knownAssets = new Set(['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'EURUSD_OTC', 'BTCUSD_OTC']);

    function simulateRouteRequest(urlStr) {
      const parsedUrl = new URL(urlStr, 'http://localhost:3001');
      let statusCode = 500;
      let headers = {};
      let rawBody = '';

      const res = {
        writeHead(code, hdrs) {
          statusCode = code;
          headers = hdrs || {};
        },
        end(payload) {
          rawBody = payload;
        },
      };

      if (parsedUrl.pathname === '/api/sentiment') {
        const rawSymbol = (parsedUrl.searchParams.get('symbol') || '').trim();
        const symbol = rawSymbol ? resolveTestSymbol(rawSymbol) : '';
        if (!symbol || !knownAssets.has(symbol)) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify({ error: 'Invalid or missing symbol' }));
        } else {
          const sentiment = getSentiment(symbol);
          if (!sentiment) {
            res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify({ error: 'Sentiment service disabled' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
            res.end(JSON.stringify(sentiment));
          }
        }
      }

      return {
        statusCode,
        headers,
        body: rawBody ? JSON.parse(rawBody) : null,
      };
    }

    it('retorna 400 se symbol estiver ausente ou for desconhecido / payload malicioso', () => {
      startSentimentService({ pgPool: null, resolveSymbol: resolveTestSymbol, enabled: true });

      assert.equal(simulateRouteRequest('/api/sentiment').statusCode, 400);
      assert.equal(simulateRouteRequest('/api/sentiment?symbol=').statusCode, 400);
      assert.equal(simulateRouteRequest('/api/sentiment?symbol=NAO_EXISTE').statusCode, 400);
      assert.equal(simulateRouteRequest('/api/sentiment?symbol=%27%20OR%201%3D1--').statusCode, 400);
    });

    it('retorna 404 se o serviço estiver desligado', () => {
      startSentimentService({ pgPool: null, resolveSymbol: resolveTestSymbol, enabled: false });

      const resp = simulateRouteRequest('/api/sentiment?symbol=VOL_50');
      assert.equal(resp.statusCode, 404);
    });

    it('retorna 200 com Cache-Control: no-store, canonicaliza alias e oculta sample_size < 5', async () => {
      const mockPool = {
        query: async () => ({
          rows: [
            { symbol: 'SYNTH_VOL_50', user_id: 'u1', has_up: true, has_down: false },
            { symbol: 'SYNTH_VOL_50', user_id: 'u2', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u1', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u2', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u3', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u4', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u5', has_up: true, has_down: false },
            { symbol: 'EURUSD_OTC', user_id: 'u6', has_up: true, has_down: false },
          ],
        }),
      };

      const svc = startSentimentService({
        pgPool: mockPool,
        resolveSymbol: resolveTestSymbol,
        enabled: true,
        intervalMs: 60_000,
      });
      await svc.pollOnce();

      // SYNTH_VOL_50 tem apenas 2 usuários -> low_sample: true, sample_size: 0, bulls_pct: 50
      const rLow = simulateRouteRequest('/api/sentiment?symbol=SYNTH_VOL_50');
      assert.equal(rLow.statusCode, 200);
      assert.equal(rLow.headers['Cache-Control'], 'no-store');
      assert.equal(rLow.body.symbol, 'VOL_50');
      assert.equal(rLow.body.bulls_pct, 50);
      assert.equal(rLow.body.low_sample, true);
      assert.equal(rLow.body.sample_size, 0);
      assert.equal('user_id' in rLow.body, false);

      // EURUSD_OTC tem 6 usuários UP -> low_sample: false, sample_size: 6, bulls_pct: round(16/26*100) = 62
      const rNormal = simulateRouteRequest('/api/sentiment?symbol=EURUSD_OTC');
      assert.equal(rNormal.statusCode, 200);
      assert.equal(rNormal.headers['Cache-Control'], 'no-store');
      assert.equal(rNormal.body.symbol, 'EURUSD_OTC');
      assert.equal(rNormal.body.bulls_pct, 62);
      assert.equal(rNormal.body.low_sample, false);
      assert.equal(rNormal.body.sample_size, 6);
    });
  });
});
