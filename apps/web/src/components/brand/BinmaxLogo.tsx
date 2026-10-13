import React from 'react';

export type BinmaxLogoVariant = 'horizontal' | 'short' | 'vertical' | 'mark';

export interface BinmaxLogoProps {
  variant?: BinmaxLogoVariant;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function BinmaxLogo({
  variant = 'horizontal',
  height = 32,
  className = '',
  style,
}: BinmaxLogoProps) {
  // Símbolo SVG da seta dupla construído na grade exata de 48x48
  const mark = (
    <svg
      viewBox="0 0 48 48"
      width={height}
      height={height}
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M 9 26 L 24 11 L 39 26"
        stroke="#DCE1EA"
        strokeWidth="6.5"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
      <path
        d="M 9 41 L 24 26 L 39 41"
        stroke="#8A92A1"
        strokeWidth="6.5"
        strokeLinejoin="miter"
        strokeLinecap="square"
      />
    </svg>
  );

  if (variant === 'mark') {
    return (
      <div
        className={`binmax-logo-mark ${className}`}
        style={{ display: 'inline-flex', alignItems: 'center', ...style }}
        role="img"
        aria-label="Binmax Option"
      >
        {mark}
      </div>
    );
  }

  if (variant === 'short') {
    return (
      <div
        className={`binmax-logo-short ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: `${Math.round(height * 0.25)}px`,
          textDecoration: 'none',
          userSelect: 'none',
          ...style,
        }}
        role="img"
        aria-label="Binmax Option"
      >
        {mark}
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 800,
            fontSize: `${Math.round(height * 0.52)}px`,
            letterSpacing: '-0.01em',
            color: '#DCE1EA',
            lineHeight: 1,
            textTransform: 'uppercase',
          }}
        >
          BINMAX
        </span>
      </div>
    );
  }

  if (variant === 'vertical') {
    return (
      <div
        className={`binmax-logo-vertical ${className}`}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${Math.round(height * 0.2)}px`,
          textDecoration: 'none',
          userSelect: 'none',
          ...style,
        }}
        role="img"
        aria-label="Binmax Option"
      >
        {mark}
        <div style={{ textAlign: 'center', lineHeight: 1.1 }}>
          <div
            style={{
              fontFamily: "'Geist', sans-serif",
              fontWeight: 800,
              fontSize: `${Math.round(height * 0.45)}px`,
              letterSpacing: '-0.01em',
              color: '#DCE1EA',
              textTransform: 'uppercase',
            }}
          >
            BINMAX
          </div>
          <div
            style={{
              fontFamily: "'Geist', sans-serif",
              fontWeight: 500,
              fontSize: `${Math.round(height * 0.28)}px`,
              letterSpacing: '0.18em',
              color: '#8A92A1',
              textTransform: 'uppercase',
            }}
          >
            OPTION
          </div>
        </div>
      </div>
    );
  }

  // Horizontal completa (default)
  return (
    <div
      className={`binmax-logo-horizontal ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${Math.round(height * 0.25)}px`,
        textDecoration: 'none',
        userSelect: 'none',
        ...style,
      }}
      role="img"
      aria-label="Binmax Option"
    >
      {mark}
      <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: '6px', lineHeight: 1 }}>
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 800,
            fontSize: `${Math.round(height * 0.52)}px`,
            letterSpacing: '-0.01em',
            color: '#DCE1EA',
            textTransform: 'uppercase',
          }}
        >
          BINMAX
        </span>
        <span
          style={{
            fontFamily: "'Geist', sans-serif",
            fontWeight: 500,
            fontSize: `${Math.round(height * 0.38)}px`,
            letterSpacing: '0.18em',
            color: '#8A92A1',
            textTransform: 'uppercase',
          }}
        >
          OPTION
        </span>
      </div>
    </div>
  );
}
