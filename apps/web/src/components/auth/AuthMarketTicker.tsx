import React from 'react';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_TEXT,
} from '../../lib/design-tokens';

/**
 * AuthMarketTicker — Painel vertical de cotações de índices sintéticos
 * para preencher o espaço à direita do chart no AuthShell.
 *
 * Exibe 5 ativos sintéticos com nome, preço demo e variação percentual.
 * Design: terminal de precisão, dados tabulares, zero cassino.
 */

interface TickerAsset {
  symbol: string;
  name: string;
  price: string;
  change: string;
  direction: 'up' | 'down';
}

const DEMO_ASSETS: TickerAsset[] = [
  { symbol: 'V50', name: 'Vol 50', price: '507.98', change: '+1.24%', direction: 'up' },
  { symbol: 'V75', name: 'Vol 75', price: '891.44', change: '+0.87%', direction: 'up' },
  { symbol: 'V100', name: 'Vol 100', price: '1,243.60', change: '-0.32%', direction: 'down' },
  { symbol: 'C500', name: 'Crash 500', price: '6,812.15', change: '+2.11%', direction: 'up' },
  { symbol: 'B1K', name: 'Boom 1000', price: '4,390.72', change: '-0.58%', direction: 'down' },
];

/** Micro seta SVG — up ou down, 8x8px */
function MicroArrow({ direction }: { direction: 'up' | 'down' }) {
  const color = direction === 'up' ? PRECISION_COLORS.profit : PRECISION_COLORS.loss;
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" style={{ flexShrink: 0 }}>
      {direction === 'up' ? (
        <path d="M4 1 L7 5 L1 5 Z" fill={color} />
      ) : (
        <path d="M4 7 L7 3 L1 3 Z" fill={color} />
      )}
    </svg>
  );
}

export interface AuthMarketTickerProps {
  className?: string;
  style?: React.CSSProperties;
}

export function AuthMarketTicker({ className = '', style }: AuthMarketTickerProps) {
  return (
    <div
      data-testid="auth-market-ticker"
      className={className}
      style={{
        width: '148px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: `rgba(16, 22, 34, 0.6)`,
        border: `1px solid ${PRECISION_SURFACES.line}`,
        borderRadius: '8px',
        overflow: 'hidden',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        alignSelf: 'stretch',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: `1px solid rgba(138, 146, 161, 0.08)`,
        }}
      >
        <span
          style={{
            fontSize: '9.5px',
            fontWeight: 600,
            color: PRECISION_TEXT.quiet,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: PRECISION_FONTS.sans,
          }}
        >
          Mercados
        </span>
      </div>

      {/* Asset list */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {DEMO_ASSETS.map((asset, idx) => (
          <div
            key={asset.symbol}
            data-testid={`ticker-asset-${asset.symbol}`}
            style={{
              padding: '8px 12px',
              borderBottom: idx < DEMO_ASSETS.length - 1
                ? `1px solid rgba(138, 146, 161, 0.06)`
                : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            {/* Row 1: Symbol + Arrow */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  color: PRECISION_TEXT.muted,
                  fontFamily: PRECISION_FONTS.sans,
                  letterSpacing: '0.02em',
                }}
              >
                {asset.name}
              </span>
              <MicroArrow direction={asset.direction} />
            </div>

            {/* Row 2: Price + Change */}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: '4px',
              }}
            >
              <span
                className="bm-tabular-nums"
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: PRECISION_TEXT.strong,
                  fontFamily: PRECISION_FONTS.mono,
                  letterSpacing: '-0.01em',
                }}
              >
                {asset.price}
              </span>
              <span
                className="bm-tabular-nums"
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  color: asset.direction === 'up'
                    ? PRECISION_COLORS.profit
                    : PRECISION_COLORS.loss,
                  fontFamily: PRECISION_FONTS.mono,
                }}
              >
                {asset.change}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
