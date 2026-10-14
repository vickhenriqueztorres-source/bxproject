import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time, UTCTimestamp } from "lightweight-charts";
import { ensureStrictAscendingBars } from "../../chart/bar-sanitizer";
import { normalizeTimeSeconds } from "../../chart/chart-sanitizer";
import { syncChartViewportOnResize } from "../../chart/IsolatedChartHost";

interface TradingViewCanvasProps {
  symbol: string;
  lastTick: { sequence: string; price: string; ts: string } | null;
  activeContractPrice?: number | null;
}

export const TradingViewCanvas: React.FC<TradingViewCanvasProps> = React.memo(({
  symbol,
  lastTick,
  activeContractPrice
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const lastSequenceRef = useRef<bigint>(0n);
  const currentBarRef = useRef<CandlestickData<UTCTimestamp> | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // 1. Instanciação ÚNICA do gráfico e série em useRef (mount-only, nunca recria em mudanças de estado #1345 / #1346)
  useEffect(() => {
    const containerEl = chartContainerRef.current;
    if (!containerEl) return;

    // Blindagem Anti-Duplicação (React StrictMode / Re-mount #1345 / #1351)
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {
        /* ignore */
      }
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRef.current = null;
    }
    if (typeof containerEl.replaceChildren === "function") {
      containerEl.replaceChildren();
    } else if ("innerHTML" in containerEl) {
      containerEl.innerHTML = "";
    }
    let effectDisposed = false;

    const initWidth = Math.max(containerEl.clientWidth || 800, 320);
    const initHeight = Math.max(containerEl.clientHeight || 500, 300);
    lastDimensionsRef.current = { width: initWidth, height: initHeight };

    let chart: IChartApi | null = createChart(containerEl, {
      width: initWidth,
      height: initHeight,
      layout: {
        background: { color: "#0B0E14" },
        textColor: "#9B9FA4"
      },
      grid: {
        vertLines: { color: "#1E222D" },
        horzLines: { color: "#1E222D" }
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: true,
        borderColor: "#2B2F3A",
        rightOffset: 12,
        shiftVisibleRangeOnNewBar: true
      },
      rightPriceScale: {
        autoScale: true,
        borderColor: "#2B2F3A"
      }
    });

    let candlestickSeries: ISeriesApi<"Candlestick"> | null = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#F23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#F23645"
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Blindagem contra colapso de dimensão zero e sincronização Fullscreen/Resize (Issues #1334 / #1344)
    const handleResize = (entries?: ResizeObserverEntry[], forceFullscreen = false) => {
      if (effectDisposed || !chartContainerRef.current || !chart || chartRef.current !== chart) return;
      const rect = entries?.[0]?.contentRect ?? (
        typeof chartContainerRef.current.getBoundingClientRect === "function"
          ? chartContainerRef.current.getBoundingClientRect()
          : undefined
      );
      const w = Math.floor(rect?.width || chartContainerRef.current.clientWidth || 0);
      const h = Math.floor(rect?.height || chartContainerRef.current.clientHeight || 0);
      if (typeof syncChartViewportOnResize === "function") {
        syncChartViewportOnResize(chart, w, h, lastDimensionsRef, {
          forceAutoScale: forceFullscreen,
          forceScrollToRealTime: forceFullscreen
        });
      } else if (w > 50 && h > 50) {
        lastDimensionsRef.current = { width: w, height: h };
        chart.applyOptions({ width: w, height: h });
      }
    };

    const resizeObserver = new ResizeObserver((entries) => handleResize(entries, false));
    resizeObserver.observe(containerEl);

    let fsTimer1: ReturnType<typeof setTimeout> | null = null;
    let fsTimer2: ReturnType<typeof setTimeout> | null = null;
    const clearFsTimers = () => {
      if (fsTimer1 !== null) {
        clearTimeout(fsTimer1);
        fsTimer1 = null;
      }
      if (fsTimer2 !== null) {
        clearTimeout(fsTimer2);
        fsTimer2 = null;
      }
    };

    const onFullscreenOrWindowResize = (isFullscreen: boolean) => {
      if (effectDisposed || !chart || chartRef.current !== chart) return;
      handleResize(undefined, isFullscreen);
      clearFsTimers();
      fsTimer1 = setTimeout(() => handleResize(undefined, isFullscreen), 60);
      fsTimer2 = setTimeout(() => handleResize(undefined, isFullscreen), 200);
    };

    const onFullscreenChange = () => onFullscreenOrWindowResize(true);
    const onWindowResize = () => onFullscreenOrWindowResize(false);

    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("fullscreenchange", onFullscreenChange);
      document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", onWindowResize);
    }

    return () => {
      effectDisposed = true;
      clearFsTimers();
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      }
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("resize", onWindowResize);
      }
      resizeObserver.disconnect();
      if (priceLineRef.current && seriesRef.current) {
        try {
          seriesRef.current.removePriceLine(priceLineRef.current);
        } catch {
          /* ignore */
        }
      }
      priceLineRef.current = null;
      seriesRef.current = null;
      chartRef.current = null;
      currentBarRef.current = null;
      try {
        chart?.remove();
      } catch {
        /* ignore */
      }
      if (typeof containerEl.replaceChildren === "function") {
        containerEl.replaceChildren();
      } else if ("innerHTML" in containerEl) {
        containerEl.innerHTML = "";
      }
      chart = null;
      candlestickSeries = null;
    };
  }, []);

  // 2. Atualização de dados na troca de ativo via setData() SEM destruir/recriar o gráfico (#1345 / #1346)
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    lastSequenceRef.current = 0n;
    currentBarRef.current = null;
    if (priceLineRef.current) {
      try {
        seriesRef.current.removePriceLine(priceLineRef.current);
      } catch {
        /* ignore */
      }
      priceLineRef.current = null;
    }

    let cancelled = false;
    const activeChart = chartRef.current;
    const activeSeries = seriesRef.current;

    // Carga de histórico inicial via REST UDF (D-03) com alinhamento monotônico UTC (#1344)
    const loadHistory = async () => {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 3600; // Última 1 hora
        const res = await fetch(`/api/v1/chart/history?symbol=${symbol}&resolution=1&from=${from}&to=${to}`);
        if (cancelled || !chartRef.current) return;
        const data = await res.json();
        if (cancelled || chartRef.current !== activeChart || !seriesRef.current) return;

        if (data.s === "ok" && Array.isArray(data.t)) {
          const rawBars: CandlestickData<UTCTimestamp>[] = data.t.map((t: number, i: number) => ({
            time: t as UTCTimestamp,
            open: Number(data.o[i]),
            high: Number(data.h[i]),
            low: Number(data.l[i]),
            close: Number(data.c[i])
          }));
          const cleanBars = ensureStrictAscendingBars(rawBars);
          currentBarRef.current = cleanBars.length > 0 ? { ...cleanBars[cleanBars.length - 1] } : null;
          try {
            activeSeries.setData(cleanBars);
            activeChart.priceScale("right").applyOptions({ autoScale: true });
            activeChart.timeScale().scrollToRealTime();
          } catch {
            /* ignore if series is disposed */
          }
        }
      } catch (err) {
        if (!cancelled && chartRef.current) {
          console.error("Failed to load chart history:", err);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Atualização em tempo real da vela atual com o tick recebido via WebSocket (#1344: preserva OHLC do minuto em UTC)
  useEffect(() => {
    if (!lastTick || !seriesRef.current || !chartRef.current) return;

    const seq = BigInt(lastTick.sequence);
    // Descarte rigoroso de ticks fora de ordem ou duplicados (F-06)
    if (seq <= lastSequenceRef.current) {
      return;
    }
    lastSequenceRef.current = seq;

    const tickTimeSec = normalizeTimeSeconds(lastTick.ts);
    const price = parseFloat(lastTick.price);
    if (tickTimeSec === null || !Number.isFinite(price) || price <= 0) {
      return;
    }

    // Alinhamento ao bucket de 1 minuto em segundos UTC
    const candleTimeSec = (Math.floor(tickTimeSec / 60) * 60) as UTCTimestamp;
    const prevBar = currentBarRef.current;

    // Bloqueia regressão temporal contra o histórico carregado (#1344)
    if (prevBar && candleTimeSec < prevBar.time) {
      return;
    }

    const nextBar: CandlestickData<UTCTimestamp> =
      prevBar && prevBar.time === candleTimeSec
        ? {
            time: candleTimeSec,
            open: prevBar.open,
            high: Math.max(prevBar.high, price),
            low: Math.min(prevBar.low, price),
            close: price
          }
        : {
            time: candleTimeSec,
            open: prevBar ? prevBar.close : price,
            high: prevBar ? Math.max(prevBar.close, price) : price,
            low: prevBar ? Math.min(prevBar.close, price) : price,
            close: price
          };

    currentBarRef.current = nextBar;

    try {
      seriesRef.current.update(nextBar as CandlestickData<Time>);
    } catch {
      /* ignore if series is disposed */
    }
  }, [lastTick]);

  // Atualiza linha de preço de entrada para ordens ativas
  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return;

    if (priceLineRef.current) {
      try {
        seriesRef.current.removePriceLine(priceLineRef.current);
      } catch {
        /* ignore */
      }
      priceLineRef.current = null;
    }

    if (activeContractPrice) {
      try {
        priceLineRef.current = seriesRef.current.createPriceLine({
          price: activeContractPrice,
          color: "#F6C344",
          lineWidth: 2,
          lineStyle: 2, // Tracejado
          axisLabelVisible: true,
          title: "ENTRADA"
        });
      } catch {
        /* ignore if series is disposed */
      }
    }
  }, [activeContractPrice]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "100%",
        minWidth: "320px",
        minHeight: "300px",
        position: "relative"
      }}
    />
  );
});

TradingViewCanvas.displayName = "TradingViewCanvas";
