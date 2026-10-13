import React from 'react';
import { isNewTraderoomEnabled } from '../lib/feature-flags';

export interface StalenessOverlayProps {
  isStale: boolean;
  symbol: string;
  tickAgeMs?: number;
  circuitBreakerOpen?: boolean;
  circuitBreakerRemainingSeconds?: number;
}

export const StalenessOverlay: React.FC<StalenessOverlayProps> = ({
  isStale,
  symbol,
  tickAgeMs = 4000,
  circuitBreakerOpen = false,
  circuitBreakerRemainingSeconds = 30,
}) => {
  if (!isStale && !circuitBreakerOpen) return null;

  const seconds = Math.max(4, Math.round(tickAgeMs / 1000));
  const isBinmax = isNewTraderoomEnabled();

  // Modo Turbo Prata Moderno (Pill discreto flutuante que não cobre as velas nem as ferramentas)
  if (isBinmax) {
    if (circuitBreakerOpen) {
      return (
        <div
          data-testid="staleness-circuit-pill"
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 25,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              background: 'rgba(21, 25, 34, 0.92)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(234, 88, 12, 0.55)',
              borderRadius: '20px',
              padding: '4px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
            }}
          >
            <span style={{ fontSize: '12px' }}>⚡</span>
            <span
              style={{
                color: '#fb923c',
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Reconexão em pausa ({circuitBreakerRemainingSeconds}s) · {symbol}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        data-testid="staleness-pill"
        style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 25,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(21, 25, 34, 0.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(242, 84, 91, 0.45)',
            borderRadius: '20px',
            padding: '4px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
          }}
        >
          <span style={{ fontSize: '12px' }}>⚠️</span>
          <span
            style={{
              color: '#F2545B',
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Cotação em pausa ({symbol}) · {seconds}s
          </span>
        </div>
      </div>
    );
  }

  // Modo Legado Original (Preservado para NEW_TRADEROOM = false)
  if (circuitBreakerOpen) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '48px',
          left: '16px',
          right: '16px',
          zIndex: 25,
          pointerEvents: 'none',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            background: 'rgba(234, 88, 12, 0.25)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(234, 88, 12, 0.65)',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(234, 88, 12, 0.35)',
            animation: 'pulse 1.5s infinite',
          }}
        >
          <span style={{ fontSize: '16px' }}>⚡</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#fb923c', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
              RECONEXÃO EM PAUSA DE SEGURANÇA — CIRCUIT BREAKER ABERTO ({symbol})
            </div>
            <div style={{ color: '#fed7aa', fontSize: '10px', fontWeight: 600 }}>
              3 falhas consecutivas de rede. Retentando automaticamente em {circuitBreakerRemainingSeconds}s (proteção contra Reconnect Storm).
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: '48px',
        left: '16px',
        right: '16px',
        zIndex: 25,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.22)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(239, 68, 68, 0.55)',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.25)',
          animation: 'pulse 1.5s infinite',
        }}
      >
        <span style={{ fontSize: '16px' }}>⚠️</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: '#ff6b6b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' }}>
            FEED DESATUALIZADO — COTAÇÃO CONGELADA ({symbol})
          </div>
          <div style={{ color: '#fca5a5', fontSize: '10px', fontWeight: 600 }}>
            Sem cotações oficiais há {seconds}s. Abertura de novos contratos bloqueada pela governança de risco.
          </div>
        </div>
      </div>
    </div>
  );
};
