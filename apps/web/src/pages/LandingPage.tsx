import React, { useState } from 'react';
import { useRouter } from '../router/RouterContext';
import { Vol50LiveMiniChart } from '../components/chart/Vol50LiveMiniChart';
import { setGuestMode } from '../auth/oidc';
import { AuthService } from '../auth/auth-service';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../lib/design-tokens';

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: '¿Qué es BINMAX?',
    a: 'BINMAX es una plataforma institucional de trading de opciones binarias e índices sintéticos que permite especular sobre la dirección del precio en contratos de alta velocidad (60 segundos) con ejecución determinística y transparencia contable total.',
  },
  {
    q: '¿Cómo creo una cuenta de práctica?',
    a: 'El registro se realiza en un solo paso en menos de un minuto. Al registrarte recibirás automáticamente $10.000 USD de saldo demostrativo renovable de forma ilimitada para practicar sin arriesgar capital real.',
  },
  {
    q: '¿Cuánto es el depósito mínimo y los tiempos de retiro?',
    a: 'El depósito mínimo es de solo $20 USD a través de métodos instantáneos como PIX, tarjetas bancarias y criptomonedas (USDT TRC-20). Los retiros se procesan y liquidan en menos de 24 horas hábiles.',
  },
  {
    q: '¿Qué son los índices sintéticos y por qué operan 24/7?',
    a: 'Los índices de volatilidad sintética (Vol 10, 25, 50, 75, 100) simulan dinámicas estocásticas de mercado continuo mediante algoritmos criptográficos (CSPRNG), permitiendo operar las 24 horas del día, los 7 días de la semana, sin depender de feriados bancarios.',
  },
];

export function LandingPage() {
  const { navigate } = useRouter();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [miniTicketDirection, setMiniTicketDirection] = useState<'UP' | 'DOWN' | null>(null);

  const handleGoToTraderoom = () => {
    const session = AuthService.getSession();
    if (session?.user) {
      setGuestMode(false);
    } else {
      setGuestMode(true);
    }
    navigate('/operar');
  };

  return (
    <div
      data-testid="landing-page-container"
      className="theme-binmax bm-page-enter"
      style={{
        minHeight: '100vh',
        backgroundColor: PRECISION_SURFACES.bg0,
        color: PRECISION_TEXT.main,
        fontFamily: PRECISION_FONTS.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── NAVEGAÇÃO SUPERIOR CALIBRADA ───────────────────────────── */}
      <header
        style={{
          borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
          backgroundColor: PRECISION_SURFACES.bg1,
          backdropFilter: 'blur(8px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo */}
          <div
            onClick={handleGoToTraderoom}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <span style={{ color: PRECISION_COLORS.profit, fontSize: '20px', fontWeight: 900 }}>∿</span>
            <strong style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.04em', color: PRECISION_TEXT.strong }}>
              BINMAX
            </strong>
            <span
              style={{
                fontSize: '10px',
                background: PRECISION_SURFACES.bg3,
                color: PRECISION_COLORS.metal,
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 700,
                border: `1px solid ${PRECISION_SURFACES.line}`,
              }}
            >
              OPTION
            </span>
          </div>

          {/* Links Centrais */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <a href="#plataforma" style={{ fontSize: '13px', color: PRECISION_TEXT.muted, textDecoration: 'none', fontWeight: 500 }}>
              Plataforma
            </a>
            <a href="#activos" style={{ fontSize: '13px', color: PRECISION_TEXT.muted, textDecoration: 'none', fontWeight: 500 }}>
              Activos
            </a>
            <a href="#ventajas" style={{ fontSize: '13px', color: PRECISION_TEXT.muted, textDecoration: 'none', fontWeight: 500 }}>
              Cómo funciona
            </a>
            <a href="#faq" style={{ fontSize: '13px', color: PRECISION_TEXT.muted, textDecoration: 'none', fontWeight: 500 }}>
              Preguntas frecuentes
            </a>
          </nav>

          {/* Ações Direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              data-testid="landing-login-btn"
              className="bm-btn-press"
              onClick={() => navigate('/login')}
              style={{
                background: 'transparent',
                border: 'none',
                color: PRECISION_TEXT.strong,
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '8px 12px',
              }}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              data-testid="landing-register-btn"
              className="bm-btn-press"
              onClick={() => navigate('/registro')}
              style={{
                background: PRECISION_COLORS.profit,
                color: '#07120B',
                border: 'none',
                borderRadius: '6px',
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
              }}
            >
              Crear cuenta gratis
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION (DOBRA PRINCIPAL) ────────────────────────── */}
      <section
        id="plataforma"
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '64px 24px 80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: '48px',
          alignItems: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Coluna Esquerda: Proposta de Valor e Rigor Técnico */}
        <div>
          <span
            style={{
              color: PRECISION_COLORS.metal,
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '14px',
            }}
          >
            TERMINAL INSTITUCIONAL DE OPÇÕES E DERIVATIVOS SINTÉTICOS
          </span>

          <h1
            style={{
              fontSize: '42px',
              fontWeight: 800,
              lineHeight: 1.15,
              color: PRECISION_TEXT.strong,
              margin: '0 0 18px',
              letterSpacing: '-0.02em',
            }}
          >
            Trading de opciones,{' '}
            <span style={{ color: PRECISION_COLORS.profit }}>simple y rápido</span>
          </h1>

          <p
            style={{
              fontSize: '14.5px',
              color: PRECISION_TEXT.muted,
              lineHeight: 1.6,
              margin: '0 0 28px',
              maxWidth: '520px',
            }}
          >
            La plataforma donde el gráfico obedece a tu clic, no al algoritmo de la casa. Sin delays ocultos, con ejecución server-side atómica y transparencia contable total.
          </p>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <button
              type="button"
              data-testid="hero-create-account-btn"
              className="bm-btn-press"
              onClick={() => navigate('/registro')}
              style={{
                background: PRECISION_COLORS.profit,
                color: '#07120B',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
              }}
            >
              <span>Crear cuenta gratis</span>
              <span>→</span>
            </button>

            <button
              type="button"
              data-testid="hero-enter-traderoom-btn"
              className="bm-btn-precision"
              onClick={handleGoToTraderoom}
              style={{
                padding: '12px 20px',
                fontSize: '13.5px',
              }}
            >
              Ir a la sala de trading
            </button>
          </div>

          {/* Checks de Confiança Técnicos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: PRECISION_TEXT.muted }}>
              <span style={{ color: PRECISION_COLORS.profit, fontWeight: 700 }}>✓</span>
              <span>Registro rápido en menos de 1 minuto</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: PRECISION_TEXT.muted }}>
              <span style={{ color: PRECISION_COLORS.profit, fontWeight: 700 }}>✓</span>
              <span>Plataforma intuitiva con renderizado fluido a 60 FPS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: PRECISION_TEXT.muted }}>
              <span style={{ color: PRECISION_COLORS.profit, fontWeight: 700 }}>✓</span>
              <span>Cuenta de práctica ilimitada con $10.000 sin riesgo</span>
            </div>
          </div>
        </div>

        {/* Coluna Direita: Live Preview da Sala Real */}
        <div
          data-testid="hero-traderoom-preview"
          style={{
            backgroundColor: PRECISION_SURFACES.bg1,
            border: `1px solid ${PRECISION_SURFACES.line}`,
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
          }}
        >
          {/* Header da Mini Janela */}
          <div
            style={{
              backgroundColor: PRECISION_SURFACES.bg1,
              borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: PRECISION_COLORS.profit, fontWeight: 900 }}>∿</span>
              <span style={{ fontSize: '11.5px', fontWeight: 800, color: PRECISION_TEXT.strong }}>BINMAX TERMINAL</span>
              <span
                style={{
                  background: PRECISION_SURFACES.bg3,
                  color: PRECISION_TEXT.muted,
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontFamily: PRECISION_FONTS.mono,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                }}
              >
                SYNTH_VOL_50
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '11.5px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 700 }} className="bm-tabular-nums">
                $10,000.00 DEMO
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: PRECISION_COLORS.profit,
                  background: 'rgba(34, 196, 122, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontFamily: PRECISION_FONTS.mono,
                }}
              >
                16ms
              </span>
            </div>
          </div>

          {/* Gráfico Real com Order Ticket Lateral */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', height: '280px', backgroundColor: PRECISION_SURFACES.bg0 }}>
            {/* Gráfico do Vol 50 */}
            <div style={{ position: 'relative', height: '100%', borderRight: `1px solid ${PRECISION_SURFACES.line}` }}>
              <Vol50LiveMiniChart />
            </div>

            {/* Boleta Lateral em Miniatura */}
            <div
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                padding: '14px 12px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <span style={{ fontSize: '10px', color: PRECISION_TEXT.quiet, display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Inversión
                </span>
                <strong style={{ fontSize: '13.5px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  $100.00
                </strong>

                <div style={{ margin: '12px 0 6px', height: '1px', background: PRECISION_SURFACES.line }} />

                <span style={{ fontSize: '10px', color: PRECISION_TEXT.quiet, display: 'block', marginBottom: '2px', textTransform: 'uppercase' }}>
                  Rendimiento
                </span>
                <strong style={{ fontSize: '13px', color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono }} className="bm-tabular-nums">
                  +85% ($185.00)
                </strong>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="bm-btn-press"
                  onClick={() => setMiniTicketDirection('UP')}
                  style={{
                    background: PRECISION_COLORS.profit,
                    color: '#07120B',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 4px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ▲ SUBE
                </button>
                <button
                  type="button"
                  className="bm-btn-press"
                  onClick={() => setMiniTicketDirection('DOWN')}
                  style={{
                    background: PRECISION_COLORS.loss,
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 4px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ▼ BAJA
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé da Mini Janela */}
          <div style={{ backgroundColor: PRECISION_SURFACES.bg1, borderTop: `1px solid ${PRECISION_SURFACES.line}`, padding: '7px 14px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: PRECISION_TEXT.muted }}>
            <span>Ejecución server-side determinística</span>
            <span style={{ color: PRECISION_COLORS.profit }}>Feed: 250ms</span>
          </div>
        </div>
      </section>

      {/* ─── SEÇÃO DE BENEFÍCIOS (3 COLUNAS ESTRUTURAIS) ───────────── */}
      <section
        id="ventajas"
        style={{
          backgroundColor: PRECISION_SURFACES.bg1,
          borderTop: `1px solid ${PRECISION_SURFACES.line}`,
          borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '44px' }}>
            <span style={{ color: PRECISION_COLORS.metal, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              POR QUÉ ELEGIR BINMAX
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: PRECISION_TEXT.strong, margin: '8px 0 0', letterSpacing: '-0.01em' }}>
              Diseñada para la máxima velocidad y precisión
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Card 1 */}
            <div style={{ backgroundColor: PRECISION_SURFACES.bg2, border: `1px solid ${PRECISION_SURFACES.line}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: PRECISION_SURFACES.bg3, border: `1px solid ${PRECISION_SURFACES.line}`, color: PRECISION_COLORS.metal, display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 8px' }}>
                Amplia variedad de activos
              </h3>
              <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, lineHeight: 1.6, margin: 0 }}>
                Opera divisas OTC, criptomonedas, materias primas e índices sintéticos continuos con disponibilidad 24/7 y sin manipulación algorítmica.
              </p>
            </div>

            {/* Card 2 */}
            <div style={{ backgroundColor: PRECISION_SURFACES.bg2, border: `1px solid ${PRECISION_SURFACES.line}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: PRECISION_SURFACES.bg3, border: `1px solid ${PRECISION_SURFACES.line}`, color: PRECISION_COLORS.metal, display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 8px' }}>
                Plataforma rápida y estable
              </h3>
              <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, lineHeight: 1.6, margin: 0 }}>
                Ejecución ultrarrápida a través de WebSockets con compresión binaria, motor de gráficos a 60 FPS y latencia comprobable de 16ms.
              </p>
            </div>

            {/* Card 3 */}
            <div style={{ backgroundColor: PRECISION_SURFACES.bg2, border: `1px solid ${PRECISION_SURFACES.line}`, borderRadius: '8px', padding: '24px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '6px', background: PRECISION_SURFACES.bg3, border: `1px solid ${PRECISION_SURFACES.line}`, color: PRECISION_COLORS.metal, display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: PRECISION_TEXT.strong, margin: '0 0 8px' }}>
                Seguridad y transparencia
              </h3>
              <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, lineHeight: 1.6, margin: 0 }}>
                Auditoría determinística de cotações en PostgreSQL e inmutabilidad garantizada mediante libro contable de doble entrada Blnk Ledger.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAIXA DE MERCADOS POPULARES ───────────────────────────── */}
      <section id="activos" style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <span style={{ color: PRECISION_COLORS.metal, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              OPERA LOS MERCADOS MÁS POPULARES
            </span>
            <h2 style={{ fontSize: '24px', fontWeight: 800, color: PRECISION_TEXT.strong, margin: '6px 0 0', letterSpacing: '-0.01em' }}>
              Más de 100 activos disponibles 24/7
            </h2>
          </div>
          <button
            type="button"
            onClick={handleGoToTraderoom}
            style={{
              background: 'transparent',
              border: 'none',
              color: PRECISION_TEXT.strong,
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Ver todos los activos en la sala →
          </button>
        </div>

        {/* Grade de Pílulas de Ativos */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
          }}
        >
          {[
            { sym: 'EUR/USD', cat: 'Forex OTC', yield: '+85%' },
            { sym: 'BTC/USD', cat: 'Criptomonedas', yield: '+85%' },
            { sym: 'SYNTH_VOL_50', cat: 'Índice Sintético', yield: '+85%' },
            { sym: 'ETH/USD', cat: 'Criptomonedas', yield: '+85%' },
            { sym: 'GOLD', cat: 'Materias Primas', yield: '+85%' },
            { sym: 'SPX500', cat: 'Índices', yield: '+85%' },
          ].map((a, i) => (
            <div
              key={i}
              onClick={handleGoToTraderoom}
              className="bm-btn-press"
              style={{
                backgroundColor: PRECISION_SURFACES.bg1,
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '6px',
                padding: '14px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '13.5px', color: PRECISION_TEXT.strong }}>{a.sym}</strong>
                <span style={{ fontSize: '11.5px', color: PRECISION_COLORS.profit, fontFamily: PRECISION_FONTS.mono, fontWeight: 700 }} className="bm-tabular-nums">
                  {a.yield}
                </span>
              </div>
              <span style={{ fontSize: '11px', color: PRECISION_TEXT.quiet }}>{a.cat}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ (PERGUNTAS FREQUENTES) ────────────────────────────── */}
      <section
        id="faq"
        style={{
          backgroundColor: PRECISION_SURFACES.bg1,
          borderTop: `1px solid ${PRECISION_SURFACES.line}`,
          padding: '64px 24px',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span style={{ color: PRECISION_COLORS.metal, fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              PREGUNTAS FRECUENTES
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 800, color: PRECISION_TEXT.strong, margin: '8px 0 4px', letterSpacing: '-0.01em' }}>
              Resolvemos tus dudas
            </h2>
            <p style={{ fontSize: '13px', color: PRECISION_TEXT.muted, margin: 0 }}>
              Encuentra respuestas a las preguntas más comunes sobre BINMAX y comienza a operar con confianza.
            </p>
          </div>

          {/* Acordeão de FAQs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FAQS.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={index}
                  data-testid={`faq-item-${index}`}
                  style={{
                    backgroundColor: PRECISION_SURFACES.bg2,
                    border: `1px solid ${PRECISION_SURFACES.line}`,
                    borderRadius: '6px',
                    overflow: 'hidden',
                  }}
                >
                  <button
                    type="button"
                    data-testid={`faq-toggle-${index}`}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      padding: '16px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: PRECISION_TEXT.strong,
                      fontSize: '13.5px',
                      fontWeight: 600,
                    }}
                  >
                    <span>{faq.q}</span>
                    <span style={{ color: PRECISION_COLORS.metal, fontSize: '16px', marginLeft: '12px' }}>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div
                      data-testid={`faq-answer-${index}`}
                      style={{
                        padding: '0 20px 16px',
                        fontSize: '13px',
                        color: PRECISION_TEXT.muted,
                        lineHeight: 1.6,
                      }}
                    >
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── RODAPÉ INSTITUCIONAL COM AVISO DE RISCO ───────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${PRECISION_SURFACES.line}`,
          backgroundColor: PRECISION_SURFACES.bg0,
          padding: '40px 24px 32px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: PRECISION_COLORS.profit, fontSize: '20px', fontWeight: 900 }}>∿</span>
              <strong style={{ fontSize: '15px', fontWeight: 900, color: PRECISION_TEXT.strong }}>BINMAX OPTION</strong>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '12.5px', color: PRECISION_TEXT.muted }}>
              <span style={{ cursor: 'pointer' }}>Sobre nosotros</span>
              <span style={{ cursor: 'pointer' }}>Términos y condiciones</span>
              <span style={{ cursor: 'pointer' }}>Política de privacidad</span>
              <span style={{ cursor: 'pointer' }}>Contacto y soporte</span>
            </div>
          </div>

          <div
            style={{
              borderTop: `1px solid ${PRECISION_SURFACES.line}`,
              paddingTop: '20px',
              fontSize: '11px',
              color: PRECISION_TEXT.quiet,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0 }}>
              <strong>Advertencia de riesgo:</strong> El trading de opciones binarias conlleva un alto nivel de riesgo y puede no ser adecuado para todos los inversores. Existe la posibilidad de perder la totalidad de su inversión. Los resultados pasados no garantizan resultados futuros. Antes de operar, asegúrese de comprender los riesgos involucrados y considere su situación financiera, objetivos de inversión y nivel de experiencia. Opere únicamente con fondos que pueda permitirse perder.
            </p>
            <p style={{ margin: '8px 0 0' }}>
              © 2026 BINMAX Option Ltd. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
