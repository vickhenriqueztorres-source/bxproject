import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCandles, getAssetBasePrice } from './client';

// Mock do ambiente de browser com sessionStorage
const mockSessionStorage: Record<string, string> = {};

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '1');
  for (const k of Object.keys(mockSessionStorage)) {
    delete mockSessionStorage[k];
  }
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => mockSessionStorage[key] ?? null,
    setItem: (key: string, val: string) => {
      mockSessionStorage[key] = val;
    },
    removeItem: (key: string) => {
      delete mockSessionStorage[key];
    },
    clear: () => {
      for (const k of Object.keys(mockSessionStorage)) delete mockSessionStorage[k];
    },
  });
  mockSessionStorage['synth_guest_mode'] = 'true';
});

describe('[SUBETAPA 02] Purga Automática de Cache Zumbi e Sanitização de Preço Base', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('PURGE-01: Detecta e purga velas zumbis (1253.87) em SYNTH_VOL_50, regenerando velas em ~500.1250', async () => {
    const symbol = 'SYNTH_VOL_50';
    const base = getAssetBasePrice(symbol); // 500.1250

    // Simula cache zumbi gravado na versão antiga com preço 1253.87
    const zombieStore = {
      wallet: { currency: 'USD', available_minor: 1000000, reserved_minor: 0 },
      candles: {
        [symbol]: [
          { time: 1700000000, open: '1250.0000', high: '1255.0000', low: '1248.0000', close: '1253.8700', volume: 100 },
          { time: 1700000060, open: '1253.8700', high: '1256.0000', low: '1251.0000', close: '1254.5000', volume: 120 },
        ],
      },
      contracts: [],
    };

    mockSessionStorage['synth_mock_store_v3'] = JSON.stringify(zombieStore);

    // Invoca getCandles
    const candles = await getCandles(symbol, '1m', 100);

    expect(candles.length).toBeGreaterThan(0);
    const lastClose = Number(candles[candles.length - 1].close);

    // O preço DEVE estar alinhado com o preço base oficial (500.1250), e NUNCA em 1253
    expect(lastClose).toBeGreaterThan(450);
    expect(lastClose).toBeLessThan(550);
    expect(Math.abs(lastClose - base) / base).toBeLessThan(0.15);

    // O cache no sessionStorage deve ter sido atualizado com as novas velas alinhadas
    const updatedStore = JSON.parse(mockSessionStorage['synth_mock_store_v3']);
    const cachedCandles = updatedStore.candles[symbol];
    expect(cachedCandles).toBeDefined();
    const cachedClose = Number(cachedCandles[cachedCandles.length - 1].close);
    expect(cachedClose).toBeGreaterThan(450);
    expect(cachedClose).toBeLessThan(550);
  });

  it('PURGE-02: Mantém intacto o cache de velas quando os preços estão dentro da faixa normal (paridade de mercado)', async () => {
    const symbol = 'EURUSD_OTC';
    getAssetBasePrice(symbol); // 1.08542

    const validStore = {
      wallet: { currency: 'USD', available_minor: 1000000, reserved_minor: 0 },
      candles: {
        [symbol]: [
          { time: 1700000000, open: '1.08500', high: '1.08600', low: '1.08450', close: '1.08542', volume: 50 },
        ],
      },
      contracts: [],
    };

    mockSessionStorage['synth_mock_store_v3'] = JSON.stringify(validStore);

    const candles = await getCandles(symbol, '1m', 10);
    expect(candles.length).toBe(1);
    expect(candles[0].close).toBe('1.08542');
  });

  it('PURGE-03: Purgar chaves obsoletas legadas (synth_mock_store v1 e v2) na inicialização', async () => {
    mockSessionStorage['synth_mock_store'] = JSON.stringify({ legacy: true });
    mockSessionStorage['synth_mock_store_v2'] = JSON.stringify({ legacy: true });

    await getCandles('SYNTH_VOL_10', '1m', 10);

    // As chaves antigas devem ter sido removidas para liberar espaço e evitar confusão
    expect(mockSessionStorage['synth_mock_store']).toBeUndefined();
    expect(mockSessionStorage['synth_mock_store_v2']).toBeUndefined();
  });

  it('PURGE-CHAOS: Resiliência contra JSON corrompido no sessionStorage', async () => {
    mockSessionStorage['synth_mock_store_v3'] = '{"corrupted": true, broken json...';

    // Não deve lançar erro
    const candles = await getCandles('BTCUSD_OTC', '1m', 50);
    expect(Array.isArray(candles)).toBe(true);
    expect(candles.length).toBeGreaterThan(0);
    expect(Number(candles[0].close)).toBeGreaterThan(40000);
  });
});
