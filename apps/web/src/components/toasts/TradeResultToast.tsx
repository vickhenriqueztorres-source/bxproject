import React, { useEffect, useRef } from 'react';
import { getAssetDisplayName } from '../../catalog/assets';
import { AssetFlagBadge } from '../header/AssetFlagBadge';

export interface TradeResultToastProps {
  result: 'WIN' | 'LOSS' | 'DRAW';
  amountFormatted: string;
  assetSymbol?: string;
  direction?: 'UP' | 'DOWN' | 'SUBE' | 'BAJA';
  onClose: () => void;
  autoCloseMs?: number;
  drawerOpen?: boolean;
}

export const TradeResultToast: React.FC<TradeResultToastProps> = ({
  result,
  amountFormatted,
  assetSymbol = 'NZD/JPY',
  direction = 'SUBE',
  onClose,
  autoCloseMs = 4000,
  drawerOpen = false,
}) => {
  // Ref estável para onClose: garante que re-renders do componente pai (a cada tick 1Hz do WebSocket)
  // NUNCA reiniciem o cronômetro de auto-fechamento!
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (autoCloseMs > 0) {
      const timer = setTimeout(() => {
        onCloseRef.current();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [autoCloseMs, result, amountFormatted, assetSymbol, direction]);

  const isWin = result === 'WIN';
  const isLoss = result === 'LOSS';

  const dirLabel = direction === 'UP' || direction === 'SUBE' ? 'SUBE' : 'BAJA';
  const isUpDir = dirLabel === 'SUBE';

  const cleanSymbol =
    getAssetDisplayName(assetSymbol) ||
    assetSymbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

  const title = isWin ? 'Ganaste' : isLoss ? 'Perdiste' : 'Empate';
  const accentColor = isWin ? '#22C47A' : isLoss ? '#F2545B' : '#F5A524';
  const iconBg = isWin
    ? 'rgba(34, 196, 122, 0.14)'
    : isLoss
    ? 'rgba(242, 84, 91, 0.14)'
    : 'rgba(245, 165, 36, 0.14)';
  const iconBorder = isWin
    ? 'rgba(34, 196, 122, 0.35)'
    : isLoss
    ? 'rgba(242, 84, 91, 0.35)'
    : 'rgba(245, 165, 36, 0.35)';

  return (
    <aside
      aria-label="Resultado de la operación"
      role="alert"
      data-testid={isWin ? 'trade-result-toast-win' : 'trade-result-toast-loss'}
      className="trade-result-toast"
      style={{
        position: 'fixed',
        left: drawerOpen ? '448px' : '84px',
        bottom: '48px',
        zIndex: 200,
        background: 'linear-gradient(180deg, rgba(21, 29, 43, 0.96) 0%, rgba(16, 22, 34, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: '10px',
        padding: '11px 14px 13px 14px',
        boxShadow: '0 14px 36px -8px rgba(0, 0, 0, 0.82), 0 0 0 1px rgba(255, 255, 255, 0.02)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minWidth: '256px',
        maxWidth: '340px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        userSelect: 'none',
        overflow: 'hidden',
        transition: 'left 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        animation: 'bmToastSlideIn 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fontFamily: "'Geist', sans-serif",
      }}
    >
      {/* Badge Vetorial de Precisão (Preserva ✓ / ✕ para acessibilidade e testes) */}
      <div
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '8px',
          background: iconBg,
          border: `1px solid ${iconBorder}`,
          display: 'grid',
          placeItems: 'center',
          color: accentColor,
          fontSize: '13px',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        <span>{isWin ? '✓' : isLoss ? '✕' : '—'}</span>
      </div>

      {/* Telemetria da Ordem Liquidada: Cabeçalho + Montante Tabular */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: '2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
          <span
            data-testid="toast-title"
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: accentColor,
            }}
          >
            {title}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.18)' }}>•</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
            <AssetFlagBadge symbol={assetSymbol} size={13} />
            <span
              data-testid="toast-details"
              style={{
                fontSize: '11px',
                color: '#9BA3B2',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {`${cleanSymbol} · ${dirLabel}`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
          <strong
            data-testid="toast-amount"
            className="bm-tabular-nums"
            style={{
              fontSize: '16px',
              fontWeight: 800,
              color: '#F4F5F7',
              fontFamily: "'Geist Mono', monospace",
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.3px',
              lineHeight: 1.15,
            }}
          >
            <span style={{ color: accentColor }}>{amountFormatted}</span>
          </strong>
          <span
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              color: isUpDir ? '#22C47A' : '#F2545B',
              background: isUpDir ? 'rgba(34, 196, 122, 0.10)' : 'rgba(242, 84, 91, 0.10)',
              border: `1px solid ${isUpDir ? 'rgba(34, 196, 122, 0.24)' : 'rgba(242, 84, 91, 0.24)'}`,
              borderRadius: '4px',
              padding: '1px 5px',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {isUpDir ? '↑ SUBE' : '↓ BAJA'}
          </span>
        </div>
      </div>

      {/* Botão Fechar Toast */}
      <button
        type="button"
        data-testid="btn-close-toast"
        aria-label="Cerrar notificación"
        onClick={onClose}
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '6px',
          color: '#8A92A1',
          width: '22px',
          height: '22px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
          transition: 'color 0.15s ease, background 0.15s ease',
        }}
      >
        ×
      </button>

      {/* Barra de Progresso Temporal de Auto-Fechamento (2px inferior) */}
      {autoCloseMs > 0 && (
        <div
          data-testid="toast-progress-bar"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: '2px',
            background: accentColor,
            opacity: 0.65,
            transformOrigin: 'left center',
            animation: `bmToastProgress ${autoCloseMs}ms linear forwards`,
          }}
        />
      )}
    </aside>
  );
};
