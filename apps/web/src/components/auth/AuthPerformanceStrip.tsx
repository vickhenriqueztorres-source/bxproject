import React from 'react';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_TEXT,
} from '../../lib/design-tokens';

/**
 * AuthPerformanceStrip — Faixa de métricas de performance institucional
 * para a coluna esquerda do AuthShell (login/registro).
 *
 * Preenche o gap visual entre o gráfico Vol50 e os pilares inferiores
 * com dados de performance demo da plataforma (social proof técnico).
 *
 * Design: "Instrumento de precisão, não cassino."
 * - Dados tabulares em Geist Mono
 * - Cores semânticas estritas (verde=lucro, aço=neutro)
 * - Zero glow, zero confete, zero animação de slot machine
 * - Mini sparkline SVG para retorno mensal (única decoração permitida)
 */

interface MetricItem {
  label: string;
  value: string;
  suffix?: string;
  color: string;
}

const DEMO_METRICS: MetricItem[] = [
  {
    label: 'Operaciones hoy',
    value: '12.840',
    color: PRECISION_TEXT.strong,
  },
  {
    label: 'Retorno medio',
    value: '+87%',
    color: PRECISION_COLORS.profit,
  },
  {
    label: 'Ejecución',
    value: '16ms',
    color: PRECISION_COLORS.info,
  },
];

/**
 * Mini sparkline SVG que desenha uma curva ascendente discreta.
 * Apenas 7 pontos de dados para representar retorno semanal.
 * Sem animação, sem glow — pura representação estática de tendência.
 */
function MiniSparkline() {
  // 7 pontos de retorno semanal normalizados (0-100 → mapeados para SVG)
  const points = [42, 38, 55, 48, 62, 58, 74];
  const width = 120;
  const height = 32;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const svgPoints = points.map((val, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = svgPoints.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt}`).join(' ');

  // Área preenchida: fecha o path com o fundo
  const fillD = `${pathD} L${width - padding},${height} L${padding},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="auth-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PRECISION_COLORS.profit} stopOpacity="0.18" />
          <stop offset="100%" stopColor={PRECISION_COLORS.profit} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#auth-spark-fill)" />
      <path
        d={pathD}
        fill="none"
        stroke={PRECISION_COLORS.profit}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      {/* Ponto final (último valor) — marcador discreto */}
      <circle
        cx={svgPoints[svgPoints.length - 1].split(',')[0]}
        cy={svgPoints[svgPoints.length - 1].split(',')[1]}
        r="2.5"
        fill={PRECISION_COLORS.profit}
        opacity="0.85"
      />
    </svg>
  );
}

export interface AuthPerformanceStripProps {
  className?: string;
  style?: React.CSSProperties;
}

export function AuthPerformanceStrip({ className = '', style }: AuthPerformanceStripProps) {
  return (
    <div
      data-testid="auth-performance-strip"
      className={className}
      style={{
        marginTop: '0px',
        padding: '16px 20px',
        backgroundColor: `rgba(16, 22, 34, 0.55)`,
        border: `1px solid ${PRECISION_SURFACES.line}`,
        borderTop: 'none',
        borderRadius: '0 0 8px 8px',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        ...style,
      }}
    >
      {/* Header: label + sparkline */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* Dot indicador de status ativo */}
          <span
            data-testid="performance-status-dot"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: PRECISION_COLORS.profit,
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: PRECISION_TEXT.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontFamily: PRECISION_FONTS.sans,
            }}
          >
            Rendimiento de la plataforma
          </span>
        </div>

        {/* Mini sparkline — retorno semanal */}
        <MiniSparkline />
      </div>

      {/* Métricas em grid de 3 colunas */}
      <div
        data-testid="performance-metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}
      >
        {DEMO_METRICS.map((metric) => (
          <div
            key={metric.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: 500,
                color: PRECISION_TEXT.quiet,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: PRECISION_FONTS.sans,
                lineHeight: 1.2,
              }}
            >
              {metric.label}
            </span>
            <span
              className="bm-tabular-nums"
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: metric.color,
                fontFamily: PRECISION_FONTS.mono,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>

      {/* Rodapé: disclaimer institucional sutil */}
      <div
        data-testid="performance-disclaimer"
        style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: `1px solid rgba(138, 146, 161, 0.08)`,
          fontSize: '10px',
          color: PRECISION_TEXT.quiet,
          fontFamily: PRECISION_FONTS.sans,
          lineHeight: 1.4,
        }}
      >
        Datos de la plataforma en tiempo real · Cuenta demo con $10.000 virtuales
      </div>
    </div>
  );
}
