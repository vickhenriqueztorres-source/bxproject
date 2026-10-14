import React from 'react';
import { TournamentItem } from './TournamentTypes';
import { TournamentTrophyArt } from './TournamentTrophyArt';
import { useUiLanguage } from '../../i18n';

export interface TournamentCardProps {
  tournament: TournamentItem;
  onSelect: (id: string) => void;
  isJoined?: boolean;
}

function translateCardActionLabel(label: string, isEs: boolean): string {
  if (!isEs) return label;
  if (label === 'Ver detalhes') return 'Ver detalles';
  if (label === 'Ver resultado') return 'Ver resultado';
  return label;
}

export function TournamentCard({ tournament, onSelect, isJoined = false }: TournamentCardProps) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const isLive = tournament.status === 'AO_VIVO';
  const isUpcoming = tournament.status === 'EM_BREVE';
  const isFinished = tournament.status === 'ENCERRADO';

  const isHighlighted = isLive;

  return (
    <div
      data-testid={`tournament-card-${tournament.id}`}
      style={{
        backgroundColor: '#0E131D',
        border: isHighlighted
          ? '1.5px solid #22C47A'
          : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '14px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: isHighlighted
          ? '0 12px 32px rgba(34, 196, 122, 0.12)'
          : '0 8px 24px rgba(0, 0, 0, 0.4)',
        opacity: isFinished ? 0.65 : 1,
        transition: 'transform 100ms cubic-bezier(0.16, 1, 0.3, 1), border-color 100ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = isHighlighted ? 'translateY(-6px)' : 'translateY(-4px)';
        if (!isHighlighted) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        if (!isHighlighted) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      }}
    >
      <div>
        {/* Barra Superior de Status & Contagem Regressiva */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            fontSize: '10px',
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {/* Badge de Status */}
          <span
            data-testid={`tournament-badge-${tournament.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 800,
              letterSpacing: '0.04em',
              backgroundColor: isLive
                ? 'rgba(34, 196, 122, 0.14)'
                : isUpcoming
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isLive ? '#22C47A' : isUpcoming ? '#AEB8C8' : '#6A7282',
              border: isLive
                ? '1px solid rgba(34, 196, 122, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {isLive && <span style={{ fontSize: '8px' }}>●</span>}
            {isLive
              ? isEs ? 'EN VIVO' : 'AO VIVO'
              : isUpcoming
              ? isEs ? 'PRÓXIMO' : 'EM BREVE'
              : isEs ? 'FINALIZADO' : 'ENCERRADO'}
          </span>

          {/* Prazo Restante */}
          <span
            data-testid={`tournament-timer-${tournament.id}`}
            style={{
              color: '#8A92A1',
              fontSize: '10px',
              whiteSpace: 'nowrap',
            }}
          >
            {tournament.timeRemaining}
          </span>
        </div>

        {/* Ilustração do Troféu com Matrix / Skyline */}
        <div style={{ marginBottom: '12px' }}>
          <TournamentTrophyArt variant={tournament.trophyVariant} height={100} />
        </div>

        {/* Título e Subtítulo */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <h3
              data-testid={`tournament-title-${tournament.id}`}
              style={{
                margin: '0 0 3px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#FFFFFF',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {tournament.name}
            </h3>
            {isJoined && (
              <span
                data-testid={`tournament-joined-badge-${tournament.id}`}
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#22C47A',
                  backgroundColor: 'rgba(34, 196, 122, 0.14)',
                  border: '1px solid rgba(34, 196, 122, 0.35)',
                  borderRadius: '4px',
                  padding: '1px 6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                Inscrito ✓
              </span>
            )}
          </div>
          <p
            data-testid={`tournament-subtitle-${tournament.id}`}
            style={{
              margin: 0,
              fontSize: '12px',
              color: '#8A92A1',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tournament.subtitle}
          </p>
        </div>

        {/* Linha de Métricas: Prêmio Total & Participantes */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '14px',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '10px',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'block',
                marginBottom: '2px',
              }}
            >
              {isEs ? 'Premio total' : 'Prêmio total'}
            </span>
            <strong
              data-testid={`tournament-prize-${tournament.id}`}
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#FFFFFF',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {tournament.prizeFormatted}
            </strong>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span
              style={{
                fontSize: '10px',
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'block',
                marginBottom: '2px',
              }}
            >
              Participantes
            </span>
            <span
              data-testid={`tournament-participants-${tournament.id}`}
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#AEB8C8',
                fontFamily: "'Geist Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'flex-end',
              }}
            >
              <span style={{ fontSize: '11px', opacity: 0.7 }}>👥</span>
              {tournament.participantsFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Botão de Ação Direta */}
      <button
        type="button"
        data-testid={`tournament-action-${tournament.id}`}
        onClick={() => onSelect(tournament.id)}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '6px',
          border: isLive ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
          backgroundColor: isLive ? '#22C47A' : '#141A26',
          color: isLive ? '#08140B' : '#F4F5F7',
          fontWeight: 700,
          fontSize: '12.5px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={(e) => {
          if (isLive) {
            e.currentTarget.style.backgroundColor = '#1EB06D';
          } else {
            e.currentTarget.style.backgroundColor = '#1C2434';
          }
        }}
        onMouseLeave={(e) => {
          if (isLive) {
            e.currentTarget.style.backgroundColor = '#22C47A';
          } else {
            e.currentTarget.style.backgroundColor = '#141A26';
          }
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.97)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <span>
          {isJoined && isLive
            ? 'Inscrito ✓ · Ver'
            : translateCardActionLabel(tournament.actionLabel, isEs)}
        </span>
      </button>
    </div>
  );
}

