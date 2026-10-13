import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type Row = { _internal_originalTime: number; _internal_value: number[] };
type Layer = { _internal_setSeriesData(s: object, data: unknown[]): unknown;
  _internal_updateSeriesData(s: object, data: unknown): unknown; _private__seriesRowsBySeries: Map<object, Row[]> };
type Candle = { time: number; open: string; high: string; low: string; close: string; volume: number };
type Tick = { type: 'tick'; symbol: string; sequence: number; ts: string; price: string };
const t0 = Date.parse('2026-10-09T15:53:00Z') / 1000;
const history: Candle[] = [{ time: t0, open: '0.59850', high: '0.59850', low: '0.59850', close: '0.59850', volume: 1 }];
const ticks: Tick[] = ['0.59820', '0.59900', '0.59810', '0.59830'].map((price, index) => ({
  type: 'tick', symbol: 'NZDUSD_OTC', sequence: index + 1, price,
  ts: index === 3 ? '2026-10-09T16:00:01Z' : `2026-10-09T15:59:0${index + 1}Z`,
}));
const expected = [[t0, 0.5985, 0.5985, 0.5985, 0.5985],
  [t0 + 360, 0.5982, 0.599, 0.5981, 0.5981], [t0 + 420, 0.5983, 0.5983, 0.5983, 0.5983]];

function mountPriceChart() {
  const source = readFileSync(resolve('apps/web/node_modules/lightweight-charts/dist/lightweight-charts.development.mjs'), 'utf8');
  const engine = runInNewContext(source.replace(/^import .* from 'fancy-canvas';$/m, '')
    .replace(/^export \{[^\n]+\};$/m, '({ DataLayer, HorzScaleBehaviorTime })')) as {
      DataLayer: new (behavior: unknown) => Layer; HorzScaleBehaviorTime: new () => unknown };
  const layer = new engine.DataLayer(new engine.HorzScaleBehaviorTime()), noop = () => {};
  const makeSeries = (type: string) => {
    const s = { _internal_seriesType: () => type, _internal_customSeriesPlotValuesBuilder: () => undefined,
      _internal_customSeriesWhitespaceCheck: () => undefined,
      setData: (data: unknown[]) => layer._internal_setSeriesData(s, data),
      update: (data: unknown) => layer._internal_updateSeriesData(s, data),
      createPriceLine: () => ({ applyOptions: noop }), removePriceLine: noop, applyOptions: noop };
    return s;
  };
  const candleSeries = makeSeries('Candlestick'), areaSeries = makeSeries('Area');
  const timeScale = { scrollToRealTime: noop, fitContent: noop, subscribeVisibleLogicalRangeChange: noop,
    unsubscribeVisibleLogicalRangeChange: noop };
  const chart = { timeScale: () => timeScale, priceScale: () => ({ applyOptions: noop }) };
  const values: unknown[] = [], refs: { current: unknown }[] = [], deps: unknown[][] = [], memo: { deps: unknown[]; value: unknown }[] = [];
  const cleanups: (unknown | (() => unknown))[] = [], frames = new Map<number, () => void>();
  let si = 0, ri = 0, ei = 0, mi = 0, frameId = 0, dirty = false, effects: (() => unknown)[] = [];
  let hostProps: Record<string, unknown> | undefined, toolbar: Record<string, (value: string) => void> = {};
  const compute = (fn: () => unknown, keys: unknown[]) => {
    const index = mi++, previous = memo[index];
    if (!previous || keys.some((v, i) => v !== previous.deps[i])) memo[index] = { deps: keys, value: fn() };
    return memo[index].value;
  };
  const jsx = (tag: unknown, props: Record<string, unknown>) => {
    if (tag === 'TOOLBAR') toolbar = props as typeof toolbar;
    if (tag === 'HOST') {
      if (hostProps?.candles !== props.candles || hostProps?.chartType !== props.chartType) {
        candleSeries.setData(props.chartType === 'candles' ? props.candles as unknown[] : []);
        areaSeries.setData(props.chartType === 'line' ? (props.candles as { time: number; close: number }[]).map(c => ({ time: c.time, value: c.close })) : []);
      }
      if (!hostProps || hostProps.chartType !== props.chartType) (props.onChartReady as (api: object) => void)({
        chart, candleSeries, areaSeries, timeScale, activeSeries: props.chartType === 'candles' ? candleSeries : areaSeries });
      hostProps = props;
    }
    return null;
  };
  const react = { useRef: (v: unknown) => refs[ri++] ??= { current: v },
    useMemo: compute, useCallback: (fn: () => unknown, keys: unknown[]) => compute(() => fn, keys),
    useState: (initial: unknown) => {
      const index = si++; if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], (next: unknown) => { const value = typeof next === 'function' ? next(values[index]) : next;
        if (!Object.is(value, values[index])) { values[index] = value; dirty = true; } }];
    },
    useEffect: (effect: () => unknown, keys: unknown[]) => {
      const index = ei++, previous = deps[index];
      if (!previous || keys.some((v, i) => v !== previous[i])) effects.push(() => {
        if (typeof cleanups[index] === 'function') (cleanups[index] as () => unknown)(); cleanups[index] = effect(); });
      deps[index] = keys;
    },
  };
  const globals = { console, performance: { now: () => 0 },
    setInterval, clearInterval, setTimeout, clearTimeout,
    window: {
    requestAnimationFrame: (cb: () => void) => { frames.set(++frameId, cb); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id), addEventListener: noop, removeEventListener: noop,
    setInterval, clearInterval, setTimeout, clearTimeout } };
  const modules = new Map<string, Record<string, unknown>>();
  function load(file: string): Record<string, unknown> {
    if (modules.has(file)) return modules.get(file)!;
    const mod = { exports: {} as Record<string, unknown> }; modules.set(file, mod.exports);
    const localRequire = (name: string): unknown => {
      if (name === 'react') return react; if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'lightweight-charts') return { LineStyle: { Dashed: 2 } };
      if (name.endsWith('IsolatedChartHost')) return { IsolatedChartHost: 'HOST' };
      if (name.endsWith('ChartDrawingToolbar')) return { ChartDrawingToolbar: 'TOOLBAR' };
      if (name.endsWith('drawing-types')) return { DEFAULT_INDICATORS: [] };
      if (name.endsWith('drawing-sanitizer')) return { loadSafeDrawings: () => [], saveSafeDrawings: noop };
      if (name.endsWith('useTickPulse')) return { useTickPulse: () => false };
      if (name.endsWith('feature-flags')) return { isNewTraderoomEnabled: () => false };
      if (name.endsWith('api/client')) return { generateSeedCandles: () => { throw new Error('Unexpected invented history'); } };
      if (name.endsWith('money')) return { formatMinor: () => '' };
      if (!/^(candle-adapter|chart-scale-normalizer|raf-updater|assets)$/.test(basename(name))) return {};
      const target = resolve(dirname(file), name); return load(existsSync(`${target}.ts`) ? `${target}.ts` : `${target}.tsx`);
    };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    runInNewContext(code, { ...globals, require: localRequire, module: mod, exports: mod.exports }); return mod.exports;
  }
  const component = load(resolve('apps/web/src/chart/PriceChart.tsx')).PriceChart as (props: object) => unknown;
  let props = { candles: history, tick: null as Tick | null, symbol: 'NZDUSD_OTC' };
  const render = (next = props) => { props = next; let attempts = 0;
    do { si = ri = ei = mi = 0; dirty = false; effects = []; component(props); effects.forEach(f => f());
      if (++attempts > 15) throw new Error('Render failed to settle'); } while (dirty); };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(f => f()); };
  const rows = (s = candleSeries) => (layer._private__seriesRowsBySeries.get(s) ?? []).map(r => [r._internal_originalTime, ...r._internal_value]);
  const observe = (burst = false) => { render(); ticks.forEach((tick, index) => {
    render({ ...props, tick }); if (!burst || index >= 2) flush(); });
    if (!burst) expect(rows()).toEqual(expected); };
  return { observe, rows, render, flush, push: (tick: Tick) => render({ ...props, tick }),
    hydrate: (official = history) => { render({ ...props, candles: official.map(c => ({ ...c })) }); flush(); },
    select: (kind: 'ChartType' | 'Timeframe', value: string) => { toolbar[`onSelect${kind}`](value); render(); flush(); },
    areaRows: () => rows(areaSeries) };
}

// Given four official ticks; when history/type/timeframe is replaced without another tick;
// then observed OHLC survives exactly, with no invented intermediate candles.
describe('[M-05][G-07] PriceChart observed tail hydration', () => {
  it('retains closing bucket extrema when a frame contains the end of one minute and start of the next', () => {
    const chart = mountPriceChart(); chart.render(); chart.push(ticks[0]); chart.flush();
    ticks.slice(1).forEach(chart.push); chart.flush();
    expect(chart.rows()).toEqual(expected);
  });
  it('[AC-T13-4] late REST history retains both observed live buckets and their exact extrema', () => {
    const chart = mountPriceChart(); chart.observe(); chart.hydrate(); expect(chart.rows()).toEqual(expected);
  });
  it('[AC-T13-5] switching to line without another tick retains both observed closing prices', () => {
    const chart = mountPriceChart(); chart.observe(); chart.select('ChartType', 'line');
    expect(chart.areaRows().map(r => [r[0], r[4]])).toEqual([[t0, 0.5985], [t0 + 360, 0.5981], [t0 + 420, 0.5983]]);
  });
  it('[AC-T13-6] switching to 5m aggregates only the actual historical and observed buckets', () => {
    const chart = mountPriceChart(); chart.observe(); chart.select('Timeframe', '5m');
    expect(chart.rows()).toEqual(expected.map(r => [Math.floor(r[0] / 300) * 300, ...r.slice(1)]));
  });
  it('[G-01][M-05] three ticks coalesced into one frame preserve observed open and extrema after hydration', () => {
    const chart = mountPriceChart(); chart.observe(true); chart.hydrate(); expect(chart.rows()).toEqual(expected);
  });
  it('[M-05] a closed REST bar prevails over earlier observations once the next bucket exists', () => {
    const chart = mountPriceChart(); chart.observe();
    chart.hydrate([...history, { time: t0 + 360, open: '0.59820', high: '0.59910', low: '0.59800', close: '0.59840', volume: 20 }]);
    expect(chart.rows()).toEqual([expected[0], [t0 + 360, 0.5982, 0.5991, 0.598, 0.5984], expected[2]]);
  });
});
