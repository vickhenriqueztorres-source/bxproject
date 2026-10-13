import React from 'react';

export interface ExpirationResultPinProps {
  result: 'WIN' | 'LOSS' | 'DRAW';
  amountFormatted: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function ExpirationResultPin({
  result,
  amountFormatted,
  x,
  y,
  onClose,
}: ExpirationResultPinProps) {
  const isWin = result === 'WIN';
  const bgColor = isWin ? '#22C47A' : result === 'LOSS' ? '#E5484D' : '#8A92A1';

  return (
    <div
      data-testid={`expiration-result-pin-${isWin ? 'win' : 'loss'}`}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        transform: 'translate(10px, -50%)',
        zIndex: 25,
        pointerEvents: 'auto',
        userSelect: 'none',
        animation: 'bmPinEnter 260ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Ponto Âncora no Cruzamento da Linha de Expiração */}
      <div
        data-testid="pin-anchor-dot"
        style={{
          position: 'absolute',
          left: '-14px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: '#FFFFFF',
          boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.4), 0 0 6px rgba(255, 255, 255, 0.8)',
          ...(isWin ? { animation: 'bmAnchorPulse 260ms cubic-bezier(0.16, 1, 0.3, 1) 1' } : {}),
        }}
      />

      {/* Seta Apontando para o Ponto Âncora */}
      <div
        style={{
          position: 'absolute',
          left: '-5px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderRight: `6px solid ${bgColor}`,
        }}
      />

      {/* Card Balão de Resultado */}
      <div
        style={{
          background: bgColor,
          borderRadius: '6px',
          padding: '6px 12px',
          color: '#FFFFFF',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: '130px',
          boxSizing: 'border-box',
          fontFamily: "'Geist', sans-serif",
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            textTransform: 'uppercase',
            opacity: 0.95,
          }}
        >
          <span>RESULTADO (L/P)</span>
          <button
            type="button"
            data-testid="pin-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
              padding: 0,
              fontSize: '14px',
              fontWeight: 800,
              lineHeight: 1,
              width: '14px',
              height: '14px',
              display: 'grid',
              placeItems: 'center',
              opacity: 0.85,
            }}
            title="Fechar resultado"
          >
            ×
          </button>
        </div>

        {/* Valor de Ganho / Perda */}
        <div
          style={{
            fontSize: '16px',
            fontWeight: 900,
            fontFamily: "'Geist Mono', monospace",
            letterSpacing: '-0.02em',
            marginTop: '2px',
          }}
        >
          {amountFormatted}
        </div>
      </div>
    </div>
  );
}
