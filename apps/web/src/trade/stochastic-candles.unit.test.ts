import { describe, it, expect } from 'vitest';
import { generateSeedCandles } from '../api/client';
import { ASSET_CATALOG } from '../catalog/assets';

describe('SUBETAPA 1: Validação do Motor Estocástico de Velas Realistas', () => {
  it('ST-01: Integridade Estrutural das Velas em Janela Contínua (3.500 velas)', () => {
    const candles = generateSeedCandles('SYNTH_VOL_50', 3500);
    expect(candles.length).toBe(3500);

    candles.forEach((c) => {
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);

      expect(Number.isFinite(open)).toBe(true);
      expect(Number.isFinite(high)).toBe(true);
      expect(Number.isFinite(low)).toBe(true);
      expect(Number.isFinite(close)).toBe(true);

      // Invariantes absolutos de velas japonesas
      expect(high).toBeGreaterThanOrEqual(low);
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      expect(low).toBeLessThanOrEqual(Math.min(open, close));

      // Todos os preços devem ser estritamente positivos
      expect(low).toBeGreaterThan(0);
      expect(c.volume).toBeGreaterThan(0);
    });
  });

  it('ST-02: Não-Periodicidade & Ausência de Senoide (Eliminação do Padrão em Zigue-Zague)', () => {
    // Na fórmula antiga de senoide pura, velas subiam e desciam em blocos exatos e periódicos
    const candles = generateSeedCandles('EURUSD_OTC', 200);

    // Calcula os retornos percentuais (close - open) / open
    const returns = candles.map((c) => (Number(c.close) - Number(c.open)) / Number(c.open));

    // Calcula autocorrelação no lag 6 (onde a senoide anterior criava crista)
    let sum1 = 0;
    let sum2 = 0;
    let cross = 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

    for (let i = 0; i < returns.length - 6; i++) {
      const diff1 = returns[i] - mean;
      const diff2 = returns[i + 6] - mean;
      cross += diff1 * diff2;
      sum1 += diff1 * diff1;
      sum2 += diff2 * diff2;
    }

    const autoCorrLag6 = cross / Math.sqrt(sum1 * sum2);

    // Em uma senoide pura de período ~6, a autocorrelação seria fortemente positiva (> 0.8)
    // Em um processo estocástico de Ornstein-Uhlenbeck com ruído gaussiano, deve ser próxima de zero (|r| < 0.35)
    expect(Math.abs(autoCorrLag6)).toBeLessThan(0.35);

    // Contagem de sequências: mercados reais têm alternância variada de velas (1, 2, 3, etc.), não blocos fixos
    let consecutiveSameSign = 1;
    let maxConsecutive = 1;
    for (let i = 1; i < returns.length; i++) {
      if ((returns[i] >= 0 && returns[i - 1] >= 0) || (returns[i] < 0 && returns[i - 1] < 0)) {
        consecutiveSameSign++;
        if (consecutiveSameSign > maxConsecutive) maxConsecutive = consecutiveSameSign;
      } else {
        consecutiveSameSign = 1;
      }
    }

    // Não deve haver monotonicidade excessiva e artificial
    expect(maxConsecutive).toBeLessThan(18);
  });

  it('ST-03: Diversidade e Precisão por Classe de Ativo', () => {
    // 1. Forex JPY (3 casas decimais)
    const jpyCandles = generateSeedCandles('NZDJPY_OTC', 20);
    expect(jpyCandles[0].close).toMatch(/^\d+\.\d{3}$/);

    // 2. Cripto (2 casas decimais, valores altos)
    const btcCandles = generateSeedCandles('BTCUSD_OTC', 20);
    expect(Number(btcCandles[0].close)).toBeGreaterThan(20000);
    expect(btcCandles[0].close).toMatch(/^\d+\.\d{2}$/);

    // 3. Forex Standard (5 casas decimais)
    const eurusdCandles = generateSeedCandles('EURUSD_OTC', 20);
    expect(eurusdCandles[0].close).toMatch(/^\d+\.\d{5}$/);
    expect(Number(eurusdCandles[0].close)).toBeLessThan(2.0);

    // 4. Índice Sintético (2 casas decimais, volatilidade alta)
    const synthCandles = generateSeedCandles('SYNTH_VOL_50', 20);
    expect(Number(synthCandles[0].close)).toBeGreaterThan(100);
    expect(synthCandles[0].close).toMatch(/^\d+\.\d{2}$/);
  });

  it('ST-04: Performance Extrema de Geração de Histórico (< 25ms para 1.000 velas)', () => {
    const start = performance.now();
    const candles = generateSeedCandles('ETHUSD_OTC', 1000);
    const elapsed = performance.now() - start;

    expect(candles.length).toBe(1000);
    expect(elapsed).toBeLessThan(25);
  });

  it('ST-05: Cobertura Completa de Ativos do Catálogo sem Exceções', () => {
    ASSET_CATALOG.forEach((asset) => {
      const candles = generateSeedCandles(asset.symbol, 10);
      expect(candles.length).toBe(10);
      expect(Number(candles[0].close)).toBeGreaterThan(0);
    });
  });
});
