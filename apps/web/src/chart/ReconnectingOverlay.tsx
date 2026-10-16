import React from 'react';

export interface ReconnectingOverlayProps {
  isReconnecting: boolean;
  isLoadingInitial?: boolean;
  symbol?: string;
  message?: string;
}

export const ReconnectingOverlay: React.FC<ReconnectingOverlayProps> = ({
  isReconnecting,
  isLoadingInitial = false,
  symbol,
  message = 'Reconectando...',
}) => {
  if (!isReconnecting && !isLoadingInitial) return null;

  if (!isReconnecting && isLoadingInitial) {
    return (
      <div
        data-testid="cold-start-loading-icon"
        aria-label={symbol ? `Carregando ${symbol}` : 'Carregando gráfico'}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 35,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'rgba(16, 22, 34, 0.72)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A92A1"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="reconnecting-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(11, 14, 20, 0.78)',
        backdropFilter: 'blur(5px)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: '#DCE1EA',
        userSelect: 'none',
        pointerEvents: 'none',
        animation: 'fadeInOverlay 0.2s ease',
      }}
    >
      {/* Ícone de Radar / Wi-Fi com Ondas de Pulso (Sessão 10) */}
      <div
        data-testid="radar-pulse-icon"
        style={{
          position: 'relative',
          width: '56px',
          height: '56px',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {/* Onda 1 Externa (Pulso) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: '2px solid rgba(0, 229, 255, 0.25)',
            animation: 'radarPulse 2s cubic-bezier(0, 0.2, 0.8, 1) infinite',
          }}
        />
        {/* Onda 2 Intermediária */}
        <div
          style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '2px solid rgba(0, 229, 255, 0.45)',
            animation: 'radarPulse 2s cubic-bezier(0, 0.2, 0.8, 1) infinite 0.5s',
          }}
        />
        {/* Ícone SVG Central */}
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#00e5ff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ zIndex: 2 }}
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
        </svg>
      </div>

      {/* Texto de Status */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <strong
          data-testid="reconnecting-text"
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: '#F4F5F7',
            letterSpacing: '-0.2px',
          }}
        >
          {message}
        </strong>
        <span
          style={{
            fontSize: '11px',
            color: '#8A92A1',
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {symbol ? `Sincronizando cotações · ${symbol}` : 'Sincronizando feed em tempo real...'}
        </span>
      </div>
    </div>
  );
};
