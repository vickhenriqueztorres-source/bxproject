import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { safeCandleFromTick } from '../../apps/web/src/chart/chart-scale-normalizer';
type ChartTime = NonNullable<ReturnType<typeof safeCandleFromTick>>['time'];

type Bar = { time: number; open: number; high: number; low: number; close: number };
type ModelSeries = { _internal_seriesType(): string; _internal_customSeriesPlotValuesBuilder(): undefined;
  _internal_customSeriesWhitespaceCheck(): undefined };
type PriceFormat = { precision: number; minMove: number };
type Layer = { _internal_setSeriesData(s: ModelSeries, data: unknown[]): unknown;
  _internal_updateSeriesData(s: ModelSeries, data: unknown): unknown;
  _private__seriesRowsBySeries: Map<ModelSeries, { _internal_index: number;
    _internal_originalTime: number; _internal_value: number[] }[]> };
type Series = ModelSeries & { setData(data: unknown[]): void; update(data: unknown): void;
  data(): unknown[];
  applyOptions(options: Record<string, unknown>): void; options(): { priceFormat: PriceFormat } };

// Load the installed engine in memory; expose internals without changing its implementation.
const bundle = readFileSync(resolve('apps/web/node_modules/lightweight-charts/dist/lightweight-charts.development.mjs'), 'utf8');
const engine = runInNewContext(bundle.replace(/^import .* from 'fancy-canvas';$/m, '')
  .replace(/^export \{[^\n]+\};$/m, '({ DataLayer, HorzScaleBehaviorTime, PriceFormatter, seriesOptionsDefaults })')) as {
  DataLayer: new (behavior: unknown) => Layer; HorzScaleBehaviorTime: new () => unknown;
  PriceFormatter: new (scale: number, minMove: number) => { format(price: number): string };
  seriesOptionsDefaults: { priceFormat: PriceFormat };
};
const t0 = Date.parse('2026-10-09T15:53:00Z') / 1000;
const bar = (time: number, close = 0.5985): Bar => ({ time, open: close, high: close, low: close, close });
const seed = Array.from({ length: 7 }, (_, i) => bar(t0 + i * 60));
const history = [bar(t0)];
const tick = { type: 'tick' as const, symbol: 'NZDUSD_OTC', sequence: 1,
  ts: '2026-10-09T15:59:17Z', price: '0.59820' };

// Only React scheduling and the DOM adapter are faked. Host source, sanitization,
// timeline indexing and numeric formatter execute their installed implementations.
function mountHost() {
  const layer = new engine.DataLayer(new engine.HorzScaleBehaviorTime());
  const series: Series[] = [];
  const addSeries = (type: string, options: Record<string, unknown>) => {
    let settings = { ...options, priceFormat: { ...engine.seriesOptionsDefaults.priceFormat, ...(options.priceFormat as Partial<PriceFormat>) } };
    const s: Series = { _internal_seriesType: () => type,
      _internal_customSeriesPlotValuesBuilder: () => undefined, _internal_customSeriesWhitespaceCheck: () => undefined,
      setData: (data) => { layer._internal_setSeriesData(s, data); },
      update: (data) => { layer._internal_updateSeriesData(s, data); },
      data: () => (layer._private__seriesRowsBySeries.get(s) ?? []).map(row => type === 'Area'
        ? { time: row._internal_originalTime, value: row._internal_value[3] }
        : { time: row._internal_originalTime, open: row._internal_value[0], high: row._internal_value[1],
          low: row._internal_value[2], close: row._internal_value[3] }),
      applyOptions: (next) => { settings = { ...settings, ...next }; }, options: () => settings };
    series.push(s);
    return s;
  };
  const noop = () => {};
  const chart = { addCandlestickSeries: (opts: Record<string, unknown>) => addSeries('Candlestick', opts),
    addAreaSeries: (opts: Record<string, unknown>) => addSeries('Area', opts),
    priceScale: () => ({ applyOptions: noop }), timeScale: () => ({ applyOptions: noop, scrollToRealTime: noop }),
    applyOptions: noop, remove: noop };
  const events = new Map<string, () => void>();
  let observed = 0;
  const element = { clientWidth: 1000, clientHeight: 500,
    addEventListener: (name: string, callback: () => void) => events.set(name, callback), removeEventListener: noop };
  const refs: { current: unknown }[] = [];
  const dependencies: (readonly unknown[])[] = [];
  let refIndex = 0, effectIndex = 0;
  let pending: (() => unknown)[] = [];
  const react = {
    memo: (fn: unknown) => fn, forwardRef: (fn: unknown) => fn,
    useRef: (initial: unknown) => refs[refIndex++] ??= { current: initial },
    useCallback: (fn: unknown) => fn, useImperativeHandle: noop,
    useEffect: (effect: () => unknown, deps: unknown[]) => {
      const index = effectIndex++, previous = dependencies[index];
      if (!previous || deps.some((value, i) => value !== previous[i])) pending.push(effect);
      dependencies[index] = deps;
    },
    createElement: (_tag: unknown, props: { ref?: { current: unknown } } | null) => {
      if (props?.ref) props.ref.current = element;
      return null;
    },
  };
  const modules = new Map<string, Record<string, unknown>>();
  function loadSource(file: string): Record<string, unknown> {
    if (modules.has(file)) return modules.get(file)!;
    const mod = { exports: {} as Record<string, unknown> };
    modules.set(file, mod.exports);
    const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
    } }).outputText;
    const localRequire = (name: string): unknown => {
      if (name === 'react') return react;
      if (name === 'lightweight-charts') return { createChart: () => chart, ColorType: { Solid: 'solid' } };
      if (!name.startsWith('.')) throw new Error(`Unexpected dependency: ${name}`);
      const target = resolve(dirname(file), name);
      return loadSource(existsSync(`${target}.ts`) ? `${target}.ts` : `${target}.tsx`);
    };
    runInNewContext(code, { require: localRequire, module: mod, exports: mod.exports,
      document: { addEventListener: noop, removeEventListener: noop, hidden: false },
      ResizeObserver: class { observe() { observed++; } disconnect() {} }, console });
    return mod.exports;
  }
  const host = loadSource(resolve('apps/web/src/chart/IsolatedChartHost.tsx')).IsolatedChartHost as
    (props: { candles: Bar[]; chartType: string; timeframe: string; symbol: string }) => unknown;
  const render = (candles: Bar[], chartType = 'candles') => {
    refIndex = effectIndex = 0;
    pending = [];
    host({ candles, chartType, timeframe: '1m', symbol: 'NZDUSD_OTC' });
    pending.forEach(effect => effect());
  };
  return { render, series, layer, observed: () => observed, restore: () => events.get('webglcontextrestored')!() };
}

// AC-T13-1: seed -> official history + tick => indices [0,1], original times/prices unchanged.
// AC-T13-2: populated history -> [] => exactly zero rows in both series.
// AC-T13-3: NZDUSD 0.59820/0.59821 -> host formatter => distinct five decimal strings.
// M-05: first observed tick after six empty minutes => OHLC all equal to its price.
describe('[M-05][G-07] Real chart engine boot and first tick regressions', () => {
  it('retains live updates applied after the last props history during context restoration', () => {
    const host = mountHost(); host.render(history, 'line');
    host.series[1].update({ time: t0 + 360, value: 0.5982 });
    host.restore();
    expect(host.layer._private__seriesRowsBySeries.get(host.series[1])!.map(row => row._internal_value[3]))
      .toEqual([0.5985, 0.5982]);
  });
  it('observes host dimensions and restores only the currently active series after switching to line', () => {
    const host = mountHost();
    host.render(seed);
    host.render(history, 'line');
    host.restore();
    expect(host.layer._private__seriesRowsBySeries.get(host.series[0]) ?? []).toHaveLength(0);
    expect(host.layer._private__seriesRowsBySeries.get(host.series[1])).toHaveLength(1);
    expect(host.observed()).toBe(1);
  });
  it('[AC-T13-1] hidden seed series contributes zero empty logical slots after real history replaces it', () => {
    // Given seven seed minutes; when official history and its next tick replace them;
    // then the two active bars occupy exactly logical indices 0 and 1.
    const host = mountHost();
    host.render(seed);
    host.render(history);
    const next = safeCandleFromTick(tick, { ...history[0], time: t0 as ChartTime }, '1m');
    expect(next).not.toBeNull();
    host.series[0].update(next);
    const indices = host.layer._private__seriesRowsBySeries.get(host.series[0])!.map(row => row._internal_index);
    expect(indices).toEqual([0, 1]);
    const rows = host.layer._private__seriesRowsBySeries.get(host.series[0])!;
    expect(rows.map(row => row._internal_originalTime)).toEqual([t0, t0 + 360]);
    expect(rows.map(row => row._internal_value[3])).toEqual([0.5985, 0.5982]);
  });
  it('[AC-T13-2] empty replacement history leaves zero old bars in either series', () => {
    const host = mountHost();
    host.render(seed);
    host.render([]);
    expect([...host.layer._private__seriesRowsBySeries.values()].flat()).toHaveLength(0);
  });
  it('[AC-T13-3] NZDUSD host formatter preserves five decimals and distinguishes adjacent prices', () => {
    const host = mountHost();
    host.render(history);
    for (const s of host.series) {
      const { precision, minMove } = s.options().priceFormat;
      const formatter = new engine.PriceFormatter(10 ** precision, minMove * 10 ** precision);
      expect([formatter.format(0.59820), formatter.format(0.59821)]).toEqual(['0.59820', '0.59821']);
    }
  });
  it('[M-05] first tick after a six minute gap opens its own bucket at the observed price', () => {
    const next = safeCandleFromTick({ ...tick, price: '0.59000' }, { ...history[0], time: t0 as ChartTime }, '1m');
    expect(next).toMatchObject({ time: t0 + 360, open: 0.59, high: 0.59, low: 0.59, close: 0.59 });
  });
});
