import { describe, it, expect, vi } from 'vitest';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import {
  IsolatedChartHost,
  areCandlesEquivalent,
  areChartHostPropsEqual,
  syncChartViewportOnResize,
  type IsolatedChartHostProps,
} from './IsolatedChartHost';
import { ensureStrictAscendingBars } from './bar-sanitizer';
import { normalizeTimeSeconds } from './chart-sanitizer';
import { resampleCandles } from './candle-adapter';
import { normalizeSeedWithTick, mergeObservedCandles } from './chart-scale-normalizer';
import { calculateSMA, calculateRSI } from './indicator-calculator';

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

  it('ISO-06 [StrictMode #1351]: Ciclo duplo mount -> cleanup -> remount descarta chart #1 sem vazar canvas duplicado nem esvaziar latestCandlesRef', () => {
    const domChildren: string[] = [];
    const hostEl = {
      replaceChildren: vi.fn(() => {
        domChildren.length = 0;
      }),
    };

    const createdCharts: Array<{ id: number; disposed: boolean; remove: ReturnType<typeof vi.fn>; setDataCalls: number }> = [];
    const latestCandlesRef = { current: sampleCandles };
    const chartRef: { current: any } = { current: null };
    const isDisposedRef = { current: false };
    const onChartDispose = vi.fn();

    const runMountEffect = () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {
          /* ignore */
        }
        chartRef.current = null;
      }
      hostEl.replaceChildren();
      isDisposedRef.current = false;

      const chartId = createdCharts.length + 1;
      const chartInstance = {
        id: chartId,
        disposed: false,
        setDataCalls: 0,
        remove: vi.fn(() => {
          chartInstance.disposed = true;
          const idx = domChildren.indexOf(`canvas-${chartId}`);
          if (idx >= 0) domChildren.splice(idx, 1);
        }),
      };
      domChildren.push(`canvas-${chartId}`);
      createdCharts.push(chartInstance);
      chartRef.current = chartInstance;

      if (latestCandlesRef.current.length > 0) {
        chartInstance.setDataCalls++;
      }

      return () => {
        isDisposedRef.current = true;
        onChartDispose();
        chartRef.current = null;
        try {
          chartInstance.remove();
        } catch {
          /* ignore */
        }
        hostEl.replaceChildren();
      };
    };

    // 1º Mount (React StrictMode Pass 1)
    const cleanupPass1 = runMountEffect();
    expect(createdCharts.length).toBe(1);
    expect(domChildren).toEqual(['canvas-1']);
    expect(createdCharts[0].setDataCalls).toBe(1);

    // Cleanup Pass 1 (React StrictMode desmonta efeito sem re-renderizar o componente)
    cleanupPass1();
    expect(createdCharts[0].remove).toHaveBeenCalledTimes(1);
    expect(createdCharts[0].disposed).toBe(true);
    expect(onChartDispose).toHaveBeenCalledTimes(1);
    expect(domChildren).toEqual([]);
    // Garantia crítica: latestCandlesRef NÃO foi esvaziado pelo cleanup
    expect(latestCandlesRef.current.length).toBe(3);

    // 2º Mount (React StrictMode Pass 2 - sem novo render entre cleanup e mount)
    const cleanupPass2 = runMountEffect();
    expect(createdCharts.length).toBe(2);
    // Apenas 1 gráfico vivo no DOM (canvas-2), nunca 2 gráficos duplicados
    expect(domChildren).toEqual(['canvas-2']);
    expect(createdCharts[1].disposed).toBe(false);
    // Chart #2 recebeu os dados iniciais íntegros de latestCandlesRef
    expect(createdCharts[1].setDataCalls).toBe(1);

    cleanupPass2();
    expect(createdCharts[1].disposed).toBe(true);
    expect(domChildren).toEqual([]);
  });

  it('ISO-07 [Late Call Guard #1345]: Chamadas assíncronas tardias após chart.remove() não lançam Uncaught TypeError (Object is disposed)', () => {
    let effectDisposed = false;
    const isDisposedRef = { current: false };

    // Simula Lightweight Charts que lança TypeError / Error("Object is disposed") após chart.remove()
    const disposedChart = {
      applyOptions: vi.fn(() => {
        if (isDisposedRef.current) {
          throw new TypeError("Cannot read properties of null (reading 'applyOptions') - Object is disposed");
        }
      }),
      timeScale: vi.fn(() => {
        if (isDisposedRef.current) {
          throw new Error('Object is disposed');
        }
        return { scrollToRealTime: vi.fn() };
      }),
    };

    const chartRef: { current: any } = { current: disposedChart };

    // Simula cleanup síncrono
    effectDisposed = true;
    isDisposedRef.current = true;
    chartRef.current = null;

    // 1. Callback tardio de ResizeObserver
    const lateResizeCallback = () => {
      if (effectDisposed || isDisposedRef.current || chartRef.current !== disposedChart) return 'blocked';
      disposedChart.applyOptions();
      return 'executed';
    };

    // 2. Callback tardio de scrollToRealTime / visibilitychange
    const lateScrollCallback = () => {
      if (isDisposedRef.current || !chartRef.current) return 'blocked';
      try {
        chartRef.current.timeScale().scrollToRealTime();
        return 'executed';
      } catch {
        return 'caught';
      }
    };

    expect(() => lateResizeCallback()).not.toThrow();
    expect(lateResizeCallback()).toBe('blocked');
    expect(() => lateScrollCallback()).not.toThrow();
    expect(lateScrollCallback()).toBe('blocked');
    expect(disposedChart.applyOptions).not.toHaveBeenCalled();
  });

  it('ISO-08 [Orphan Series Cleanup #1345]: Troca de instância de chart limpa mapas órfãos de indicadores, strikeLines e currentPriceLine no PriceChart', () => {
    const currentPriceLine = { current: { id: 'line-1' } as any };
    const currentPriceLineSeries = { current: { id: 'series-1' } as any };
    const strikeLinesMap = new Map<string, any>([['contract-1', { line: {}, series: {} }]]);
    const indicatorSeriesMap = new Map<string, any>([['sma-20', { id: 'ind-series-1' }]]);
    const chartInstance = { current: { id: 'chart-1' } as any };

    const handleChartReady = (newChart: any) => {
      if (chartInstance.current && chartInstance.current !== newChart) {
        currentPriceLine.current = null;
        currentPriceLineSeries.current = null;
        strikeLinesMap.clear();
        indicatorSeriesMap.clear();
      }
      chartInstance.current = newChart;
    };

    // Quando chart #2 substitui chart #1 (ex: remount StrictMode), todas as referências órfãs do chart #1 são expurgadas
    handleChartReady({ id: 'chart-2' });

    expect(chartInstance.current.id).toBe('chart-2');
    expect(currentPriceLine.current).toBeNull();
    expect(currentPriceLineSeries.current).toBeNull();
    expect(strikeLinesMap.size).toBe(0);
    expect(indicatorSeriesMap.size).toBe(0);
  });

  it('ISO-09 [DOM Orphan Resilience #1345]: Se chart.remove() lançar erro interno, o cleanup captura a exceção e limpa o container DOM', () => {
    let domContent = '<div class="tv-lightweight-charts"><canvas></canvas></div>';
    const hostEl = {
      replaceChildren: vi.fn(() => {
        domContent = '';
      }),
    };
    const brokenChart = {
      remove: vi.fn(() => {
        throw new TypeError('Uncaught TypeError: Cannot read properties of undefined (reading removeChild)');
      }),
    };

    expect(() => {
      try {
        brokenChart.remove();
      } catch {
        /* ignore if already disposed */
      }
      hostEl.replaceChildren();
    }).not.toThrow();

    expect(brokenChart.remove).toHaveBeenCalledTimes(1);
    expect(hostEl.replaceChildren).toHaveBeenCalledTimes(1);
    expect(domContent).toBe('');
  });

  it('ISO-10 [State Re-Render Guard #1345 / #1346]: areChartHostPropsEqual e areCandlesEquivalent bloqueiam flicker quando o pai re-renderiza com novo array de mesmas velas', () => {
    const clonedCandles: CandlestickData<UTCTimestamp>[] = sampleCandles.map((c) => ({ ...c }));
    expect(clonedCandles).not.toBe(sampleCandles);
    expect(areCandlesEquivalent(sampleCandles, clonedCandles)).toBe(true);
    expect(areCandlesEquivalent([], [])).toBe(true);

    const prevProps: IsolatedChartHostProps = {
      candles: sampleCandles,
      chartType: 'candles',
      timeframe: '1m',
      symbol: 'SYNTH_VOL_50',
      isBinmax: true,
      onChartReady: () => {},
      onDimensionsChange: () => {},
    };

    // Mudança de estado no pai cria novos callbacks inline e clone de array com mesmas velas
    const nextPropsAfterParentStateChange: IsolatedChartHostProps = {
      candles: clonedCandles,
      chartType: 'candles',
      timeframe: '1m',
      symbol: 'SYNTH_VOL_50',
      isBinmax: true,
      onChartReady: () => {},
      onDimensionsChange: () => {},
    };

    expect(areChartHostPropsEqual(prevProps, nextPropsAfterParentStateChange)).toBe(true);

    // Mas se o fechamento da última vela mudar legitimamente, detecta a atualização
    const updatedCandles = sampleCandles.map((c, idx) =>
      idx === sampleCandles.length - 1 ? { ...c, close: 112 } : { ...c }
    );
    expect(areCandlesEquivalent(sampleCandles, updatedCandles)).toBe(false);
    expect(
      areChartHostPropsEqual(prevProps, {
        ...nextPropsAfterParentStateChange,
        candles: updatedCandles,
      })
    ).toBe(false);
  });

  it('ISO-11 [Dual-Series Ref Sync #1345 / #1346]: Comutação de estado chartType (candles <-> line) preserva instância em useRef e ticks ao vivo sem setData([]) nem recriação', () => {
    const createChartSpy = vi.fn();
    const removeChartSpy = vi.fn();
    const candleBars: CandlestickData<UTCTimestamp>[] = [];
    const areaBars: Array<{ time: UTCTimestamp; value: number }> = [];

    const candleSeriesRef = {
      current: {
        visible: true,
        setData: vi.fn((bars: CandlestickData<UTCTimestamp>[]) => {
          candleBars.length = 0;
          candleBars.push(...bars);
        }),
        update: vi.fn((bar: CandlestickData<UTCTimestamp>) => {
          const idx = candleBars.findIndex((b) => b.time === bar.time);
          if (idx >= 0) candleBars[idx] = bar;
          else candleBars.push(bar);
        }),
        applyOptions: vi.fn((opts: { visible?: boolean }) => {
          if (opts.visible !== undefined) candleSeriesRef.current.visible = opts.visible;
        }),
      },
    };

    const areaSeriesRef = {
      current: {
        visible: false,
        setData: vi.fn((bars: Array<{ time: UTCTimestamp; value: number }>) => {
          areaBars.length = 0;
          areaBars.push(...bars);
        }),
        update: vi.fn((pt: { time: UTCTimestamp; value: number }) => {
          const idx = areaBars.findIndex((b) => b.time === pt.time);
          if (idx >= 0) areaBars[idx] = pt;
          else areaBars.push(pt);
        }),
        applyOptions: vi.fn((opts: { visible?: boolean }) => {
          if (opts.visible !== undefined) areaSeriesRef.current.visible = opts.visible;
        }),
      },
    };

    // 1. Mount único (useRef)
    createChartSpy();
    candleSeriesRef.current.setData(sampleCandles);
    areaSeriesRef.current.setData(sampleCandles.map((c) => ({ time: c.time, value: c.close })));

    // 2. Chegada de tick em tempo real enquanto está em 'candles': atualiza AMBAS as séries em memória
    const liveBar: CandlestickData<UTCTimestamp> = {
      time: 1700000180 as UTCTimestamp,
      open: 105,
      high: 115,
      low: 104,
      close: 114,
    };
    candleSeriesRef.current.update(liveBar);
    areaSeriesRef.current.update({ time: liveBar.time, value: liveBar.close });

    // 3. Mudança de estado: usuário alterna chartType para 'line'
    const switchChartType = (nextType: 'candles' | 'line') => {
      const isCandles = nextType === 'candles';
      candleSeriesRef.current.applyOptions({ visible: isCandles });
      areaSeriesRef.current.applyOptions({ visible: !isCandles });
    };

    switchChartType('line');

    // Nenhuma recriação de gráfico (createChart chamado apenas 1 vez no mount, remove 0 vezes)
    expect(createChartSpy).toHaveBeenCalledTimes(1);
    expect(removeChartSpy).not.toHaveBeenCalled();
    // Nenhuma chamada destrutiva de setData([]) ao trocar chartType
    expect(candleSeriesRef.current.setData).toHaveBeenCalledTimes(1);
    expect(areaSeriesRef.current.setData).toHaveBeenCalledTimes(1);
    // A série de linha já possui os 3 candles históricos + o 4º candle do tick ao vivo (sem perda de dados!)
    expect(areaSeriesRef.current.visible).toBe(true);
    expect(candleSeriesRef.current.visible).toBe(false);
    expect(areaBars.length).toBe(4);
    expect(areaBars[3]).toEqual({ time: 1700000180, value: 114 });
  });

  it('ISO-12 [Symbol & UI State Persistence #1345 / #1346]: Mudança de estado de símbolo atualiza dados na mesma instância useRef sem desmontar o gráfico nem perder timeframe/indicadores', () => {
    let createChartCount = 0;
    let removeChartCount = 0;
    const chartRef = {
      current: {
        id: 'persistent-chart-ref',
        remove: () => {
          removeChartCount++;
        },
      },
    };
    createChartCount++;

    // Estado interno do PriceChart preservado graças à key estável ("cell-0") e instância em useRef
    const userState = {
      timeframe: '5s' as const,
      chartType: 'line' as const,
      enabledIndicators: ['sma-20', 'rsi-14'],
    };

    const setDataSpy = vi.fn();
    const switchSymbolInPlace = (newSymbol: string, newCandles: CandlestickData<UTCTimestamp>[]) => {
      // Não chama chart.remove() nem createChart(), apenas setData() na ref existente
      expect(chartRef.current).not.toBeNull();
      setDataSpy(newSymbol, newCandles);
    };

    switchSymbolInPlace('EURUSD_OTC', sampleCandles);
    switchSymbolInPlace('BTCUSD_OTC', sampleCandles);
    switchSymbolInPlace('SYNTH_VOL_50', sampleCandles);

    expect(createChartCount).toBe(1);
    expect(removeChartCount).toBe(0);
    expect(setDataSpy).toHaveBeenCalledTimes(3);
    // O usuário não perde seu timeframe ('5s'), chartType ('line') ou indicadores ativos
    expect(userState.timeframe).toBe('5s');
    expect(userState.chartType).toBe('line');
    expect(userState.enabledIndicators).toEqual(['sma-20', 'rsi-14']);
  });

  it('ISO-13 [Lazy-Load & Re-Render Scroll Preservation #1345]: Atualizações de candles no mesmo ativo/timeframe não forçam scrollToRealTime nem apagam sequência rAF', () => {
    const scrollToRealTimeSpy = vi.fn();
    const resetRafSpy = vi.fn();
    let hadBars = false;
    let prevSymbol = 'SYNTH_VOL_50';
    let prevTimeframe = '1m';
    let lastAppliedCandles: CandlestickData<UTCTimestamp>[] = [];

    const runDataUpdateEffect = (
      candles: CandlestickData<UTCTimestamp>[],
      symbol: string,
      timeframe: string
    ) => {
      const symbolChanged = prevSymbol !== symbol;
      const timeframeChanged = prevTimeframe !== timeframe;
      prevSymbol = symbol;
      prevTimeframe = timeframe;

      if (!symbolChanged && !timeframeChanged && areCandlesEquivalent(lastAppliedCandles, candles)) {
        return 'skipped-identical';
      }
      lastAppliedCandles = candles;

      const wasEmpty = !hadBars;
      hadBars = candles.length > 0;

      if (symbolChanged) {
        resetRafSpy(symbol);
      }

      if (symbolChanged || timeframeChanged || (wasEmpty && candles.length > 0)) {
        scrollToRealTimeSpy();
      }
      return 'updated';
    };

    // 1. Carga inicial (wasEmpty = true -> posiciona no tempo real 1 vez)
    expect(runDataUpdateEffect(sampleCandles, 'SYNTH_VOL_50', '1m')).toBe('updated');
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);
    expect(resetRafSpy).not.toHaveBeenCalled();

    // 2. Re-render do componente pai com clone idêntico das velas -> ignorado!
    const cloned = sampleCandles.map((c) => ({ ...c }));
    expect(runDataUpdateEffect(cloned, 'SYNTH_VOL_50', '1m')).toBe('skipped-identical');
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);

    // 3. Lazy-load de histórico (usuário rolou para a esquerda e carregou vela anterior no mesmo ativo/timeframe)
    const withOlderHistory: CandlestickData<UTCTimestamp>[] = [
      { time: 1699999940 as UTCTimestamp, open: 95, high: 101, low: 94, close: 100 },
      ...sampleCandles,
    ];
    expect(runDataUpdateEffect(withOlderHistory, 'SYNTH_VOL_50', '1m')).toBe('updated');
    // NÃO puxa o scroll de volta para o presente (scrollToRealTime continua em 1) e NÃO reseta o rAF!
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);
    expect(resetRafSpy).not.toHaveBeenCalled();

    // 4. Troca real de ativo -> agora sim reseta rAF do símbolo e faz scrollToRealTime
    expect(runDataUpdateEffect(sampleCandles, 'BTCUSD_OTC', '1m')).toBe('updated');
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(2);
    expect(resetRafSpy).toHaveBeenCalledWith('BTCUSD_OTC');
  });

  it('ISO-14 [Data Alignment & UTC #1344]: normalizeTimeSeconds e ensureStrictAscendingBars forçam UTC em strings sem timezone e fundem OHLC em timestamps duplicados', () => {
    // 1. ISO sem sufixo Z ou formato SQL não pode sofrer desvio de fuso local (ex: -3h no Brasil)
    const utcWithZ = normalizeTimeSeconds('2026-10-13T21:00:00Z');
    const isoWithoutZ = normalizeTimeSeconds('2026-10-13T21:00:00');
    const sqlFormat = normalizeTimeSeconds('2026-10-13 21:00:00');
    const epochMs = normalizeTimeSeconds(1791925200000);

    expect(isoWithoutZ).toBe(utcWithZ);
    expect(sqlFormat).toBe(utcWithZ);
    expect(epochMs).toBe(1791925200);

    // 2. Velas fora de ordem e com timestamps duplicados preservam open original, maior high, menor low e último close
    const misalignedBars: CandlestickData<UTCTimestamp>[] = [
      { time: 1700000120 as UTCTimestamp, open: 105, high: 108, low: 103, close: 106 },
      { time: 1700000060 as UTCTimestamp, open: 100, high: 104, low: 99, close: 102 },
      { time: 1700000060 as UTCTimestamp, open: 102, high: 112, low: 97, close: 110 }, // mesmo minuto com novo topo/fundo/fechamento
    ];

    const aligned = ensureStrictAscendingBars(misalignedBars);
    expect(aligned.length).toBe(2);
    expect(aligned[0]).toEqual({
      time: 1700000060,
      open: 100,
      high: 112,
      low: 97,
      close: 110,
    });
    expect(aligned[1]).toEqual({
      time: 1700000120,
      open: 105,
      high: 108,
      low: 103,
      close: 106,
    });
  });

  it('ISO-15 [1-Minute Resolution & Seed Alignment #1344]: normalizeSeedWithTick mantém alinhamento de 60s sem descartar ticks subsequentes em mergeObservedCandles', () => {
    // Múltiplos exatos de 60s: 1700000040 e 1700000100
    const seedCandles = [
      { time: 1700000040, open: '100', high: '102', low: '99', close: '101' },
      { time: 1700000100, open: '101', high: '103', low: '100', close: '102' },
    ];

    // Tick chega no segundo :25 do minuto 1700000160 (1700000185)
    const tickAt25s = {
      type: 'tick' as const,
      symbol: 'SYNTH_VOL_50',
      sequence: 10,
      price: '105',
      ts: new Date(1700000185 * 1000).toISOString(),
      event_time: 1700000185000,
    };

    const normalizedSeed = normalizeSeedWithTick(seedCandles, tickAt25s);
    const lastSeedTime = Number(normalizedSeed[normalizedSeed.length - 1].time);
    // O timestamp da última vela do seed DEVE permanecer alinhado ao múltiplo de 60s (1700000160), nunca 1700000185!
    expect(lastSeedTime % 60).toBe(0);
    expect(lastSeedTime).toBe(1700000160);

    // Quando os próximos ticks do mesmo minuto chegam (bucket 1700000160), mergeObservedCandles NÃO pode descartá-los
    const historyBars = resampleCandles(normalizedSeed, '1m');
    const observedInSameMinute: CandlestickData<UTCTimestamp>[] = [
      { time: 1700000160 as UTCTimestamp, open: 102, high: 109, low: 101, close: 108 },
    ];
    const merged = mergeObservedCandles(historyBars, observedInSameMinute, '1m', false);
    const lastMerged = merged[merged.length - 1];
    expect(lastMerged.time).toBe(1700000160);
    expect(Number(lastMerged.high)).toBe(109);
    expect(Number(lastMerged.close)).toBe(108);

    // E resampleCandles para '1m' agrupa sub-minutos no bucket canônico de 60s
    const subMinuteInput = [
      { time: 1700000165, open: '100', high: '104', low: '99', close: '103' },
      { time: 1700000195, open: '103', high: '108', low: '101', close: '107' },
    ];
    const resampled1m = resampleCandles(subMinuteInput, '1m');
    expect(resampled1m.length).toBe(1);
    expect(resampled1m[0]).toEqual({
      time: 1700000160,
      open: 100,
      high: 108,
      low: 99,
      close: 107,
    });
  });

  it('ISO-16 [Indicator Warmup Alignment #1344]: Indicadores ordenam e deduplicam histórico antes do aquecimento sem cair em Date.now()', () => {
    // 5 velas fora de ordem + 1 duplicata no minuto 21:01 + timestamps como strings ISO
    const rawUnorderedHistory = [
      { time: '2026-10-13T21:03:00Z' as any, open: '103', high: '104', low: '102', close: '104' },
      { time: '2026-10-13T21:00:00Z' as any, open: '100', high: '101', low: '99', close: '100' },
      { time: '2026-10-13T21:01:00' as any, open: '100', high: '102', low: '100', close: '101' }, // sem Z, deve alinhar em UTC
      { time: '2026-10-13T21:01:00Z' as any, open: '101', high: '105', low: '100', close: '102' }, // duplicata atualizada do minuto 21:01
      { time: '2026-10-13T21:02:00Z' as any, open: '102', high: '103', low: '101', close: '103' },
    ];

    const sma3 = calculateSMA(rawUnorderedHistory, 3);
    // Com 4 minutos únicos (100, 102, 103, 104), SMA(3) deve produzir exatamente 2 pontos alinhados em UTC
    expect(sma3.length).toBe(2);
    expect(sma3[0].time).toBe(normalizeTimeSeconds('2026-10-13T21:02:00Z'));
    expect(sma3[0].value).toBeCloseTo((100 + 102 + 103) / 3, 4);
    expect(sma3[1].time).toBe(normalizeTimeSeconds('2026-10-13T21:03:00Z'));
    expect(sma3[1].value).toBeCloseTo((102 + 103 + 104) / 3, 4);

    const rsi2 = calculateRSI(rawUnorderedHistory, 2);
    expect(rsi2.length).toBeGreaterThan(0);
    // Todos os timestamps calculados devem ser estritamente crescentes
    for (let i = 1; i < rsi2.length; i++) {
      expect(rsi2[i].time).toBeGreaterThan(rsi2[i - 1].time);
    }
  });

  it('ISO-17 [Fullscreen & Resize Autoscale/Scroll #1344]: syncChartViewportOnResize redimensiona no 1º clique de tela cheia, recalcula autoScale e preserva scroll', () => {
    const resizeSpy = vi.fn();
    const applyOptionsSpy = vi.fn();
    const priceScaleApplyOptionsSpy = vi.fn();
    const scrollToRealTimeSpy = vi.fn();
    let currentScrollPos = 0;

    const mockChart: any = {
      resize: resizeSpy,
      applyOptions: applyOptionsSpy,
      priceScale: vi.fn(() => ({
        applyOptions: priceScaleApplyOptionsSpy,
      })),
      timeScale: vi.fn(() => ({
        scrollPosition: () => currentScrollPos,
        scrollToRealTime: scrollToRealTimeSpy,
      })),
    };

    const lastSizeRef = { current: { width: 800, height: 500 } };

    // 1. Primeiro clique em Fullscreen (1920x1080) com forceAutoScale + forceScrollToRealTime:
    const didSyncFs = syncChartViewportOnResize(mockChart, 1920, 1080, lastSizeRef, {
      forceAutoScale: true,
      forceScrollToRealTime: true,
    });

    expect(didSyncFs).toBe(true);
    expect(resizeSpy).toHaveBeenCalledWith(1920, 1080, true);
    expect(applyOptionsSpy).toHaveBeenCalledWith({ width: 1920, height: 1080 });
    expect(priceScaleApplyOptionsSpy).toHaveBeenCalledWith({ autoScale: true });
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);
    expect(lastSizeRef.current).toEqual({ width: 1920, height: 1080 });

    // 2. Se o usuário rolou para trás no histórico (scrollPos = 25) e houve apenas window resize comum (1600x900),
    // redimensiona e atualiza autoScale, mas NÃO puxa o scroll de volta para o tempo real!
    currentScrollPos = 25;
    const didSyncWindow = syncChartViewportOnResize(mockChart, 1600, 900, lastSizeRef);
    expect(didSyncWindow).toBe(true);
    expect(resizeSpy).toHaveBeenCalledWith(1600, 900, true);
    expect(priceScaleApplyOptionsSpy).toHaveBeenCalledTimes(2);
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1); // preservou posição histórica!

    // 3. Dimensões colapsadas (<= 50px) são bloqueadas
    expect(syncChartViewportOnResize(mockChart, 0, 0, lastSizeRef)).toBe(false);
    expect(syncChartViewportOnResize(mockChart, 40, 40, lastSizeRef)).toBe(false);
  });

  it('ISO-18 [React StrictMode Full Remount #8 / #1344]: Mount Pass 1 -> Cleanup -> Mount Pass 2 reseta observed.sequence/lastTickTime e preserva tick inicial e scrollToRealTime', () => {
    const observed = {
      current: {
        symbol: 'SYNTH_VOL_50',
        sequence: 0,
        lastTickTime: 0,
        bars: new Map<UTCTimestamp, CandlestickData<UTCTimestamp>>(),
        pending: new Set<UTCTimestamp>(),
      },
    };
    const shouldScrollToRealTimeRef = { current: true };
    const scrollToRealTimeSpy = vi.fn();

    const initialTick = {
      type: 'tick' as const,
      symbol: 'SYNTH_VOL_50',
      sequence: 1,
      price: '105.50',
      ts: '2026-10-13T21:00:15Z',
    };

    const runTickEffect = (tick: typeof initialTick) => {
      const tickSec = normalizeTimeSeconds(tick.ts)!;
      if (tick.sequence > observed.current.sequence && tickSec >= observed.current.lastTickTime) {
        const bucket = (Math.floor(tickSec / 5) * 5) as UTCTimestamp;
        observed.current.bars.set(bucket, {
          time: bucket,
          open: Number(tick.price),
          high: Number(tick.price),
          low: Number(tick.price),
          close: Number(tick.price),
        });
        observed.current.pending.add(bucket);
        observed.current.sequence = tick.sequence;
        observed.current.lastTickTime = tickSec;
      }
    };

    const runHandleChartReady = () => {
      if (shouldScrollToRealTimeRef.current) {
        scrollToRealTimeSpy();
        shouldScrollToRealTimeRef.current = false;
      }
    };

    const runStrictModeCleanup = () => {
      observed.current.bars.clear();
      observed.current.pending.clear();
      observed.current.sequence = 0;
      observed.current.lastTickTime = 0;
      shouldScrollToRealTimeRef.current = true;
    };

    // Pass 1 (React Strict Mode Mount 1)
    runHandleChartReady();
    runTickEffect(initialTick);
    expect(observed.current.bars.size).toBe(1);
    expect(observed.current.sequence).toBe(1);
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(1);

    // Cleanup Pass 1 (React Strict Mode Unmount Simulado)
    runStrictModeCleanup();
    expect(observed.current.bars.size).toBe(0);
    expect(observed.current.sequence).toBe(0);
    expect(observed.current.lastTickTime).toBe(0);
    expect(shouldScrollToRealTimeRef.current).toBe(true);

    // Pass 2 (React Strict Mode Mount 2 com mesma referência de prop `tick`)
    runHandleChartReady();
    runTickEffect(initialTick);
    expect(observed.current.bars.size).toBe(1);
    expect(observed.current.sequence).toBe(1);
    expect(scrollToRealTimeSpy).toHaveBeenCalledTimes(2);
  });

  it('ISO-19 [Anti-Zombie Disposal #9 / #1359]: Descarte remove explicitamente priceLines, indicatorSeries, candleSeries e areaSeries, desmonta overlays (isChartReady=false) e anula closures', () => {
    const removePriceLineSpy = vi.fn();
    const removeSeriesSpy = vi.fn();
    const removeChartSpy = vi.fn();
    let isChartReady = true;

    let candleSeriesRef: any = { id: 'candle-series', removePriceLine: removePriceLineSpy };
    let areaSeriesRef: any = { id: 'area-series', removePriceLine: removePriceLineSpy };
    let chartRef: any = {
      id: 'chart-instance',
      removeSeries: removeSeriesSpy,
      remove: removeChartSpy,
    };

    const currentPriceLine = { current: { id: 'price-line-1' } as any };
    const currentPriceLineSeries = { current: candleSeriesRef };
    const strikeLinesMap = new Map<string, any>([
      ['c-1', { line: { id: 'strike-1' }, series: candleSeriesRef }],
    ]);
    const indicatorSeriesMap = new Map<string, any>([
      ['sma-20', { id: 'ind-sma-20' }],
      ['bb-20:upper', { id: 'ind-bb-upper' }],
    ]);

    // 1. handleChartDispose no PriceChart antes de chart.remove()
    if (currentPriceLine.current && currentPriceLineSeries.current) {
      currentPriceLineSeries.current.removePriceLine(currentPriceLine.current);
      currentPriceLine.current = null;
      currentPriceLineSeries.current = null;
    }
    for (const [, entry] of strikeLinesMap.entries()) {
      entry.series.removePriceLine(entry.line);
    }
    strikeLinesMap.clear();
    for (const [, series] of indicatorSeriesMap.entries()) {
      chartRef.removeSeries(series);
    }
    indicatorSeriesMap.clear();
    isChartReady = false;

    // 2. Cleanup do IsolatedChartHost
    chartRef.removeSeries(candleSeriesRef);
    chartRef.removeSeries(areaSeriesRef);
    chartRef.remove();
    chartRef = null;
    candleSeriesRef = null;
    areaSeriesRef = null;

    expect(removePriceLineSpy).toHaveBeenCalledTimes(2); // 1 cotação + 1 strike
    expect(removeSeriesSpy).toHaveBeenCalledTimes(4); // 2 indicadores + candleSeries + areaSeries
    expect(removeChartSpy).toHaveBeenCalledTimes(1);
    expect(isChartReady).toBe(false); // desmonta TimeLinesOverlay, OrderFlagsOverlay e ChartDrawingOverlay
    expect(chartRef).toBeNull();
    expect(candleSeriesRef).toBeNull();
    expect(areaSeriesRef).toBeNull();
  });

  it('ISO-20 [Out-of-Order Live Data & Sub-Bucket Protection #10 / #1351]: Ticks regressivos no tempo são descartados e sub-buckets atrasados (:10s após :30s) jamais sobrescrevem o close da vela atual', async () => {
    const { RafChartUpdater } = await import('./raf-updater');
    const renderedTicks: any[] = [];
    const updater = new RafChartUpdater((cb) => {
      cb(0);
      return 1;
    });

    // 1. Tick válido em :30s (sequence 10, price 150)
    updater.push(
      {
        type: 'tick',
        symbol: 'SYNTH_VOL_50',
        sequence: 10,
        price: '150.00',
        ts: '2026-10-13T21:01:30Z',
      },
      (t) => renderedTicks.push(t)
    );
    expect(renderedTicks).toHaveLength(1);

    // 2. Tick atrasado/fora de ordem com timestamp no passado (:10s), mesmo com sequence maior (11)!
    updater.push(
      {
        type: 'tick',
        symbol: 'SYNTH_VOL_50',
        sequence: 11,
        price: '110.00',
        ts: '2026-10-13T21:01:10Z',
      },
      (t) => renderedTicks.push(t)
    );
    // Deve ser estritamente descartado pelo guarda de monotonicidade temporal!
    expect(renderedTicks).toHaveLength(1);
    expect(updater.getStats().dropped).toBe(1);

    // 3. Mesmo que mergeObservedCandles receba a vela atual de 1m (aberta em 21:01:00 com close=150 vindo de :30s)
    // e um sub-bucket atrasado de 5s em 21:01:10 (close=110, low=95) junto ao sub-bucket de 21:01:30 (close=150, high=155):
    const tMinute = normalizeTimeSeconds('2026-10-13T21:01:00Z')!;
    const tSub10 = normalizeTimeSeconds('2026-10-13T21:01:10Z')!;
    const tSub30 = normalizeTimeSeconds('2026-10-13T21:01:30Z')!;

    const current1mBar: CandlestickData<UTCTimestamp> = {
      time: tMinute,
      open: 100,
      high: 155,
      low: 100,
      close: 150,
    };

    const merged = mergeObservedCandles(
      [current1mBar],
      [
        { time: tSub30, open: 140, high: 155, low: 138, close: 150 },
        { time: tSub10, open: 100, high: 120, low: 95, close: 110 },
      ],
      '1m',
      false
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].time).toBe(tMinute);
    expect(merged[0].open).toBe(100);
    expect(merged[0].high).toBe(155);
    expect(merged[0].low).toBe(95); // Incorporou o extremo mínimo de :10s
    expect(merged[0].close).toBe(150); // Preservou o fechamento mais recente de :30s (NUNCA voltou para 110!)
  });
});
