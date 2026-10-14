import React from 'react';
import { TournamentItem } from './TournamentTypes';
import { CountryFlagBadge } from './CountryFlagBadge';
import { useUiLanguage } from '../../i18n';

export interface TournamentDetailViewProps {
  tournament: TournamentItem;
  onBack: () => void;
  onClose: () => void;
  isJoined?: boolean;
  onJoin?: (id: string) => void;
  onStartTrading?: (id: string) => void;
  onOpenArena?: () => void;
}

/* ── Cores cromáticas de medalhas ─────────────────────────────────────── */
const MEDAL_COLORS = {
  gold: '#E5A93C',
  silver: '#B0BEC5',
  bronze: '#CD7F32',
} as const;

export function TournamentDetailView({
  tournament,
  onBack,
  onClose,
  isJoined = false,
  onJoin,
  onStartTrading,
  onOpenArena,
}: TournamentDetailViewProps) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const isLive = tournament.status === 'AO_VIVO';
  const isUpcoming = tournament.status === 'EM_BREVE';

  return (
    <div
      data-testid="tournament-detail-view"
      style={{
        padding: '20px 28px 28px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
      }}
    >
      {/* ─── BARRA DE NAVEGAÇÃO SUPERIOR ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '4px',
        }}
      >
        <button
          type="button"
          data-testid="btn-back-to-tournaments"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8A92A1',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 0',
            transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
        >
          <span>←</span>
          <span>{isEs ? 'Volver a todos los torneos' : 'Voltar para todos os torneios'}</span>
        </button>

        <button
          type="button"
          data-testid="btn-close-tournament-detail"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8A92A1',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '4px 8px',
            lineHeight: 1,
            transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#8A92A1')}
          title={isEs ? 'Cerrar (ESC)' : 'Fechar (ESC)'}
          aria-label={isEs ? 'Cerrar detalles del torneo' : 'Fechar detalhes do torneio'}
        >
          ✕
        </button>
      </div>

      {/* ─── GRADE DAS 3 COLUNAS ──────────────────────────────────────────── */}
      <div
        data-testid="tournament-detail-columns"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr 0.8fr',
          gap: '16px',
          alignItems: 'stretch',
        }}
      >
        {/* ─── COLUNA 1: INFORMAÇÕES & REGRAS DO TORNEIO ──────────────────── */}
        <div
          data-testid="tournament-column-rules"
          style={{
            backgroundColor: '#0C1018',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '10px',
            padding: '22px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            {/* Linha Superior: Badge + Timer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <span
                data-testid="detail-status-badge"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '10.5px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  backgroundColor: isLive
                    ? 'rgba(34, 196, 122, 0.14)'
                    : 'rgba(255, 255, 255, 0.06)',
                  color: isLive ? '#22C47A' : '#8A92A1',
                  border: isLive
                    ? '1px solid rgba(34, 196, 122, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                {isLive && <span style={{ fontSize: '7px' }}>●</span>}
                {tournament.status === 'AO_VIVO'
                  ? isEs ? 'EN VIVO' : 'AO VIVO'
                  : tournament.status === 'EM_BREVE'
                  ? isEs ? 'PRÓXIMO' : 'EM BREVE'
                  : isEs ? 'FINALIZADO' : 'ENCERRADO'}
              </span>

              {/* Timer Container — Widget de Terminal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#0A0D13',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  padding: '5px 12px',
                }}
              >
                <span style={{ fontSize: '11px', color: '#596273' }}>
                  {isEs ? 'Termina en' : 'Termina em'}
                </span>
                <span style={{ fontSize: '12px', color: '#596273' }}>⏱</span>
                <strong
                  data-testid="detail-countdown-clock"
                  style={{
                    color: '#FFFFFF',
                    fontSize: '16px',
                    fontWeight: 700,
                    fontFamily: "'Geist Mono', monospace",
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.02em',
                  }}
                >
                  {tournament.timerClock}
                </strong>
              </div>
            </div>

            {/* Título & Subtítulo */}
            <h2
              data-testid="detail-tournament-title"
              style={{
                margin: '0 0 3px',
                fontSize: '22px',
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-0.02em',
              }}
            >
              {tournament.name}
            </h2>
            <div
              data-testid="detail-tournament-subtitle"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#22C47A',
                marginBottom: '14px',
              }}
            >
              {tournament.subtitle}
            </div>

            {/* Descrição Institucional */}
            <p
              data-testid="detail-tournament-description"
              style={{
                margin: '0 0 22px',
                fontSize: '12.5px',
                color: '#8A92A1',
                lineHeight: 1.55,
              }}
            >
              {tournament.description}
            </p>

            {/* Título de Seção: Regras do Torneio */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#AEB8C8',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              <span>📋</span>
              <span>{isEs ? 'Reglas del torneo' : 'Regras do torneio'}</span>
            </div>

            {/* Tabela de Regras — Container Recuado */}
            <div
              data-testid="detail-rules-table"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                fontSize: '12px',
                backgroundColor: '#080B10',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
              }}
            >
              {[
                { label: 'Período', value: tournament.rules.period, mono: true },
                { label: isEs ? 'Depósito' : 'Depósito', value: tournament.rules.deposit, mono: false },
                { label: isEs ? 'Activos' : 'Ativos', value: tournament.rules.assets, mono: false },
                { label: isEs ? 'Clasificación' : 'Classificação', value: tournament.rules.criteria, mono: false },
                { label: 'Mínimo', value: tournament.rules.minOps, mono: true },
              ].map((rule, idx, arr) => (
                <div
                  key={rule.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '10px 14px',
                    borderBottom: idx < arr.length - 1 ? '1px solid rgba(255, 255, 255, 0.05)' : 'none',
                  }}
                >
                  <span style={{ color: '#596273', fontWeight: 600, flexShrink: 0 }}>
                    {rule.label}
                  </span>
                  <span
                    style={{
                      color: '#DCE1EA',
                      fontFamily: rule.mono ? "'Geist Mono', monospace" : 'inherit',
                      textAlign: 'right',
                      maxWidth: '62%',
                      fontSize: '11.5px',
                      lineHeight: 1.4,
                    }}
                  >
                    {rule.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── BLOCO DE AÇÃO FUNCIONAL DO TORNEIO ─────────────────────────── */}
          <div
            data-testid="tournament-detail-actions"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              paddingTop: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {isLive ? (
              isJoined ? (
                <>
                  <div
                    data-testid="tournament-detail-joined-status"
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(34, 196, 122, 0.12)',
                      border: '1px solid rgba(34, 196, 122, 0.32)',
                      color: '#22C47A',
                      fontSize: '12px',
                      fontWeight: 700,
                      textAlign: 'center',
                    }}
                  >
                    {isEs
                      ? '✓ Inscrito en el torneo · Cuenta de torneo activa'
                      : '✓ Inscrito no torneio · Conta de torneio ativa'}
                  </div>
                  <button
                    type="button"
                    data-testid="tournament-detail-trade-btn"
                    onClick={() => onStartTrading?.(tournament.id)}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#22C47A',
                      color: '#08140B',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {isEs ? 'Operar en el Torneo →' : 'Operar no Torneio →'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="tournament-detail-join-btn"
                    onClick={() => onJoin?.(tournament.id)}
                    style={{
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#22C47A',
                      color: '#08140B',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    {isEs ? 'Participar gratis →' : 'Participar gratuitamente →'}
                  </button>
                  {onOpenArena && (
                    <button
                      type="button"
                      data-testid="tournament-detail-arena-btn"
                      onClick={onOpenArena}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(157, 78, 221, 0.35)',
                        backgroundColor: '#0E131D',
                        color: '#C77DFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    >
                      {isEs ? '⚡ Ir a Arena Blitz · 15 min' : '⚡ Ir para Arena Blitz · 15 min'}
                    </button>
                  )}
                </>
              )
            ) : isUpcoming ? (
              isJoined ? (
                <div
                  data-testid="tournament-detail-joined-status"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(34, 196, 122, 0.12)',
                    border: '1px solid rgba(34, 196, 122, 0.32)',
                    color: '#22C47A',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    textAlign: 'center',
                  }}
                >
                  {isEs ? '✓ Cupo reservado gratuitamente' : '✓ Vaga reservada gratuitamente'}
                </div>
              ) : (
                <button
                  type="button"
                  data-testid="tournament-detail-join-btn"
                  onClick={() => onJoin?.(tournament.id)}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '8px',
                    border: '1px solid rgba(34, 196, 122, 0.4)',
                    backgroundColor: '#121A26',
                    color: '#22C47A',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  {isEs ? 'Reservar cupo gratis →' : 'Reservar vaga gratuita →'}
                </button>
              )
            ) : (
              <div
                data-testid="tournament-detail-ended-status"
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#0A0D13',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#8A92A1',
                  fontSize: '12px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                {isEs
                  ? 'Torneo finalizado · Resultado auditado'
                  : 'Torneio encerrado · Resultado auditado'}
              </div>
            )}
          </div>
        </div>

        {/* ─── COLUNA 2: RANKING EM TEMPO REAL ────────────────────────────── */}
        <div
          data-testid="tournament-column-ranking"
          style={{
            backgroundColor: '#0C1018',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '10px',
            padding: '22px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Header do Ranking */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              paddingBottom: '14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {isEs ? 'Ranking en tiempo real' : 'Ranking em tempo real'}
            </h3>
            <span
              data-testid="ranking-participants-count"
              style={{
                fontSize: '11.5px',
                color: '#596273',
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {`${tournament.participantsFormatted} participantes`}
            </span>
          </div>

          {/* Cabeçalho da Tabela */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '34px 1fr 100px 44px',
              padding: '0 10px 6px',
              fontSize: '10.5px',
              color: '#4E5564',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            <span>#</span>
            <span>Trader</span>
            <span style={{ textAlign: 'right' }}>{isEs ? 'Rentabilidad' : 'Rentabilidade'}</span>
            <span style={{ textAlign: 'right' }}>Ops</span>
          </div>

          {/* Linhas de Competidores */}
          <div
            data-testid="ranking-traders-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            {tournament.leaderboard.map((trader) => {
              const isFirst = trader.rank === 1;
              const isSecond = trader.rank === 2;
              const isThird = trader.rank === 3;
              const isPodium = isFirst || isSecond || isThird;

              // Borda lateral cromática para pódio
              const podiumBorderColor = isFirst
                ? MEDAL_COLORS.gold
                : isSecond
                ? MEDAL_COLORS.silver
                : isThird
                ? MEDAL_COLORS.bronze
                : 'transparent';

              return (
                <div
                  key={trader.rank}
                  data-testid={`ranking-row-${trader.rank}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '34px 1fr 100px 44px',
                    alignItems: 'center',
                    padding: '9px 10px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    backgroundColor: isPodium
                      ? 'rgba(255, 255, 255, 0.025)'
                      : 'transparent',
                    borderLeft: isPodium
                      ? `3px solid ${podiumBorderColor}`
                      : '3px solid transparent',
                    transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isPodium
                      ? 'rgba(255, 255, 255, 0.025)'
                      : 'transparent';
                  }}
                >
                  {/* Medalha ou Número */}
                  <span
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 700,
                      fontSize: isPodium ? '14px' : '12px',
                      color: isPodium ? podiumBorderColor : '#596273',
                    }}
                  >
                    {isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : trader.rank}
                  </span>

                  {/* Nome do Trader & Bandeira */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CountryFlagBadge countryCode={trader.country} />
                    <span
                      style={{
                        color: isPodium ? '#F4F5F7' : '#DCE1EA',
                        fontWeight: isPodium ? 700 : 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {trader.name}
                    </span>
                  </div>

                  {/* Rentabilidade % */}
                  <span
                    style={{
                      textAlign: 'right',
                      fontFamily: "'Geist Mono', monospace",
                      fontVariantNumeric: 'tabular-nums',
                      color: '#22C47A',
                      fontWeight: 700,
                      fontSize: isPodium ? '13px' : '12.5px',
                    }}
                  >
                    {trader.returnPct}
                  </span>

                  {/* Operações */}
                  <span
                    style={{
                      textAlign: 'right',
                      fontFamily: "'Geist Mono', monospace",
                      fontVariantNumeric: 'tabular-nums',
                      color: '#596273',
                      fontSize: '12px',
                    }}
                  >
                    {trader.ops}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── COLUNA 3: PRÊMIOS POR POSIÇÃO ──────────────────────────────── */}
        <div
          data-testid="tournament-column-prizes"
          style={{
            backgroundColor: '#0C1018',
            border: '1px solid rgba(255, 255, 255, 0.07)',
            borderRadius: '10px',
            padding: '22px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Header de Prêmios */}
          <div
            style={{
              paddingBottom: '14px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 700,
                color: '#FFFFFF',
              }}
            >
              {isEs ? 'Premios por posición' : 'Prêmios por posição'}
            </h3>
          </div>

          {/* Lista dos Tiers de Premiação */}
          <div
            data-testid="prizes-tier-list"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
            }}
          >
            {tournament.prizes.map((p, idx) => {
              const isTop3 = idx < 3;
              const tierBorderColor =
                idx === 0
                  ? MEDAL_COLORS.gold
                  : idx === 1
                  ? MEDAL_COLORS.silver
                  : idx === 2
                  ? MEDAL_COLORS.bronze
                  : 'transparent';

              return (
                <div
                  key={idx}
                  data-testid={`prize-tier-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '6px',
                    backgroundColor: isTop3 ? '#0E131D' : '#0A0E15',
                    borderLeft: isTop3
                      ? `3px solid ${tierBorderColor}`
                      : '3px solid transparent',
                    fontSize: '12.5px',
                    transition: 'background-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isTop3 ? '#0E131D' : '#0A0E15';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {p.isGift && (
                      <span style={{ fontSize: '13px', opacity: 0.9 }}>🎁</span>
                    )}
                    <span
                      style={{
                        color: isTop3 ? '#DCE1EA' : '#8A92A1',
                        fontWeight: isTop3 ? 700 : 500,
                      }}
                    >
                      {p.position}
                    </span>
                  </div>

                  <strong
                    style={{
                      color: isTop3 ? '#FFFFFF' : '#AEB8C8',
                      fontFamily: "'Geist Mono', monospace",
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      fontSize: isTop3 ? '13.5px' : '12.5px',
                    }}
                  >
                    {p.prize}
                  </strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
