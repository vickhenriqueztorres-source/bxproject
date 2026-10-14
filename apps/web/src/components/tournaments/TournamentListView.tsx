import React from 'react';
import { TournamentItem } from './TournamentTypes';
import { TournamentCard } from './TournamentCard';
import { useUiLanguage } from '../../i18n';

export interface TournamentListViewProps {
  tournaments: TournamentItem[];
  onSelectTournament: (id: string) => void;
  onClose: () => void;
  joinedIds?: string[];
  onOpenArena?: () => void;
}

export function TournamentListView({
  tournaments,
  onSelectTournament,
  onClose,
  joinedIds = [],
  onOpenArena,
}: TournamentListViewProps) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';

  return (
    <div
      data-testid="tournament-list-view"
      style={{
        padding: '24px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
      }}
    >
      {/* ─── CABEÇALHO DO MODAL (IMAGEM 1) ────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            id="tournament-modal-title"
            data-testid="tournament-list-title"
            style={{
              margin: '0 0 6px',
              fontSize: '26px',
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            {isEs ? 'Torneos' : 'Torneios'}
          </h1>
          <p
            data-testid="tournament-list-subtitle"
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#8A92A1',
              lineHeight: 1.45,
              maxWidth: '560px',
            }}
          >
            {isEs ? (
              <>
                Compite con otros traders, demuestra tu estrategia y disputa premios en efectivo.
                <br />
                Participación gratuita.
              </>
            ) : (
              <>
                Compita com outros traders, mostre sua estratégia e dispute prêmios em dinheiro.
                <br />
                Participação gratuita.
              </>
            )}
          </p>
        </div>

        {/* Lado Direito: Badge Torneios Semanais & Botão Fechar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Badge de Torneios Semanais */}
          <div
            data-testid="weekly-tournaments-badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: '#0F1622',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px 14px',
            }}
          >
            <div
              style={{
                color: '#22C47A',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              🏆
            </div>
            <div>
              <strong
                style={{
                  display: 'block',
                  fontSize: '12.5px',
                  color: '#FFFFFF',
                  fontWeight: 700,
                }}
              >
                {isEs ? 'Torneos semanales' : 'Torneios semanais'}
              </strong>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#8A92A1',
                }}
              >
                {isEs ? 'Nuevos torneos todos los lunes.' : 'Novos torneios toda segunda-feira.'}
              </span>
            </div>
          </div>

          {/* Botão Fechar (✕) */}
          <button
            type="button"
            data-testid="btn-close-tournament-modal"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8A92A1',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              transition: 'color 0.1s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
            title={isEs ? 'Cerrar (ESC)' : 'Fechar (ESC)'}
            aria-label={isEs ? 'Cerrar modal de torneos' : 'Fechar modal de torneios'}
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── BANNER DE ACESSO DIRETO: ARENA BLITZ · 15 MIN ────────────────── */}
      <div
        data-testid="modal-open-arena-blitz"
        onClick={() => onOpenArena?.()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenArena?.();
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '12px 18px',
          borderRadius: '10px',
          backgroundColor: '#0E131D',
          border: '1px solid rgba(157, 78, 221, 0.35)',
          cursor: 'pointer',
          transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1), background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontFamily: "'Geist Mono', monospace",
              color: '#C77DFF',
              backgroundColor: 'rgba(157, 78, 221, 0.14)',
              border: '1px solid rgba(157, 78, 221, 0.32)',
              borderRadius: '4px',
              padding: '3px 8px',
            }}
          >
            ⚡ ARENA BLITZ · 15 MIN
          </span>
          <span style={{ fontSize: '13px', color: '#DCE1EA', fontWeight: 600 }}>
            {isEs
              ? 'Sprints Sit & Go de 15 minutos con T$ 1.000 iniciales — Top 3 se llevan el bote.'
              : 'Sprints Sit & Go de 15 minutos com T$ 1.000 iniciais — Top 3 levam o pote.'}
          </span>
        </div>
        <span
          style={{
            fontSize: '12.5px',
            fontWeight: 700,
            color: '#C77DFF',
            whiteSpace: 'nowrap',
          }}
        >
          {isEs ? 'Abrir Arena Blitz →' : 'Abrir Arena Blitz →'}
        </span>
      </div>

      {/* ─── GRADE DOS 5 CARDS DE TORNEIOS (IMAGEM 1) ─────────────────────── */}
      <div
        data-testid="tournament-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '14px',
          boxSizing: 'border-box',
        }}
      >
        {tournaments.map((t) => (
          <TournamentCard
            key={t.id}
            tournament={t}
            onSelect={onSelectTournament}
            isJoined={joinedIds.includes(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

