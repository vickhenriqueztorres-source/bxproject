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
  isBinmax?: boolean;
  onChartReady?: (api: {
    chart: IChartApi;
    activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
    candleSeries: ISeriesApi<'Candlestick'>;
    areaSeries: ISeriesApi<'Area'>;
    timeScale: ITimeScaleApi<any>;
  }) => void;
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
 * Componente Ilhado de Canvas do TradingView Lightweight Charts (v4.2.1).
 * Implementa as 4 regras de ouro de isolamento + 4 blindagens industriais:
 * 1. Instanciação ÚNICA de Chart e Séries no mount (useEffect com []);
 * 2. Atualização de velas via setData() SEM recriar ou remover séries;
 * 3. Blindagem de dimensões contra colapsos temporários (width/height <= 50);
 * 4. React.memo com comparação customizada para ignorar re-renders do shell;
 * 5. Sanitização monotônica de barras antes de setData;
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
      isBinmax = true,
      onChartReady,
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
    const latestCandlesRef = useRef<CandlestickData<UTCTimestamp>[]>(candles);
    const precision = getAssetMeta(symbol ?? 'SYNTH_VOL_50').precision;
    const priceFormat = { type: 'price' as const, precision, minMove: 1 / 10 ** precision };

    latestCandlesRef.current = candles;

    const scrollToRealTime = useCallback(() => {
      chartRef.current?.timeScale().scrollToRealTime();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getChart: () => chartRef.current,
        getActiveSeries: () =>
          chartType === 'candles' ? candleSeriesRef.current : areaSeriesRef.current,
        getCandleSeries: () => candleSeriesRef.current,
        getAreaSeries: () => areaSeriesRef.current,
        getTimeScale: () => chartRef.current?.timeScale() ?? null,
        scrollToRealTime,
      }),
      [chartType, scrollToRealTime]
    );

    // 1. Instanciação ÚNICA do gráfico e das séries no mount
    useEffect(() => {
      if (!hostRef.current) return;

      const initWidth = Math.max(hostRef.current.clientWidth || 800, 320);
      const initHeight = Math.max(hostRef.current.clientHeight || 500, 300);

      const chart = createChart(hostRef.current, {
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
          borderColor: isBinmax ? 'rgba(244, 245, 247, 0.08)' : '#1d2c48',
          scaleMargins: { top: 0.12, bottom: 0.12 },
        },
        timeScale: {
          borderColor: isBinmax ? 'rgba(244, 245, 247, 0.08)' : '#1d2c48',
          timeVisible: true,
          secondsVisible: isSubMinuteTimeframe(timeframe),
          rightOffset: 12,
          barSpacing: 10,
        },
        crosshair: {
          vertLine: { color: isBinmax ? '#8A92A1' : '#4d6994', width: 1 },
          horzLine: { color: isBinmax ? '#8A92A1' : '#4d6994', width: 1 },
        },
      });

      // Instanciação ÚNICA das séries candlestick e area
      const candleSeries = chart.addCandlestickSeries({
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

      const areaSeries = chart.addAreaSeries({
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

      // Carga inicial de dados sem destruição de série (sanitização monotônica)
      if (latestCandlesRef.current.length > 0) {
        const cleanInitial = ensureStrictAscendingBars(latestCandlesRef.current);
        if (cleanInitial.length > 0) {
          candleSeries.setData(chartType === 'candles' ? cleanInitial : []);
          const lineData: AreaData<UTCTimestamp>[] = cleanInitial.map((c) => ({
            time: c.time,
            value: c.close,
          }));
          areaSeries.setData(chartType === 'line' ? lineData : []);
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

      // Blindagem geométrica no ResizeObserver: ignora dimensões <= 50px
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 50 && height > 50 && chartRef.current) {
            chartRef.current.applyOptions({ width, height });
            onDimensionsChange?.({ width, height });
          }
        }
      });

      // 5. Blindagem contra perda e restauração de contexto WebGL (Khronos WebGL Spec)
      const hostEl = hostRef.current;
      resizeObserver.observe(hostEl);
      const handleContextLost = (e: Event) => {
        // Obrigatório no padrão WebGL: sem preventDefault(), o contexto é destruído permanentemente
        e.preventDefault();
        console.warn('[IsolatedChartHost] WebGL Context Lost interceptado — aguardando restauração');
      };

      const handleContextRestored = () => {
        console.info('[IsolatedChartHost] WebGL Context Restored — recuperando séries e dados');
        if (chartRef.current && latestCandlesRef.current.length > 0) {
          try {
            if (candleSeriesRef.current?.options().visible) {
              areaSeriesRef.current?.setData([]);
              candleSeriesRef.current.setData([...candleSeriesRef.current.data()]);
            } else if (areaSeriesRef.current) {
              candleSeriesRef.current?.setData([]);
              const lineData = [...areaSeriesRef.current.data()];
              areaSeriesRef.current.setData(lineData);
            }
          } catch (err) {
            console.error('[IsolatedChartHost] Falha ao recarregar dados após restauração de contexto:', err);
          }
        }
      };

      // 4. Supressão ativa de atribuição / logo do TradingView (#tv-attr-logo)
      const suppressTvLogo = () => {
        if (!hostRef.current || typeof hostRef.current.querySelector !== 'function') return;
        const logo = hostRef.current.querySelector('#tv-attr-logo, .tv-attr-logo, a[href*="tradingview.com"]');
        if (logo) {
          (logo as HTMLElement).style.display = 'none';
          (logo as HTMLElement).style.visibility = 'hidden';
          (logo as HTMLElement).style.opacity = '0';
          (logo as HTMLElement).style.pointerEvents = 'none';
        }
      };
      suppressTvLogo();
      const safeSetTimeout = typeof globalThis !== 'undefined' && typeof globalThis.setTimeout === 'function'
        ? globalThis.setTimeout
        : (typeof setTimeout === 'function' ? setTimeout : null);
      const safeClearTimeout = typeof globalThis !== 'undefined' && typeof globalThis.clearTimeout === 'function'
        ? globalThis.clearTimeout
        : (typeof clearTimeout === 'function' ? clearTimeout : null);

      const logoTimer1 = safeSetTimeout ? safeSetTimeout(suppressTvLogo, 100) : null;
      const logoTimer2 = safeSetTimeout ? safeSetTimeout(suppressTvLogo, 500) : null;

      hostEl.addEventListener('webglcontextlost', handleContextLost, false);
      hostEl.addEventListener('webglcontextrestored', handleContextRestored, false);

      return () => {
        if (logoTimer1 && safeClearTimeout) safeClearTimeout(logoTimer1);
        if (logoTimer2 && safeClearTimeout) safeClearTimeout(logoTimer2);
        hostEl.removeEventListener('webglcontextlost', handleContextLost);
        hostEl.removeEventListener('webglcontextrestored', handleContextRestored);
        resizeObserver.disconnect();
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        areaSeriesRef.current = null;
      };
    }, []); // Dependência vazia: NUNCA reinicia o canvas no mount

    // 2. Atualização isolada de dados via setData() com blindagem monotônica
    useEffect(() => {
      if (!candleSeriesRef.current || !areaSeriesRef.current) return;

      const cleanBars = ensureStrictAscendingBars(candles);
      candleSeriesRef.current.applyOptions({ priceFormat });
      areaSeriesRef.current.applyOptions({ priceFormat });

      if (chartType === 'candles') {
        areaSeriesRef.current.setData([]);
        candleSeriesRef.current.setData(cleanBars);
      } else {
        candleSeriesRef.current.setData([]);
        const lineData: AreaData<UTCTimestamp>[] = cleanBars.map((c) => ({
          time: c.time,
          value: c.close,
        }));
        areaSeriesRef.current.setData(lineData);
      }

      // Garante autoScale recalculado com os novos limites para evitar gráficos comprimidos
      try {
        chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
        chartRef.current?.timeScale().scrollToRealTime();
      } catch { /* ignore */ }
    }, [candles, chartType, symbol, timeframe]);

    // 2.1 Reset e Recálculo Forçado de AutoScale em Mudança de Símbolo (Prevenção de gráfico comprimido / fora de escala)
    useEffect(() => {
      if (!chartRef.current) return;
      try {
        chartRef.current.priceScale('right').applyOptions({
          autoScale: true,
        });
        chartRef.current.timeScale().scrollToRealTime();
      } catch {
        // defensivo
      }
    }, [symbol]);

    // 3. Comutação de visibilidade das séries sem destruição de instâncias
    useEffect(() => {
      if (!candleSeriesRef.current || !areaSeriesRef.current || !chartRef.current) return;

      const isCandles = chartType === 'candles';
      candleSeriesRef.current.applyOptions({ visible: isCandles });
      areaSeriesRef.current.applyOptions({ visible: !isCandles });

      onChartReady?.({
        chart: chartRef.current,
        activeSeries: isCandles ? candleSeriesRef.current : areaSeriesRef.current,
        candleSeries: candleSeriesRef.current,
        areaSeries: areaSeriesRef.current,
        timeScale: chartRef.current.timeScale(),
      });
    }, [chartType, onChartReady]);

    // 4. Configuração dinâmica da escala de tempo por timeframe
    useEffect(() => {
      chartRef.current?.timeScale().applyOptions({
        secondsVisible: isSubMinuteTimeframe(timeframe),
      });
    }, [timeframe]);

    // 5. Wake-up Auto-Resync na retomada de abas em segundo plano
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (!document.hidden && hostRef.current && chartRef.current) {
          const w = hostRef.current.clientWidth;
          const h = hostRef.current.clientHeight;
          if (w > 50 && h > 50) {
            chartRef.current.applyOptions({ width: w, height: h });
          }
          chartRef.current.timeScale().scrollToRealTime();
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
  (prev, next) => {
    return (
      prev.candles === next.candles &&
      prev.chartType === next.chartType &&
      prev.timeframe === next.timeframe &&
      prev.symbol === next.symbol &&
      prev.isBinmax === next.isBinmax
    );
  }
);
