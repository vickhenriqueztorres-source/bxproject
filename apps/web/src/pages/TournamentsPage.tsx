import React, { useState, useEffect } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';
import { getTournaments, joinTournament, TournamentItem } from '../api/client';

export type Tournament = TournamentItem;

const TOURNAMENTS_DATA: Tournament[] = [
  {
    id: 'copa-binmax',
    name: 'Copa BINMAX',
    status: 'EN_VIVO',
    prizeFormatted: '$2,500',
    participants: 1248,
    timeRemaining: 'Termina en 02:15:30',
    rules: {
      period: '24 horas',
      depositRequired: 'No requerido (cuenta práctica)',
      operationType: 'Contratos 60 segundos',
      criteria: 'Mayor rentabilidad porcentual',
      minOperations: 10,
    },
    prizes: [
      { position: '1º Lugar', prize: '$1,000 USD' },
      { position: '2º Lugar', prize: '$500 USD' },
      { position: '3º Lugar', prize: '$300 USD' },
      { position: '4º Lugar', prize: '$200 USD' },
      { position: '5º Lugar', prize: '$100 USD' },
      { position: '6º al 10º', prize: '$80 USD' },
    ],
    leaderboard: [
      { rank: 2, name: 'Carlos M.', country: 'CO', returnPct: '+241.10%', ops: 38 },
      { rank: 3, name: 'Elena R.', country: 'ES', returnPct: '+198.50%', ops: 35 },
      { rank: 4, name: 'Mateus S.', country: 'BR', returnPct: '+175.20%', ops: 31 },
      { rank: 5, name: 'Javier P.', country: 'AR', returnPct: '+162.80%', ops: 29 },
    ],
  },
  {
    id: 'desafio-semana',
    name: 'Desafío de la Semana',
    status: 'EN_VIVO',
    prizeFormatted: '$5,000',
    participants: 2840,
    timeRemaining: 'Termina en 14:40:00',
    rules: {
      period: '7 días',
      depositRequired: 'No requerido (cuenta práctica)',
      operationType: 'Índices sintéticos continuos',
      criteria: 'Mayor rentabilidad acumulada',
      minOperations: 25,
    },
    prizes: [
      { position: '1º Lugar', prize: '$2,000 USD' },
      { position: '2º Lugar', prize: '$1,200 USD' },
      { position: '3º Lugar', prize: '$800 USD' },
      { position: '4º Lugar', prize: '$500 USD' },
      { position: '5º Lugar', prize: '$250 USD' },
      { position: '6º al 10º', prize: '$50 USD' },
    ],
    leaderboard: [
      { rank: 2, name: 'Andrés V.', country: 'CL', returnPct: '+310.20%', ops: 52 },
      { rank: 3, name: 'Lucía G.', country: 'MX', returnPct: '+284.10%', ops: 49 },
      { rank: 4, name: 'Gabriel T.', country: 'PE', returnPct: '+240.00%', ops: 44 },
    ],
  },
  {
    id: 'maestros-forex',
    name: 'Arena Algorítmica OTC',
    status: 'PROXIMO',
    prizeFormatted: '$10,000',
    participants: 850,
    timeRemaining: 'Inicia en 2d 05h',
    rules: {
      period: '48 horas',
      depositRequired: 'No requerido',
      operationType: 'Pares sintéticos y OTC',
      criteria: 'Mayor volumen de ganancias netas',
      minOperations: 15,
    },
    prizes: [
      { position: '1º Lugar', prize: '$4,000 USD' },
      { position: '2º Lugar', prize: '$2,500 USD' },
      { position: '3º Lugar', prize: '$1,500 USD' },
      { position: '4º al 10º', prize: '$2,000 USD' },
    ],
    leaderboard: [],
  },
  {
    id: 'reto-express',
    name: 'Sprint de Velocidad 60s',
    status: 'FINALIZADO',
    prizeFormatted: '$1,000',
    participants: 640,
    timeRemaining: 'Finalizado',
    rules: {
      period: '2 horas',
      depositRequired: 'No requerido',
      operationType: 'Turbo 60s',
      criteria: 'Racha de victorias consecutivas',
      minOperations: 5,
    },
    prizes: [
      { position: '1º Lugar', prize: '$500 USD' },
      { position: '2º Lugar', prize: '$250 USD' },
      { position: '3º Lugar', prize: '$150 USD' },
      { position: '4º Lugar', prize: '$100 USD' },
    ],
    leaderboard: [
      { rank: 1, name: 'Diego H.', country: 'UY', returnPct: '+192.40%', ops: 12 },
      { rank: 2, name: 'Valeria M.', country: 'EC', returnPct: '+180.10%', ops: 11 },
    ],
  },
];

export function TournamentsPage() {
  const [filter, setFilter] = useState<'ALL' | 'EN_VIVO' | 'PROXIMO' | 'FINALIZADO'>('ALL');
  const [tournaments, setTournaments] = useState<Tournament[]>(TOURNAMENTS_DATA);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('copa-binmax');
  const [joinedTournaments, setJoinedTournaments] = useState<Set<string>>(new Set());
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getTournaments()
      .then((data) => {
        if (!isMounted || !Array.isArray(data) || data.length === 0) return;
        setTournaments(data);
        const joined = new Set<string>();
        data.forEach((t) => {
          if (t.userJoined) joined.add(t.id);
        });
        setJoinedTournaments(joined);
        if (data.length > 0 && !data.some((t) => t.id === selectedTournamentId)) {
          setSelectedTournamentId(data[0].id);
        }
      })
      .catch((err) => {
        console.warn('[Tournaments Load Error]', err);
      });
    return () => { isMounted = false; };
  }, []);

  const filteredTournaments = tournaments.filter((t) => {
    if (filter === 'ALL') return true;
    return t.status === filter;
  });

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId) || tournaments[0] || TOURNAMENTS_DATA[0];
  const isJoined = joinedTournaments.has(selectedTournament.id);

  const handleToggleJoin = async (id: string) => {
    if (joiningId) return;
    setJoiningId(id);
    try {
      const res = await joinTournament(id);
      if (res && res.joined) {
        setJoinedTournaments((prev) => new Set(prev).add(id));
        setTournaments((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, participants: Number(t.participants) + 1, userJoined: true } : t
          )
        );
      }
    } catch (err) {
      console.warn('[Tournament Join Error]', err);
    } finally {
      setJoiningId(null);
    }
  };


  return (
    <SecondaryLayout activeNav="Torneos">
      <div
        data-testid="tournaments-page-container"
        className="bm-page-enter"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* ─── CABEÇALHO TÉCNICO ───────────────────────────────────────── */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: PRECISION_COLORS.metal,
              }}
            >
              Competición Institucional
            </span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>·</span>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }}>
              Arena de Traders
            </span>
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: PRECISION_TEXT.strong,
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Torneos de Trading Cuantitativo
          </h1>
          <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, margin: '6px 0 0', maxWidth: '700px' }}>
            Demuestra disciplina y consistencia en rankings auditados en vivo bajo igualdad de condiciones sobre la cuenta de práctica.
          </p>
        </div>

        {/* ─── FILTROS DE STATUS ──────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: 'Todos los torneos' },
            { id: 'EN_VIVO', label: 'En vivo' },
            { id: 'PROXIMO', label: 'Próximos' },
            { id: 'FINALIZADO', label: 'Finalizados' },
          ].map((f) => {
            const isSelected = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                data-testid={`filter-${f.id.toLowerCase()}`}
                onClick={() => setFilter(f.id as any)}
                className="bm-btn-press"
                style={{
                  background: isSelected ? PRECISION_SURFACES.bg3 : PRECISION_SURFACES.bg1,
                  color: isSelected ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                  border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.2)' : PRECISION_SURFACES.line}`,
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12.5px',
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* ─── GRADE DE TORNEIOS DISPONÍVEIS ───────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {filteredTournaments.map((t) => {
            const isSelected = t.id === selectedTournament.id;
            const isTournamentJoined = joinedTournaments.has(t.id);

            return (
              <div
                key={t.id}
                data-testid={`tournament-card-${t.id}`}
                onClick={() => setSelectedTournamentId(t.id)}
                style={{
                  backgroundColor: isSelected ? PRECISION_SURFACES.bg2 : PRECISION_SURFACES.bg1,
                  border: `1px solid ${isSelected ? 'rgba(255, 255, 255, 0.25)' : PRECISION_SURFACES.line}`,
                  borderRadius: '8px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        background:
                          t.status === 'EN_VIVO'
                            ? 'rgba(34, 196, 122, 0.12)'
                            : t.status === 'PROXIMO'
                            ? 'rgba(232, 163, 61, 0.12)'
                            : PRECISION_SURFACES.bg3,
                        color:
                          t.status === 'EN_VIVO'
                            ? PRECISION_COLORS.profit
                            : t.status === 'PROXIMO'
                            ? PRECISION_COLORS.pending
                            : PRECISION_TEXT.muted,
                        border: `1px solid ${PRECISION_SURFACES.line}`,
                      }}
                    >
                      {t.status === 'EN_VIVO' ? 'EN VIVO' : t.status === 'PROXIMO' ? 'PRÓXIMO' : 'FINALIZADO'}
                    </span>
                    <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                      {t.timeRemaining}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 12px' }}>
                    {t.name}
                  </h3>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', display: 'block' }}>Fondo de premios</span>
                      <strong style={{ fontSize: '20px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 800 }} className="bm-tabular-nums">
                        {t.prizeFormatted}
                      </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10.5px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', display: 'block' }}>Participantes</span>
                      <span style={{ fontSize: '13px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono, fontWeight: 600 }} className="bm-tabular-nums">
                        {t.participants}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  data-testid={`action-btn-${t.id}`}
                  className="bm-btn-press"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleJoin(t.id);
                  }}
                  style={{
                    width: '100%',
                    background: isTournamentJoined ? PRECISION_SURFACES.bg3 : PRECISION_SURFACES.bg2,
                    color: isTournamentJoined ? PRECISION_COLORS.profit : PRECISION_TEXT.strong,
                    border: `1px solid ${isTournamentJoined ? PRECISION_COLORS.profit : PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  {isTournamentJoined ? 'Inscrito' : t.status === 'FINALIZADO' ? 'Ver ranking final' : 'Participar →'}
                </button>
              </div>
            );
          })}
        </div>

        {/* ─── DETALHES DO EVENTO & AUDITORIA DE RANKING ───────────────── */}
        <div
          data-testid="tournament-details-panel"
          style={{
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div style={{ borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '14px', marginBottom: '22px' }}>
            <div style={{ fontSize: '11px', color: PRECISION_COLORS.metal, fontWeight: 600, textTransform: 'uppercase', marginBottom: '2px' }}>
              Mesa Oficial de Posiciones
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: PRECISION_TEXT.strong, margin: 0 }}>
              {selectedTournament.name}
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '28px',
            }}
          >
            {/* Regras Técnicas */}
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: PRECISION_TEXT.muted, textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '0.05em' }}>
                Reglas del Torneo
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12.5px' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                  <span style={{ color: PRECISION_TEXT.muted }}>Duración total:</span>
                  <strong style={{ color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }}>{selectedTournament.rules.period}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                  <span style={{ color: PRECISION_TEXT.muted }}>Entrada:</span>
                  <strong style={{ color: PRECISION_COLORS.profit }}>Sin cargo (Demo)</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                  <span style={{ color: PRECISION_TEXT.muted }}>Tipo de contrato:</span>
                  <strong style={{ color: PRECISION_TEXT.strong }}>{selectedTournament.rules.operationType}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                  <span style={{ color: PRECISION_TEXT.muted }}>Criterio de orden:</span>
                  <strong style={{ color: PRECISION_TEXT.strong }}>{selectedTournament.rules.criteria}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: PRECISION_TEXT.muted }}>Mínimo requerido:</span>
                  <strong style={{ color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }}>{`${selectedTournament.rules.minOperations} ops`}</strong>
                </li>
              </ul>
            </div>

            {/* Ranking em Tempo Real */}
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: PRECISION_TEXT.muted, textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '0.05em' }}>
                Ranking en Vivo
              </h4>

              {/* Posição do Usuário no Topo */}
              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_COLORS.profit}`,
                  borderRadius: '6px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      background: PRECISION_COLORS.profit,
                      color: '#07120B',
                      borderRadius: '4px',
                      width: '20px',
                      height: '20px',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 800,
                      fontSize: '11px',
                      fontFamily: PRECISION_FONTS.mono,
                    }}
                  >
                    1
                  </span>
                  <div>
                    <strong style={{ fontSize: '13px', color: PRECISION_TEXT.strong }}>Tú (TraderPro)</strong>
                    <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, display: 'block', fontFamily: PRECISION_FONTS.mono }}>42 contratos</span>
                  </div>
                </div>
                <strong style={{ fontSize: '13.5px', color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  +285.43%
                </strong>
              </div>

              {/* Tabela de Outros Competidores */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedTournament.leaderboard.map((item) => (
                  <div
                    key={item.rank}
                    style={{
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ color: PRECISION_TEXT.quiet, fontSize: '11.5px', fontFamily: PRECISION_FONTS.mono, width: '18px' }} className="bm-tabular-nums">
                        #{item.rank}
                      </span>
                      <div>
                        <span style={{ fontSize: '12.5px', color: PRECISION_TEXT.strong, fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, marginLeft: '6px' }}>[{item.country}]</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '12.5px', color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                        {item.returnPct}
                      </strong>
                      <span style={{ fontSize: '10.5px', color: PRECISION_TEXT.quiet, display: 'block', fontFamily: PRECISION_FONTS.mono }}>{`${item.ops} ops`}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Escala de Prêmios */}
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 700, color: PRECISION_TEXT.muted, textTransform: 'uppercase', margin: '0 0 14px', letterSpacing: '0.05em' }}>
                Premios Oficiales
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {selectedTournament.prizes.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: PRECISION_SURFACES.bg0,
                      border: `1px solid ${PRECISION_SURFACES.line}`,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>{p.position}</span>
                    <strong style={{ fontSize: '12.5px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                      {p.prize}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}
