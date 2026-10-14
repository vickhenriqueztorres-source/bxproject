import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import {
  ColorType,
  createChart,
  type AreaData,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type ITimeScaleApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { isSubMinuteTimeframe, type Timeframe } from './candle-adapter';
import { ensureStrictAscendingBars } from './bar-sanitizer';
export { ensureStrictAscendingBars } from './bar-sanitizer';
import { getAssetMeta } from '../catalog/assets';

export interface IsolatedChartHostProps {
  candles: CandlestickData<UTCTimestamp>[];
  chartType: 'candles' | 'line';
  timeframe: Timeframe;
  symbol?: string;
  locale?: string;
  timezone?: string;
  /** Casas decimais do eixo; ausente = precisão do catálogo (comportamento anterior). */
  pricePrecision?: number;
  isBinmax?: boolean;
  onChartReady?: (api: {
    chart: IChartApi;
    activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
    candleSeries: ISeriesApi<'Candlestick'>;
    areaSeries: ISeriesApi<'Area'>;
    timeScale: ITimeScaleApi<any>;
  }) => void;
  onChartDispose?: () => void;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface IsolatedChartHandle {
  getChart: () => IChartApi | null;
  getActiveSeries: () => ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null;
  getCandleSeries: () => ISeriesApi<'Candlestick'> | null;
  getAreaSeries: () => ISeriesApi<'Area'> | null;
  getTimeScale: () => ITimeScaleApi<any> | null;
  scrollToRealTime: () => void;
}

/**
 * Comparador estrutural O(1) de velas para impedir que um novo array com os mesmos dados
 * (criado durante re-render de estado no componente pai) dispare setData() ou flicker (#1345 / #1346).
 */
export function areCandlesEquivalent(
  prev: CandlestickData<UTCTimestamp>[],
  next: CandlestickData<UTCTimestamp>[]
): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  if (prev.length === 0) return true;

  const pFirst = prev[0];
  const nFirst = next[0];
  const pLast = prev[prev.length - 1];
  const nLast = next[next.length - 1];

  return (
    pFirst.time === nFirst.time &&
    pFirst.open === nFirst.open &&
    pFirst.close === nFirst.close &&
    pLast.time === nLast.time &&
    pLast.open === nLast.open &&
    pLast.high === nLast.high &&
    pLast.low === nLast.low &&
    pLast.close === nLast.close
  );
}

export function areChartHostPropsEqual(
  prev: IsolatedChartHostProps,
  next: IsolatedChartHostProps
): boolean {
  return (
    areCandlesEquivalent(prev.candles, next.candles) &&
    prev.chartType === next.chartType &&
    prev.timeframe === next.timeframe &&
    prev.symbol === next.symbol &&
    prev.isBinmax === next.isBinmax &&
    prev.locale === next.locale &&
    prev.timezone === next.timezone &&
    prev.pricePrecision === next.pricePrecision
  );
}

export interface ViewportSyncOptions {
  forceAutoScale?: boolean;
  forceScrollToRealTime?: boolean;
}

/**
 * Sincroniza imperativamente o tamanho do canvas, o autoscale vertical e o scroll horizontal
 * do Lightweight Charts durante redimensionamentos e transições de Tela Cheia (#1344).
 */
export function syncChartViewportOnResize(
  chart: IChartApi | null | undefined,
  width: number,
  height: number,
  lastSizeRef?: { current: { width: number; height: number } },
  options: ViewportSyncOptions = {}
): boolean {
  if (!chart) return false;
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 50 || h <= 50) {
    return false;
  }

  const sizeChanged =
    !lastSizeRef ||
    lastSizeRef.current.width !== w ||
    lastSizeRef.current.height !== h;

  if (!sizeChanged && !options.forceAutoScale && !options.forceScrollToRealTime) {
    return false;
  }

  if (lastSizeRef) {
    lastSizeRef.current = { width: w, height: h };
  }

  try {
    const timeScale = chart.timeScale?.();
    const scrollPos =
      typeof timeScale?.scrollPosition === 'function' ? timeScale.scrollPosition() : 0;
    const isNearRealTime = typeof scrollPos === 'number' && scrollPos <= 5;

    if (typeof (chart as any).resize === 'function') {
      (chart as any).resize(w, h, true);
    }
    chart.applyOptions?.({ width: w, height: h });

    if (options.forceAutoScale || sizeChanged) {
      chart.priceScale?.('right')?.applyOptions?.({ autoScale: true });
    }

    if (options.forceScrollToRealTime || (sizeChanged && isNearRealTime)) {
      timeScale?.scrollToRealTime?.();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Componente Ilhado de Canvas do TradingView Lightweight Charts (v4.2.1).
 * Implementa as 4 regras de ouro de isolamento + blindagens industriais:
 * 1. Instanciação ÚNICA de Chart e Séries no mount (useEffect com []);
 * 2. Atualização de velas via setData() SEM recriar ou remover séries;
 * 3. Blindagem de dimensões contra colapsos temporários (width/height <= 50) e Fullscreen multi-pass (#1344);
 * 4. React.memo com comparação customizada para ignorar re-renders do shell;
 * 5. Sanitização monotônica UTC de barras antes de setData (#1344);
 * 6. Recuperação automática de WebGL/Canvas Context Loss (GPU Reset / Sleep);
 * 7. Wake-up Auto-Resync ao retornar de abas em segundo plano.
 */
const IsolatedChartHostComponent = forwardRef<IsolatedChartHandle, IsolatedChartHostProps>(
  (
    {
      candles,
      chartType,
      timeframe,
      symbol,
      locale,
      timezone,
      pricePrecision,
      isBinmax = true,
      onChartReady,
      onChartDispose,
      onDimensionsChange,
      className,
      style,
    },
    ref
  ) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
    const lastAppliedCandlesRef = useRef<CandlestickData<UTCTimestamp>[]>([]);
    const isDisposedRef = useRef<boolean>(false);
    const latestCandlesRef = useRef<CandlestickData<UTCTimestamp>[]>(candles);
    const hadBarsRef = useRef<boolean>(false);
    const prevSymbolRef = useRef<string | undefined>(symbol);
    const prevTimeframeRef = useRef<Timeframe>(timeframe);
    const lastDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
    const catalogPrecision = getAssetMeta(symbol ?? 'SYNTH_VOL_50').precision;
    const precision = Number.isInteger(pricePrecision) && (pricePrecision as number) >= 0 && (pricePrecision as number) <= 8
      ? (pricePrecision as number)
      : catalogPrecision;
    const priceFormat = { type: 'price' as const, precision, minMove: 1 / 10 ** precision };

    latestCandlesRef.current = candles;

    const scrollToRealTime = useCallback(() => {
      if (isDisposedRef.current || !chartRef.current) return;
      try {
        chartRef.current.timeScale().scrollToRealTime();
      } catch {
        /* ignore if chart is disposed */
      }
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getChart: () => (isDisposedRef.current ? null : chartRef.current),
        getActiveSeries: () =>
          isDisposedRef.current
            ? null
            : chartType === 'candles'
              ? candleSeriesRef.current
              : areaSeriesRef.current,
        getCandleSeries: () => (isDisposedRef.current ? null : candleSeriesRef.current),
        getAreaSeries: () => (isDisposedRef.current ? null : areaSeriesRef.current),
        getTimeScale: () => (isDisposedRef.current ? null : chartRef.current?.timeScale() ?? null),
        scrollToRealTime,
      }),
      [chartType, scrollToRealTime]
    );

    // 1. Instanciação ÚNICA do gráfico e das séries no mount
    useEffect(() => {
      if (!hostRef.current) return;

      let hostEl: HTMLDivElement | null = hostRef.current;

      // Blindagem Anti-Duplicação (React StrictMode / Re-mount #1344 / #1345 / #1351):
      // Garante descarte completo de instância anterior e limpeza de nós órfãos antes de createChart.
      if (chartRef.current) {
        try {
          if (candleSeriesRef.current && typeof (chartRef.current as any).removeSeries === 'function') {
            (chartRef.current as any).removeSeries(candleSeriesRef.current);
          }
          if (areaSeriesRef.current && typeof (chartRef.current as any).removeSeries === 'function') {
            (chartRef.current as any).removeSeries(areaSeriesRef.current);
          }
        } catch {
          /* ignore */
        }
        try {
          chartRef.current.remove();
        } catch {
          /* ignore */
        }
        chartRef.current = null;
        candleSeriesRef.current = null;
        areaSeriesRef.current = null;
      }
      if (typeof hostEl.replaceChildren === 'function') {
        hostEl.replaceChildren();
      } else if ('innerHTML' in hostEl) {
        hostEl.innerHTML = '';
      }
      isDisposedRef.current = false;
      let effectDisposed = false;

      const measureHostDimensions = (): { width: number; height: number } => {
        if (!hostRef.current) return { width: 0, height: 0 };
        const rect =
          typeof hostRef.current.getBoundingClientRect === 'function'
            ? hostRef.current.getBoundingClientRect()
            : { width: 0, height: 0 };
        const w = Math.floor(rect.width || hostRef.current.clientWidth || 0);
        const h = Math.floor(rect.height || hostRef.current.clientHeight || 0);
        return { width: w, height: h };
      };

      const { width: rawW, height: rawH } = measureHostDimensions();
      const initWidth = Math.max(rawW > 50 ? rawW : 800, 320);
      const initHeight = Math.max(rawH > 50 ? rawH : 500, 300);
      lastDimensionsRef.current = { width: initWidth, height: initHeight };

      let chart: IChartApi | null = createChart(hostEl, {
        autoSize: false,
        width: initWidth,
        height: initHeight,
        layout: {
          background: {
            type: ColorType.Solid,
            color: isBinmax ? '#0D0F14' : 'transparent',
          },
          textColor: isBinmax ? '#8A92A1' : '#8e9ebc',
          fontSize: 11,
        },
        grid: {
          vertLines: {
            color: isBinmax ? 'rgba(244, 245, 247, 0.05)' : 'rgba(28, 41, 65, 0.45)',
          },
          horzLines: {
            color: isBinmax ? 'rgba(244, 245, 247, 0.05)' : 'rgba(28, 41, 65, 0.45)',
          },
        },
        rightPriceScale: {
          autoScale: true,
          borderColor: isBinmax ? 'rgba(244, 245, 247, 0.08)' : '#1d2c48',
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: isBinmax ? 'rgba(244, 245, 247, 0.08)' : '#1d2c48',
          timeVisible: true,
          secondsVisible: isSubMinuteTimeframe(timeframe),
          rightOffset: 12,
          barSpacing: 10,
          shiftVisibleRangeOnNewBar: true,
        },
        crosshair: {
          vertLine: { color: isBinmax ? '#8A92A1' : '#4d6994', width: 1 },
          horzLine: { color: isBinmax ? '#8A92A1' : '#4d6994', width: 1 },
        },
      });

      // Instanciação ÚNICA das séries candlestick e area
      let candleSeries: ISeriesApi<'Candlestick'> | null = chart.addCandlestickSeries({
        upColor: isBinmax ? '#22C55E' : '#00e676',
        downColor: isBinmax ? '#E5484D' : '#ff3d71',
        borderVisible: false,
        wickUpColor: isBinmax ? '#22C55E' : '#00e676',
        wickDownColor: isBinmax ? '#E5484D' : '#ff3d71',
        lastValueVisible: false,
        priceLineVisible: false,
        visible: chartType === 'candles',
        priceFormat,
      });

      let areaSeries: ISeriesApi<'Area'> | null = chart.addAreaSeries({
        lineColor: isBinmax ? '#22C55E' : '#00e676',
        topColor: isBinmax ? 'rgba(34, 197, 94, 0.35)' : 'rgba(0, 230, 118, 0.35)',
        bottomColor: isBinmax ? 'rgba(34, 197, 94, 0.01)' : 'rgba(0, 230, 118, 0.01)',
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: chartType === 'line',
        priceFormat,
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      areaSeriesRef.current = areaSeries;

      // Carga inicial de dados em AMBAS as séries (evita perda ao alternar chartType #1346)
      if (latestCandlesRef.current.length > 0) {
        const cleanInitial = ensureStrictAscendingBars(latestCandlesRef.current);
        if (cleanInitial.length > 0) {
          candleSeries.setData(cleanInitial);
          const lineData: AreaData<UTCTimestamp>[] = cleanInitial.map((c) => ({
            time: c.time,
            value: c.close,
          }));
          areaSeries.setData(lineData);
          lastAppliedCandlesRef.current = latestCandlesRef.current;
          hadBarsRef.current = true;
        }
      }

      onDimensionsChange?.({ width: initWidth, height: initHeight });

      onChartReady?.({
        chart,
        activeSeries: chartType === 'candles' ? candleSeries : areaSeries,
        candleSeries,
        areaSeries,
        timeScale: chart.timeScale(),
      });

      const syncHostDimensions = (opts: ViewportSyncOptions = {}) => {
        if (effectDisposed || isDisposedRef.current || !chart || chartRef.current !== chart) return;
        const { width, height } = measureHostDimensions();
        if (syncChartViewportOnResize(chart, width, height, lastDimensionsRef, opts)) {
          onDimensionsChange?.({ width, height });
        }
      };

      // Blindagem geométrica no ResizeObserver (Issues #1334 / #1344): ignora dimensões <= 50px
      const resizeObserver = new ResizeObserver((entries) => {
        if (effectDisposed || isDisposedRef.current || !chart || chartRef.current !== chart) return;
        for (const entry of entries) {
          const width = Math.floor(entry.contentRect?.width || hostEl?.clientWidth || 0);
          const height = Math.floor(entry.contentRect?.height || hostEl?.clientHeight || 0);
          if (syncChartViewportOnResize(chart, width, height, lastDimensionsRef)) {
            onDimensionsChange?.({ width, height });
          }
        }
      });

      const safeRaf =
        typeof globalThis !== 'undefined' && typeof globalThis.requestAnimationFrame === 'function'
          ? globalThis.requestAnimationFrame
          : null;
      const safeCancelRaf =
        typeof globalThis !== 'undefined' && typeof globalThis.cancelAnimationFrame === 'function'
          ? globalThis.cancelAnimationFrame
          : null;
      const safeSetTimeout =
        typeof globalThis !== 'undefined' && typeof globalThis.setTimeout === 'function'
          ? globalThis.setTimeout
          : typeof setTimeout === 'function'
            ? setTimeout
            : null;
      const safeClearTimeout =
        typeof globalThis !== 'undefined' && typeof globalThis.clearTimeout === 'function'
          ? globalThis.clearTimeout
          : typeof clearTimeout === 'function'
            ? clearTimeout
            : null;

      // Auto-heal pós-mount: se o container montou com 0x0 antes do paint do Flexbox,
      // verifica no próximo frame de animação se as dimensões reais já estão disponíveis.
      const postMountRafId =
        (rawW <= 50 || rawH <= 50) && safeRaf
          ? safeRaf(() => {
              syncHostDimensions({ forceAutoScale: true, forceScrollToRealTime: true });
            })
          : null;

      // Blindagem de Fullscreen e Window Resize (#1344: "First click on fullscreen and resize doesn't work properly")
      let fullscreenRafId: number | null = null;
      let fullscreenTimer1: ReturnType<typeof setTimeout> | null = null;
      let fullscreenTimer2: ReturnType<typeof setTimeout> | null = null;

      const clearFullscreenTimers = () => {
        if (fullscreenRafId !== null && safeCancelRaf) {
          safeCancelRaf(fullscreenRafId);
          fullscreenRafId = null;
        }
        if (fullscreenTimer1 !== null && safeClearTimeout) {
          safeClearTimeout(fullscreenTimer1);
          fullscreenTimer1 = null;
        }
        if (fullscreenTimer2 !== null && safeClearTimeout) {
          safeClearTimeout(fullscreenTimer2);
          fullscreenTimer2 = null;
        }
      };

      const handleFullscreenOrWindowResize = (isFullscreenEvent = false) => {
        if (effectDisposed || isDisposedRef.current || !chart || chartRef.current !== chart) return;
        const syncOpts: ViewportSyncOptions = {
          forceAutoScale: true,
          forceScrollToRealTime: isFullscreenEvent,
        };
        syncHostDimensions(syncOpts);
        clearFullscreenTimers();
        if (safeRaf) {
          fullscreenRafId = safeRaf(() => {
            syncHostDimensions(syncOpts);
          });
        }
        if (safeSetTimeout) {
          fullscreenTimer1 = safeSetTimeout(() => {
            syncHostDimensions(syncOpts);
          }, 60);
          fullscreenTimer2 = safeSetTimeout(() => {
            syncHostDimensions(syncOpts);
          }, 200);
        }
      };

      const onFullscreenChange = () => handleFullscreenOrWindowResize(true);
      const onWindowResize = () => handleFullscreenOrWindowResize(false);

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('fullscreenchange', onFullscreenChange);
        document.addEventListener('webkitfullscreenchange', onFullscreenChange);
      }
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('resize', onWindowResize);
      }

      // 5. Blindagem contra perda e restauração de contexto WebGL (Khronos WebGL Spec)
      resizeObserver.observe(hostEl);
      const handleContextLost = (e: Event) => {
        e.preventDefault();
        console.warn('[IsolatedChartHost] WebGL Context Lost interceptado — aguardando restauração');
      };

      const handleContextRestored = () => {
        if (effectDisposed || isDisposedRef.current || !chart || chartRef.current !== chart) return;
        console.info('[IsolatedChartHost] WebGL Context Restored — recuperando séries e dados');
        try {
          const restoredBars = ensureStrictAscendingBars(latestCandlesRef.current);
          const cSeries = candleSeriesRef.current as any;
          const aSeries = areaSeriesRef.current as any;
          const cVisible = cSeries?.options?.()?.visible !== false;
          const aVisible = aSeries?.options?.()?.visible !== false;

          if (cSeries) {
            if (!cVisible) {
              cSeries.setData([]);
            } else {
              const existing = typeof cSeries.data === 'function' ? cSeries.data() : [];
              cSeries.setData(existing.length > 0 ? [...existing] : restoredBars);
            }
          }
          if (aSeries) {
            if (!aVisible) {
              aSeries.setData([]);
            } else {
              const existing = typeof aSeries.data === 'function' ? aSeries.data() : [];
              aSeries.setData(
                existing.length > 0
                  ? [...existing]
                  : restoredBars.map((c) => ({ time: c.time, value: c.close }))
              );
            }
          }
        } catch (err) {
          console.error('[IsolatedChartHost] Falha ao recarregar dados após restauração de contexto:', err);
        }
      };

      // 4. Supressão ativa de atribuição / logo do TradingView (#tv-attr-logo)
      const suppressTvLogo = () => {
        if (effectDisposed || !hostRef.current || typeof hostRef.current.querySelector !== 'function') return;
        const logo = hostRef.current.querySelector('#tv-attr-logo, .tv-attr-logo, a[href*="tradingview.com"]');
        if (logo) {
          (logo as HTMLElement).style.display = 'none';
          (logo as HTMLElement).style.visibility = 'hidden';
          (logo as HTMLElement).style.opacity = '0';
          (logo as HTMLElement).style.pointerEvents = 'none';
        }
      };
      suppressTvLogo();

      const logoTimer1 = safeSetTimeout ? safeSetTimeout(suppressTvLogo, 100) : null;
      const logoTimer2 = safeSetTimeout ? safeSetTimeout(suppressTvLogo, 500) : null;

      hostEl.addEventListener('webglcontextlost', handleContextLost, false);
      hostEl.addEventListener('webglcontextrestored', handleContextRestored, false);

      return () => {
        effectDisposed = true;
        isDisposedRef.current = true;
        clearFullscreenTimers();
        if (postMountRafId !== null && safeCancelRaf) safeCancelRaf(postMountRafId);
        if (logoTimer1 && safeClearTimeout) safeClearTimeout(logoTimer1);
        if (logoTimer2 && safeClearTimeout) safeClearTimeout(logoTimer2);
        if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
          document.removeEventListener('fullscreenchange', onFullscreenChange);
          document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
        }
        if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
          window.removeEventListener('resize', onWindowResize);
        }
        hostEl?.removeEventListener('webglcontextlost', handleContextLost);
        hostEl?.removeEventListener('webglcontextrestored', handleContextRestored);
        resizeObserver.disconnect();
        onChartDispose?.();
        chartRef.current = null;
        candleSeriesRef.current = null;
        areaSeriesRef.current = null;
        lastAppliedCandlesRef.current = [];
        hadBarsRef.current = false;
        lastDimensionsRef.current = { width: 0, height: 0 };
        if (chart) {
          try {
            if (candleSeries && typeof (chart as any).removeSeries === 'function') {
              (chart as any).removeSeries(candleSeries);
            }
            if (areaSeries && typeof (chart as any).removeSeries === 'function') {
              (chart as any).removeSeries(areaSeries);
            }
          } catch {
            /* ignore if series already removed */
          }
          try {
            chart.remove();
          } catch {
            /* ignore if already disposed */
          }
        }
        if (hostEl) {
          if (typeof hostEl.replaceChildren === 'function') {
            hostEl.replaceChildren();
          } else if ('innerHTML' in hostEl) {
            hostEl.innerHTML = '';
          }
        }
        // Anula referências nas closures V8 para impedir Zombies / Detached DOM (#9 / Issue #1359)
        chart = null;
        candleSeries = null;
        areaSeries = null;
        hostEl = null;
      };
    }, []); // Dependência vazia: NUNCA reinicia o canvas no mount

    // 2. Atualização isolada de dados via setData() com blindagem monotônica e preservação de scroll (#1344 / #1345 / #1346)
    useEffect(() => {
      if (isDisposedRef.current || !chartRef.current || !candleSeriesRef.current || !areaSeriesRef.current) return;

      const symbolChanged = prevSymbolRef.current !== symbol;
      const timeframeChanged = prevTimeframeRef.current !== timeframe;
      prevSymbolRef.current = symbol;
      prevTimeframeRef.current = timeframe;

      if (
        !symbolChanged &&
        !timeframeChanged &&
        areCandlesEquivalent(lastAppliedCandlesRef.current, candles)
      ) {
        return;
      }
      lastAppliedCandlesRef.current = candles;

      const cleanBars = ensureStrictAscendingBars(candles);
      const wasEmpty = !hadBarsRef.current;
      hadBarsRef.current = cleanBars.length > 0;

      try {
        candleSeriesRef.current.applyOptions({ priceFormat });
        areaSeriesRef.current.applyOptions({ priceFormat });

        candleSeriesRef.current.setData(cleanBars);
        const lineData: AreaData<UTCTimestamp>[] = cleanBars.map((c) => ({
          time: c.time,
          value: c.close,
        }));
        areaSeriesRef.current.setData(lineData);
      } catch {
        /* ignore if series is disposed */
      }

      // Garante autoScale e reposiciona em tempo real apenas quando ativo/timeframe mudam ou na 1ª carga
      if (symbolChanged || timeframeChanged || (wasEmpty && cleanBars.length > 0)) {
        try {
          chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
          chartRef.current?.timeScale().scrollToRealTime();
        } catch {
          /* ignore */
        }
      }
    }, [candles, symbol, timeframe, precision]);

    // 3. Comutação de visibilidade das séries sem destruição de instâncias nem perda de dados (#1346)
    useEffect(() => {
      if (isDisposedRef.current || !candleSeriesRef.current || !areaSeriesRef.current || !chartRef.current) return;

      const isCandles = chartType === 'candles';
      try {
        candleSeriesRef.current.applyOptions({ visible: isCandles });
        areaSeriesRef.current.applyOptions({ visible: !isCandles });

        onChartReady?.({
          chart: chartRef.current,
          activeSeries: isCandles ? candleSeriesRef.current : areaSeriesRef.current,
          candleSeries: candleSeriesRef.current,
          areaSeries: areaSeriesRef.current,
          timeScale: chartRef.current.timeScale(),
        });
      } catch {
        /* ignore if chart is disposed */
      }
    }, [chartType, onChartReady]);

    // 4. Configuração dinâmica da escala de tempo por timeframe e localização regional (Seção 10.4)
    useEffect(() => {
      if (isDisposedRef.current || !chartRef.current) return;
      try {
        chartRef.current.timeScale().applyOptions({
          secondsVisible: isSubMinuteTimeframe(timeframe),
        });
      } catch {
        /* ignore if chart is disposed */
      }
    }, [timeframe]);

    useEffect(() => {
      if (isDisposedRef.current || !chartRef.current || (!locale && !timezone)) return;
      const activeLocale = locale || 'pt-BR';
      const activeTz = timezone || 'America/Sao_Paulo';
      try {
        chartRef.current.applyOptions({
          localization: {
            locale: activeLocale,
            priceFormatter: (price: number) => {
              try {
                return new Intl.NumberFormat(activeLocale, {
                  minimumFractionDigits: precision,
                  maximumFractionDigits: precision,
                }).format(price);
              } catch {
                return price.toFixed(precision);
              }
            },
            timeFormatter: (time: number) => {
              try {
                const tsMs = typeof time === 'number' ? time * 1000 : Date.now();
                return new Intl.DateTimeFormat(activeLocale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                  timeZone: activeTz,
                }).format(new Date(tsMs));
              } catch {
                return '';
              }
            },
          },
        });
      } catch {
        // Ignora se mock de gráfico em teste unitário não suportar localization
      }
    }, [locale, timezone, precision]);

    // 5. Wake-up Auto-Resync na retomada de abas em segundo plano
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (!document.hidden && !isDisposedRef.current && hostRef.current && chartRef.current) {
          const rect =
            typeof hostRef.current.getBoundingClientRect === 'function'
              ? hostRef.current.getBoundingClientRect()
              : { width: 0, height: 0 };
          const w = Math.floor(rect.width || hostRef.current.clientWidth || 0);
          const h = Math.floor(rect.height || hostRef.current.clientHeight || 0);
          syncChartViewportOnResize(chartRef.current, w, h, lastDimensionsRef, {
            forceAutoScale: true,
            forceScrollToRealTime: true,
          });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return (
      <div
        ref={hostRef}
        className={`isolated-chart-host ${className ?? ''}`}
        role="img"
        aria-label="Canvas Gráfico Isolado de Trading"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '350px',
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      />
    );
  }
);

IsolatedChartHostComponent.displayName = 'IsolatedChartHost';

export const IsolatedChartHost = React.memo(
  IsolatedChartHostComponent,
  areChartHostPropsEqual
);
