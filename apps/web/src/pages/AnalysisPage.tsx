import React, { useState, useEffect } from 'react';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';
import { getUserAnalytics, UserAnalyticsResponse } from '../api/client';

export function AnalysisPage() {
  const [period, setPeriod] = useState<'30d' | '7d' | 'all'>('30d');
  const [chartMetric, setChartMetric] = useState<'profit' | 'volume'>('profit');
  const [analytics, setAnalytics] = useState<UserAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    getUserAnalytics(period)
      .then((data) => {
        if (!isMounted) return;
        setAnalytics(data);
      })
      .catch((err) => {
        console.warn('[Analytics Load Error]', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [period]);

  const hasData = !!(analytics && analytics.has_data && analytics.total_ops > 0);
  const totalOps = analytics?.total_ops ?? 0;
  const winOps = analytics?.win_ops ?? 0;
  const lossOps = analytics?.loss_ops ?? 0;
  const winRate = analytics?.win_rate ?? 0;
  const netProfitDollars = ((analytics?.net_profit_minor ?? 0) / 100).toFixed(2);
  const netProfitFormatted = (analytics?.net_profit_minor ?? 0) >= 0 ? `+$${netProfitDollars}` : `-$${Math.abs(Number(netProfitDollars)).toFixed(2)}`;
  const currentStreak = analytics?.current_streak ?? 0;
  const maxStreak = analytics?.max_streak ?? 0;
  const currentStreakText = currentStreak > 0 ? `${currentStreak} WIN` : currentStreak < 0 ? `${Math.abs(currentStreak)} LOSS` : '0';
  const bestSlot = analytics?.best_time_window;
  const bestSlotRate = analytics?.hourly.find((h) => h.isBest)?.rate ?? (bestSlot ? 70 : 0);

  // Dados diários para o gráfico analítico de barras
  const dailyData = (analytics && analytics.daily.length > 0)
    ? analytics.daily
    : [
        { day: 'Lun', date: '—', profit: 0, ops: 0 },
        { day: 'Mar', date: '—', profit: 0, ops: 0 },
        { day: 'Mié', date: '—', profit: 0, ops: 0 },
        { day: 'Jue', date: '—', profit: 0, ops: 0 },
        { day: 'Vie', date: '—', profit: 0, ops: 0 },
        { day: 'Sáb', date: '—', profit: 0, ops: 0 },
        { day: 'Dom', date: '—', profit: 0, ops: 0 },
      ];

  const assetPerformance = analytics?.assets ?? [];
  const hourlySlots = (analytics && analytics.hourly.length > 0)
    ? analytics.hourly
    : [
        { slot: '00-04', rate: 0, ops: 0 },
        { slot: '04-08', rate: 0, ops: 0 },
        { slot: '08-12', rate: 0, ops: 0 },
        { slot: '12-16', rate: 0, ops: 0 },
        { slot: '16-20', rate: 0, ops: 0 },
        { slot: '20-24', rate: 0, ops: 0 },
      ];

  return (
    <SecondaryLayout activeNav="Análisis">
      <div
        data-testid="analysis-page-container"
        className="bm-page-enter"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* ─── CABEÇALHO TÉCNICO & SELETOR DE PERÍODO ───────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '20px',
          }}
        >
          <div>
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
                Auditoría Cuantitativa
              </span>
              <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>·</span>
              <span style={{ fontSize: '11px', color: PRECISION_TEXT.muted, fontFamily: PRECISION_FONTS.mono }}>
                Terminal v2.4
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
              Análisis y Métricas Personales
            </h1>
          </div>

          {/* Seletor de Período Calibrado */}
          <div
            style={{
              display: 'flex',
              background: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '6px',
              padding: '3px',
              gap: '2px',
            }}
          >
            {[
              { id: '7d', label: '7 días' },
              { id: '30d', label: '30 días' },
              { id: 'all', label: 'Histórico completo' },
            ].map((p) => {
              const isSelected = period === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  data-testid={`period-btn-${p.id}`}
                  onClick={() => setPeriod(p.id as any)}
                  className="bm-btn-press"
                  style={{
                    background: isSelected ? PRECISION_SURFACES.bg3 : 'transparent',
                    color: isSelected ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    border: 'none',
                    borderRadius: '4px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── INSIGHT PROTAGONISTA — ANÁLISE QUANTITATIVA PROPRIETÁRIA ─── */}
        <div
          data-testid="optimal-pattern-card"
          style={{
            backgroundColor: PRECISION_SURFACES.bg1,
            borderLeft: `3px solid ${hasData ? PRECISION_COLORS.profit : PRECISION_COLORS.metal}`,
            borderTop: `1px solid ${PRECISION_SURFACES.line}`,
            borderRight: `1px solid ${PRECISION_SURFACES.line}`,
            borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '6px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: hasData ? PRECISION_COLORS.profit : PRECISION_COLORS.metal,
                fontWeight: 700,
                marginBottom: '6px',
              }}
            >
              Patrón Operacional Óptimo
            </div>
            <div
              style={{
                fontSize: '19px',
                fontWeight: 800,
                color: PRECISION_TEXT.strong,
                letterSpacing: '-0.01em',
              }}
            >
              {hasData && bestSlot
                ? `Tu mejor ventana operativa es entre ${bestSlot}h, con ${bestSlotRate}% de acierto.`
                : hasData
                ? `Rendimiento activo sobre ${totalOps} contrato(s) registrado(s).`
                : 'Auditoría analítica en calibración.'}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: PRECISION_TEXT.muted,
                marginTop: '4px',
              }}
            >
              {hasData
                ? `Rendimiento sostenido sobre ${totalOps} contratos liquidados. Telemetría calculada en tiempo real.`
                : 'Ejecuta operaciones en la traderoom para activar el análisis cuantitativo de asertividad y ventanas horarias.'}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase' }}>Eficiencia</div>
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: hasData ? PRECISION_COLORS.profit : PRECISION_TEXT.muted,
                  fontFamily: PRECISION_FONTS.mono,
                }}
                className="bm-tabular-nums"
              >
                {hasData ? (winRate >= 50 ? `+${(winRate - 50).toFixed(1)}%` : `${(winRate - 50).toFixed(1)}%`) : '0.0%'}
              </div>
            </div>
          </div>
        </div>

        {/* ─── RÉGUA DE TELEMETRIA INTEGRADA (ZERO CARTÕES GENÉRICOS) ───── */}
        <div
          data-testid="metrics-summary-bar"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '8px',
            marginBottom: '28px',
            overflow: 'hidden',
          }}
        >
          {/* Métrica 1: Taxa de Acierto */}
          <div style={{ padding: '20px 24px', borderRight: `1px solid ${PRECISION_SURFACES.line}` }}>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Tasa de acierto global
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <strong style={{ fontSize: '28px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 800 }} className="bm-tabular-nums">
                {hasData ? `${winRate}%` : '0.0%'}
              </strong>
              {hasData && (
                <span style={{ fontSize: '12px', color: winRate >= 50 ? PRECISION_COLORS.profit : PRECISION_COLORS.loss, fontWeight: 700 }} className="bm-tabular-nums">
                  {winRate >= 50 ? `+${(winRate - 50).toFixed(1)}%` : `${(winRate - 50).toFixed(1)}%`}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.muted, marginTop: '6px', display: 'block' }}>
              {hasData ? `${winOps} ganadas de ${totalOps} operaciones` : '0 ganadas de 0 operaciones'}
            </span>
          </div>

          {/* Métrica 2: Resultado Total */}
          <div style={{ padding: '20px 24px', borderRight: `1px solid ${PRECISION_SURFACES.line}` }}>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Resultado neto auditado
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <strong
                style={{
                  fontSize: '28px',
                  color: (analytics?.net_profit_minor ?? 0) >= 0 ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                  fontFamily: PRECISION_FONTS.mono,
                  fontWeight: 800,
                }}
                className="bm-tabular-nums"
              >
                {netProfitFormatted}
              </strong>
            </div>
            <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.muted, marginTop: '6px', display: 'block' }}>
              {hasData ? 'Sobre contratos reales liquidados' : 'Sin operaciones en el período'}
            </span>
          </div>

          {/* Métrica 3: Racha Atual */}
          <div style={{ padding: '20px 24px', borderRight: `1px solid ${PRECISION_SURFACES.line}` }}>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Racha consecutiva
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <strong style={{ fontSize: '28px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 800 }} className="bm-tabular-nums">
                {currentStreakText}
              </strong>
              {maxStreak > 0 && (
                <span style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>
                  {`(Máx: ${maxStreak})`}
                </span>
              )}
            </div>
            <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.muted, marginTop: '6px', display: 'block' }}>
              {hasData ? 'Contratos en secuencia' : 'Sin racha activa'}
            </span>
          </div>

          {/* Métrica 4: Ventana Horária */}
          <div style={{ padding: '20px 24px' }}>
            <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
              Rango horario pico
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <strong style={{ fontSize: '24px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 800 }} className="bm-tabular-nums">
                {bestSlot ? `${bestSlot}h` : 'En calibración'}
              </strong>
            </div>
            <span style={{ fontSize: '11.5px', color: bestSlot ? PRECISION_COLORS.profit : PRECISION_TEXT.muted, fontWeight: 600, marginTop: '6px', display: 'block' }}>
              {bestSlot ? `${bestSlotRate}% de efectividad comprobada` : 'Pendiente de volumen'}
            </span>
          </div>
        </div>

        {/* ─── PAINEL CENTRAL DE ANÁLISE GRÁFICA ───────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
            gap: '24px',
            marginBottom: '28px',
          }}
        >
          {/* Gráfico 1: Rendimento por Dia */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '22px 24px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 2px' }}>
                  Resultado por día
                </h3>
                <span style={{ fontSize: '12px', color: PRECISION_TEXT.quiet }}>Distribución por jornada de trading</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '2px',
                  background: PRECISION_SURFACES.bg2,
                  padding: '3px',
                  borderRadius: '4px',
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => setChartMetric('profit')}
                  style={{
                    background: chartMetric === 'profit' ? PRECISION_SURFACES.bg3 : 'transparent',
                    color: chartMetric === 'profit' ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  Ganancias ($)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('volume')}
                  style={{
                    background: chartMetric === 'volume' ? PRECISION_SURFACES.bg3 : 'transparent',
                    color: chartMetric === 'volume' ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    border: 'none',
                    borderRadius: '3px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  Contratos
                </button>
              </div>
            </div>

            {/* Barras Analíticas de Precisão */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '190px',
                paddingTop: '20px',
                borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
                gap: '12px',
              }}
            >
              {dailyData.map((d, i) => {
                const val = chartMetric === 'profit' ? d.profit : d.ops;
                const isPositive = val >= 0;
                const maxDailyVal = Math.max(1, ...dailyData.map((x) => Math.abs(chartMetric === 'profit' ? x.profit : x.ops)));
                const heightPercent = val === 0 ? 4 : Math.min(100, Math.max(16, (Math.abs(val) / maxDailyVal) * 100));

                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                      height: '100%',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        color: val === 0 ? PRECISION_TEXT.quiet : isPositive ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                        fontFamily: PRECISION_FONTS.mono,
                        marginBottom: '6px',
                        fontWeight: 700,
                      }}
                      className="bm-tabular-nums"
                    >
                      {chartMetric === 'profit' ? `${val > 0 ? '+' : ''}$${val}` : val}
                    </span>
                    <div
                      style={{
                        width: '100%',
                        maxWidth: '32px',
                        height: `${heightPercent}%`,
                        backgroundColor: val === 0 ? PRECISION_SURFACES.bg3 : isPositive ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                        borderRadius: '2px 2px 0 0',
                        opacity: val === 0 ? 0.3 : 0.9,
                        transition: `height ${PRECISION_MOTION.tBase}ms ${PRECISION_MOTION.ease}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '11.5px',
                        color: PRECISION_TEXT.muted,
                        marginTop: '8px',
                        fontFamily: PRECISION_FONTS.mono,
                      }}
                    >
                      {d.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráfico 2: Desempenho por Ativo */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '22px 24px',
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 2px' }}>
                Resultado por activo
              </h3>
              <span style={{ fontSize: '12px', color: PRECISION_TEXT.quiet }}>Tasa de asertividad y balance atribuido</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {assetPerformance.length > 0 ? (
                assetPerformance.map((a, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: PRECISION_TEXT.strong }}>{a.name}</strong>
                        <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet, marginLeft: '8px', fontFamily: PRECISION_FONTS.mono }}>
                          {`${a.ops} ops`}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: '13px',
                            color: a.winRate >= 50 ? PRECISION_COLORS.profit : PRECISION_TEXT.muted,
                            fontFamily: PRECISION_FONTS.mono,
                            fontWeight: 700,
                            marginRight: '10px',
                          }}
                          className="bm-tabular-nums"
                        >
                          {`${a.winRate}%`}
                        </span>
                        <strong
                          style={{
                            fontSize: '12.5px',
                            color: a.profit.startsWith('+') ? PRECISION_COLORS.profit : PRECISION_COLORS.loss,
                            fontFamily: PRECISION_FONTS.mono,
                          }}
                          className="bm-tabular-nums"
                        >
                          {a.profit}
                        </strong>
                      </div>
                    </div>
                    <div style={{ height: '4px', background: PRECISION_SURFACES.bg3, borderRadius: '2px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${a.winRate}%`,
                          background: a.winRate >= 50 ? PRECISION_COLORS.profit : PRECISION_COLORS.metal,
                          borderRadius: '2px',
                          transition: `width ${PRECISION_MOTION.tBase}ms ${PRECISION_MOTION.ease}`,
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: PRECISION_TEXT.muted, fontSize: '13px' }}>
                  Aún no se registran contratos liquidados en este período.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── PAINEL INFERIOR: DISTRIBUIÇÃO E EFICIÊNCIA TEMPORAL ─────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Distribuição de Resultados */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '22px 24px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 16px' }}>
              Distribución de resultados
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '16px' }}>
              {/* Medidor Circular Limpo */}
              <div style={{ position: 'relative', width: '110px', height: '110px' }}>
                <svg width="110" height="110" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={hasData ? PRECISION_COLORS.loss : PRECISION_SURFACES.bg3}
                    strokeWidth="3.2"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={hasData ? PRECISION_COLORS.profit : PRECISION_SURFACES.bg3}
                    strokeWidth="3.2"
                    strokeDasharray={`${winRate}, 100`}
                  />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                    {hasData ? `${winRate}%` : '0.0%'}
                  </span>
                </div>
              </div>

              {/* Detalhamento Numérico Tabular */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <div style={{ width: '8px', height: '8px', background: PRECISION_COLORS.profit, borderRadius: '2px' }} />
                    <span style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Operaciones Ganadas</span>
                  </div>
                  <strong style={{ fontSize: '13.5px', color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono, marginLeft: '16px' }} className="bm-tabular-nums">
                    {hasData ? `${winOps} ops (${winRate}%)` : '0 ops (0.0%)'}
                  </strong>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <div style={{ width: '8px', height: '8px', background: PRECISION_COLORS.loss, borderRadius: '2px' }} />
                    <span style={{ fontSize: '12px', color: PRECISION_TEXT.muted }}>Operaciones No Ganadas</span>
                  </div>
                  <strong style={{ fontSize: '13.5px', color: PRECISION_COLORS.loss, fontFamily: PRECISION_FONTS.mono, marginLeft: '16px' }} className="bm-tabular-nums">
                    {hasData ? `${lossOps} ops (${(100 - winRate).toFixed(1)}%)` : '0 ops (0.0%)'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Horários Operacionais */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '22px 24px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 16px' }}>
              Asertividad por franja horaria
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {hourlySlots.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.quiet, width: '50px', fontFamily: PRECISION_FONTS.mono }}>
                    {h.slot}h
                  </span>
                  <div style={{ flex: 1, height: '6px', background: PRECISION_SURFACES.bg3, borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${h.rate}%`,
                        background: h.isBest ? PRECISION_COLORS.profit : PRECISION_COLORS.metal,
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                  <strong
                    style={{
                      fontSize: '12px',
                      color: h.isBest ? PRECISION_COLORS.profit : PRECISION_TEXT.muted,
                      fontFamily: PRECISION_FONTS.mono,
                      width: '42px',
                      textAlign: 'right',
                    }}
                    className="bm-tabular-nums"
                  >
                    {`${h.rate}%`}
                  </strong>
                </div>
              ))}
            </div>
          </div>

          {/* Parâmetros Quantitativos */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              border: `1px solid ${PRECISION_SURFACES.line}`,
              borderRadius: '8px',
              padding: '22px 24px',
            }}
          >
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 16px' }}>
              Estadísticas clave
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                <span style={{ color: PRECISION_TEXT.muted }}>Contratos auditados:</span>
                <strong style={{ color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">{totalOps} ops</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                <span style={{ color: PRECISION_TEXT.muted }}>Mayor ganancia única:</span>
                <strong style={{ color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  {analytics?.max_win_minor ? `+$${(analytics.max_win_minor / 100).toFixed(2)}` : '$0.00'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${PRECISION_SURFACES.line}`, paddingBottom: '8px' }}>
                <span style={{ color: PRECISION_TEXT.muted }}>Mayor drawdown único:</span>
                <strong style={{ color: PRECISION_COLORS.loss, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  {analytics?.max_loss_minor ? `-$${(analytics.max_loss_minor / 100).toFixed(2)}` : '$0.00'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: PRECISION_TEXT.muted }}>Retorno medio / trade:</span>
                <strong style={{ color: (analytics?.avg_trade_profit_minor ?? 0) >= 0 ? PRECISION_COLORS.profit : PRECISION_COLORS.loss, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  {(analytics?.avg_trade_profit_minor ?? 0) >= 0 ? `+$${((analytics?.avg_trade_profit_minor ?? 0) / 100).toFixed(2)}` : `-$${Math.abs((analytics?.avg_trade_profit_minor ?? 0) / 100).toFixed(2)}`}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SecondaryLayout>
  );
}
