import React from 'react';
import { TournamentItem } from './TournamentTypes';
import { TournamentCard } from './TournamentCard';

export interface TournamentListViewProps {
  tournaments: TournamentItem[];
  onSelectTournament: (id: string) => void;
  onClose: () => void;
}

export function TournamentListView({
  tournaments,
  onSelectTournament,
  onClose,
}: TournamentListViewProps) {
  return (
    <div
      data-testid="tournament-list-view"
      style={{
        padding: '24px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
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
            Torneios
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
            Compita com outros traders, mostre sua estratégia e dispute prêmios em dinheiro.
            <br />
            Participação gratuita.
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
                Torneios semanais
              </strong>
              <span
                style={{
                  display: 'block',
                  fontSize: '11px',
                  color: '#8A92A1',
                }}
              >
                Novos torneios toda segunda-feira.
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
            title="Fechar (ESC)"
            aria-label="Fechar modal de torneios"
          >
            ✕
          </button>
        </div>
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
          />
        ))}
      </div>
    </div>
  );
}
