import React, { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from "lightweight-charts";

interface TradingViewCanvasProps {
  symbol: string;
  lastTick: { sequence: string; price: string; ts: string } | null;
  activeContractPrice?: number | null;
}

export const TradingViewCanvas: React.FC<TradingViewCanvasProps> = ({
  symbol,
  lastTick,
  activeContractPrice
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLineRef = useRef<any>(null);
  const lastSequenceRef = useRef<bigint>(0n);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
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
        borderColor: "#2B2F3A"
      },
      rightPriceScale: {
        borderColor: "#2B2F3A"
      }
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#F23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#F23645"
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Carga de histórico inicial via REST UDF (D-03)
    const loadHistory = async () => {
      try {
        const to = Math.floor(Date.now() / 1000);
        const from = to - 3600; // Última 1 hora
        const res = await fetch(`/api/v1/chart/history?symbol=${symbol}&resolution=1&from=${from}&to=${to}`);
        const data = await res.json();

        if (data.s === "ok" && data.t) {
          const bars: CandlestickData[] = data.t.map((t: number, i: number) => ({
            time: t as Time,
            open: data.o[i],
            high: data.h[i],
            low: data.l[i],
            close: data.c[i]
          }));
          candlestickSeries.setData(bars);
        }
      } catch (err) {
        console.error("Failed to load chart history:", err);
      }
    };

    loadHistory();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [symbol]);

  // Atualização em tempo real da vela atual com o tick recebido via WebSocket
  useEffect(() => {
    if (!lastTick || !seriesRef.current) return;

    const seq = BigInt(lastTick.sequence);
    // Descarte rigoroso de ticks fora de ordem ou duplicados (F-06)
    if (seq <= lastSequenceRef.current) {
      return;
    }
    lastSequenceRef.current = seq;

    const tickTimeSec = Math.floor(new Date(lastTick.ts).getTime() / 1000);
    // Alinhamento ao bucket de 1 minuto em segundos
    const candleTimeSec = Math.floor(tickTimeSec / 60) * 60;
    const price = parseFloat(lastTick.price);

    seriesRef.current.update({
      time: candleTimeSec as Time,
      open: price,
      high: price,
      low: price,
      close: price
    });
  }, [lastTick]);

  // Atualiza linha de preço de entrada para ordens ativas
  useEffect(() => {
    if (!seriesRef.current) return;

    if (priceLineRef.current) {
      seriesRef.current.removePriceLine(priceLineRef.current);
      priceLineRef.current = null;
    }

    if (activeContractPrice) {
      priceLineRef.current = seriesRef.current.createPriceLine({
        price: activeContractPrice,
        color: "#F6C344",
        lineWidth: 2,
        lineStyle: 2, // Tracejado
        axisLabelVisible: true,
        title: "ENTRADA"
      });
    }
  }, [activeContractPrice]);

  return (
    <div
      ref={chartContainerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative"
      }}
    />
  );
};
