import React from 'react';
import { BinmaxLogo } from '../brand/BinmaxLogo';
import { Vol50LiveMiniChart } from '../chart/Vol50LiveMiniChart';
import { useRouter } from '../../router/RouterContext';
import {
  IconClock,
  IconShield,
  IconCheckCircle,
  IconChart,
  IconZap,
} from '../icons/PrecisionIcons';
import {
  PRECISION_SURFACES,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_TEXT,
} from '../../lib/design-tokens';
import { AuthBackgroundGridMotion } from './AuthBackgroundGridMotion';
import { AuthPerformanceStrip } from './AuthPerformanceStrip';
import { AuthMarketTicker } from './AuthMarketTicker';

export interface AuthShellProps {
  activeMode: 'login' | 'register';
  children: React.ReactNode;
}

export function AuthShell({ activeMode, children }: AuthShellProps) {
  const { navigate } = useRouter();

  const isLogin = activeMode === 'login';

  return (
    <div
      data-testid="auth-shell"
      className="theme-binmax bm-page-enter auth-shell-scroll"
      style={{
        minHeight: '100vh',
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
        backgroundColor: '#070A0F',
        color: PRECISION_TEXT.main,
        fontFamily: PRECISION_FONTS.sans,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* CAMADA DE FUNDO TÉCNICO: GRID CARTESIANO + CURVAS VETORIAIS COM MOTION */}
      <AuthBackgroundGridMotion />

      {/* 1. HEADER SUPERIOR INSTITUCIONAL UNIFICADO (ALTURA 56PX) */}
      <header
        data-testid="auth-header"
        style={{
          height: '56px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          backgroundColor: 'rgba(7, 10, 15, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          boxSizing: 'border-box',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Logo Institucional (Único, sem repetição no corpo) */}
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Ir a página de inicio de BINMAX"
        >
          <BinmaxLogo variant="horizontal" height={28} />
        </button>

        {/* Telemetria e Controles de Acesso Rápido */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Latência de Telemetria Honesta */}
          <div
            data-testid="auth-telemetry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: PRECISION_TEXT.muted,
              fontFamily: PRECISION_FONTS.mono,
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: PRECISION_COLORS.profit,
                display: 'inline-block',
              }}
            />
            <span className="bm-tabular-nums">16ms</span>
          </div>

          {/* Seletor de Idioma Limpo */}
          <div
            style={{
              fontSize: '12px',
              color: PRECISION_TEXT.muted,
              fontWeight: 500,
              cursor: 'default',
              userSelect: 'none',
            }}
          >
            ES ⌵
          </div>

          {/* Botão de Alternância Contextual de Alta Precisão */}
          {isLogin ? (
            <button
              type="button"
              data-testid="header-btn-register"
              onClick={() => navigate('/registro')}
              className="bm-btn-precision"
              style={{
                background: 'transparent',
                border: `1px solid ${PRECISION_SURFACES.line}`,
                color: PRECISION_TEXT.strong,
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              Crear cuenta
            </button>
          ) : (
            <button
              type="button"
              data-testid="header-btn-login"
              onClick={() => navigate('/login')}
              className="bm-btn-precision"
              style={{
                background: 'transparent',
                border: `1px solid ${PRECISION_SURFACES.line}`,
                color: PRECISION_TEXT.strong,
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              Iniciar sesión
            </button>
          )}
        </div>
      </header>

      {/* 2. ÁREA CENTRAL SPLIT SCREEN 55% / 45% */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          maxWidth: '1440px',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* COLUNA ESQUERDA (55% Desktop, oculta em telas compactas) */}
        <div
          className="auth-left-panel"
          style={{
            flex: '0 0 55%',
            backgroundColor: 'transparent',
            borderRight: 'none',
            padding: '48px 16px 48px 48px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '0px',
          }}
        >
          {/* Bloco Superior: Tese The Hunter + Gráfico Vol 50 ao vivo */}
          <div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                color: PRECISION_COLORS.profit,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Terminal de Precisión Suiza</span>
            </div>

            <h1
              style={{
                fontSize: '34px',
                fontWeight: 800,
                lineHeight: 1.18,
                margin: '0 0 12px',
                letterSpacing: '-0.02em',
                color: PRECISION_TEXT.strong,
              }}
            >
              {isLogin ? (
                <>
                  Opera en 60 segundos.
                  <br />
                  <span style={{ color: PRECISION_COLORS.profit }}>Práctica gratis con $10.000.</span>
                </>
              ) : (
                <>
                  Empieza en segundos
                  <br />
                  <span style={{ color: PRECISION_COLORS.profit }}>con una cuenta de práctica.</span>
                </>
              )}
            </h1>

            <p
              style={{
                fontSize: '14px',
                color: PRECISION_TEXT.muted,
                margin: '0 0 24px',
                lineHeight: 1.5,
                maxWidth: '480px',
              }}
            >
              {isLogin
                ? 'La plataforma donde el gráfico obedece a tu clic, no al algoritmo de la casa. Latencia real de 16ms y retiros sin fricción.'
                : 'Explora la sala de trading de BINMAX con $10.000 virtuales. Sin depósito. Sin riesgos. Solo aprendizaje.'}
            </p>

            {/* Área do gráfico + ticker lateral */}
            <div style={{ display: 'flex', gap: '0px', alignItems: 'stretch' }}>
              {/* Coluna principal: Chart + Performance Strip */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Moldura do Gráfico Vol 50 ao Vivo */}
                <div
                  style={{
                    borderRadius: '8px 8px 0 0',
                    overflow: 'hidden',
                    border: `1px solid ${PRECISION_SURFACES.line}`,
                    borderBottom: 'none',
                    borderRight: 'none',
                    backgroundColor: PRECISION_SURFACES.bg1,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  }}
                >
                  <Vol50LiveMiniChart height={220} />
                </div>

                {/* Performance Strip institucional */}
                <AuthPerformanceStrip style={{ borderRight: 'none', borderRadius: '0 0 0 8px' }} />
              </div>

              {/* Coluna lateral: Ticker de mercados */}
              <AuthMarketTicker style={{ borderRadius: '0 8px 8px 0' }} />
            </div>
          </div>

          {/* Bloco Inferior: 3 Pilares Institucionais com Ícones de Precisão */}
          {isLogin ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                fontSize: '13px',
                color: PRECISION_TEXT.muted,
                borderTop: `1px solid ${PRECISION_SURFACES.line}`,
                paddingTop: '24px',
                marginTop: '32px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconClock size={16} />
                <span>Pagos en 24h</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconShield size={16} />
                <span>Soporte en español</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <IconCheckCircle size={16} />
                <span>Cuenta de práctica ilimitada</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                borderTop: `1px solid ${PRECISION_SURFACES.line}`,
                paddingTop: '24px',
                marginTop: '32px',
              }}
            >
              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(34, 196, 122, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRECISION_COLORS.profit,
                  }}
                >
                  <IconChart size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: PRECISION_TEXT.strong }}>
                    Plataforma profesional
                  </div>
                  <div style={{ fontSize: '11px', color: PRECISION_TEXT.muted, marginTop: '2px', lineHeight: 1.4 }}>
                    Rápida, estable y segura.
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(77, 141, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRECISION_COLORS.info,
                  }}
                >
                  <IconShield size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: PRECISION_TEXT.strong }}>
                    Aprende sin riesgos
                  </div>
                  <div style={{ fontSize: '11px', color: PRECISION_TEXT.muted, marginTop: '2px', lineHeight: 1.4 }}>
                    Usa $10.000 virtuales.
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  borderRadius: '6px',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(232, 163, 61, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRECISION_COLORS.pending,
                  }}
                >
                  <IconZap size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: PRECISION_TEXT.strong }}>
                    Acceso inmediato
                  </div>
                  <div style={{ fontSize: '11px', color: PRECISION_TEXT.muted, marginTop: '2px', lineHeight: 1.4 }}>
                    Entra al trading en segundos.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA (45% Desktop, 100% Mobile) - Centralização dos Formulários */}
        <main
          className="auth-right-panel"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px 24px',
            boxSizing: 'border-box',
            backgroundColor: 'transparent',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '440px',
              boxSizing: 'border-box',
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
