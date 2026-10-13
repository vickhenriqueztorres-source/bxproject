import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LineStyle,
  type AreaData,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { fetchHistoricalCandlesChunk, generateSeedCandles, type Candle, type Contract } from '../api/client';
import type { Tick } from '../feed/protocol';
import { formatMinor } from '../lib/money';
import {
  candleData,
  candleFromTick,
  resampleCandles,
  timeframeSeconds,
  isSubMinuteTimeframe,
  type Timeframe,
} from './candle-adapter';
import { normalizeSeedWithTick, safeCandleFromTick } from './chart-scale-normalizer';
import { IsolatedChartHost } from './IsolatedChartHost';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { TradersMoodBar } from './TradersMoodBar';
import { useTickPulse } from './useTickPulse';
import { RafChartUpdater } from './raf-updater';
import { ChartDrawingToolbar } from './ChartDrawingToolbar';
import { ChartDrawingOverlay } from './ChartDrawingOverlay';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { ASSET_CATALOG, type AssetCategory } from '../catalog/assets';
import { AssetFlagBadge } from '../components/header/AssetFlagBadge';
import {
  DEFAULT_INDICATORS,
  type DrawingItem,
  type DrawingToolType,
  type IndicatorConfig,
} from './drawing-types';
import { loadSafeDrawings, saveSafeDrawings } from './drawing-sanitizer';
import {
  calculateSMA,
  calculateEMA,
  calculateWMA,
  calculateBollinger,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateVWAP,
  calculateCCI,
} from './indicator-calculator';

export type ChartType = 'candles' | 'line';
export type { Timeframe };

export interface PriceChartProps {
  candles: Candle[];
  tick: Tick | null;
  symbol?: string;
  activeContracts?: Contract[];
  isStale?: boolean;
  isVisible?: boolean;
  onSelectSymbol?: (symbol: string) => void;
}

export function PriceChart({
  candles,
  tick,
  symbol = 'SYNTH_VOL_50',
  activeContracts = [],
  isStale = false,
  isVisible = true,
  onSelectSymbol,
}: PriceChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaSeries = useRef<ISeriesApi<'Area'> | null>(null);
  const currentPriceLine = useRef<IPriceLine | null>(null);
  const currentPriceLineSeries = useRef<ISeriesApi<any> | null>(null);
  const strikeLinesMap = useRef<Map<string, IPriceLine>>(new Map());

  const safeRemoveCurrentPriceLine = useCallback(() => {
    if (currentPriceLine.current) {
      try {
        if (currentPriceLineSeries.current) {
          currentPriceLineSeries.current.removePriceLine(currentPriceLine.current);
        } else {
          if (candleSeries.current) candleSeries.current.removePriceLine(currentPriceLine.current);
          if (areaSeries.current) areaSeries.current.removePriceLine(currentPriceLine.current);
        }
      } catch { /* ignore */ }
      currentPriceLine.current = null;
      currentPriceLineSeries.current = null;
    }
  }, []);
  const indicatorSeriesMap = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const latestCandle = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const rafUpdaterRef = useRef<RafChartUpdater>(new RafChartUpdater());

  const [chartType, setChartType] = useState<ChartType>('candles');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [sentimentBulls, setSentimentBulls] = useState(64);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [isChartReady, setIsChartReady] = useState(false);
  const lastPrice = useRef<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN' | 'NEUTRAL'>('NEUTRAL');
  const tickPulse = useTickPulse(tick);

  // Seletor Rápido de Ativos In-Chart (Subetapa 2)
  const [showAssetSelector, setShowAssetSelector] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState('');
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<'TODOS' | AssetCategory>('TODOS');

  useEffect(() => {
    if (!showAssetSelector) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAssetSelector(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAssetSelector]);

  // Retenção Histórica & Janela Deslizante Macro (Perigo 8 / Subetapas 4 & 6)
  const MAX_LOADED_BARS = 3500;
  const [internalCandles, setInternalCandles] = useState<Candle[]>(candles);
  const isLoadingHistoryRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const oldestLoadedTimeRef = useRef<number | null>(null);
  const shouldScrollToRealTimeRef = useRef(true);

  // Sincronizar quando a prop inicial de candles ou o símbolo mudar (Subetapa 01)
  useEffect(() => {
    setInternalCandles(candles);
    hasMoreHistoryRef.current = true;
    isLoadingHistoryRef.current = false;
    oldestLoadedTimeRef.current = null;
    shouldScrollToRealTimeRef.current = true;
    rafUpdaterRef.current.reset(symbol);
  }, [candles, symbol]);

  // Ferramentas Gráficas e Indicadores Técnicos
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(DEFAULT_INDICATORS);
  const [drawings, setDrawings] = useState<DrawingItem[]>(() => loadSafeDrawings(symbol));
  const [activeTool, setActiveTool] = useState<DrawingToolType>(null);
  const [activeColor, setActiveColor] = useState<string>('#00e676');

  // Persistência blindada de desenhos no localStorage por ativo com Quota Guard
  useEffect(() => {
    saveSafeDrawings(symbol, drawings);
  }, [drawings, symbol]);

  useEffect(() => {
    setDrawings(loadSafeDrawings(symbol));
  }, [symbol]);

  // Monitorar direção do preço e atualizar levemente o sentimento da comunidade
  useEffect(() => {
    if (!tick) return;
    const currentPrice = Number(tick.price);
    if (Number.isFinite(currentPrice)) {
      if (lastPrice.current !== null) {
        if (currentPrice > lastPrice.current) {
          setPriceDirection('UP');
          setSentimentBulls((prev) => Math.min(88, Math.max(45, prev + 1)));
        } else if (currentPrice < lastPrice.current) {
          setPriceDirection('DOWN');
          setSentimentBulls((prev) => Math.max(25, Math.min(65, prev - 1)));
        }
      }
      lastPrice.current = currentPrice;
    }
  }, [tick]);

  // Reset de referência de preço e sequência ao alternar ativo
  useEffect(() => {
    lastPrice.current = null;
    rafUpdaterRef.current.resetSequence();
    shouldScrollToRealTimeRef.current = true;
  }, [symbol]);

  const isBinmax = isNewTraderoomEnabled();

  // Callback de inicialização do canvas vindo do componente ilhado IsolatedChartHost
  const handleChartReady = useCallback(
    (api: {
      chart: IChartApi;
      activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
      candleSeries: ISeriesApi<'Candlestick'>;
      areaSeries: ISeriesApi<'Area'>;
      timeScale: any;
    }) => {
      chartInstance.current = api.chart;
      candleSeries.current = api.candleSeries;
      areaSeries.current = api.areaSeries;
      setIsChartReady(true);

      if (shouldScrollToRealTimeRef.current) {
        api.timeScale.scrollToRealTime();
        shouldScrollToRealTimeRef.current = false;
      }
    },
    []
  );

  const effectiveCandles = useMemo(() => {
    if (internalCandles && internalCandles.length > 0) return internalCandles;
    return generateSeedCandles(symbol, 2880);
  }, [internalCandles, symbol]);

  const resampledCandles = useMemo(() => {
    return resampleCandles(effectiveCandles, timeframe);
  }, [effectiveCandles, timeframe]);

  // Atualiza referência da vela mais recente quando as velas reamostradas mudam
  useEffect(() => {
    latestCandle.current = resampledCandles.at(-1) ?? null;
  }, [resampledCandles]);

  // Sincronizar Linha de Preço Atual na troca de tipo de gráfico
  useEffect(() => {
    safeRemoveCurrentPriceLine();

    const activeSeries = chartType === 'candles' ? candleSeries.current : areaSeries.current;
    if (!activeSeries || lastPrice.current === null) return;

    const price = lastPrice.current;
    const isUp = priceDirection === 'UP' || priceDirection === 'NEUTRAL';
    const color = isBinmax ? '#DCE1EA' : (isUp ? '#00e676' : '#ff3d71');
    const title = isBinmax ? price.toFixed(5) : (isUp ? '▲ Cotação' : '▼ Cotação');

    currentPriceLine.current = activeSeries.createPriceLine({
      price,
      color,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title,
    });
    currentPriceLineSeries.current = activeSeries;
  }, [chartType, isBinmax, safeRemoveCurrentPriceLine]);

  // Cleanup geral ao desmontar o componente
  useEffect(() => {
    return () => {
      safeRemoveCurrentPriceLine();
      chartInstance.current = null;
      candleSeries.current = null;
      areaSeries.current = null;
      currentPriceLineSeries.current = null;
      latestCandle.current = null;
      lastPrice.current = null;
      strikeLinesMap.current.clear();
      indicatorSeriesMap.current.clear();
      rafUpdaterRef.current.cancel();
    };
  }, [safeRemoveCurrentPriceLine]);

  // Limpeza de overlays, linhas de preço e strikes na troca de ativo (Subetapa 02)
  useEffect(() => {
    safeRemoveCurrentPriceLine();
    lastPrice.current = null;

    for (const [, line] of strikeLinesMap.current.entries()) {
      try {
        if (candleSeries.current) candleSeries.current.removePriceLine(line);
        if (areaSeries.current) areaSeries.current.removePriceLine(line);
      } catch { /* ignore */ }
    }
    strikeLinesMap.current.clear();

    shouldScrollToRealTimeRef.current = true;
    if (chartInstance.current) {
      try {
        chartInstance.current.priceScale('right').applyOptions({ autoScale: true });
        chartInstance.current.timeScale().fitContent();
        chartInstance.current.timeScale().scrollToRealTime();
      } catch { /* ignore */ }
    }
  }, [symbol, safeRemoveCurrentPriceLine]);

  // Lazy Loading Retroativo no Scroll para a Esquerda (Subetapa 4 & 6)
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    let debounceTimer: any = null;

    const onVisibleLogicalRangeChanged = (logicalRange: any) => {
      if (!logicalRange || isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

      // Se o usuário rolou até perto da borda esquerda (menos de 60 barras visíveis - Prefetch Preditivo)
      if (logicalRange.from < 60) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

          const sorted = [...internalCandles].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
          const oldest = sorted[0];
          if (!oldest) return;

          const oldestEpoch = typeof oldest.time === 'number'
            ? oldest.time
            : Math.floor(Date.parse(String(oldest.time)) / 1000);

          if (!Number.isFinite(oldestEpoch) || oldestEpoch <= 0) return;
          if (oldestLoadedTimeRef.current === oldestEpoch) return;

          isLoadingHistoryRef.current = true;
          try {
            const olderBars = await fetchHistoricalCandlesChunk(symbol, oldestEpoch, 1000);
            if (!olderBars || olderBars.length === 0) {
              hasMoreHistoryRef.current = false;
              return;
            }

            oldestLoadedTimeRef.current = oldestEpoch;
            shouldScrollToRealTimeRef.current = false;

            setInternalCandles((prev) => {
              const map = new Map<number, Candle>();
              for (const b of olderBars) {
                const t = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(String(b.time)) / 1000);
                if (Number.isFinite(t)) map.set(t, b);
              }
              for (const b of prev) {
                const t = typeof b.time === 'number' ? b.time : Math.floor(Date.parse(String(b.time)) / 1000);
                if (Number.isFinite(t)) map.set(t, b);
              }

              let merged = Array.from(map.values()).sort(
                (a, b) => (Number(a.time) || 0) - (Number(b.time) || 0)
              );

              // Teto da Janela Deslizante (Subetapa 6: MAX_LOADED_BARS = 3000)
              if (merged.length > MAX_LOADED_BARS) {
                merged = merged.slice(merged.length - MAX_LOADED_BARS);
              }

              const addedCount = merged.length - prev.length;
              if (addedCount > 0 && chartInstance.current) {
                const currentRange = chartInstance.current.timeScale().getVisibleLogicalRange();
                if (currentRange) {
                  chartInstance.current.timeScale().setVisibleLogicalRange({
                    from: currentRange.from + addedCount,
                    to: currentRange.to + addedCount,
                  });
                }
              }

              return merged;
            });
          } catch (err) {
            console.warn('[PriceChart] Falha ao carregar histórico retroativo:', err);
          } finally {
            isLoadingHistoryRef.current = false;
          }
        }, 200);
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      try {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
      } catch { /* ignore */ }
    };
  }, [isChartReady, internalCandles, symbol]);

  // Sincronização dos 10 Indicadores Técnicos Nativos
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || resampledCandles.length === 0) return;

    for (const ind of indicators) {
      if (ind.enabled) {
        if (ind.type === 'SMA') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `${ind.type} ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateSMA(resampledCandles, ind.period);
          series.setData(data);
        } else if (ind.type === 'EMA') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `${ind.type} ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateEMA(resampledCandles, ind.period);
          series.setData(data);
        } else if (ind.type === 'WMA') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `${ind.type} ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateWMA(resampledCandles, ind.period);
          series.setData(data);
        } else if (ind.type === 'BOLLINGER') {
          const upperKey = `${ind.id}_upper`;
          const lowerKey = `${ind.id}_lower`;
          let upperSeries = indicatorSeriesMap.current.get(upperKey);
          let lowerSeries = indicatorSeriesMap.current.get(lowerKey);
          if (!upperSeries) {
            upperSeries = chart.addLineSeries({
              color: ind.color,
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              title: 'BB Superior',
            });
            indicatorSeriesMap.current.set(upperKey, upperSeries);
          }
          if (!lowerSeries) {
            lowerSeries = chart.addLineSeries({
              color: ind.color,
              lineWidth: 1,
              lineStyle: LineStyle.Dotted,
              title: 'BB Inferior',
            });
            indicatorSeriesMap.current.set(lowerKey, lowerSeries);
          }
          const points = calculateBollinger(resampledCandles, ind.period, ind.stdDev ?? 2);
          upperSeries.setData(points.map((p) => ({ time: p.time, value: p.upper })));
          lowerSeries.setData(points.map((p) => ({ time: p.time, value: p.lower })));
        } else if (ind.type === 'RSI') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `RSI ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateRSI(resampledCandles, ind.period);
          series.setData(data);
        } else if (ind.type === 'MACD') {
          const macdKey = `${ind.id}_macd`;
          const signalKey = `${ind.id}_signal`;
          let macdSeries = indicatorSeriesMap.current.get(macdKey);
          let signalSeries = indicatorSeriesMap.current.get(signalKey);
          if (!macdSeries) {
            macdSeries = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `MACD (${ind.fastPeriod ?? 12}, ${ind.slowPeriod ?? 26})`,
            });
            indicatorSeriesMap.current.set(macdKey, macdSeries);
          }
          if (!signalSeries) {
            signalSeries = chart.addLineSeries({
              color: ind.signalColor ?? '#f97316',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              title: `Sinal (${ind.signalPeriod ?? 9})`,
            });
            indicatorSeriesMap.current.set(signalKey, signalSeries);
          }
          const macdData = calculateMACD(
            resampledCandles,
            ind.fastPeriod ?? 12,
            ind.slowPeriod ?? 26,
            ind.signalPeriod ?? 9
          );
          macdSeries.setData(macdData.map((p) => ({ time: p.time, value: p.macd })));
          signalSeries.setData(macdData.map((p) => ({ time: p.time, value: p.signal })));
        } else if (ind.type === 'STOCHASTIC') {
          const kKey = `${ind.id}_k`;
          const dKey = `${ind.id}_d`;
          let kSeries = indicatorSeriesMap.current.get(kKey);
          let dSeries = indicatorSeriesMap.current.get(dKey);
          if (!kSeries) {
            kSeries = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `%K (${ind.kPeriod ?? 14})`,
            });
            indicatorSeriesMap.current.set(kKey, kSeries);
          }
          if (!dSeries) {
            dSeries = chart.addLineSeries({
              color: ind.signalColor ?? '#eab308',
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              title: `%D (${ind.dPeriod ?? 3})`,
            });
            indicatorSeriesMap.current.set(dKey, dSeries);
          }
          const stochData = calculateStochastic(
            resampledCandles,
            ind.kPeriod ?? 14,
            ind.dPeriod ?? 3
          );
          kSeries.setData(stochData.map((p) => ({ time: p.time, value: p.k })));
          dSeries.setData(stochData.map((p) => ({ time: p.time, value: p.d })));
        } else if (ind.type === 'ATR') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `ATR ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateATR(resampledCandles, ind.period);
          series.setData(data);
        } else if (ind.type === 'VWAP') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: 'VWAP',
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateVWAP(resampledCandles);
          series.setData(data);
        } else if (ind.type === 'CCI') {
          let series = indicatorSeriesMap.current.get(ind.id);
          if (!series) {
            series = chart.addLineSeries({
              color: ind.color,
              lineWidth: 2,
              title: `CCI ${ind.period}`,
            });
            indicatorSeriesMap.current.set(ind.id, series);
          }
          const data = calculateCCI(resampledCandles, ind.period);
          series.setData(data);
        }
      } else {
        // Remover séries desativadas
        if (ind.type === 'BOLLINGER') {
          const u = indicatorSeriesMap.current.get(`${ind.id}_upper`);
          if (u) {
            try { chart.removeSeries(u); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_upper`);
          }
          const l = indicatorSeriesMap.current.get(`${ind.id}_lower`);
          if (l) {
            try { chart.removeSeries(l); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_lower`);
          }
        } else if (ind.type === 'MACD') {
          const m = indicatorSeriesMap.current.get(`${ind.id}_macd`);
          if (m) {
            try { chart.removeSeries(m); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_macd`);
          }
          const s = indicatorSeriesMap.current.get(`${ind.id}_signal`);
          if (s) {
            try { chart.removeSeries(s); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_signal`);
          }
        } else if (ind.type === 'STOCHASTIC') {
          const k = indicatorSeriesMap.current.get(`${ind.id}_k`);
          if (k) {
            try { chart.removeSeries(k); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_k`);
          }
          const d = indicatorSeriesMap.current.get(`${ind.id}_d`);
          if (d) {
            try { chart.removeSeries(d); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(`${ind.id}_d`);
          }
        } else {
          const s = indicatorSeriesMap.current.get(ind.id);
          if (s) {
            try { chart.removeSeries(s); } catch { /* ignore */ }
            indicatorSeriesMap.current.delete(ind.id);
          }
        }
      }
    }
  }, [isChartReady, indicators, resampledCandles]);

  // Atualização em tempo real de novos ticks com Throttling rAF a 60fps
  useEffect(() => {
    if (!tick) return;

    // Blindagem Anti-Cross-Asset Zombie Tick: descarta ticks de símbolos anteriores em trânsito
    if (tick.symbol && tick.symbol !== symbol) {
      return;
    }

    rafUpdaterRef.current.push(tick, (targetTick) => {
      // Re-valida dentro do callback rAF caso o ativo tenha mudado enquanto o frame aguardava
      if (targetTick.symbol && targetTick.symbol !== symbol) {
        return;
      }
      const price = Number(targetTick.price);

      if (chartType === 'candles' && candleSeries.current) {
        const next = safeCandleFromTick(targetTick, latestCandle.current, timeframe);
        if (next) {
          candleSeries.current.update(next);
          latestCandle.current = next;
        }
      } else if (chartType === 'line' && areaSeries.current) {
        const epoch = Date.parse(targetTick.ts);
        if (Number.isFinite(epoch) && Number.isFinite(price)) {
          const step = timeframeSeconds(timeframe);
          const tsSeconds = Math.floor(epoch / 1000);
          const bucket = (Math.floor(tsSeconds / step) * step) as UTCTimestamp;
          areaSeries.current.update({ time: bucket, value: price });
        }
      }

      // Atualizar Linha de Preço Atual
      const activeSeries = candleSeries.current ?? areaSeries.current;
      if (activeSeries && Number.isFinite(price)) {
        const isUp = priceDirection === 'UP' || priceDirection === 'NEUTRAL';
        const color = isBinmax ? '#DCE1EA' : (isUp ? '#00e676' : '#ff3d71');
        const title = isBinmax ? price.toFixed(5) : (isUp ? '▲ Cotação' : '▼ Cotação');

        if (currentPriceLine.current) {
          currentPriceLine.current.applyOptions({
            price,
            color,
            title,
          });
        } else {
          currentPriceLine.current = activeSeries.createPriceLine({
            price,
            color,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title,
          });
          currentPriceLineSeries.current = activeSeries;
        }
      }
    });
  }, [tick, chartType, priceDirection, timeframe, isBinmax, symbol]);

  // Pausa e Retomada de Renderização sob Segundo Plano
  useEffect(() => {
    if (!isVisible) {
      rafUpdaterRef.current.pause();
    } else {
      rafUpdaterRef.current.resume();
    }
  }, [isVisible]);

  // Sincronizar linhas de strike para ordens ativas
  useEffect(() => {
    const activeSeries = candleSeries.current ?? areaSeries.current;
    if (!activeSeries) return;

    const currentOpenIds = new Set(activeContracts.filter((c) => c.status === 'OPEN').map((c) => c.id));

    // Remover linhas de contratos liquidados ou removidos
    for (const [id, line] of strikeLinesMap.current.entries()) {
      if (!currentOpenIds.has(id)) {
        try {
          activeSeries.removePriceLine(line);
        } catch { /* ignore */ }
        strikeLinesMap.current.delete(id);
      }
    }

    // Criar linhas de strike para contratos abertos
    for (const contract of activeContracts) {
      if (contract.status !== 'OPEN') continue;
      if (strikeLinesMap.current.has(contract.id)) continue;

      const rawStrike = contract.strike_price ?? contract.entry_price ?? tick?.price;
      const strike = Number(rawStrike);
      if (!Number.isFinite(strike) || strike <= 0) continue;

      const isUp = contract.direction === 'UP';
      const color = isUp ? '#00e676' : '#ff3d71';
      const stakeNum = Number(contract.stake_minor);
      const title = `${isUp ? '▲ COMPRA' : '▼ VENDA'} ${Number.isFinite(stakeNum) ? formatMinor(stakeNum) : ''}`;

      const line = activeSeries.createPriceLine({
        price: strike,
        color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title,
      });
      strikeLinesMap.current.set(contract.id, line);
    }
  }, [activeContracts, chartType, tick?.price]);

  const handleToggleIndicator = (id: string) => {
    setIndicators((prev) =>
      prev.map((ind) => (ind.id === id ? { ...ind, enabled: !ind.enabled } : ind))
    );
  };

  const handleAddDrawing = (drawing: DrawingItem) => {
    setDrawings((prev) => [...prev, drawing]);
  };

  const handleUpdateDrawing = (updated: DrawingItem) => {
    setDrawings((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleRemoveDrawing = (id: string) => {
    setDrawings((prev) => prev.filter((d) => d.id !== id));
  };

  const handleClearDrawings = () => {
    if (window.confirm('Deseja remover todos os desenhos gráficos deste ativo?')) {
      setDrawings([]);
    }
  };

  const inChartFilteredAssets = useMemo(() => {
    return ASSET_CATALOG.filter((a) => {
      const matchesCat = assetCategoryFilter === 'TODOS' || a.category === assetCategoryFilter;
      const query = assetSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        a.symbol.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });
  }, [assetCategoryFilter, assetSearchQuery]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* HUD Flutuante Superior */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '16px',
          right: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {/* Espaço reservado para manter o alinhamento com a barra esquerda */}
        {isBinmax ? (
          <div style={{ position: 'relative', pointerEvents: 'auto' }}>
            <div
              data-testid="chart-top-asset-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(21, 25, 34, 0.85)',
                border: '1px solid rgba(244, 245, 247, 0.08)',
                borderRadius: '8px',
                padding: '4px 10px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
              }}
            >
              <div
                onClick={() => setShowAssetSelector((prev) => !prev)}
                role="button"
                aria-label="Seleccionar activo del gráfico"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <AssetFlagBadge symbol={symbol} size={16} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F4F5F7' }}>
                  {symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}
                </span>
                <span style={{ fontSize: '10px', color: '#00e5ff', fontWeight: 600 }}>Turbo ▾</span>
              </div>
              <div style={{ width: '1px', height: '14px', background: 'rgba(244, 245, 247, 0.1)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8A92A1', fontSize: '12px', cursor: 'pointer' }}>
                <span title="Información del activo">ⓘ</span>
                <span title="Crear alerta">🔔</span>
                <span title="Agregar a favoritos">★</span>
              </div>
            </div>

            {/* Dropdown Seletor de Ativos Flutuante In-Chart */}
            {showAssetSelector && (
              <>
                <div
                  onClick={() => setShowAssetSelector(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 90,
                    background: 'rgba(0, 0, 0, 0.35)',
                  }}
                />
                <div
                  data-testid="chart-asset-selector-dropdown"
                  style={{
                    position: 'absolute',
                    top: '36px',
                    left: 0,
                    width: '320px',
                    maxHeight: '420px',
                    background: '#151922',
                    border: '1px solid rgba(244, 245, 247, 0.12)',
                    borderRadius: '8px',
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    boxSizing: 'border-box',
                    gap: '8px',
                  }}
                >
                  {/* Busca */}
                  <input
                    type="text"
                    data-testid="in-chart-search-input"
                    placeholder="Buscar activo (ej: EUR, BTC, Vol)..."
                    value={assetSearchQuery}
                    onChange={(e) => setAssetSearchQuery(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: '#0D0F14',
                      border: '1px solid rgba(244, 245, 247, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      fontSize: '11px',
                      color: '#F4F5F7',
                      outline: 'none',
                    }}
                  />

                  {/* Categorias Pills */}
                  <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
                    {(['TODOS', 'Sintéticos', 'Forex', 'Cripto', 'Commodities'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAssetCategoryFilter(cat)}
                        style={{
                          background: assetCategoryFilter === cat ? 'rgba(0, 229, 255, 0.15)' : 'rgba(244, 245, 247, 0.05)',
                          border: assetCategoryFilter === cat ? '1px solid #00e5ff' : '1px solid transparent',
                          color: assetCategoryFilter === cat ? '#00e5ff' : '#8A92A1',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {/* Lista de Ativos */}
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {inChartFilteredAssets.map((asset) => {
                      const isCur = asset.symbol === symbol;
                      return (
                        <div
                          key={asset.symbol}
                          onClick={() => {
                            if (onSelectSymbol) {
                              onSelectSymbol(asset.symbol);
                            }
                            setShowAssetSelector(false);
                            setAssetSearchQuery('');
                          }}
                          data-testid={`in-chart-asset-row-${asset.symbol}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: isCur ? 'rgba(0, 229, 255, 0.1)' : 'transparent',
                            border: isCur ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AssetFlagBadge symbol={asset.symbol} size={16} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: isCur ? '#00e5ff' : '#F4F5F7' }}>
                                {asset.symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}
                              </span>
                              <span style={{ fontSize: '9px', color: '#8A92A1' }}>{asset.name}</span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 800,
                              color: '#22C47A',
                              background: 'rgba(34, 196, 122, 0.12)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontFamily: "'Geist Mono', monospace",
                            }}
                          >
                            +{asset.payout}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ width: '40px' }} />
        )}

        {/* Tag Pulsante de Preço em Tempo Real (Apenas modo legado, não no Binmax) */}
        {!isBinmax && (
          <div
            className={`price-tag-pulse ${priceDirection === 'DOWN' ? 'down' : 'up'} ${
              isStale ? 'stale' : tickPulse === 'UP' ? 'tick-pulse-green' : tickPulse === 'DOWN' ? 'tick-pulse-red' : ''
            }`}
            style={{
              pointerEvents: 'auto',
              background: isStale ? 'rgba(50, 60, 75, 0.85)' : undefined,
              borderColor: isStale ? '#5a6b82' : undefined,
              color: isStale ? '#a0b0c5' : undefined,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isStale ? '#8898a8' : priceDirection === 'DOWN' ? '#ff3d71' : '#00e676',
              }}
            />
            <span>{tick?.price ?? '—'} USD</span>
            <span>{isStale ? '⏸️' : priceDirection === 'DOWN' ? '▼' : '▲'}</span>
          </div>
        )}

        {/* Trader Sentiment Bar (Sentimento da Comunidade Legado) */}
        {!isBinmax && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(10, 16, 30, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #1f2e4b',
              borderRadius: '8px',
              padding: '6px 12px',
              pointerEvents: 'auto',
              minWidth: '170px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800 }}>
              <span style={{ color: '#00e676' }}>▲ {sentimentBulls}% COMPRA</span>
              <span style={{ color: '#ff3d71' }}>▼ {100 - sentimentBulls}% VENDA</span>
            </div>
            {/* Barra bicolor */}
            <div
              style={{
                height: '4px',
                width: '100%',
                borderRadius: '2px',
                background: '#ff3d71',
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${sentimentBulls}%`,
                  background: '#00e676',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Barra de Ferramentas Gráficas Lateral (Estilo IQ Option) */}
      <ChartDrawingToolbar
        chartType={chartType}
        onSelectChartType={(ct) => {
          shouldScrollToRealTimeRef.current = true;
          setChartType(ct);
        }}
        timeframe={timeframe}
        onSelectTimeframe={(tf) => {
          shouldScrollToRealTimeRef.current = true;
          setTimeframe(tf);
        }}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        activeColor={activeColor}
        onChangeColor={setActiveColor}
        drawingsCount={drawings.length}
        drawings={drawings}
        onRemoveDrawing={handleRemoveDrawing}
        onClearDrawings={handleClearDrawings}
        indicators={indicators}
        onToggleIndicator={handleToggleIndicator}
      />

      {/* Overlays de Linhas de Tempo, Ordens e Desenhos Técnicos (Blindados com isChartReady) */}
      {isChartReady && (
        <>
          <TimeLinesOverlay
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            chartInstance={chartInstance.current}
            latestCandleTime={latestCandle.current?.time ?? null}
            tickTimestamp={tick?.ts ?? null}
            timeframe={timeframe}
          />

          <OrderFlagsOverlay
            contracts={activeContracts}
            currentPrice={tick ? Number(tick.price) : null}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            activeSeries={chartType === 'candles' ? candleSeries.current : areaSeries.current}
          />

          <ChartDrawingOverlay
            chartInstance={chartInstance.current}
            activeSeries={chartType === 'candles' ? candleSeries.current : areaSeries.current}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            drawings={drawings}
            onAddDrawing={handleAddDrawing}
            onUpdateDrawing={handleUpdateDrawing}
            onRemoveDrawing={handleRemoveDrawing}
            activeTool={activeTool}
            onFinishDrawing={() => setActiveTool(null)}
            activeColor={activeColor}
          />
        </>
      )}

      {/* Barra de Sentimento Vertical (Trader's Mood Bar) */}
      <TradersMoodBar bullsPercentage={sentimentBulls} />

      {/* Canvas Ilhado do Lightweight Charts (Subetapa 01/03) */}
      <IsolatedChartHost
        candles={resampledCandles}
        chartType={chartType}
        timeframe={timeframe}
        symbol={symbol}
        isBinmax={isBinmax}
        onChartReady={handleChartReady}
        onDimensionsChange={setDimensions}
      />
    </div>
  );
}
