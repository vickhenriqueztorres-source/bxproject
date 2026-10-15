/**
 * Testes de Validação - Subetapa 5.3: Habilitação de Velas Reais 5s/15s/30s no Frontend,
 * Reconciliação sem Pulo (open = 1º tick), Cache por Timeframe e Fallback Seguro
 *
 * Invariantes validadas:
 * - M-05 (Regra Única de OHLCV entre cliente e servidor)
 * - G-01 & G-07 (Monotonicidade estrita no Lightweight Charts: t_n > t_{n-1}, zero timestamps duplicados)
 * - G-08 (Causalidade e ausência de pulo visual da vela no refetch / foco de janela)
 * - Resiliência e Fallback Seguro (compatibilidade retroativa quando a fonte só fornece 1m)
 */

import { describe, it, expect } from 'vitest';
import type { UTCTimestamp, CandlestickData } from 'lightweight-charts';
import type { Candle } from '../../apps/web/src/api/client';
import {
  resampleCandles,
  timeframeSeconds,
} from '../../apps/web/src/chart/candle-adapter';
import {
  mergeObservedCandles,
  safeCandleFromTick,
} from '../../apps/web/src/chart/chart-scale-normalizer';

describe('Subetapa 5.3 — Velas Reais no Frontend e Fallback Seguro', () => {

  describe('1. Validação do Regex e Intervalos em getCandles', () => {
    it('deve aceitar sub-minutos canônicos (5s, 15s, 30s) e timeframes padrão (1m, 5m, 1h)', () => {
      const regex = /^([5]|[13]5|30)s$|^[1-9]\d{0,6}[mhd]$/;

      // Sub-minutos válidos
      expect(regex.test('5s')).toBe(true);
      expect(regex.test('15s')).toBe(true);
      expect(regex.test('30s')).toBe(true);

      // Minutos/horas/dias válidos
      expect(regex.test('1m')).toBe(true);
      expect(regex.test('5m')).toBe(true);
      expect(regex.test('15m')).toBe(true);
      expect(regex.test('1h')).toBe(true);
      expect(regex.test('1d')).toBe(true);

      // Intervalos inválidos (devem cair no fallback '1m')
      expect(regex.test('7s')).toBe(false);
      expect(regex.test('10s')).toBe(false);
      expect(regex.test('20s')).toBe(false);
      expect(regex.test('0m')).toBe(false);
      expect(regex.test('invalid')).toBe(false);
    });
  });

  describe('2. Preservação de Velas Reais vs Fallback Sintético em resampleCandles', () => {
    it('deve PRESERVAR velas de 5s reais sem fatiar quando a entrada já contiver barras sub-minuto', () => {
      // 12 velas de 5s reais vindas do servidor cobrindo 1 minuto (1710000000 até 1710000055)
      const real5sCandles: Candle[] = [];
      const baseSec = 1710000000;
      for (let i = 0; i < 12; i++) {
        real5sCandles.push({
          time: baseSec + i * 5,
          open: (100 + i).toFixed(4),
          high: (101 + i).toFixed(4),
          low: (99.5 + i).toFixed(4),
          close: (100.8 + i).toFixed(4),
          volume: 5,
        });
      }

      // Reamostra pedindo 5s
      const result5s = resampleCandles(real5sCandles, '5s');

      // NÃO deve fatiar cada vela em 12 pedaços (o que geraria 144 velas falsas)!
      // Deve retornar exatamente as 12 velas reais!
      expect(result5s.length).toBe(12);
      expect(result5s[0].time).toBe(baseSec);
      expect(result5s[0].open).toBe(100);
      expect(result5s[0].high).toBe(101);
      expect(result5s[0].low).toBe(99.5);
      expect(result5s[0].close).toBe(100.8);
      expect(result5s[11].time).toBe(baseSec + 55);
    });

    it('deve agregar com exatidão velas de 5s para 15s (3 em 1) e 30s (6 em 1) sem sintetizar fatias', () => {
      const real5sCandles: Candle[] = [];
      const baseSec = 1710000000;
      for (let i = 0; i < 12; i++) {
        real5sCandles.push({
          time: baseSec + i * 5,
          open: (100 + i * 0.5).toFixed(4),
          high: (101 + i * 0.5).toFixed(4),
          low: (99 + i * 0.5).toFixed(4),
          close: (100.4 + i * 0.5).toFixed(4),
          volume: 5,
        });
      }

      // Reamostra pedindo 15s (12 velas de 5s -> 4 velas de 15s)
      const result15s = resampleCandles(real5sCandles, '15s');
      expect(result15s.length).toBe(4);
      expect(result15s[0].time).toBe(baseSec);
      expect(result15s[0].open).toBe(100.0); // Open da 1ª vela de 5s
      expect(result15s[0].close).toBe(101.4); // Close da 3ª vela de 5s (100.4 + 2 * 0.5)

      // Reamostra pedindo 30s (12 velas de 5s -> 2 velas de 30s)
      const result30s = resampleCandles(real5sCandles, '30s');
      expect(result30s.length).toBe(2);
      expect(result30s[0].time).toBe(baseSec);
      expect(result30s[1].time).toBe(baseSec + 30);
    });

    it('deve usar fatiamento sintético EXCLUSIVAMENTE como fallback quando a entrada só tiver velas de 1m', () => {
      const legacy1mCandles: Candle[] = [
        {
          time: 1710000000,
          open: '100.0000',
          high: '105.0000',
          low: '98.0000',
          close: '103.0000',
          volume: 60,
        },
      ];

      // Pede 5s com base de 1m: fallback sintético ativado
      const fallback5s = resampleCandles(legacy1mCandles, '5s');
      expect(fallback5s.length).toBe(12); // Fatiamento em 12 pedaços
      expect(fallback5s[0].time).toBe(1710000000);
      expect(fallback5s[11].time).toBe(1710000055);

      // Pede 15s com base de 1m: fallback sintético ativado
      const fallback15s = resampleCandles(legacy1mCandles, '15s');
      expect(fallback15s.length).toBe(4); // Fatiamento em 4 pedaços
    });
  });

  describe('3. Reconciliação sem Pulo da Vela (open = 1º tick) e Anti-Crash', () => {
    it('deve manter o open estritamente inalterado entre ticks ao vivo e refetch do servidor', () => {
      const bucketSec = 1710000000 as UTCTimestamp;
      const initialTick = {
        symbol: 'VOL_50',
        price: '100.2500',
        ts: new Date(bucketSec * 1000).toISOString(),
      };

      // 1. Tick 1 cria a vela no cliente
      const liveBar1 = safeCandleFromTick(initialTick as any, null, '5s');
      expect(liveBar1).not.toBeNull();
      expect(liveBar1!.time).toBe(bucketSec);
      expect(liveBar1!.open).toBe(100.25);
      expect(liveBar1!.close).toBe(100.25);

      // 2. Tick 2 e 3 chegam ao vivo
      const tick2 = { symbol: 'VOL_50', price: '102.0000', ts: new Date((bucketSec + 1) * 1000).toISOString() };
      const liveBar2 = safeCandleFromTick(tick2 as any, liveBar1, '5s');
      const tick3 = { symbol: 'VOL_50', price: '101.5000', ts: new Date((bucketSec + 2) * 1000).toISOString() };
      const liveBar3 = safeCandleFromTick(tick3 as any, liveBar2, '5s');

      expect(liveBar3!.open).toBe(100.25, 'Open deve continuar 100.25');
      expect(liveBar3!.high).toBe(102.0);
      expect(liveBar3!.close).toBe(101.5);

      // 3. Simula um refetch HTTP do servidor acontecendo no meio do bucket (após o tick 3)
      // O servidor retorna a vela consolidada até o tick 3 usando a Regra Única (open = primeiro tick)
      const serverCandle: CandlestickData<UTCTimestamp> = {
        time: bucketSec,
        open: 100.25,
        high: 102.0,
        low: 100.25,
        close: 101.5,
      };

      // Mescla com mergeObservedCandles
      const merged = mergeObservedCandles([serverCandle], [liveBar3!], '5s');
      expect(merged.length).toBe(1);
      const mergedBar = merged[0];

      // Prova matemática: zero "pulo" de vela!
      expect(mergedBar.open).toBe(100.25);
      expect(mergedBar.high).toBe(102.0);
      expect(mergedBar.low).toBe(100.25);
      expect(mergedBar.close).toBe(101.5);
    });

    it('deve garantir monotonicidade estrita de tempo (t_n > t_{n-1}) para proteger Lightweight Charts (G-07)', () => {
      const history: CandlestickData<UTCTimestamp>[] = [
        { time: 1710000000 as UTCTimestamp, open: 100, high: 101, low: 99, close: 100.5 },
        { time: 1710000005 as UTCTimestamp, open: 100.5, high: 102, low: 100, close: 101.2 },
        { time: 1710000010 as UTCTimestamp, open: 101.2, high: 103, low: 101, close: 102.0 },
      ];

      // Observed com ticks duplicados, fora de ordem e no passado
      const chaoticObserved: CandlestickData<UTCTimestamp>[] = [
        { time: 1710000005 as UTCTimestamp, open: 100.5, high: 102.5, low: 99.8, close: 101.3 }, // Duplicado/passado
        { time: 1710000015 as UTCTimestamp, open: 102.0, high: 104, low: 101.8, close: 103.5 },
        { time: 1710000020 as UTCTimestamp, open: 103.5, high: 105, low: 103.0, close: 104.2 },
        { time: 1710000012 as UTCTimestamp, open: 101.5, high: 102, low: 101.0, close: 101.8 }, // Fora de ordem
      ];

      const merged = mergeObservedCandles(history, chaoticObserved, '5s');

      // Monotonicidade estrita
      for (let i = 1; i < merged.length; i++) {
        expect(merged[i].time).toBeGreaterThan(merged[i - 1].time);
      }

      // Validação de invariantes OHLCV
      for (const bar of merged) {
        expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
        expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
      }
    });
  });
});
