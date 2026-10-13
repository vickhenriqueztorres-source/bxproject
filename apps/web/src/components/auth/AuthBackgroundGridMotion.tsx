import React from 'react';

export interface AuthBackgroundGridMotionProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Fundo Institucional de Alta Precisão BINMAX para Autenticação.
 * Integra malha cartesiana SVG 48px, vinheta perimétrica de profundidade 360°,
 * glow volumétrico esmeralda em múltiplas camadas difusas e ondas sinuosas de trading
 * em movimento suave a 60 FPS (sem mockup de aparelho e sem elementos de cassino).
 */
export function AuthBackgroundGridMotion({ className = '', style }: AuthBackgroundGridMotionProps) {
  return (
    <div
      data-testid="auth-background-grid-motion"
      aria-hidden="true"
      className={`bm-auth-bg-container ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
        backgroundColor: '#070A0F',
        ...style,
      }}
    >
      {/* 1. ATMOSFERA RADIAL DE PROFUNDIDADE (GLOW ESMERALDA VOLUMÉTRICO) */}
      {/* Camada A: Luz difusa central-esquerda (sob o título e mini-gráfico Vol 50) */}
      <div
        className="bm-bg-glow-drift"
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: '65vw',
          height: '65vh',
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(34, 196, 122, 0.08) 0%, rgba(16, 22, 34, 0.02) 65%, transparent 80%)',
          filter: 'blur(50px)',
          borderRadius: '50%',
        }}
      />

      {/* Camada B: Luz suave no quadrante superior direito (sob o card de login/registro) */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          right: '5%',
          width: '55vw',
          height: '55vh',
          background: 'radial-gradient(ellipse 65% 55% at 60% 40%, rgba(34, 196, 122, 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
          borderRadius: '50%',
        }}
      />

      {/* Camada C: Base escura profunda ardósia para estabilidade visual */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '20%',
          width: '60vw',
          height: '50vh',
          background: 'radial-gradient(circle, rgba(16, 22, 34, 0.45) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* 2. GRADE CARTESIANA MATEMÁTICA DE TRADING (48px x 48px) COM DEGRADE SUAVE */}
      <svg
        data-testid="auth-grid-svg"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.95,
        }}
      >
        <defs>
          <pattern
            id="bm-auth-cartesian-grid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            {/* Linhas cartesianas ultra-finas de precisão suíça */}
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(255, 255, 255, 0.028)"
              strokeWidth="1"
            />
            {/* Ponto de interseção nos eixos cartesianos */}
            <circle cx="48" cy="48" r="0.8" fill="rgba(34, 196, 122, 0.22)" />
          </pattern>

          {/* Gradiente vertical para preenchimento volumétrico sob a curva */}
          <linearGradient id="bm-curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22C47A" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#22C47A" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#22C47A" stopOpacity="0.0" />
          </linearGradient>

          {/* Gradiente luminoso para o traço ascendente de alta precisão */}
          <linearGradient id="bm-curve-stroke" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(34, 196, 122, 0.15)" />
            <stop offset="30%" stopColor="#22C47A" />
            <stop offset="70%" stopColor="#26E890" />
            <stop offset="100%" stopColor="#6EEDB8" />
          </linearGradient>

          {/* Gradiente secundário para a linha de suporte pontilhada */}
          <linearGradient id="bm-curve-secondary" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(34, 196, 122, 0.04)" />
            <stop offset="50%" stopColor="rgba(34, 196, 122, 0.3)" />
            <stop offset="100%" stopColor="rgba(110, 237, 184, 0.55)" />
          </linearGradient>
        </defs>

        {/* Preenchimento contínuo do grid cartesiano em toda a tela */}
        <rect width="100%" height="100%" fill="url(#bm-auth-cartesian-grid)" />
      </svg>

      {/* 3. VINHETA PERIMÉTRICA SUAVE 360° (SUAVIZA BORDAS E INTEGRA COM O FUNDO) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 75% 70% at 50% 50%, transparent 35%, rgba(7, 10, 15, 0.45) 75%, #070A0F 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* 4. CURVAS VETORIAIS DE TENDÊNCIA EM MOVIMENTO (MOTION FINANCIAL WAVES) */}
      <div
        data-testid="auth-motion-curves"
        className="bm-bg-curve-motion"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <svg
          viewBox="0 0 1920 1080"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Preenchimento orgânico sob a curva ascendente */}
          <path
            d="M -120 1150 L -120 980 C 240 960, 520 840, 840 700 C 1160 560, 1480 390, 1920 280 C 1980 260, 2040 240, 2100 220 L 2100 1150 Z"
            fill="url(#bm-curve-fill)"
          />

          {/* Curva secundária técnica tracejada */}
          <path
            d="M -120 1040 C 260 1000, 560 890, 880 760 C 1200 630, 1500 450, 1920 340 C 1980 320, 2040 300, 2100 280"
            fill="none"
            stroke="url(#bm-curve-secondary)"
            strokeWidth="1.5"
            strokeDasharray="5 3"
          />

          {/* Curva primária luminosa oficial de alta precisão */}
          <path
            d="M -120 980 C 240 960, 520 840, 840 700 C 1160 560, 1480 390, 1920 280 C 1980 260, 2040 240, 2100 220"
            fill="none"
            stroke="url(#bm-curve-stroke)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Marcadores de cotação / pulso nos nós de inflexão de alta precisão */}
          <circle cx="840" cy="700" r="3" fill="#22C47A" opacity="0.8" />
          <circle cx="1480" cy="390" r="3.5" fill="#34D399" opacity="0.9" />
          <circle cx="1920" cy="280" r="4" fill="#6EEDB8" opacity="0.95" />
        </svg>
      </div>
    </div>
  );
}
