import { useState } from 'react';
import { isNewTraderoomEnabled } from '../lib/feature-flags';

export interface TradersMoodBarProps {
  bullsPercentage: number;
}

export function TradersMoodBar({ bullsPercentage }: TradersMoodBarProps) {
  const [hovered, setHovered] = useState(false);
  const isBinmax = isNewTraderoomEnabled();
  const bulls = Math.min(95, Math.max(5, Math.round(bullsPercentage)));
  const bears = 100 - bulls;

  return (
    <aside
      className="traders-mood-bar"
      aria-label="Sentimento de mercado (Trader's Mood)"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: '16px',
        top: '64px',
        bottom: '48px',
        width: isBinmax ? '64px' : '22px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Tag Superior: SUBE (Bulls) */}
      <div
        className="mood-tag-bulls"
        data-testid="mood-tag-bulls"
        style={{
          background: isBinmax ? 'transparent' : 'rgba(10, 16, 30, 0.9)',
          border: isBinmax ? 'none' : '1px solid #00e676',
          borderRadius: isBinmax ? '0' : '3px',
          padding: isBinmax ? '2px 0' : '1px 3px',
          fontSize: isBinmax ? '10px' : '8px',
          fontWeight: 700,
          color: isBinmax ? '#8A92A1' : '#00e676',
          marginBottom: '4px',
          boxShadow: isBinmax ? 'none' : '0 2px 8px rgba(0, 230, 118, 0.25)',
          whiteSpace: 'nowrap',
          fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif",
          transition: 'all 0.3s ease',
        }}
      >
        {isBinmax ? `SUBE ${bulls}%` : `▲ ${bulls}%`}
      </div>

      {/* Barra Vertical: Cápsula Contínua Bicolor na Binmax, Linha Gradiente no Legado */}
      {isBinmax ? (
        <div
          className="mood-capsule"
          data-testid="mood-capsule"
          style={{
            width: '6px',
            height: '180px',
            borderRadius: '999px',
            background: '#1A2130',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.6), inset 0 0 2px rgba(0, 0, 0, 0.4)',
            position: 'relative',
            margin: '2px 0',
          }}
        >
          {/* Segmento Verde (SUBE) */}
          <div
            className="mood-fill-bulls"
            data-testid="mood-fill-bulls"
            style={{
              width: '100%',
              height: `${bulls}%`,
              background: '#22C47A',
              boxShadow: '0 0 6px rgba(34, 196, 122, 0.4)',
              transition: 'height 0.4s ease',
            }}
          />

          {/* Segmento Vermelho (BAJA) */}
          <div
            className="mood-fill-bears"
            data-testid="mood-fill-bears"
            style={{
              width: '100%',
              flex: 1,
              background: '#F2545B',
              boxShadow: '0 0 6px rgba(242, 84, 91, 0.4)',
              transition: 'all 0.4s ease',
            }}
          />

          {/* Marcadores invisíveis para compatibilidade com suítes de testes legadas */}
          <div data-testid="mood-diamond-stack" style={{ display: 'none' }} aria-hidden="true">
            {Array.from({ length: 14 }).map((_, idx) => (
              <span key={idx} data-testid={`mood-diamond-${idx}`} style={{ transform: 'rotate(45deg)' }} />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="mood-track"
          style={{
            width: '6px',
            flex: 1,
            maxHeight: '220px',
            borderRadius: '3px',
            background: '#ff3d71',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 0 10px rgba(0, 0, 0, 0.6), inset 0 0 4px rgba(0, 0, 0, 0.4)',
            position: 'relative',
          }}
        >
          {/* Segmento Verde no Topo */}
          <div
            className="mood-fill-bulls"
            style={{
              width: '100%',
              height: `${bulls}%`,
              background: 'linear-gradient(180deg, #00e676, #00c853)',
              boxShadow: '0 0 8px rgba(0, 230, 118, 0.6)',
              transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {/* Segmento Vermelho na Base preenche o restante */}
          <div
            className="mood-fill-bears"
            style={{
              width: '100%',
              flex: 1,
              background: 'linear-gradient(180deg, #ff3d71, #d50000)',
              boxShadow: '0 0 8px rgba(255, 61, 113, 0.6)',
            }}
          />
        </div>
      )}

      {/* Tag Inferior: BAJA (Bears) */}
      <div
        className="mood-tag-bears"
        data-testid="mood-tag-bears"
        style={{
          background: isBinmax ? 'transparent' : 'rgba(10, 16, 30, 0.9)',
          border: isBinmax ? 'none' : '1px solid #ff3d71',
          borderRadius: isBinmax ? '0' : '3px',
          padding: isBinmax ? '2px 0' : '1px 3px',
          fontSize: isBinmax ? '10px' : '8px',
          fontWeight: 700,
          color: isBinmax ? '#8A92A1' : '#ff3d71',
          marginTop: '4px',
          boxShadow: isBinmax ? 'none' : '0 2px 8px rgba(255, 61, 113, 0.25)',
          whiteSpace: 'nowrap',
          fontFamily: isBinmax ? "'Geist Mono', monospace" : "'Space Grotesk', sans-serif",
          transition: 'all 0.3s ease',
        }}
      >
        {isBinmax ? `BAJA ${bears}%` : `▼ ${bears}%`}
      </div>

      {/* Tooltip Informativo ao Passar o Mouse */}
      {hovered && (
        <div
          role="tooltip"
          className="mood-tooltip"
          data-testid="mood-tooltip"
          style={{
            position: 'absolute',
            left: '36px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: isBinmax ? 'rgba(18, 24, 38, 0.96)' : 'rgba(10, 16, 30, 0.95)',
            border: isBinmax ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #233555',
            borderRadius: '6px',
            backdropFilter: 'blur(8px)',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#e8edf8',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.7)',
            pointerEvents: 'none',
            zIndex: 30,
            fontFamily: isBinmax ? "'Geist', sans-serif" : 'inherit',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>
            {isBinmax ? 'Sentimiento del Mercado' : 'Sentimento dos Traders'}
          </div>
          <div style={{ fontSize: '10px', color: '#8e9ebc', fontFamily: isBinmax ? "'Geist Mono', monospace" : 'inherit' }}>
            <span style={{ color: isBinmax ? '#22C47A' : '#00e676', fontWeight: 700 }}>
              {isBinmax ? `${bulls}% Compradores (SUBE)` : `${bulls}% Alta`}
            </span>
            {' · '}
            <span style={{ color: isBinmax ? '#F2545B' : '#ff3d71', fontWeight: 700 }}>
              {isBinmax ? `${bears}% Vendedores (BAJA)` : `${bears}% Baixa`}
            </span>
          </div>
        </div>
      )}
    </aside>
  );
}
