import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCandles, fetchHistoricalCandlesChunk, generateSeedCandles } from '../api/client';

describe('SUBETAPA 1: Expansão do Histórico de Velas (48h / 2.880 Velas) & Lazy Load Retroativo', () => {
  beforeEach(() => vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '1'));
  afterEach(() => vi.unstubAllEnvs());

  it('HE-01: getCandles retorna 2.880 velas (48 horas a 1m) no boot padrão sem corte artificial em 180', async () => {
    const candles = await getCandles('EURUSD_OTC', '1m', 2880);

    // Deve conter 2.880 velas (48 horas contínuas)
    expect(candles.length).toBe(2880);

    // Deve cobrir uma janela contínua de exatamente (2880 - 1) * 60 segundos
    const firstTime = Number(candles[0].time);
    const lastTime = Number(candles[candles.length - 1].time);
    const spanSeconds = lastTime - firstTime;
    expect(spanSeconds).toBe((2880 - 1) * 60);

    // Timestamps estritamente crescentes sem duplicatas
    for (let i = 1; i < candles.length; i++) {
      const prev = Number(candles[i - 1].time);
      const curr = Number(candles[i].time);
      expect(curr).toBe(prev + 60);
    }
  });

  it('HE-02: fetchHistoricalCandlesChunk com beforeTimestamp retorna lote retroativo contíguo anterior', async () => {
    // 1. Carrega o primeiro lote de 2.880 velas
    const initialCandles = await getCandles('EURUSD_OTC', '1m', 2880);
    const oldestTimestamp = Number(initialCandles[0].time);

    // 2. Solicita um lote de 1.000 velas ANTERIOR ao timestamp mais antigo carregado
    const olderChunk = await fetchHistoricalCandlesChunk('EURUSD_OTC', oldestTimestamp, 1000);

    expect(olderChunk.length).toBe(1000);

    // Todas as velas do lote retroativo devem ter time < oldestTimestamp
    for (const c of olderChunk) {
      expect(Number(c.time)).toBeLessThan(oldestTimestamp);
    }

    // A última vela do lote mais antigo deve se conectar imediatamente com a primeira do lote inicial
    const lastOldChunkTime = Number(olderChunk[olderChunk.length - 1].time);
    expect(lastOldChunkTime).toBe(oldestTimestamp - 60);
  });

  it('HE-03: Mesclagem de histórico preserva unicidade e ordenação temporal estrita', async () => {
    const initialCandles = await getCandles('SYNTH_VOL_50', '1m', 1440); // 24h
    const oldestTimestamp = Number(initialCandles[0].time);

    const chunk1 = await fetchHistoricalCandlesChunk('SYNTH_VOL_50', oldestTimestamp, 500);

    // Mescla simulando o PriceChart
    const map = new Map<number, any>();
    for (const c of chunk1) map.set(Number(c.time), c);
    for (const c of initialCandles) map.set(Number(c.time), c);

    const merged = Array.from(map.values()).sort((a, b) => Number(a.time) - Number(b.time));

    expect(merged.length).toBe(1440 + 500);
    for (let i = 1; i < merged.length; i++) {
      expect(Number(merged[i].time)).toBe(Number(merged[i - 1].time) + 60);
    }
  });

  it('HE-04: Teste de Estresse e Desempenho (< 45ms para gerar e processar 2.880 velas)', async () => {
    const t0 = performance.now();
    const candles = generateSeedCandles('BTCUSD_OTC', 2880);
    const elapsed = performance.now() - t0;

    expect(candles.length).toBe(2880);
    expect(elapsed).toBeLessThan(45);
  });

  it('HE-05: Integridade Matemática Absoluta das Velas na Janela Expandida', async () => {
    const candles = await getCandles('NZDJPY_OTC', '1m', 2880);

    candles.forEach((c) => {
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);

      expect(Number.isFinite(open)).toBe(true);
      expect(Number.isFinite(high)).toBe(true);
      expect(Number.isFinite(low)).toBe(true);
      expect(Number.isFinite(close)).toBe(true);

      expect(high).toBeGreaterThanOrEqual(low);
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      expect(low).toBeLessThanOrEqual(Math.min(open, close));
      expect(low).toBeGreaterThan(0);
      expect(c.volume).toBeGreaterThan(0);
    });
  });
});
