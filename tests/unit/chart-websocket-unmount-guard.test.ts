import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { TradingFeedManager } from '../../apps/web/src/feed/TradingFeedManager';

describe('[ANTI-ZOMBIE-WEBSOCKET] Certificação Contra WebSocket e Loops de Streaming Rodando Após Unmount (Issues #1341 / #1351)', () => {
  it('WS-UNMOUNT-01: IsolatedChartHost invoca onChartDispose sincronicamente no unmount e bloqueia qualquer acesso ao contexto 2D/WebGL destruído (Cannot read properties of null reading getContext)', () => {
    const code = ts.transpileModule(
      readFileSync(resolve('apps/web/src/chart/IsolatedChartHost.tsx'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }
    ).outputText;

    let isChartRemoved = false;
    let disposeCallbackCount = 0;
    let resizeObserverCb: ((entries: any[]) => void) | null = null;
    let rafCb: (() => void) | null = null;
    const visibilityListeners: Array<() => void> = [];
    const cleanups: Array<() => void> = [];

    const throwIfRemoved = (methodName: string) => {
      if (isChartRemoved) {
        throw new TypeError(`Cannot read properties of null (reading 'getContext') [${methodName}]`);
      }
    };

    const hostEl = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: hostEl.clientWidth, height: hostEl.clientHeight }),
      querySelector: () => null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let firstRef = true;
    const react = {
      memo: (fn: any) => fn,
      forwardRef: (fn: any) => fn,
      useRef: (init: any) => {
        const r = { current: firstRef ? hostEl : init };
        firstRef = false;
        return r;
      },
      useCallback: (fn: any) => fn,
      useImperativeHandle: vi.fn(),
      useEffect: (fn: () => any) => {
        const c = fn();
        if (typeof c === 'function') cleanups.push(c);
      },
      createElement: () => null,
    };

    const chartApi = {
      addCandlestickSeries: () => ({
        setData: () => throwIfRemoved('candleSeries.setData'),
        update: () => throwIfRemoved('candleSeries.update'),
        applyOptions: () => throwIfRemoved('candleSeries.applyOptions'),
        data: () => [],
        options: () => ({ visible: true }),
      }),
      addAreaSeries: () => ({
        setData: () => throwIfRemoved('areaSeries.setData'),
        update: () => throwIfRemoved('areaSeries.update'),
        applyOptions: () => throwIfRemoved('areaSeries.applyOptions'),
        data: () => [],
        options: () => ({ visible: false }),
      }),
      priceScale: () => ({
        applyOptions: () => throwIfRemoved('priceScale.applyOptions'),
      }),
      timeScale: () => ({
        applyOptions: () => throwIfRemoved('timeScale.applyOptions'),
        scrollToRealTime: () => throwIfRemoved('timeScale.scrollToRealTime'),
      }),
      applyOptions: () => throwIfRemoved('chart.applyOptions'),
      remove: () => {
        isChartRemoved = true;
      },
    };

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') {
          return {
            ColorType: { Solid: 'solid' },
            createChart: () => chartApi,
          };
        }
        if (name.includes('candle-adapter')) return { isSubMinuteTimeframe: () => false };
        if (name.includes('bar-sanitizer')) return { ensureStrictAscendingBars: (c: any[]) => c };
        if (name.includes('assets')) return { getAssetMeta: () => ({ precision: 4 }) };
        return {};
      },
      module: mod,
      exports: mod.exports,
      ResizeObserver: class {
        constructor(cb: (entries: any[]) => void) {
          resizeObserverCb = cb;
        }
        observe() {}
        disconnect() {}
      },
      requestAnimationFrame: (cb: () => void) => {
        rafCb = cb;
        return 101;
      },
      cancelAnimationFrame: vi.fn(),
      document: {
        hidden: false,
        addEventListener: (_ev: string, cb: () => void) => visibilityListeners.push(cb),
        removeEventListener: vi.fn(),
      },
      console,
    });

    const { IsolatedChartHost } = mod.exports;

    IsolatedChartHost(
      {
        candles: [{ time: 1700000000, open: 100, high: 105, low: 95, close: 102 }],
        chartType: 'candles',
        timeframe: '1m',
        symbol: 'SYNTH_VOL_50',
        onChartDispose: () => {
          disposeCallbackCount++;
        },
      },
      null
    );

    expect(isChartRemoved).toBe(false);
    expect(disposeCallbackCount).toBe(0);

    // Desmonta o componente -> deve invocar onChartDispose() e chart.remove()
    for (const cleanup of cleanups) cleanup();

    expect(disposeCallbackCount).toBe(1);
    expect(isChartRemoved).toBe(true);

    // Simula eventos atrasados (ResizeObserver, rAF em voo, visibilitychange) após o unmount:
    // NENHUM deles pode tocar no chart removido ou lançar TypeError (getContext of null)
    hostEl.clientWidth = 900;
    hostEl.clientHeight = 500;
    expect(() => {
      resizeObserverCb?.([{ contentRect: { width: 900, height: 500 } }]);
      rafCb?.();
      for (const l of visibilityListeners) l();
    }).not.toThrow();
  });

  it('WS-UNMOUNT-02: PriceChart cancela imediatamente o RafChartUpdater quando onChartDispose / unmount ocorre, impedindo que ticks WebSocket em voo chamem series.update() após chart.remove()', () => {
    const code = ts.transpileModule(
      readFileSync(resolve('apps/web/src/chart/PriceChart.tsx'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }
    ).outputText;

    let isDisposed = false;
    let seriesUpdateCallsAfterDispose = 0;
    let pendingRafCallback: ((ts: number) => void) | null = null;
    let rafCancelledCount = 0;
    let capturedOnChartDispose: (() => void) | null = null;

    const candleSeries = {
      update: () => {
        if (isDisposed) {
          seriesUpdateCallsAfterDispose++;
          throw new TypeError("Cannot read properties of null (reading 'getContext')");
        }
      },
      createPriceLine: () => ({ applyOptions: vi.fn() }),
      removePriceLine: vi.fn(),
    };

    const areaSeries = {
      update: () => {
        if (isDisposed) {
          seriesUpdateCallsAfterDispose++;
          throw new TypeError("Cannot read properties of null (reading 'getContext')");
        }
      },
      createPriceLine: () => ({ applyOptions: vi.fn() }),
      removePriceLine: vi.fn(),
    };

    const chart = {
      addLineSeries: () => ({ setData: vi.fn() }),
      removeSeries: vi.fn(),
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({
        scrollToRealTime: vi.fn(),
        subscribeVisibleLogicalRangeChange: vi.fn(),
        unsubscribeVisibleLogicalRangeChange: vi.fn(),
      }),
    };

    const refs: { current: any }[] = [];
    const states: any[] = [];
    let refCursor = 0;
    let stateCursor = 0;
    const cleanups: Array<() => void> = [];

    const react = {
      useRef: (init: any) => {
        if (!refs[refCursor]) refs[refCursor] = { current: init };
        return refs[refCursor++];
      },
      useState: (init: any) => {
        const idx = stateCursor++;
        if (!(idx in states)) {
          states[idx] = typeof init === 'function' ? init() : init;
        }
        return [states[idx], (v: any) => { states[idx] = typeof v === 'function' ? v(states[idx]) : v; }];
      },
      useCallback: (fn: any) => fn,
      useMemo: (fn: () => any) => fn(),
      useEffect: (fn: () => any) => {
        const c = fn();
        if (typeof c === 'function') cleanups.push(c);
      },
      createElement: (comp: any, props: any) => {
        if (comp === 'IsolatedChartHost' && props) {
          capturedOnChartDispose = props.onChartDispose;
          if (props.onChartReady && !isDisposed) {
            props.onChartReady({
              chart,
              activeSeries: candleSeries,
              candleSeries,
              areaSeries,
              timeScale: chart.timeScale(),
            });
          }
        }
        return null;
      },
      Fragment: 'Fragment',
    };

    // Importa RafChartUpdater real injetando rAF assíncrono controlado
    const rafUpdaterCode = ts.transpileModule(
      readFileSync(resolve('apps/web/src/chart/raf-updater.ts'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }
    ).outputText;

    const rafMod = { exports: {} as any };
    runInNewContext(rafUpdaterCode, {
      require: () => ({}),
      module: rafMod,
      exports: rafMod.exports,
      window: {
        requestAnimationFrame: (cb: (ts: number) => void) => {
          pendingRafCallback = cb;
          return 555;
        },
        cancelAnimationFrame: () => {
          rafCancelledCount++;
          pendingRafCallback = null;
        },
      },
      performance: { now: () => 1000 },
      BigInt,
    });

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') return { LineStyle: { Dashed: 2, Dotted: 1, Solid: 0 } };
        if (name.includes('client')) return { fetchHistoricalCandlesChunk: async () => [] };
        if (name.includes('money')) return { formatMinor: () => '$10', formatCurrencyBinmax: () => '$10' };
        if (name.includes('candle-adapter')) {
          return {
            candleData: () => [],
            candleFromTick: () => null,
            resampleCandles: (c: any[]) => c,
            timeframeSeconds: () => 60,
            isSubMinuteTimeframe: () => false,
          };
        }
        if (name.includes('chart-scale-normalizer')) {
          return {
            mergeObservedCandles: (_b: any[], obs: any[]) => obs,
            safeCandleFromTick: () => ({ time: 1700000000, open: 100, high: 101, low: 99, close: 101 }),
          };
        }
        if (name.includes('IsolatedChartHost')) return { IsolatedChartHost: 'IsolatedChartHost' };
        if (name.includes('TimeLinesOverlay')) return { TimeLinesOverlay: () => null };
        if (name.includes('OrderFlagsOverlay')) return { OrderFlagsOverlay: () => null };
        if (name.includes('TradersMoodBar')) return { TradersMoodBar: () => null };
        if (name.includes('useTickPulse')) return { useTickPulse: () => 'NEUTRAL' };
        if (name.includes('raf-updater')) return rafMod.exports;
        if (name.includes('ChartDrawingToolbar')) return { ChartDrawingToolbar: () => null };
        if (name.includes('ChartDrawingOverlay')) return { ChartDrawingOverlay: () => null };
        if (name.includes('feature-flags')) return { isNewTraderoomEnabled: () => true };
        if (name.includes('traderoom-polish')) return { isTraderoomPolishEnabled: () => false };
        if (name.includes('assets')) return { ASSET_CATALOG: [], isSameAsset: (a: string, b: string) => a === b };
        if (name.includes('AssetFlagBadge')) return { AssetFlagBadge: () => null };
        if (name.includes('drawing-types')) return { DEFAULT_INDICATORS: [] };
        if (name.includes('drawing-sanitizer')) return { loadSafeDrawings: () => [], saveSafeDrawings: () => {} };
        if (name.includes('indicator-calculator')) {
          return {
            calculateSMA: () => [],
            calculateEMA: () => [],
            calculateWMA: () => [],
            calculateBollinger: () => [],
            calculateRSI: () => [],
            calculateMACD: () => [],
            calculateStochastic: () => [],
            calculateATR: () => [],
            calculateVWAP: () => [],
            calculateCCI: () => [],
          };
        }
        return {};
      },
      module: mod,
      exports: mod.exports,
      React: react,
      window: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
      setInterval: () => 1,
      clearInterval: vi.fn(),
      console,
    });

    const { PriceChart } = mod.exports;

    // 1. Mount inicial (onChartReady preenche chartInstance.current) e em seguida recebe tick via WebSocket
    refCursor = 0;
    stateCursor = 0;
    PriceChart({
      candles: [],
      tick: null,
      symbol: 'SYNTH_VOL_50',
      activeContracts: [],
    });

    refCursor = 0;
    stateCursor = 0;
    PriceChart({
      candles: [],
      tick: { symbol: 'SYNTH_VOL_50', price: '101.50', sequence: 10, ts: new Date().toISOString() },
      symbol: 'SYNTH_VOL_50',
      activeContracts: [],
    });

    expect(pendingRafCallback).not.toBeNull();
    expect(capturedOnChartDispose).not.toBeNull();

    // 2. O componente desmonta ANTES do frame rAF executar (ex: usuário saiu da tela)
    isDisposed = true;
    capturedOnChartDispose!();
    for (const c of cleanups) c();

    // O rAF pendente foi cancelado sincronicamente e nunca chamou series.update() no chart destruído
    expect(rafCancelledCount).toBeGreaterThanOrEqual(1);
    expect(pendingRafCallback).toBeNull();
    expect(seriesUpdateCallsAfterDispose).toBe(0);
  });

  it('WS-UNMOUNT-03: TradingFeedManager para envios ao desmontar (unsubscribeSymbol / disconnect), cancela timers iniciais e aborta snapshots em voo', async () => {
    const manager = new TradingFeedManager('ws://localhost:39998/ws');
    const sentFrames: any[] = [];
    let fetchResolver: ((val: any) => void) | null = null;

    const origFetch = globalThis.fetch;
    globalThis.fetch = (() =>
      new Promise((res) => {
        fetchResolver = res;
      })) as any;

    try {
      const fakeSocket: any = {
        readyState: 1, // WebSocket.OPEN
        send: (raw: string) => sentFrames.push(JSON.parse(raw)),
        close: vi.fn(),
      };
      (manager as any).socket = fakeSocket;
      (manager as any).connected = true;
      (manager as any).closed = false;

      const receivedTicks: any[] = [];
      const unsubscribe = manager.subscribeSymbol('SYNTH_VOL_50', (tick) => {
        receivedTicks.push(tick);
      });

      // Deve ter enviado subscribe inicial
      expect(sentFrames).toContainEqual({ type: 'subscribe', symbol: 'SYNTH_VOL_50' });

      // 1. Dispara um rebuild de snapshot em voo (ex: gap detectado)
      const rebuildPromise = manager.triggerSnapshotRebuild('SYNTH_VOL_50', {
        type: 'tick',
        symbol: 'SYNTH_VOL_50',
        sequence: 50,
        price: '125.00',
        ts: new Date().toISOString(),
      });

      // 2. O componente desmonta ENQUANTO o snapshot HTTP ainda está em voo!
      unsubscribe();

      // Deve ter enviado frame unsubscribe para o servidor WebSocket
      expect(sentFrames).toContainEqual({ type: 'unsubscribe', symbol: 'SYNTH_VOL_50' });
      expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(0);

      // 3. O fetch do snapshot resolve ATRASADO (depois que o componente já desmontou)
      expect(fetchResolver).not.toBeNull();
      fetchResolver!({
        ok: true,
        json: async () => ({
          sequence: 49,
          price: '124.80',
          ts: new Date().toISOString(),
        }),
      });
      await rebuildPromise;

      // 4. Chegam mais ticks ao vivo pelo WebSocket para SYNTH_VOL_50
      (manager as any).applyTick({
        type: 'tick',
        symbol: 'SYNTH_VOL_50',
        sequence: 51,
        price: '125.50',
        ts: new Date().toISOString(),
      });

      // O componente desmontado NUNCA recebeu nenhum tick pós-unmount!
      expect(receivedTicks).toHaveLength(0);
    } finally {
      globalThis.fetch = origFetch;
      manager.disconnect();
    }
  });
});
