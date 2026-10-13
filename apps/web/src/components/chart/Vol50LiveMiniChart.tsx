import React, { useEffect, useState, useMemo } from 'react';

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function Vol50LiveMiniChart({ height = 280 }: { height?: number }) {
  const [currentPrice, setCurrentPrice] = useState(507.9397);
  const [lastTickDir, setLastTickDir] = useState<'UP' | 'DOWN'>('UP');

  // Série de velas OHLC inicial representativa de Vol 50
  const initialCandles: CandleData[] = useMemo(() => [
    { time: '18:30', open: 498.2, high: 499.5, low: 497.8, close: 499.1 },
    { time: '18:45', open: 499.1, high: 501.2, low: 498.9, close: 500.8 },
    { time: '19:00', open: 500.8, high: 502.4, low: 499.7, close: 500.2 },
    { time: '19:15', open: 500.2, high: 501.5, low: 498.6, close: 499.4 },
    { time: '19:30', open: 499.4, high: 502.8, low: 499.0, close: 502.5 },
    { time: '19:45', open: 502.5, high: 504.6, low: 501.9, close: 504.1 },
    { time: '20:00', open: 504.1, high: 505.2, low: 502.3, close: 503.0 },
    { time: '20:15', open: 503.0, high: 504.0, low: 501.1, close: 501.8 },
    { time: '20:30', open: 501.8, high: 503.9, low: 501.2, close: 503.5 },
    { time: '20:45', open: 503.5, high: 506.2, low: 503.0, close: 505.8 },
    { time: '21:00', open: 505.8, high: 509.4, low: 505.1, close: 508.9 },
    { time: '21:15', open: 508.9, high: 514.2, low: 508.0, close: 512.6 },
    { time: '21:30', open: 512.6, high: 515.0, low: 506.8, close: 507.94 },
  ], []);

  // Simulação de micro-ticks em tempo real para dar vida ao gráfico mudo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPrice((prev) => {
        // Delta sutil estocástico Ornstein-Uhlenbeck simplificado
        const randArr = new Uint32Array(1);
        (window.crypto || globalThis.crypto).getRandomValues(randArr);
        const csprng = randArr[0] / 4294967295;
        const drift = (508.0 - prev) * 0.05;
        const noise = (csprng - 0.49) * 0.45;
        const next = Math.max(496, Math.min(516, prev + drift + noise));
        setLastTickDir(next >= prev ? 'UP' : 'DOWN');
        return parseFloat(next.toFixed(4));
      });
    }, 1200);

    return () => clearInterval(timer);
  }, []);

  const minPrice = 496.0;
  const maxPrice = 516.0;
  const priceRange = maxPrice - minPrice;

  const getY = (val: number) => {
    const normalized = (val - minPrice) / priceRange;
    return height - normalized * (height - 30) - 20;
  };

  const currentPriceY = getY(currentPrice);

  return (
    <div
      data-testid="vol50-mini-chart"
      style={{
        backgroundColor: '#0B1220',
        padding: '12px 12px 8px',
        boxSizing: 'border-box',
        position: 'relative',
        width: '100%',
      }}
    >
      {/* Pílula do Seletor Vol 50 */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#111A2B',
          border: '1px solid #1F2A3A',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#E6EDF5',
          marginBottom: '16px',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#22C55E' }}>∿</span>
        <span>Vol 50</span>
        <span style={{ color: '#8A96A8', fontSize: '10px' }}>▼</span>
      </div>

      {/* SVG Canvas de Velas OHLC */}
      <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
        <svg
          viewBox={`0 0 460 ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
          preserveAspectRatio="none"
        >
          {/* Linhas de Grade Horizontais */}
          {[496, 500, 504, 508, 512, 516].map((p) => {
            const y = getY(p);
            return (
              <g key={p}>
                <line
                  x1="0"
                  y1={y}
                  x2="400"
                  y2={y}
                  stroke="#1F2A3A"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <text
                  x="410"
                  y={y + 4}
                  fill="#64748B"
                  fontSize="11"
                  fontFamily="'Geist Mono', monospace"
                >
                  {p.toFixed(4)}
                </text>
              </g>
            );
          })}

          {/* Velas OHLC Japonesas */}
          {initialCandles.map((c, i) => {
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#22C55E' : '#EF4444';
            const candleX = 20 + i * 28;
            const candleWidth = 14;

            const highY = getY(c.high);
            const lowY = getY(c.low);
            const openY = getY(c.open);
            const closeY = getY(c.close);

            const bodyTop = Math.min(openY, closeY);
            const bodyHeight = Math.max(3, Math.abs(openY - closeY));

            return (
              <g key={c.time}>
                {/* Pavio (Wick) */}
                <line
                  x1={candleX + candleWidth / 2}
                  y1={highY}
                  x2={candleX + candleWidth / 2}
                  y2={lowY}
                  stroke={color}
                  strokeWidth="1.5"
                />
                {/* Corpo (Real Body) */}
                <rect
                  x={candleX}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  rx="1"
                />
              </g>
            );
          })}

          {/* Linha Tracejada do Preço Atual */}
          <line
            x1="0"
            y1={currentPriceY}
            x2="400"
            y2={currentPriceY}
            stroke="#8A96A8"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Eixo de Tempo Inferior */}
          {['18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'].map((time, idx) => (
            <text
              key={time}
              x={25 + idx * 56}
              y={height - 4}
              fill="#64748B"
              fontSize="11"
              fontFamily="'Geist Mono', monospace"
            >
              {time}
            </text>
          ))}
        </svg>

        {/* Badge do Preço Atual Flutuante */}
        <div
          style={{
            position: 'absolute',
            top: `${currentPriceY - 12}px`,
            right: '4px',
            backgroundColor: '#111A2B',
            border: `1px solid ${lastTickDir === 'UP' ? '#22C55E' : '#EF4444'}`,
            color: '#E6EDF5',
            fontFamily: "'Geist Mono', monospace",
            fontSize: '12px',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
            transition: 'top 0.3s ease-out',
          }}
        >
          {currentPrice.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
