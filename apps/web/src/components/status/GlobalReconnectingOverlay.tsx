import React from 'react';

export interface GlobalReconnectingOverlayProps {
  isReconnecting: boolean;
  message?: string;
  onRetry?: () => void;
}

export function GlobalReconnectingOverlay({
  isReconnecting,
  message = 'Reconectando…',
  onRetry,
}: GlobalReconnectingOverlayProps) {
  if (!isReconnecting) return null;

  return (
    <div
      data-testid="global-reconnecting-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(11, 18, 32, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'all',
      }}
      role="alert"
      aria-live="assertive"
    >
      <div
        style={{
          backgroundColor: '#111A2B',
          border: '1px solid #1F2A3A',
          borderRadius: '12px',
          padding: '24px 36px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)',
          maxWidth: '320px',
          textAlign: 'center',
        }}
      >
        {/* Ícone WiFi Pulsante */}
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#19263D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8A96A8',
            fontSize: '24px',
            animation: 'pulse 1.8s ease-in-out infinite',
          }}
        >
          📶
        </div>

        {/* Texto do Estado */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#E6EDF5',
            fontFamily: "'Geist', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#8A96A8',
              display: 'inline-block',
            }}
          />
          <span>{message}</span>
        </div>

        <p style={{ margin: 0, fontSize: '12px', color: '#8A96A8', lineHeight: 1.4 }}>
          Sincronizando feed de mercado en tiempo real. Por favor, espera unos segundos.
        </p>

        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              marginTop: '8px',
              backgroundColor: '#1F2A3A',
              color: '#E6EDF5',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reintentar ahora
          </button>
        )}
      </div>
    </div>
  );
}
