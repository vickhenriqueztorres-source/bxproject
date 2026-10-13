import React, { useState } from 'react';
import { TournamentModal } from '../tournaments/TournamentModal';

export interface TournamentsDrawerProps {
  onClose?: () => void;
  initialJoined?: boolean;
}

export const TournamentsDrawer: React.FC<TournamentsDrawerProps> = ({
  onClose,
  initialJoined = false,
}) => {
  const [isJoined, setIsJoined] = useState<boolean>(initialJoined);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleJoin = () => {
    setIsJoined((prev) => !prev);
  };

  return (
    <div
      data-testid="tournaments-drawer"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        color: '#F4F5F7',
        width: '100%',
      }}
    >
      {/* Botão de Destaque: Abrir Pop-up Oficial de Torneios */}
      <button
        type="button"
        data-testid="btn-open-tournament-modal-hub"
        onClick={() => setIsModalOpen(true)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: '8px',
          backgroundColor: '#121824',
          border: '1px solid rgba(34, 196, 122, 0.35)',
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.15s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏆</span>
          <span>Abrir Hub de Torneios</span>
        </span>
        <span style={{ color: '#22C47A', fontSize: '14px' }}>→</span>
      </button>
      {/* 1. Card de Torneio Ativo: Torneo Turbo Sprint */}
      <div
        data-testid="tournament-card-live"
        style={{
          background: 'rgba(21, 25, 34, 0.85)',
          border: '1px solid rgba(244, 245, 247, 0.08)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'border 0.15s ease',
        }}
      >
        {/* Status Superior: EN VIVO + Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            data-testid="live-tournament-badge"
            style={{
              fontSize: '10px',
              fontWeight: 800,
              color: '#22C47A',
              background: 'rgba(34, 196, 122, 0.15)',
              border: '1px solid rgba(34, 196, 122, 0.3)',
              padding: '2px 8px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '8px' }}>●</span> EN VIVO
          </span>
          <span
            data-testid="live-tournament-countdown"
            style={{
              fontSize: '11px',
              color: '#8A92A1',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Termina en 14h 22m
          </span>
        </div>

        {/* Informações Principais */}
        <div>
          <h3
            data-testid="live-tournament-title"
            style={{
              margin: '0 0 6px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#F4F5F7',
              letterSpacing: '-0.2px',
            }}
          >
            Torneo Turbo Sprint
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#8A92A1',
              lineHeight: 1.45,
            }}
          >
            Compite con saldo de práctica por premios en efectivo.
          </p>
        </div>

        {/* Premiação */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(11, 14, 20, 0.6)',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(244, 245, 247, 0.04)',
          }}
        >
          <span style={{ fontSize: '11px', color: '#8A92A1' }}>Premio total</span>
          <strong
            data-testid="live-tournament-prize"
            style={{
              fontSize: '14px',
              fontWeight: 800,
              color: '#22C47A',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            $10.000 USD
          </strong>
        </div>

        {/* Botão de Ação: Participar / Inscrito */}
        <button
          type="button"
          data-testid="btn-participate-tournament"
          onClick={handleJoin}
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: '6px',
            background: isJoined
              ? 'rgba(34, 196, 122, 0.15)'
              : 'linear-gradient(135deg, #00e5ff 0%, #00b4d8 100%)',
            border: isJoined ? '1px solid #22C47A' : 'none',
            color: isJoined ? '#22C47A' : '#0B0E14',
            fontWeight: 800,
            fontSize: '12px',
            letterSpacing: '0.2px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          {isJoined ? (
            <>
              <span>✓</span>
              <span>Inscrito</span>
            </>
          ) : (
            <span>Participar</span>
          )}
        </button>
      </div>

      {/* 2. Card de Torneio Futuro: Torneo Semanal */}
      <div
        data-testid="tournament-card-upcoming"
        style={{
          background: 'rgba(21, 25, 34, 0.65)',
          border: '1px solid rgba(244, 245, 247, 0.06)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Status Superior: PRÓXIMAMENTE */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            data-testid="upcoming-tournament-badge"
            style={{
              fontSize: '9.5px',
              fontWeight: 700,
              color: '#8A92A1',
              background: 'rgba(138, 146, 161, 0.12)',
              border: '1px solid rgba(138, 146, 161, 0.2)',
              padding: '2px 8px',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.4px',
            }}
          >
            PRÓXIMAMENTE
          </span>
          <span
            data-testid="upcoming-tournament-start"
            style={{
              fontSize: '11px',
              color: '#8A92A1',
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Inicia en 3d 14h
          </span>
        </div>

        {/* Título e Premiação */}
        <div>
          <h3
            data-testid="upcoming-tournament-title"
            style={{
              margin: '0 0 4px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#F4F5F7',
            }}
          >
            Torneo Semanal
          </h3>
          <p style={{ margin: 0, fontSize: '11.5px', color: '#8A92A1' }}>
            Compite con los mejores traders de la región por premios garantizados.
          </p>
        </div>
      </div>

      {/* Modal Popup Oficial */}
      <TournamentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
};
