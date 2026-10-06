import { useState } from 'react';

export interface TradersMoodBarProps {
  bullsPercentage: number;
}

export function TradersMoodBar({ bullsPercentage }: TradersMoodBarProps) {
  const [hovered, setHovered] = useState(false);
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
        width: '28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Tag Superior: Touros (Bulls) */}
      <div
        className="mood-tag-bulls"
        style={{
          background: 'rgba(10, 16, 30, 0.9)',
          border: '1px solid #00e676',
          borderRadius: '4px',
          padding: '2px 4px',
          fontSize: '9px',
          fontWeight: 800,
          color: '#00e676',
          marginBottom: '6px',
          boxShadow: '0 2px 8px rgba(0, 230, 118, 0.25)',
          whiteSpace: 'nowrap',
          fontFamily: "'Space Grotesk', sans-serif",
          transition: 'all 0.3s ease',
        }}
      >
        ▲ {bulls}%
      </div>

      {/* Barra Vertical Bicolor Ultra-Slim */}
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
        {/* Segmento Verde (Touros) no Topo */}
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

        {/* Segmento Vermelho (Ursos) na Base preenche o restante */}
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

      {/* Tag Inferior: Ursos (Bears) */}
      <div
        className="mood-tag-bears"
        style={{
          background: 'rgba(10, 16, 30, 0.9)',
          border: '1px solid #ff3d71',
          borderRadius: '4px',
          padding: '2px 4px',
          fontSize: '9px',
          fontWeight: 800,
          color: '#ff3d71',
          marginTop: '6px',
          boxShadow: '0 2px 8px rgba(255, 61, 113, 0.25)',
          whiteSpace: 'nowrap',
          fontFamily: "'Space Grotesk', sans-serif",
          transition: 'all 0.3s ease',
        }}
      >
        ▼ {bears}%
      </div>

      {/* Tooltip Informativo ao Passar o Mouse */}
      {hovered && (
        <div
          role="tooltip"
          className="mood-tooltip"
          style={{
            position: 'absolute',
            left: '36px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(10, 16, 30, 0.95)',
            border: '1px solid #233555',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#e8edf8',
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.7)',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: '2px' }}>Sentimento dos Traders</div>
          <div style={{ fontSize: '10px', color: '#8e9ebc' }}>
            <span style={{ color: '#00e676', fontWeight: 700 }}>{bulls}% Alta</span> ·{' '}
            <span style={{ color: '#ff3d71', fontWeight: 700 }}>{bears}% Baixa</span>
          </div>
        </div>
      )}
    </aside>
  );
}
