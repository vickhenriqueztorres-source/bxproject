import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

describe('[ANTI-ZERO-DIMENSION] Certificação Contra Colapso de Container 0x0 (Issues #1334 / #1344)', () => {
  it('ZD-TEST-01: IsolatedChartHost montado em container 0x0 aplica piso seguro (800x500), rejeita resizes <= 50px e faz auto-heal via rAF e ResizeObserver', () => {
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

    const createChartCalls: Array<{ width: number; height: number }> = [];
    const applyOptionsCalls: Array<{ width?: number; height?: number }> = [];
    const dimensionCallbacks: Array<{ width: number; height: number }> = [];
    let resizeObserverCallback: ((entries: any[]) => void) | null = null;
    let scheduledRafCallback: (() => void) | null = null;
    let cancelledRafId: number | null = null;

    // Container inicia colapsado em 0x0 (ex: Flexbox ainda não pintou o layout)
    const hostElement = {
      clientWidth: 0,
      clientHeight: 0,
      getBoundingClientRect: () => ({ width: hostElement.clientWidth, height: hostElement.clientHeight }),
      querySelector: () => null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    let firstRef = true;
    const cleanups: Array<() => void> = [];

    const react = {
      memo: (fn: any) => fn,
      forwardRef: (fn: any) => fn,
      useRef: (initial: any) => {
        const r = { current: firstRef ? hostElement : initial };
        firstRef = false;
        return r;
      },
      useCallback: (fn: any) => fn,
      useImperativeHandle: vi.fn(),
      useEffect: (effect: () => any) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      },
      createElement: () => null,
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
      applyOptions: (opts: any) => {
        if (typeof opts?.width === 'number' || typeof opts?.height === 'number') {
          applyOptionsCalls.push({ width: opts.width, height: opts.height });
        }
      },
      remove: vi.fn(),
    };

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') {
          return {
            ColorType: { Solid: 'solid' },
            createChart: (_el: any, opts: any) => {
              createChartCalls.push({ width: opts.width, height: opts.height });
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
        constructor(cb: (entries: any[]) => void) {
          resizeObserverCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
      requestAnimationFrame: (cb: () => void) => {
        scheduledRafCallback = cb;
        return 777;
      },
      cancelAnimationFrame: (id: number) => {
        cancelledRafId = id;
      },
      document: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      console,
    });

    const { IsolatedChartHost } = mod.exports;

    // 1. Mount com container 0x0
    IsolatedChartHost(
      {
        candles: [],
        chartType: 'candles',
        timeframe: 'M1',
        symbol: 'SYNTH_VOL_50',
        onDimensionsChange: (dims: { width: number; height: number }) => {
          dimensionCallbacks.push(dims);
        },
      },
      null
    );

    // O gráfico NUNCA pode ser instanciado com width: 0 ou height: 0
    expect(createChartCalls).toHaveLength(1);
    expect(createChartCalls[0].width).toBeGreaterThanOrEqual(320);
    expect(createChartCalls[0].height).toBeGreaterThanOrEqual(300);

    // 2. Simula colapsos severos no ResizeObserver (0x0, 0x500, 400x0, 30x30, 50x50)
    expect(resizeObserverCallback).not.toBeNull();
    resizeObserverCallback!([
      { contentRect: { width: 0, height: 0 } },
      { contentRect: { width: 0, height: 500 } },
      { contentRect: { width: 400, height: 0 } },
      { contentRect: { width: 30, height: 30 } },
      { contentRect: { width: 50, height: 50 } },
    ]);

    // Nenhuma chamada de applyOptions pode ter ocorrido para dimensões <= 50px
    expect(applyOptionsCalls).toHaveLength(0);

    // 3. Auto-heal pós-mount via requestAnimationFrame quando o Flexbox termina de pintar (640x360)
    expect(scheduledRafCallback).not.toBeNull();
    hostElement.clientWidth = 640;
    hostElement.clientHeight = 360;
    scheduledRafCallback!();

    expect(applyOptionsCalls).toHaveLength(1);
    expect(applyOptionsCalls[0]).toEqual({ width: 640, height: 360 });
    expect(dimensionCallbacks[dimensionCallbacks.length - 1]).toEqual({ width: 640, height: 360 });

    // 4. ResizeObserver com dimensão válida (1024x600) atualiza normalmente
    resizeObserverCallback!([{ contentRect: { width: 1024, height: 600 } }]);
    expect(applyOptionsCalls).toHaveLength(2);
    expect(applyOptionsCalls[1]).toEqual({ width: 1024, height: 600 });

    // 5. Unmount cancela o rAF pendente
    for (const fn of cleanups) fn();
    expect(cancelledRafId).toBe(777);
  });

  it('ZD-TEST-02: TradingViewCanvas aplica piso seguro no mount 0x0 e bloqueia colapsos <= 50px no ResizeObserver', () => {
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

    const createChartCalls: Array<{ width: number; height: number }> = [];
    const applyOptionsCalls: Array<{ width: number; height: number }> = [];
    let resizeCallback: ((entries?: any[]) => void) | null = null;
    let renderedStyle: Record<string, any> | null = null;

    // Container inicia colapsado em 0x0
    const containerEl = {
      clientWidth: 0,
      clientHeight: 0,
    };

    let refIdx = 0;
    const react = {
      memo: (fn: any) => fn,
      useRef: (initial: any) => {
        const idx = refIdx++;
        return { current: idx === 0 ? containerEl : initial };
      },
      useEffect: (effect: () => any) => {
        effect();
      },
      createElement: (_tag: any, props: any) => {
        if (props?.style) {
          renderedStyle = props.style;
        }
        return null;
      },
    };

    const chartApi = {
      addCandlestickSeries: () => ({
        setData: vi.fn(),
        update: vi.fn(),
        createPriceLine: vi.fn(),
        removePriceLine: vi.fn(),
      }),
      applyOptions: (opts: { width: number; height: number }) => {
        applyOptionsCalls.push(opts);
      },
      remove: vi.fn(),
    };

    const mod = { exports: {} as any };
    runInNewContext(code, {
      require: (name: string) => {
        if (name === 'react') return react;
        if (name === 'lightweight-charts') {
          return {
            createChart: (_el: any, opts: any) => {
              createChartCalls.push({ width: opts.width, height: opts.height });
              return chartApi;
            },
          };
        }
        return {};
      },
      module: mod,
      exports: mod.exports,
      ResizeObserver: class {
        constructor(cb: (entries?: any[]) => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
      fetch: () => Promise.resolve({ json: () => Promise.resolve({ s: 'no_data' }) }),
      BigInt,
      console,
    });

    const { TradingViewCanvas } = mod.exports;
    TradingViewCanvas({ symbol: 'SYNTH_VOL_50', lastTick: null, activeContractPrice: null });

    // 1. Mount com clientWidth=0, clientHeight=0 deve usar piso seguro >= 320x300
    expect(createChartCalls).toHaveLength(1);
    expect(createChartCalls[0].width).toBeGreaterThanOrEqual(320);
    expect(createChartCalls[0].height).toBeGreaterThanOrEqual(300);

    // 2. Container style possui minWidth e minHeight defensivos
    expect(renderedStyle).toMatchObject({
      width: '100%',
      height: '100%',
      minWidth: '320px',
      minHeight: '300px',
    });

    // 3. ResizeObserver dispara com 0x0 e 25x25 -> ambos ignorados!
    expect(resizeCallback).not.toBeNull();
    containerEl.clientWidth = 0;
    containerEl.clientHeight = 0;
    resizeCallback!([{ contentRect: { width: 0, height: 0 } }]);
    resizeCallback!([{ contentRect: { width: 25, height: 25 } }]);
    expect(applyOptionsCalls).toHaveLength(0);

    // 4. ResizeObserver dispara com 900x450 -> aplicado com sucesso!
    containerEl.clientWidth = 900;
    containerEl.clientHeight = 450;
    resizeCallback!([{ contentRect: { width: 900, height: 450 } }]);
    expect(applyOptionsCalls).toHaveLength(1);
    expect(applyOptionsCalls[0]).toEqual({ width: 900, height: 450 });
  });

  it('ZD-TEST-03: Invariantes estruturais Flex/Grid em ChartSandbox.tsx e MultiChartGrid.tsx impedem colapso de altura em layouts 1x1, 2x1, 2x2 e 3x2', () => {
    const sandboxSource = readFileSync(resolve('apps/web/src/chart/ChartSandbox.tsx'), 'utf8');
    const gridSource = readFileSync(resolve('apps/web/src/chart/MultiChartGrid.tsx'), 'utf8');

    // ChartSandbox mantém flex: 1 + minHeight: 0 + minWidth: 0 + contain: 'layout size'
    expect(sandboxSource).toContain('flex: 1');
    expect(sandboxSource).toContain("width: '100%'");
    expect(sandboxSource).toContain("height: '100%'");
    expect(sandboxSource).toContain('minHeight: 0');
    expect(sandboxSource).toContain('minWidth: 0');
    expect(sandboxSource).toContain("contain: 'layout size'");

    // MultiChartGrid garante flex: 1, minHeight: 0, minWidth: 0, height: '100%' no wrapper da célula e na raiz
    expect(gridSource).toContain(
      "style={{ flex: 1, height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}"
    );
    expect(gridSource).toContain(
      "style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '100%', position: 'relative' }}"
    );
  });
});
