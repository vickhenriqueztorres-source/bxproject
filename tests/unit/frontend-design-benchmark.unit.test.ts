import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import { generateSeedCandles } from '../../apps/web/src/api/client';

// AC-T13-1: Dado BTCUSD_OTC e relógio fixo, quando houver 1 warmup e 10
// gerações de 2.880 velas, então cada geração deve durar estritamente <45 ms.
// AC-T13-2: Fora da janela medida, todas as velas devem conservar OHLC,
// volume inteiro positivo e timestamps contíguos separados por 60 segundos.
describe('D-UI-00D — estabilidade do benchmark frontend HE-04', () => {
  it('[AC-T13-1] dez amostras <45ms com integridade [AC-T13-2]', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    try {
      generateSeedCandles('BTCUSD_OTC', 2880); // Único warmup; nunca um retry.
      const samples: number[] = [];
      const batches: ReturnType<typeof generateSeedCandles>[] = [];
      for (let sample = 0; sample < 10; sample++) {
        const start = performance.now();
        const candles = generateSeedCandles('BTCUSD_OTC', 2880);
        const elapsed = performance.now() - start;
        samples.push(elapsed);
        batches.push(candles);
      }
      const ordered = [...samples].sort((a, b) => a - b);
      console.info('HE-04 benchmark', JSON.stringify({
        node: process.version, v8: process.versions.v8,
        platform: process.platform, arch: process.arch,
        cpu: cpus()[0]?.model, logicalCpus: cpus().length,
        totalMemoryBytes: totalmem(), symbol: 'BTCUSD_OTC', count: 2880,
        warmups: 1, samplesMs: samples, limitMs: 45,
        medianMs: (ordered[4] + ordered[5]) / 2,
        p95Ms: ordered[Math.ceil(ordered.length * 0.95) - 1],
        profile: 'maxWorkers=1;fileParallelism=false;configLoader=runner;cache=false',
      }));
      // Asserções depois de todas as medições: não alteram o custo cronometrado.
      let firstInvalidCandle: string | null = null;
      for (let sample = 0; sample < samples.length; sample++) {
        const candles = batches[sample];
        expect(candles).toHaveLength(2880);
        expect(candles[0].time).toBe(1_800_000_000 - 2879 * 60);
        expect(candles[2879].time).toBe(1_800_000_000);
        for (let i = 0; i < candles.length; i++) {
          const candle = candles[i];
          const [open, high, low, close] =
            [candle.open, candle.high, candle.low, candle.close].map(Number);
          const valid = [open, high, low, close].every(
            price => Number.isFinite(price) && price > 0,
          ) && high >= Math.max(open, close, low)
            && low <= Math.min(open, close)
            && Number.isInteger(candle.volume) && candle.volume > 0
            && candle.time === candles[0].time + i * 60;
          if (!valid && firstInvalidCandle === null) {
            firstInvalidCandle = `amostra ${sample + 1}, vela ${i}: ${JSON.stringify(candle)}`;
          }
        }
      }
      expect(firstInvalidCandle, 'integridade de todas as 28.800 velas').toBeNull();
      for (let sample = 0; sample < samples.length; sample++) {
        expect(samples[sample], `amostra ${sample + 1}`).toBeLessThan(45);
      }
    } finally {
      clock.mockRestore();
    }
  }, 30_000);
});
