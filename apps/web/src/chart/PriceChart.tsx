import { useEffect, useRef, useState } from 'react';
import {
  ColorType,
  createChart,
  LineStyle,
  type AreaData,
  type CandlestickData,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Contract } from '../api/client';
import type { Tick } from '../feed/protocol';
import { formatMinor } from '../lib/money';
import { candleData, candleFromTick } from './candle-adapter';
import { TimeLinesOverlay } from './TimeLinesOverlay';
import { OrderFlagsOverlay } from './OrderFlagsOverlay';
import { TradersMoodBar } from './TradersMoodBar';
import { useTickPulse } from './useTickPulse';

export type ChartType = 'candles' | 'line';
export type Timeframe = '5s' | '15s' | '30s' | '1m' | '5m';

export interface PriceChartProps {
  candles: Candle[];
  tick: Tick | null;
  symbol?: string;
  activeContracts?: Contract[];
}

export function PriceChart({ candles, tick, symbol = 'SYNTH_VOL_50', activeContracts = [] }: PriceChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const areaSeries = useRef<ISeriesApi<'Area'> | null>(null);
  const currentPriceLine = useRef<IPriceLine | null>(null);
  const strikeLinesMap = useRef<Map<string, IPriceLine>>(new Map());
  const latestCandle = useRef<CandlestickData<UTCTimestamp> | null>(null);

  const [chartType, setChartType] = useState<ChartType>('candles');
  const [timeframe, setTimeframe] = useState<Timeframe>('1m');
  const [sentimentBulls, setSentimentBulls] = useState(64);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const lastPrice = useRef<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN' | 'NEUTRAL'>('NEUTRAL');
  const tickPulse = useTickPulse(tick);

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

  // Instanciação inicial do gráfico
  useEffect(() => {
    if (!host.current) return;

    const chart = createChart(host.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8e9ebc',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(28, 41, 65, 0.45)' },
        horzLines: { color: 'rgba(28, 41, 65, 0.45)' },
      },
      rightPriceScale: {
        borderColor: '#1d2c48',
        scaleMargins: { top: 0.12, bottom: 0.12 },
      },
      timeScale: {
        borderColor: '#1d2c48',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        barSpacing: 10,
      },
      crosshair: {
        vertLine: { color: '#4d6994', width: 1 },
        horzLine: { color: '#4d6994', width: 1 },
      },
    });

    chartInstance.current = chart;

    if (host.current) {
      setDimensions({
        width: host.current.clientWidth,
        height: host.current.clientHeight || 450,
      });
    }

    // Redimensionamento full-bleed resiliente
    const resizeObserver = new ResizeObserver(() => {
      if (host.current && chartInstance.current) {
        const width = host.current.clientWidth;
        const height = host.current.clientHeight || 450;
        chartInstance.current.applyOptions({ width, height });
        setDimensions({ width, height });
      }
    });
    resizeObserver.observe(host.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartInstance.current = null;
      candleSeries.current = null;
      areaSeries.current = null;
      latestCandle.current = null;
      strikeLinesMap.current.clear();
    };
  }, []);

  // Criar/Trocar Series conforme o chartType
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    // Remover series antigas e linhas associadas
    const prevSeries = candleSeries.current ?? areaSeries.current;
    if (currentPriceLine.current && prevSeries) {
      try {
        prevSeries.removePriceLine(currentPriceLine.current);
      } catch { /* ignore */ }
      currentPriceLine.current = null;
    }
    if (prevSeries) {
      for (const line of strikeLinesMap.current.values()) {
        try {
          prevSeries.removePriceLine(line);
        } catch { /* ignore */ }
      }
      strikeLinesMap.current.clear();
    }
    if (candleSeries.current) {
      chart.removeSeries(candleSeries.current);
      candleSeries.current = null;
    }
    if (areaSeries.current) {
      chart.removeSeries(areaSeries.current);
      areaSeries.current = null;
    }

    if (chartType === 'candles') {
      candleSeries.current = chart.addCandlestickSeries({
        upColor: '#00e676',
        downColor: '#ff3d71',
        borderVisible: false,
        wickUpColor: '#00e676',
        wickDownColor: '#ff3d71',
      });
    } else {
      areaSeries.current = chart.addAreaSeries({
        lineColor: '#00e676',
        topColor: 'rgba(0, 230, 118, 0.35)',
        bottomColor: 'rgba(0, 230, 118, 0.01)',
        lineWidth: 2,
      });
    }

    // Carregar dados históricos na nova série
    const rows = candles.map(candleData).sort((a, b) => a.time - b.time);
    const unique = rows.filter((row, index) => index === 0 || row.time > rows[index - 1].time);

    if (chartType === 'candles' && candleSeries.current) {
      candleSeries.current.setData(unique);
      latestCandle.current = unique.at(-1) ?? null;
    } else if (chartType === 'line' && areaSeries.current) {
      const lineData: AreaData<UTCTimestamp>[] = unique.map((c) => ({
        time: c.time,
        value: c.close,
      }));
      areaSeries.current.setData(lineData);
    }
  }, [chartType, candles]);

  // Atualização em tempo real de novos ticks
  useEffect(() => {
    if (!tick) return;
    const price = Number(tick.price);

    if (chartType === 'candles' && candleSeries.current) {
      const next = candleFromTick(tick, latestCandle.current);
      if (next) {
        candleSeries.current.update(next);
        latestCandle.current = next;
      }
    } else if (chartType === 'line' && areaSeries.current) {
      const epoch = Date.parse(tick.ts);
      if (Number.isFinite(epoch) && Number.isFinite(price)) {
        const bucket = Math.floor(epoch / 60_000) * 60 as UTCTimestamp;
        areaSeries.current.update({ time: bucket, value: price });
      }
    }

    // Atualizar Linha de Preço Atual do TradingView
    const activeSeries = candleSeries.current ?? areaSeries.current;
    if (activeSeries && Number.isFinite(price)) {
      const isUp = priceDirection === 'UP' || priceDirection === 'NEUTRAL';
      const color = isUp ? '#00e676' : '#ff3d71';
      const title = isUp ? '▲ Cotação' : '▼ Cotação';

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
      }
    }
  }, [tick, chartType, priceDirection]);

  // Sincronizar linhas de strike para ordens ativas (Strike Price Lines)
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
        {/* Ferramentas do Gráfico (Tipo & Timeframe) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(10, 16, 30, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #1f2e4b',
            borderRadius: '8px',
            padding: '4px 8px',
            pointerEvents: 'auto',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          }}
        >
          {/* Tipo de Gráfico */}
          <div style={{ display: 'flex', gap: '3px', borderRight: '1px solid #1f2e4b', paddingRight: '8px' }}>
            <button
              type="button"
              onClick={() => setChartType('candles')}
              style={{
                background: chartType === 'candles' ? '#1c2d4a' : 'transparent',
                border: 'none',
                color: chartType === 'candles' ? '#00e676' : '#8597b4',
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Velas Japonesas"
            >
              🕯️ Velas
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              style={{
                background: chartType === 'line' ? '#1c2d4a' : 'transparent',
                border: 'none',
                color: chartType === 'line' ? '#00e676' : '#8597b4',
                padding: '4px 8px',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Gráfico de Linha"
            >
              📈 Linha
            </button>
          </div>

          {/* Timeframe */}
          <div style={{ display: 'flex', gap: '3px' }}>
            {(['5s', '15s', '30s', '1m', '5m'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#1c2d4a' : 'transparent',
                  border: 'none',
                  color: timeframe === tf ? '#65d5ff' : '#8597b4',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Tag Pulsante de Preço em Tempo Real */}
        <div
          className={`price-tag-pulse ${priceDirection === 'DOWN' ? 'down' : 'up'} ${
            tickPulse === 'UP' ? 'tick-pulse-green' : tickPulse === 'DOWN' ? 'tick-pulse-red' : ''
          }`}
          style={{ pointerEvents: 'auto' }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: priceDirection === 'DOWN' ? '#ff3d71' : '#00e676',
            }}
          />
          <span>{tick?.price ?? '—'} USD</span>
          <span>{priceDirection === 'DOWN' ? '▼' : '▲'}</span>
        </div>

        {/* Trader Sentiment Bar (Sentimento da Comunidade) */}
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
      </div>

      {/* Overlays de Linhas de Tempo: Hora de Compra e Expiração */}
      <TimeLinesOverlay
        containerWidth={dimensions.width}
        containerHeight={dimensions.height}
        chartInstance={chartInstance.current}
        latestCandleTime={latestCandle.current?.time ?? null}
        tickTimestamp={tick?.ts ?? null}
      />

      {/* Bandeirinhas Flutuantes de Ordens Abertas (Strike Flags) */}
      <OrderFlagsOverlay
        contracts={activeContracts}
        currentPrice={tick ? Number(tick.price) : null}
        containerWidth={dimensions.width}
        containerHeight={dimensions.height}
        activeSeries={candleSeries.current ?? areaSeries.current}
      />

      {/* Barra de Sentimento Vertical (Trader's Mood Bar) */}
      <TradersMoodBar bullsPercentage={sentimentBulls} />

      {/* Canvas Full-Bleed do Lightweight Charts */}
      <div
        className="chart-host"
        ref={host}
        role="img"
        aria-label={`Gráfico de trading em tempo real para ${symbol}`}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
