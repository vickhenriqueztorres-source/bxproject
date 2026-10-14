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
import { fetchHistoricalCandlesChunk, type Candle, type Contract } from '../api/client';
import type { Tick } from '../feed/protocol';
import { formatMinor, formatCurrencyBinmax } from '../lib/money';
import {
  candleData,
  candleFromTick,
  normalizeTimeSeconds,
  resampleCandles,
  timeframeSeconds,
  isSubMinuteTimeframe,
  type Timeframe,
} from './candle-adapter';
import { mergeObservedCandles, safeCandleFromTick } from './chart-scale-normalizer';
import { IsolatedChartHost } from './IsolatedChartHost';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { TradersMoodBar } from './TradersMoodBar';
import { useTickPulse } from './useTickPulse';
import { RafChartUpdater } from './raf-updater';
import { ChartDrawingToolbar } from './ChartDrawingToolbar';
import { ChartDrawingOverlay } from './ChartDrawingOverlay';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { isTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Rótulos da telemetria com TRADEROOM_POLISH: legíveis (11px), na fonte de interface.
const POLISH_TELEMETRY_LABEL = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: 500,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-ui)',
} as const;
import { ASSET_CATALOG, type AssetCategory, isSameAsset, getAssetDisplayName, getAxisPrecision, POLISH_CHART_LOCALE } from '../catalog/assets';
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
  contracts?: Contract[];
  isStale?: boolean;
  isVisible?: boolean;
  onSelectSymbol?: (symbol: string) => void;
}

export function PriceChart({
  candles,
  tick,
  symbol = 'VOL_50',
  activeContracts = [],
  contracts,
  isStale = false,
  isVisible = true,
  onSelectSymbol,
}: PriceChartProps) {
  const effectiveContracts = contracts ?? activeContracts ?? [];
  const host = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaSeries = useRef<ISeriesApi<'Area'> | null>(null);
  const currentPriceLine = useRef<IPriceLine | null>(null);
  const currentPriceLineSeries = useRef<ISeriesApi<any> | null>(null);
  const strikeLinesMap = useRef<Map<string, { line: IPriceLine; series: ISeriesApi<any> }>>(new Map());

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

  const safeRemoveStrikeLine = useCallback((entry: { line: IPriceLine; series: ISeriesApi<any> }) => {
    try { entry.series.removePriceLine(entry.line); } catch { /* ignore */ }
    try {
      if (candleSeries.current && candleSeries.current !== entry.series) {
        candleSeries.current.removePriceLine(entry.line);
      }
    } catch { /* ignore */ }
    try {
      if (areaSeries.current && areaSeries.current !== entry.series) {
        areaSeries.current.removePriceLine(entry.line);
      }
    } catch { /* ignore */ }
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

  const openChartContracts = effectiveContracts.filter(
    (c) => (isSameAsset(c.symbol, symbol) || !c.symbol) && c.status === 'OPEN'
  );
  const hasOpenChartContracts = openChartContracts.length > 0;

  // Telemetria em Tempo Real In-Chart (Subetapa 03 / IQ Option Fidelity):
  // Ativa o timer de 250ms APENAS quando há contratos abertos no gráfico, evitando 4 re-renders/s ociosos (#1345)
  const [telemetryNow, setTelemetryNow] = useState(Date.now());
  useEffect(() => {
    if (!hasOpenChartContracts) return;
    setTelemetryNow(Date.now());
    const interval = setInterval(() => setTelemetryNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [hasOpenChartContracts]);

  let timeFormatted = '00:00';
  let totalStakeMinor = 0;
  let netPnlMinor = 0;
  let isTradeWinning = false;

  if (openChartContracts.length > 0) {
    let earliestExpiryMs = Infinity;

    for (const c of openChartContracts) {
      const stake = Number(c.stake_minor) || 0;
      totalStakeMinor += stake;

      const curP = tick ? Number(tick.price) : Number(c.entry_price ?? 0);
      const strike = Number(c.strike_price ?? c.entry_price ?? curP);
      const isUp = c.direction === 'UP';
      const isWin = isUp ? curP > strike : curP < strike;
      const isDraw = curP === strike;

      const payout = c.payout_minor
        ? Number(c.payout_minor)
        : Math.round(stake * 0.85);

      if (isWin) {
        netPnlMinor += payout;
      } else if (!isDraw) {
        netPnlMinor -= stake;
      }

      if (c.expires_at) {
        const expMs = Date.parse(c.expires_at);
        if (Number.isFinite(expMs) && expMs < earliestExpiryMs) {
          earliestExpiryMs = expMs;
        }
      }
    }

    isTradeWinning = netPnlMinor >= 0;

    const targetExpiry = Number.isFinite(earliestExpiryMs) ? earliestExpiryMs : telemetryNow;
    const secondsRemaining = Math.max(0, Math.ceil((targetExpiry - telemetryNow) / 1000));
    const mins = Math.floor(secondsRemaining / 60).toString().padStart(2, '0');
    const secs = (secondsRemaining % 60).toString().padStart(2, '0');
    timeFormatted = `${mins}:${secs}`;
  }

  const isBinmax = isNewTraderoomEnabled();
  // Acabamento profissional (TRADEROOM_POLISH). Desligada = gráfico idêntico ao anterior.
  const polish = isBinmax && isTraderoomPolishEnabled();

  // Retenção Histórica & Janela Deslizante Macro (Perigo 8 / Subetapas 4 & 6)
  const MAX_LOADED_BARS = 3500;
  const [internalCandles, setInternalCandles] = useState<Candle[]>(candles);
  const internalCandlesRef = useRef<Candle[]>(internalCandles);
  internalCandlesRef.current = internalCandles;
  const [internalSymbol, setInternalSymbol] = useState(symbol);
  const observed = useRef({
    symbol,
    sequence: 0,
    lastTickTime: 0,
    bars: new Map<UTCTimestamp, CandlestickData<UTCTimestamp>>(),
    pending: new Set<UTCTimestamp>(),
  });
  const renderContext = useRef({ symbol, timeframe, chartType, priceDirection, isBinmax });
  renderContext.current = { symbol, timeframe, chartType, priceDirection, isBinmax };
  const isLoadingHistoryRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const oldestLoadedTimeRef = useRef<number | null>(null);
  const shouldScrollToRealTimeRef = useRef(true);
  const prevCandlesSigRef = useRef<{
    symbol: string;
    len: number;
    firstTime: unknown;
    lastTime: unknown;
    lastClose: unknown;
  } | null>(null);

  // Sincronizar quando a prop inicial de candles ou o símbolo mudar sem perder estado em re-renders (#1345 / #1346)
  useEffect(() => {
    const firstBar = candles[0];
    const lastBar = candles.length > 0 ? candles[candles.length - 1] : undefined;
    const prevSig = prevCandlesSigRef.current;
    const symbolChanged = !prevSig || prevSig.symbol !== symbol;
    const candlesIdentical =
      !symbolChanged &&
      prevSig.len === candles.length &&
      prevSig.firstTime === firstBar?.time &&
      prevSig.lastTime === lastBar?.time &&
      prevSig.lastClose === lastBar?.close;

    if (candlesIdentical) {
      return;
    }

    prevCandlesSigRef.current = {
      symbol,
      len: candles.length,
      firstTime: firstBar?.time,
      lastTime: lastBar?.time,
      lastClose: lastBar?.close,
    };

    setInternalCandles(candles);
    setInternalSymbol(symbol);

    if (symbolChanged) {
      if (observed.current.symbol !== symbol) {
        observed.current = { symbol, sequence: 0, lastTickTime: 0, bars: new Map(), pending: new Set() };
      }
      hasMoreHistoryRef.current = true;
      isLoadingHistoryRef.current = false;
      oldestLoadedTimeRef.current = null;
      shouldScrollToRealTimeRef.current = true;
      rafUpdaterRef.current.reset(symbol);
    }
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

  // Reset de referência de preço e sequência ao alternar ativo
  useEffect(() => {
    lastPrice.current = null;
    rafUpdaterRef.current.resetSequence();
    shouldScrollToRealTimeRef.current = true;
  }, [symbol]);

  // Monitorar direção do preço e atualizar levemente o sentimento da comunidade
  useEffect(() => {
    if (!tick) return;
    if (tick.symbol && tick.symbol !== symbol) return;
    const tickSec =
      typeof normalizeTimeSeconds === 'function'
        ? normalizeTimeSeconds(tick.ts)
        : typeof tick.ts === 'string' && Number.isFinite(Date.parse(tick.ts))
          ? Math.floor(Date.parse(tick.ts) / 1000)
          : null;
    if (tickSec !== null && tickSec < observed.current.lastTickTime) return;
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
  }, [tick, symbol]);

  // Callback de inicialização do canvas vindo do componente ilhado IsolatedChartHost
  const handleChartReady = useCallback(
    (api: {
      chart: IChartApi;
      activeSeries: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
      candleSeries: ISeriesApi<'Candlestick'>;
      areaSeries: ISeriesApi<'Area'>;
      timeScale: any;
    }) => {
      if (chartInstance.current && chartInstance.current !== api.chart) {
        safeRemoveCurrentPriceLine();
        for (const [, entry] of strikeLinesMap.current.entries()) {
          safeRemoveStrikeLine(entry);
        }
        strikeLinesMap.current.clear();
        for (const [, series] of indicatorSeriesMap.current.entries()) {
          try {
            chartInstance.current.removeSeries(series);
          } catch { /* ignore */ }
        }
        indicatorSeriesMap.current.clear();
      }
      chartInstance.current = api.chart;
      candleSeries.current = api.candleSeries;
      areaSeries.current = api.areaSeries;
      setIsChartReady(true);

      if (shouldScrollToRealTimeRef.current) {
        try {
          api.timeScale.scrollToRealTime();
        } catch { /* ignore */ }
        shouldScrollToRealTimeRef.current = false;
      }
    },
    [safeRemoveCurrentPriceLine, safeRemoveStrikeLine]
  );

  const handleChartDispose = useCallback(() => {
    rafUpdaterRef.current.cancel();
    rafUpdaterRef.current.reset();
    safeRemoveCurrentPriceLine();
    for (const [, entry] of strikeLinesMap.current.entries()) {
      safeRemoveStrikeLine(entry);
    }
    strikeLinesMap.current.clear();
    if (chartInstance.current) {
      for (const [, series] of indicatorSeriesMap.current.entries()) {
        try {
          chartInstance.current.removeSeries(series);
        } catch { /* ignore */ }
      }
    }
    indicatorSeriesMap.current.clear();
    chartInstance.current = null;
    candleSeries.current = null;
    areaSeries.current = null;
    latestCandle.current = null;
    shouldScrollToRealTimeRef.current = true;
    setIsChartReady(false);
  }, [safeRemoveCurrentPriceLine, safeRemoveStrikeLine]);

  const effectiveCandles = internalSymbol === symbol ? internalCandles : [];

  const resampledCandles = useMemo(() => {
    return mergeObservedCandles(resampleCandles(effectiveCandles, timeframe),
      observed.current.symbol === symbol ? [...observed.current.bars.values()] : [], timeframe);
  }, [effectiveCandles, timeframe, chartType, symbol]);

  // Atualiza referência da vela mais recente quando as velas reamostradas mudam (sem resetar sequências do rAF)
  useEffect(() => {
    latestCandle.current = resampledCandles.at(-1) ?? null;
  }, [resampledCandles, isChartReady]);

  // Sincronizar Linha de Preço Atual na troca de tipo de gráfico
  useEffect(() => {
    safeRemoveCurrentPriceLine();

    const activeSeries = chartType === 'candles' ? candleSeries.current : areaSeries.current;
    if (!activeSeries || lastPrice.current === null) return;

    const price = lastPrice.current;
    const isUp = priceDirection === 'UP' || priceDirection === 'NEUTRAL';
    const color = isBinmax ? '#DCE1EA' : (isUp ? '#00e676' : '#ff3d71');
    const title = isBinmax ? '' : (isUp ? '▲ Cotação' : '▼ Cotação');

    try {
      currentPriceLine.current = activeSeries.createPriceLine({
        price,
        color,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title,
      });
      currentPriceLineSeries.current = activeSeries;
    } catch { /* ignore if series is disposed */ }
  }, [chartType, isBinmax, safeRemoveCurrentPriceLine]);

  // Cleanup geral ao desmontar o componente (#8 StrictMode & #9 Zombies)
  useEffect(() => {
    return () => {
      safeRemoveCurrentPriceLine();
      for (const [, entry] of strikeLinesMap.current.entries()) {
        safeRemoveStrikeLine(entry);
      }
      strikeLinesMap.current.clear();

      if (chartInstance.current) {
        for (const [, series] of indicatorSeriesMap.current.entries()) {
          try {
            chartInstance.current.removeSeries(series);
          } catch { /* ignore */ }
        }
      }
      indicatorSeriesMap.current.clear();

      observed.current.bars.clear();
      observed.current.pending.clear();
      observed.current.sequence = 0;
      observed.current.lastTickTime = 0;
      prevCandlesSigRef.current = null;
      lastPrice.current = null;
      shouldScrollToRealTimeRef.current = true;
      rafUpdaterRef.current.cancel();
      rafUpdaterRef.current.reset();
      chartInstance.current = null;
      candleSeries.current = null;
      areaSeries.current = null;
      currentPriceLineSeries.current = null;
      latestCandle.current = null;
    };
  }, [safeRemoveCurrentPriceLine, safeRemoveStrikeLine]);

  // Limpeza de overlays, linhas de preço e strikes na troca de ativo (Subetapa 02)
  const prevSymbolCleanupRef = useRef(symbol);
  useEffect(() => {
    if (prevSymbolCleanupRef.current === symbol) return;
    prevSymbolCleanupRef.current = symbol;

    safeRemoveCurrentPriceLine();
    lastPrice.current = null;

    for (const [, entry] of strikeLinesMap.current.entries()) {
      safeRemoveStrikeLine(entry);
    }
    strikeLinesMap.current.clear();

    shouldScrollToRealTimeRef.current = true;
    if (chartInstance.current) {
      try {
        chartInstance.current.priceScale('right').applyOptions({ autoScale: true });
        chartInstance.current.timeScale().scrollToRealTime();
      } catch { /* ignore */ }
    }
  }, [symbol, safeRemoveCurrentPriceLine, safeRemoveStrikeLine]);

  // Lazy Loading Retroativo no Scroll para a Esquerda (Subetapa 4 & 6)
  useEffect(() => {
    let chart: IChartApi | null = chartInstance.current;
    if (!chart) return;

    let debounceTimer: any = null;
    let cancelled = false;

    const onVisibleLogicalRangeChanged = (logicalRange: any) => {
      if (cancelled || !logicalRange || isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

      // Se o usuário rolou até perto da borda esquerda (menos de 60 barras visíveis - Prefetch Preditivo)
      if (logicalRange.from < 60) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          if (cancelled || isLoadingHistoryRef.current || !hasMoreHistoryRef.current) return;

          const sorted = [...internalCandlesRef.current].sort((a, b) => (Number(a.time) || 0) - (Number(b.time) || 0));
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
            if (cancelled || renderContext.current.symbol !== symbol) return;
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
              if (addedCount > 0 && chartInstance.current && !cancelled) {
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

    try {
      chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
    } catch { /* ignore */ }

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      try {
        chart?.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
      } catch { /* ignore */ }
      chart = null;
    };
  }, [isChartReady, symbol]);

  // Sincronização dos 10 Indicadores Técnicos Nativos
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart || resampledCandles.length === 0) return;

    for (const ind of indicators) {
      try {
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
      } catch { /* ignore if chart/series is disposed */ }
    }
  }, [isChartReady, indicators, resampledCandles]);

  // Atualização em tempo real de novos ticks com Throttling rAF a 60fps (#10 / Issue #1351)
  useEffect(() => {
    if (!tick) return;

    // Blindagem Anti-Cross-Asset Zombie Tick: descarta ticks de símbolos anteriores em trânsito
    if (tick.symbol && tick.symbol !== symbol) {
      return;
    }

    const sample = safeCandleFromTick(tick, null, '5s');
    const tickTimeSec =
      typeof normalizeTimeSeconds === 'function'
        ? normalizeTimeSeconds(tick.ts)
        : sample
          ? Number(sample.time)
          : typeof tick.ts === 'string' && Number.isFinite(Date.parse(tick.ts))
            ? Math.floor(Date.parse(tick.ts) / 1000)
            : null;
    const hasValidSeq = typeof tick.sequence === 'number' && Number.isFinite(tick.sequence);
    const isSeqMonotonic = !hasValidSeq || tick.sequence > observed.current.sequence;
    const isTimeMonotonic = tickTimeSec !== null && tickTimeSec >= observed.current.lastTickTime;
    const stepSec = timeframeSeconds(renderContext.current.timeframe);
    const targetBucketTime =
      tickTimeSec !== null ? Math.floor(tickTimeSec / stepSec) * stepSec : -Infinity;
    const isBucketNotInPast =
      !latestCandle.current ||
      targetBucketTime >= Number(latestCandle.current.time) ||
      (tickTimeSec !== null && tickTimeSec >= Number(latestCandle.current.time));

    if (sample && isSeqMonotonic && isTimeMonotonic && isBucketNotInPast) {
      observed.current.bars.set(
        sample.time,
        safeCandleFromTick(tick, observed.current.bars.get(sample.time) ?? null, '5s')!
      );
      observed.current.pending.add(sample.time);
      if (hasValidSeq) {
        observed.current.sequence = tick.sequence;
      }
      if (tickTimeSec !== null) {
        observed.current.lastTickTime = tickTimeSec;
      }
      if (observed.current.bars.size > MAX_LOADED_BARS * 12) {
        const oldest = observed.current.bars.keys().next().value;
        if (oldest !== undefined) {
          observed.current.bars.delete(oldest);
          observed.current.pending.delete(oldest);
        }
      }
    } else if (!isTimeMonotonic || !isBucketNotInPast) {
      return;
    }

    rafUpdaterRef.current.push(tick, (targetTick) => {
      if (!chartInstance.current) return;
      const ctx = renderContext.current;
      if (ctx.symbol !== symbol) return;
      // Re-valida dentro do callback rAF caso o ativo tenha mudado enquanto o frame aguardava
      if (targetTick.symbol && targetTick.symbol !== ctx.symbol) {
        return;
      }
      const price = Number(targetTick.price);

      if (observed.current.pending.size > 0) {
        const updates = mergeObservedCandles(
          latestCandle.current ? [latestCandle.current] : [],
          [...observed.current.pending].map((time) => observed.current.bars.get(time)!),
          ctx.timeframe,
          false
        );
        try {
          for (const next of updates) {
            if (latestCandle.current && Number(next.time) < Number(latestCandle.current.time)) {
              continue;
            }
            // Sincroniza ambas as séries em memória para que a troca candles <-> line seja instantânea sem perda de ticks
            candleSeries.current?.update(next);
            areaSeries.current?.update({ time: next.time, value: next.close });
            latestCandle.current = next;
          }
        } catch { /* ignore if series is disposed */ }
        observed.current.pending.clear();
      }

      // Atualizar Linha de Preço Atual
      const activeSeries = ctx.chartType === 'candles' ? candleSeries.current : areaSeries.current;
      if (activeSeries && Number.isFinite(price)) {
        const isUp = ctx.priceDirection === 'UP' || ctx.priceDirection === 'NEUTRAL';
        const color = ctx.isBinmax ? '#DCE1EA' : (isUp ? '#00e676' : '#ff3d71');
        const title = ctx.isBinmax ? '' : (isUp ? '▲ Cotação' : '▼ Cotação');

        try {
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
        } catch { /* ignore if series is disposed */ }
      }
    });
  }, [tick, symbol]);

  // Pausa e Retomada de Renderização sob Segundo Plano + IntersectionObserver de Viewport (Perigo 6 — Técnica 5)
  useEffect(() => {
    if (!isVisible) {
      rafUpdaterRef.current.pause();
      return;
    }

    rafUpdaterRef.current.resume();

    const containerEl = host.current;
    if (
      !containerEl ||
      typeof IntersectionObserver === 'undefined'
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (!entry.isIntersecting) {
          rafUpdaterRef.current.pause();
        } else if (isVisible) {
          rafUpdaterRef.current.resume();
        }
      },
      { threshold: 0.01 }
    );

    observer.observe(containerEl);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  // Sincronizar linhas de strike para ordens ativas
  useEffect(() => {
    const activeSeries = chartType === 'candles' ? candleSeries.current : areaSeries.current;
    if (!activeSeries || !chartInstance.current) return;

    const currentOpenIds = new Set(
      effectiveContracts
        .filter((c) => c.status === 'OPEN' && (isSameAsset(c.symbol, symbol) || !c.symbol))
        .map((c) => c.id)
    );

    // Remover linhas de contratos liquidados, removidos ou que mudaram de série (candles <-> line).
    // Com TRADEROOM_POLISH o OrderFlagsOverlay desenha uma linha por strike; as nativas saem.
    for (const [id, entry] of strikeLinesMap.current.entries()) {
      if (polish || !currentOpenIds.has(id) || entry.series !== activeSeries) {
        safeRemoveStrikeLine(entry);
        strikeLinesMap.current.delete(id);
      }
    }

    if (polish) return;

    // Criar linhas de strike para contratos abertos
    for (const contract of effectiveContracts) {
      if (contract.status !== 'OPEN') continue;
      if (!isSameAsset(contract.symbol, symbol) && contract.symbol) continue;
      if (strikeLinesMap.current.has(contract.id)) continue;

      const rawStrike = contract.strike_price ?? contract.entry_price ?? tick?.price;
      const strike = Number(rawStrike);
      if (!Number.isFinite(strike) || strike <= 0) continue;

      const isUp = contract.direction === 'UP';
      const color = isBinmax ? (isUp ? '#22C55E' : '#E5484D') : (isUp ? '#00e676' : '#ff3d71');
      const stakeNum = Number(contract.stake_minor);
      const title = isBinmax
        ? `${isUp ? '▲ SUBE' : '▼ BAJA'} ${Number.isFinite(stakeNum) ? formatCurrencyBinmax(stakeNum) : ''}`
        : `${isUp ? '▲ COMPRA' : '▼ VENDA'} ${Number.isFinite(stakeNum) ? formatMinor(stakeNum) : ''}`;

      try {
        const line = activeSeries.createPriceLine({
          price: strike,
          color,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title,
        });
        strikeLinesMap.current.set(contract.id, { line, series: activeSeries });
      } catch { /* ignore if series is disposed */ }
    }
  }, [effectiveContracts, chartType, tick?.price, isBinmax, polish, isChartReady, symbol, safeRemoveStrikeLine]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', pointerEvents: 'auto' }}>
            <div style={{ position: 'relative' }}>
            <div
              data-testid="chart-top-asset-pill"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: polish ? 'transparent' : 'rgba(15, 20, 28, 0.88)',
                backdropFilter: polish ? 'none' : 'blur(12px)',
                border: polish ? 'none' : '1px solid rgba(244, 245, 247, 0.1)',
                borderRadius: '7px',
                padding: polish ? '0' : '4px 10px',
                boxShadow: polish ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.6)',
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
                <AssetFlagBadge symbol={symbol} size={polish ? 28 : 18} />
                {polish ? (
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
                    <span data-testid="chart-asset-display-name" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-strong)', fontFamily: 'var(--font-ui)', letterSpacing: '-0.01em' }}>
                      {getAssetDisplayName(symbol)}
                    </span>
                    <span data-testid="chart-asset-subtitle" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
                      Digital
                    </span>
                  </span>
                ) : (
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#F4F5F7' }}>
                  {symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}
                </span>
                )}
                {!polish && (
                <span
                  style={{
                    fontSize: '9.5px',
                    color: '#22C47A',
                    fontWeight: 700,
                    background: 'rgba(34, 196, 122, 0.12)',
                    border: '1px solid rgba(34, 196, 122, 0.25)',
                    borderRadius: '4px',
                    padding: '1px 5px',
                  }}
                >
                  Digital
                </span>
                )}
                <svg
                  data-testid="asset-selector-chevron"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#8A92A1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: showAssetSelector ? 'rotate(180deg)' : 'none',
                    transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {!polish && <div style={{ width: '1px', height: '14px', background: 'rgba(244, 245, 247, 0.12)' }} />}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8A92A1', fontSize: '12px' }}>
                <span
                  data-testid="asset-action-info"
                  title="Información del activo"
                  style={polish
                    ? { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-2)', transition: 'color var(--t-micro) var(--ease)' }
                    : { cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F4F5F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
                >
                  <svg width={polish ? 16 : 13} height={polish ? 16 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </span>
                <span
                  data-testid="asset-action-alert"
                  title="Crear alerta"
                  style={polish
                    ? { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-2)', transition: 'color var(--t-micro) var(--ease)' }
                    : { cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F4F5F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
                >
                  <svg width={polish ? 16 : 13} height={polish ? 16 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </span>
                <span
                  data-testid="asset-action-favorite"
                  title="Agregar a favoritos"
                  style={polish
                    ? { cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: 'var(--bg-2)', transition: 'color var(--t-micro) var(--ease)' }
                    : { cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#F4F5F7')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
                >
                  <svg width={polish ? 16 : 13} height={polish ? 16 : 13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </span>
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
                    background: 'rgba(0, 0, 0, 0.4)',
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
                    background: '#121721',
                    border: '1px solid rgba(244, 245, 247, 0.12)',
                    borderRadius: '8px',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '10px',
                    boxSizing: 'border-box',
                    gap: '8px',
                    backdropFilter: 'blur(12px)',
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
                          background: assetCategoryFilter === cat ? 'rgba(34, 196, 122, 0.15)' : 'rgba(244, 245, 247, 0.05)',
                          border: assetCategoryFilter === cat ? '1px solid #22C47A' : '1px solid transparent',
                          color: assetCategoryFilter === cat ? '#22C47A' : '#8A92A1',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
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
                            background: isCur ? 'rgba(34, 196, 122, 0.1)' : 'transparent',
                            border: isCur ? '1px solid rgba(34, 196, 122, 0.3)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'background 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                          onMouseEnter={(e) => {
                            if (!isCur) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isCur) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AssetFlagBadge symbol={asset.symbol} size={16} />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: isCur ? '#22C47A' : '#F4F5F7' }}>
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

            {/* Barra de Telemetria In-Chart (Estilo IQ Option Oficial - Tipografia Pura) */}
            {openChartContracts.length > 0 && (
              <div
                data-testid="chart-trade-telemetry-strip"
                data-telemetry-status={isTradeWinning ? 'winning' : 'losing'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 0,
                  padding: '2px 8px',
                  boxShadow: 'none',
                  pointerEvents: 'auto',
                  fontFamily: "'Geist', sans-serif",
                }}
              >
                {/* Coluna 1: HORA DE COMPRA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, fontFamily: "'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px' }}>
                    <span style={{ fontSize: '13px' }}>⏱</span>
                    <span>{timeFormatted}</span>
                  </div>
                  <span style={polish ? POLISH_TELEMETRY_LABEL : { fontSize: '9px', color: 'var(--text-quiet)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    HORA DE COMPRA
                  </span>
                </div>

                <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.12)' }} />

                {/* Coluna 2: INVESTIMENTO TOTAL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600, fontFamily: "'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px' }}>
                    {`$${(totalStakeMinor / 100).toFixed(2)}`}
                  </span>
                  <span style={polish ? POLISH_TELEMETRY_LABEL : { fontSize: '9px', color: 'var(--text-quiet)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    INVERSIÓN TOTAL
                  </span>
                </div>

                <div style={{ width: '1px', height: '32px', background: 'rgba(255, 255, 255, 0.12)' }} />

                {/* Coluna 3: LUCRO ESPERADO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: isTradeWinning ? 'var(--profit)' : 'var(--loss)', fontSize: '20px', fontWeight: 700, fontFamily: "'Geist Mono', monospace", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px' }}>
                    {isTradeWinning ? `+$${(netPnlMinor / 100).toFixed(2)}` : `-$${(Math.abs(netPnlMinor) / 100).toFixed(2)}`}
                  </span>
                  <span style={polish ? POLISH_TELEMETRY_LABEL : { fontSize: '9px', color: 'var(--text-quiet)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                    GANANCIA ESPERADA
                  </span>
                </div>
              </div>
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
            hideTopTags={openChartContracts.length > 0}
          />

          <OrderFlagsOverlay
            contracts={effectiveContracts.filter((c) => isSameAsset(c.symbol, symbol) || !c.symbol)}
            currentPrice={tick ? Number(tick.price) : null}
            containerWidth={dimensions.width}
            containerHeight={dimensions.height}
            activeSeries={chartType === 'candles' ? candleSeries.current : areaSeries.current}
            chartInstance={chartInstance.current}
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
        pricePrecision={polish ? getAxisPrecision(symbol) : undefined}
        locale={polish ? POLISH_CHART_LOCALE : undefined}
        onChartReady={handleChartReady}
        onChartDispose={handleChartDispose}
        onDimensionsChange={setDimensions}
      />
    </div>
  );
}
