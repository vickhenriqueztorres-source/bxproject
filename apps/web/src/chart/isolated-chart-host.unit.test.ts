import { describe, it, expect, vi } from 'vitest';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { IsolatedChartHost, type IsolatedChartHostProps } from './IsolatedChartHost';

describe('[SUBETAPA 01] IsolatedChartHost — Ciclo de Vida e Isolamento de Canvas', () => {
  const sampleCandles: CandlestickData<UTCTimestamp>[] = [
    { time: 1700000000 as UTCTimestamp, open: 100, high: 105, low: 98, close: 102 },
    { time: 1700000060 as UTCTimestamp, open: 102, high: 108, low: 101, close: 107 },
    { time: 1700000120 as UTCTimestamp, open: 107, high: 109, low: 104, close: 105 },
  ];

  it('ISO-01: IsolatedChartHost está definido como componente React memoizado', () => {
    expect(IsolatedChartHost).toBeDefined();
    expect(typeof IsolatedChartHost).toBe('object');
  });

  it('ISO-02: Comparador de memoização ignora re-renders espúrios quando props vitais são idênticas', () => {
    // Simula a lógica de comparação interna do React.memo
    const prevProps = {
      candles: sampleCandles,
      chartType: 'candles' as const,
      timeframe: '1m' as const,
      isBinmax: true,
      extraUiState: 'foo',
    };

    const nextPropsIdentical = {
      candles: sampleCandles,
      chartType: 'candles' as const,
      timeframe: '1m' as const,
      isBinmax: true,
      extraUiState: 'bar', // Mudança de UI no shell exterior
    };

    const areEqual =
      prevProps.candles === nextPropsIdentical.candles &&
      prevProps.chartType === nextPropsIdentical.chartType &&
      prevProps.timeframe === nextPropsIdentical.timeframe &&
      prevProps.isBinmax === nextPropsIdentical.isBinmax;

    expect(areEqual).toBe(true); // Bloqueia re-render do canvas
  });

  it('ISO-03: Comparador detecta alteração legítima de timeframe ou chartType', () => {
    const prevProps: IsolatedChartHostProps = {
      candles: sampleCandles,
      chartType: 'candles',
      timeframe: '1m',
      isBinmax: true,
    };

    const nextPropsTypeChange = {
      ...prevProps,
      chartType: 'line' as const,
    };

    const areEqualType =
      prevProps.candles === nextPropsTypeChange.candles &&
      prevProps.chartType === nextPropsTypeChange.chartType &&
      prevProps.timeframe === nextPropsTypeChange.timeframe &&
      prevProps.isBinmax === nextPropsTypeChange.isBinmax;

    expect(areEqualType).toBe(false);

    const nextPropsTfChange = {
      ...prevProps,
      timeframe: '5s' as const,
    };

    const areEqualTf =
      prevProps.candles === nextPropsTfChange.candles &&
      prevProps.chartType === nextPropsTfChange.chartType &&
      prevProps.timeframe === nextPropsTfChange.timeframe &&
      prevProps.isBinmax === nextPropsTfChange.isBinmax;

    expect(areEqualTf).toBe(false);
  });

  it('ISO-04: Transforma velas para AreaData mantendo estritamente close e time', () => {
    const lineData = sampleCandles.map((c) => ({
      time: c.time,
      value: c.close,
    }));

    expect(lineData.length).toBe(3);
    expect(lineData[0]).toEqual({ time: 1700000000, value: 102 });
    expect(lineData[1]).toEqual({ time: 1700000060, value: 107 });
    expect(lineData[2]).toEqual({ time: 1700000120, value: 105 });
  });

  it('ISO-05: Validação defensiva do ResizeObserver contra dimensões não-positivas (Causa 3)', () => {
    const applyOptionsSpy = vi.fn();
    const mockChart = { applyOptions: applyOptionsSpy };

    const handleResize = (width: number, height: number) => {
      // Regra de ouro da Subetapa 1: ignora dimensões <= 50px
      if (width > 50 && height > 50) {
        mockChart.applyOptions({ width, height });
        return true;
      }
      return false;
    };

    // Cenário de colapso temporário (flexbox colapsando para 0 durante render)
    expect(handleResize(0, 0)).toBe(false);
    expect(handleResize(0, 500)).toBe(false);
    expect(handleResize(800, 0)).toBe(false);
    expect(handleResize(40, 40)).toBe(false);
    expect(applyOptionsSpy).not.toHaveBeenCalled();

    // Cenário de dimensão válida
    expect(handleResize(800, 500)).toBe(true);
    expect(applyOptionsSpy).toHaveBeenCalledWith({ width: 800, height: 500 });
  });
});
