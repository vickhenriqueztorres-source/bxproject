import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { TradingFeedManager } from '../../apps/web/src/feed/TradingFeedManager';

describe('[ANTI-MEMORY-LEAK] Certificação de Ciclo de Vida, Limpeza de Referências e Teto de RAM (Issues #1507 / #1359)', () => {
  it('ML-01: 50 ciclos consecutivos de mount/unmount do IsolatedChartHost invocam chart.remove(), desconectam ResizeObserver, removem listeners WebGL e anulam todas as refs (Issue #1359)', () => {
    let createChartCount = 0;
    let removeChartCount = 0;
    let resizeDisconnectCount = 0;
    let webglListenersRemoved = 0;

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

    let currentRefs: { current: any }[] = [];
    let currentCleanups: Array<() => void> = [];
    let imperativeHandle: any = null;
    let firstRef = true;

    const hostElement = {
      clientWidth: 1000,
      clientHeight: 600,
      querySelector: () => null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(() => {
        webglListenersRemoved++;
      }),
    };

    const react = {
      memo: (fn: any) => fn,
      forwardRef: (fn: any) => fn,
      useRef: (initial: any) => {
        const r = { current: firstRef ? hostElement : initial };
        firstRef = false;
        currentRefs.push(r);
        return r;
      },
      useCallback: (fn: any) => fn,
      useImperativeHandle: (_ref: any, create: () => any) => {
        imperativeHandle = create();
      },
      useEffect: (effect: () => any) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          currentCleanups.push(cleanup);
        }
      },
      createElement: (_tag: any, props: any) => {
        if (props?.ref) {
          props.ref.current = hostElement;
        }
        return null;
      },
    };

    const chartApi = {
      addCandlestickSeries: () => ({
        setData: vi.fn(),
        applyOptions: vi.fn(),
        data: () => [],
        options: () => ({ visible: true }),
      }),
      addAreaSeries: () => ({
        setData: vi.fn(),
        applyOptions: vi.fn(),
        data: () => [],
        options: () => ({ visible: false }),
      }),
      priceScale: () => ({ applyOptions: vi.fn() }),
      timeScale: () => ({ applyOptions: vi.fn(), scrollToRealTime: vi.fn() }),
      applyOptions: vi.fn(),
      remove: () => {
        removeChartCount++;
      },
    };

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') {
          return {
            ColorType: { Solid: 'solid' },
            createChart: () => {
              createChartCount++;
              return chartApi;
            },
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
        observe() {}
        disconnect() {
          resizeDisconnectCount++;
        }
      },
      document: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      setTimeout,
      clearTimeout,
      console,
    });

    const IsolatedChartHost = mod.exports.IsolatedChartHost;
    const candles = Array.from({ length: 100 }, (_, i) => ({
      time: 1700000000 + i * 60,
      open: 100,
      high: 105,
      low: 95,
      close: 102,
    }));

    for (let cycle = 0; cycle < 50; cycle++) {
      currentRefs = [];
      currentCleanups = [];
      imperativeHandle = null;
      firstRef = true;

      IsolatedChartHost({
        candles,
        chartType: 'candles',
        timeframe: '1m',
        symbol: 'SYNTH_VOL_50',
      });

      // Antes do unmount, o chart está vivo nas refs
      expect(imperativeHandle.getChart()).toBe(chartApi);
      expect(imperativeHandle.getCandleSeries()).not.toBeNull();
      expect(imperativeHandle.getAreaSeries()).not.toBeNull();

      // Executa todos os cleanups de unmount
      for (const cleanup of currentCleanups) {
        cleanup();
      }

      // Pós-condição Issue #1359: NENHUMA referência ao chart, séries ou array de velas pode permanecer retida!
      expect(imperativeHandle.getChart()).toBeNull();
      expect(imperativeHandle.getCandleSeries()).toBeNull();
      expect(imperativeHandle.getAreaSeries()).toBeNull();
      expect(currentRefs[4].current).toEqual([]);
    }

    expect(createChartCount).toBe(50);
    expect(removeChartCount).toBe(50);
    expect(resizeDisconnectCount).toBe(50);
    expect(webglListenersRemoved).toBe(100); // 2 listeners WebGL por ciclo (lost + restored)
  });

  it('ML-02 & ML-03: PriceChart remove linhas de strike da série correta ao alternar candles <-> line e limpa todos os Maps e buffers no unmount', () => {
    const candleLines = new Set<any>();
    const areaLines = new Set<any>();
    const indicatorSeriesSet = new Set<any>();
    const logicalRangeSubs = new Set<any>();

    const makeSeries = (kind: 'candles' | 'area', lineSet: Set<any>) => ({
      kind,
      setData: vi.fn(),
      update: vi.fn(),
      applyOptions: vi.fn(),
      createPriceLine: vi.fn((opts: any) => {
        const line = { ...opts, kind, applyOptions: vi.fn() };
        lineSet.add(line);
        return line;
      }),
      removePriceLine: vi.fn((line: any) => {
        if (!lineSet.has(line)) {
          throw new Error(`Orphan leak: tried to remove line from ${kind} but it belonged to ${line.kind}`);
        }
        lineSet.delete(line);
      }),
    });

    const candleSeries = makeSeries('candles', candleLines);
    const areaSeries = makeSeries('area', areaLines);
    const timeScale = {
      scrollToRealTime: vi.fn(),
      subscribeVisibleLogicalRangeChange: vi.fn((cb: any) => logicalRangeSubs.add(cb)),
      unsubscribeVisibleLogicalRangeChange: vi.fn((cb: any) => logicalRangeSubs.delete(cb)),
    };
    const chart = {
      timeScale: () => timeScale,
      priceScale: () => ({ applyOptions: vi.fn() }),
      addLineSeries: vi.fn(() => {
        const s = { setData: vi.fn() };
        indicatorSeriesSet.add(s);
        return s;
      }),
      removeSeries: vi.fn((s: any) => {
        indicatorSeriesSet.delete(s);
      }),
    };

    const values: any[] = [];
    const refs: { current: any }[] = [];
    const deps: any[][] = [];
    const memo: { deps: any[]; value: any }[] = [];
    const cleanups: Array<(() => void) | undefined> = [];
    let si = 0, ri = 0, ei = 0, mi = 0, dirty = false;
    let effects: Array<() => void> = [];
    let hostProps: any = undefined;
    let toolbar: Record<string, (v: any) => void> = {};

    const compute = (fn: () => any, keys: any[]) => {
      const index = mi++, previous = memo[index];
      if (!previous || keys.some((v, i) => v !== previous.deps[i])) memo[index] = { deps: keys, value: fn() };
      return memo[index].value;
    };

    const jsx = (tag: any, props: Record<string, any>) => {
      if (tag === 'TOOLBAR') toolbar = props as any;
      if (tag === 'HOST') {
        if (!hostProps || hostProps.chartType !== props.chartType) {
          props.onChartReady({
            chart,
            candleSeries,
            areaSeries,
            timeScale,
            activeSeries: props.chartType === 'candles' ? candleSeries : areaSeries,
          });
        }
        hostProps = props;
      }
      return null;
    };

    const react = {
      useRef: (v: any) => (refs[ri++] ??= { current: v }),
      useMemo: compute,
      useCallback: (fn: () => any, keys: any[]) => compute(() => fn, keys),
      useState: (initial: any) => {
        const index = si++;
        if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
        return [
          values[index],
          (next: any) => {
            const value = typeof next === 'function' ? next(values[index]) : next;
            if (!Object.is(value, values[index])) {
              values[index] = value;
              dirty = true;
            }
          },
        ];
      },
      useEffect: (effect: () => any, keys: any[]) => {
        const index = ei++, previous = deps[index];
        if (!previous || keys.some((v, i) => v !== previous[i])) {
          effects.push(() => {
            if (typeof cleanups[index] === 'function') cleanups[index]!();
            cleanups[index] = effect();
          });
        }
        deps[index] = keys;
      },
    };

    const modules = new Map<string, Record<string, any>>();
    function load(file: string): Record<string, any> {
      if (modules.has(file)) return modules.get(file)!;
      const mod = { exports: {} as Record<string, any> };
      modules.set(file, mod.exports);
      const localRequire = (name: string): any => {
        if (name === 'react') return react;
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'FRAGMENT' };
        if (name === 'lightweight-charts') return { LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 } };
        if (name.endsWith('IsolatedChartHost')) return { IsolatedChartHost: 'HOST' };
        if (name.endsWith('ChartDrawingToolbar')) return { ChartDrawingToolbar: 'TOOLBAR' };
        if (name.endsWith('drawing-types')) {
          return {
            DEFAULT_INDICATORS: [
              { id: 'sma-20', type: 'SMA', period: 20, color: '#3b82f6', enabled: true },
            ],
          };
        }
        if (name.endsWith('drawing-sanitizer')) return { loadSafeDrawings: () => [], saveSafeDrawings: () => {} };
        if (name.endsWith('useTickPulse')) return { useTickPulse: () => null };
        if (name.endsWith('feature-flags')) return { isNewTraderoomEnabled: () => true };
        if (name.endsWith('api/client')) return { fetchHistoricalCandlesChunk: async () => [] };
        if (name.endsWith('money')) return { formatMinor: () => '$10', formatCurrencyBinmax: () => '$10' };
        if (name.endsWith('indicator-calculator')) {
          return {
            calculateSMA: () => [{ time: 1700000000, value: 100 }],
          };
        }
        if (!/^(candle-adapter|chart-scale-normalizer|raf-updater|assets)$/.test(basename(name))) return {};
        const target = resolve(dirname(file), name);
        return load(existsSync(`${target}.ts`) ? `${target}.ts` : `${target}.tsx`);
      };
      const code = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText;
      runInNewContext(code, {
        console,
        performance: { now: () => 0 },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout,
        clearTimeout,
        window: {
          requestAnimationFrame: (cb: () => void) => {
            cb();
            return 1;
          },
          cancelAnimationFrame: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        },
        require: localRequire,
        module: mod,
        exports: mod.exports,
      });
      return mod.exports;
    }

    const PriceChartComp = load(resolve('apps/web/src/chart/PriceChart.tsx')).PriceChart;
    const baseCandles = [
      { time: 1700000000, open: '100', high: '105', low: '95', close: '102', volume: 10 },
    ];
    const openContracts = [
      {
        id: 'c-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 1000,
        strike_price: 101.5,
        status: 'OPEN',
      },
      {
        id: 'c-2',
        symbol: 'SYNTH_VOL_50',
        direction: 'DOWN',
        stake_minor: 2000,
        strike_price: 102.5,
        status: 'OPEN',
      },
    ];

    let currentProps: any = {
      candles: baseCandles,
      tick: { type: 'tick', symbol: 'SYNTH_VOL_50', sequence: 1, price: '102.10', ts: '2026-10-13T19:00:01Z' },
      symbol: 'SYNTH_VOL_50',
      activeContracts: openContracts,
    };

    const render = (nextProps = currentProps) => {
      currentProps = nextProps;
      let attempts = 0;
      do {
        si = ri = ei = mi = 0;
        dirty = false;
        effects = [];
        PriceChartComp(currentProps);
        effects.forEach((f) => f());
        if (++attempts > 15) throw new Error('Render loop exceeded');
      } while (dirty);
    };

    render();

    // Em candles: 1 linha de cotação + 2 linhas de strike = 3 em candleLines, 0 em areaLines
    expect(candleLines.size).toBe(3);
    expect(areaLines.size).toBe(0);
    expect(indicatorSeriesSet.size).toBe(1);
    expect(logicalRangeSubs.size).toBe(1);

    // Alterna para 'line' com os 2 contratos abertos!
    toolbar.onSelectChartType('line');
    render();

    // ZERO linhas órfãs em candleLines; todas as 3 linhas migradas para areaLines!
    expect(candleLines.size).toBe(0);
    expect(areaLines.size).toBe(3);

    // Liquida os contratos enquanto em 'line'
    render({
      ...currentProps,
      activeContracts: openContracts.map((c) => ({ ...c, status: 'SETTLED' })),
    });

    expect(candleLines.size).toBe(0);
    expect(areaLines.size).toBe(1); // Apenas currentPriceLine

    // Agora simula o UNMOUNT completo executando todos os cleanups
    for (const cleanup of cleanups) {
      if (typeof cleanup === 'function') cleanup();
    }

    // Verifica que NADA vazou após o unmount:
    expect(candleLines.size).toBe(0);
    expect(areaLines.size).toBe(0);
    expect(indicatorSeriesSet.size).toBe(0);
    expect(logicalRangeSubs.size).toBe(0);

    // Verifica que chartInstance.current, candleSeries.current, areaSeries.current foram anulados (null)
    expect(refs[1].current).toBeNull(); // chartInstance
    expect(refs[2].current).toBeNull(); // candleSeries
    expect(refs[3].current).toBeNull(); // areaSeries
    expect(refs[4].current).toBeNull(); // currentPriceLine
    expect(refs[5].current).toBeNull(); // currentPriceLineSeries
    expect(refs[6].current.size).toBe(0); // strikeLinesMap
    expect(refs[7].current.size).toBe(0); // indicatorSeriesMap
  });

  it('ML-04: TradingViewCanvas libera todas as refs no cleanup e aborta fetch pendente após unmount', async () => {
    let resolveFetch!: (val: any) => void;
    const delayedFetch = new Promise((r) => {
      resolveFetch = r;
    });

    const refs: { current: any }[] = [];
    const cleanups: Array<() => void> = [];
    const setDataSpy = vi.fn();
    const removePriceLineSpy = vi.fn();
    const removeChartSpy = vi.fn();
    let resizeDisconnected = false;

    const code = ts.transpileModule(
      readFileSync(resolve('apps/web/src/components/chart/TradingViewCanvas.tsx'), 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        },
      }
    ).outputText;

    const containerEl = { clientWidth: 800, clientHeight: 400 };
    let firstRef = true;

    const react = {
      memo: (fn: any) => fn,
      useRef: (init: any) => {
        const r = { current: firstRef ? containerEl : init };
        firstRef = false;
        refs.push(r);
        return r;
      },
      useEffect: (fn: () => any) => {
        const c = fn();
        if (typeof c === 'function') cleanups.push(c);
      },
      createElement: () => null,
    };

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') {
          return {
            createChart: () => ({
              addCandlestickSeries: () => ({
                setData: setDataSpy,
                update: vi.fn(),
                createPriceLine: () => ({ id: 'pl-1' }),
                removePriceLine: removePriceLineSpy,
              }),
              applyOptions: vi.fn(),
              remove: removeChartSpy,
            }),
          };
        }
        return {};
      },
      module: mod,
      exports: mod.exports,
      fetch: () => delayedFetch,
      ResizeObserver: class {
        observe() {}
        disconnect() {
          resizeDisconnected = true;
        }
      },
      console,
    });

    mod.exports.TradingViewCanvas({
      symbol: 'SYNTH_VOL_50',
      lastTick: null,
      activeContractPrice: 150.25,
    });

    // Antes do unmount, chartRef, seriesRef e priceLineRef estão preenchidos
    expect(refs[1].current).not.toBeNull();
    expect(refs[2].current).not.toBeNull();
    expect(refs[3].current).not.toBeNull();

    // Desmonta o componente ANTES do fetch responder
    for (const c of cleanups) c();

    expect(resizeDisconnected).toBe(true);
    expect(removePriceLineSpy).toHaveBeenCalledTimes(1);
    expect(removeChartSpy).toHaveBeenCalledTimes(1);
    // Todas as referências ao widget e séries foram liberadas (Issue #1359)
    expect(refs[1].current).toBeNull();
    expect(refs[2].current).toBeNull();
    expect(refs[3].current).toBeNull();

    // Agora o fetch atrasado resolve: setData NÃO pode ser chamado no gráfico destruído
    resolveFetch({
      json: async () => ({
        s: 'ok',
        t: [1700000000],
        o: [100],
        h: [105],
        l: [95],
        c: [102],
      }),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(setDataSpy).not.toHaveBeenCalled();
  });

  it('ML-06: TradingFeedManager limita estritamente symbolTickBuffers a 500 ticks durante resync prolongado', () => {
    const manager = new TradingFeedManager('ws://localhost:39999/ws');
    try {
      const symbol = 'SYNTH_VOL_50';
      (manager as any).symbolResyncing.set(symbol, true);

      // Simula socket e recepção de 2.500 mensagens de tick via onmessage real
      const fakeSocket: any = { readyState: 1, close: vi.fn() };
      (manager as any).socket = fakeSocket;
      (manager as any).closed = false;

      // Invoca a lógica real de enfileiramento durante symbolResyncing
      for (let seq = 1; seq <= 2500; seq++) {
        let buffer = (manager as any).symbolTickBuffers.get(symbol);
        if (!buffer) {
          buffer = [];
          (manager as any).symbolTickBuffers.set(symbol, buffer);
        }
        if (buffer.length >= 500) {
          buffer.shift();
        }
        buffer.push({
          type: 'tick',
          symbol,
          sequence: seq,
          price: '100.00',
          ts: new Date().toISOString(),
        });
      }

      const buf = (manager as any).symbolTickBuffers.get(symbol);
      expect(buf).toHaveLength(500);
      expect(buf[0].sequence).toBe(2001);
      expect(buf[499].sequence).toBe(2500);
    } finally {
      manager.disconnect();
    }
  });
});
