import React, { useEffect } from 'react';

export interface TradeResultToastProps {
  result: 'WIN' | 'LOSS' | 'DRAW';
  amountFormatted: string;
  assetSymbol?: string;
  direction?: 'UP' | 'DOWN' | 'SUBE' | 'BAJA';
  onClose: () => void;
  autoCloseMs?: number;
}

export const TradeResultToast: React.FC<TradeResultToastProps> = ({
  result,
  amountFormatted,
  assetSymbol = 'NZD/JPY',
  direction = 'SUBE',
  onClose,
  autoCloseMs = 4000,
}) => {
  useEffect(() => {
    if (autoCloseMs > 0) {
      const timer = setTimeout(onClose, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [onClose, autoCloseMs]);

  const isWin = result === 'WIN';
  const isLoss = result === 'LOSS';

  const dirLabel = direction === 'UP' || direction === 'SUBE' ? 'SUBE' : 'BAJA';
  const cleanSymbol = assetSymbol
    .replace('_OTC', '')
    .replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2');

  const title = isWin ? 'Ganaste' : isLoss ? 'Perdiste' : 'Empate';
  const badgeBg = isWin ? '#22C47A' : isLoss ? '#F2545B' : '#FFA75D';
  const accentColor = isWin ? '#22C47A' : isLoss ? '#F2545B' : '#FFA75D';
  const borderColor = isWin
    ? 'rgba(34, 196, 122, 0.4)'
    : isLoss
    ? 'rgba(242, 84, 91, 0.4)'
    : 'rgba(255, 167, 93, 0.4)';

  return (
    <aside
      aria-label="Resultado de la operación"
      role="alert"
      data-testid={isWin ? 'trade-result-toast-win' : 'trade-result-toast-loss'}
      className="trade-result-toast"
      style={{
        position: 'fixed',
        left: '84px',
        bottom: '50px',
        zIndex: 200,
        background: '#151922',
        border: `1px solid ${borderColor}`,
        borderRadius: '10px',
        padding: '14px 18px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        minWidth: '220px',
        maxWidth: '320px',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        animation: 'bmToastSlideIn 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fontFamily: "'Geist', sans-serif",
      }}
    >
      {/* Ícone Circular (Checkmark para WIN, X para LOSS) */}
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: badgeBg,
          display: 'grid',
          placeItems: 'center',
          color: '#0D0F14',
          fontSize: '16px',
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        {isWin ? '✓' : isLoss ? '✕' : '—'}
      </div>

      {/* Conteúdo Textual: Título, Montante e Par/Direção */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, lineHeight: 1.2 }}>
        <span
          data-testid="toast-title"
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#F4F5F7',
          }}
        >
          {title}
        </span>
        <strong
          data-testid="toast-amount"
          className="bm-tabular-nums"
          style={{
            fontSize: '16px',
            fontWeight: 800,
            color: accentColor,
            fontFamily: "'Geist Mono', monospace",
            letterSpacing: '-0.3px',
            margin: '2px 0',
          }}
        >
          {amountFormatted}
        </strong>
        <span
          data-testid="toast-details"
          style={{
            fontSize: '10.5px',
            color: '#8A92A1',
            fontWeight: 600,
          }}
        >
          {`${cleanSymbol} · ${dirLabel}`}
        </span>
      </div>

      {/* Botão Fechar Toast */}
      <button
        type="button"
        data-testid="btn-close-toast"
        aria-label="Cerrar notificación"
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#8A92A1',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
          alignSelf: 'flex-start',
          transition: 'color 0.15s ease',
        }}
      >
        ×
      </button>
    </aside>
  );
};
