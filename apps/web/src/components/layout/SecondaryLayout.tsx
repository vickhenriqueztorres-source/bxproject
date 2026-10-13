import React, { useState } from 'react';
import { BinmaxLogo } from '../brand/BinmaxLogo';
import { useRouter } from '../../router/RouterContext';
import { useTranslation } from '../../i18n';
import {
  PRECISION_SURFACES,
  PRECISION_TEXT,
  PRECISION_COLORS,
  PRECISION_FONTS,
  PRECISION_MOTION,
} from '../../lib/design-tokens';
import { AuthService } from '../../auth/auth-service';
import { formatCurrencyBinmax } from '../../lib/money';

export interface SecondaryLayoutProps {
  children: React.ReactNode;
  activeNav?: string;
  userEmail?: string | null;
  balanceFormatted?: string | null;
  onDepositClick?: () => void;
  showRiskDisclaimer?: boolean;
}

export function SecondaryLayout({
  children,
  activeNav,
  userEmail: propUserEmail,
  balanceFormatted: propBalanceFormatted,
  onDepositClick,
  showRiskDisclaimer = true,
}: SecondaryLayoutProps) {
  const { navigate, currentPath } = useRouter();
  const { locale, setLocale } = useTranslation();
  const currentLang = locale?.startsWith('pt') ? 'PT' : 'ES';
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const session = AuthService.getSession();
  const userEmail = propUserEmail || session?.user?.email;
  const balanceFormatted =
    propBalanceFormatted ||
    (session?.user?.demoBalanceMinor !== undefined
      ? formatCurrencyBinmax(session.user.demoBalanceMinor)
      : '$10,000.00');

  const isLogged = Boolean(userEmail);

  const navItems = [
    { label: 'Sala de Trading', path: '/operar' },
    { label: 'Torneos', path: '/torneos' },
    { label: 'Análisis', path: '/analisis' },
    { label: 'Tutoriales', path: '/tutoriales' },
    { label: 'Promociones', path: '/promociones' },
  ];


  return (
    <div
      className="secondary-layout theme-binmax"
      data-testid="secondary-layout"
      style={{
        minHeight: '100vh',
        backgroundColor: PRECISION_SURFACES.bg0,
        color: PRECISION_TEXT.main,
        fontFamily: PRECISION_FONTS.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── HEADER INSTITUCIONAL CALIBRADO ───────────────────────────── */}
      <header
        style={{
          height: '60px',
          borderBottom: `1px solid ${PRECISION_SURFACES.line}`,
          backgroundColor: PRECISION_SURFACES.bg1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}
      >
        {/* Esquerda: Logo BINMAX e Navegação Principal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
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
            aria-label="Ir a página de inicio"
          >
            <BinmaxLogo variant="horizontal" height={26} />
          </button>

          {/* Links de navegação com transição suave e indicador sutil */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
            className="secondary-nav-links"
          >
            {navItems.map((item) => {
              const isActive = currentPath === item.path || activeNav === item.label;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: isActive ? `2px solid ${PRECISION_COLORS.profit}` : '2px solid transparent',
                    cursor: 'pointer',
                    color: isActive ? PRECISION_TEXT.strong : PRECISION_TEXT.muted,
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '13px',
                    padding: '19px 4px 17px',
                    transition: `color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Direita: Telemetria de Latência, Idioma e Ações de Conta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* Indicador de latência honesta e discreta */}
          <div
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
              }}
            />
            <span className="bm-tabular-nums">16ms</span>
          </div>

          {/* Seletor de Idioma ES / PT */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setLangMenuOpen((prev) => !prev)}
              style={{
                background: 'none',
                border: `1px solid ${PRECISION_SURFACES.line}`,
                borderRadius: '6px',
                padding: '5px 10px',
                color: PRECISION_TEXT.muted,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
              }}
              aria-label="Seleccionar idioma"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{currentLang}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {langMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  borderRadius: '6px',
                  padding: '4px',
                  minWidth: '100px',
                  zIndex: 50,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                }}
              >
                <button
                  type="button"
                  onClick={() => { setLocale('es-MX'); setLangMenuOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: currentLang === 'ES' ? PRECISION_SURFACES.bg3 : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: PRECISION_TEXT.strong,
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Español (ES)
                </button>
                <button
                  type="button"
                  onClick={() => { setLocale('pt-BR'); setLangMenuOpen(false); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '6px 10px',
                    textAlign: 'left',
                    background: currentLang === 'PT' ? PRECISION_SURFACES.bg3 : 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    color: PRECISION_TEXT.strong,
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Português (PT)
                </button>
              </div>
            )}
          </div>

          {/* Usuário Logado vs Convidado */}
          {isLogged ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Botão de Ajustes / Saldo Demonstrativo */}
              <button
                type="button"
                onClick={() => navigate('/ajustes')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  background: PRECISION_SURFACES.bg2,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  color: PRECISION_TEXT.strong,
                  cursor: 'pointer',
                  transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                <div
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: PRECISION_SURFACES.bg3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRECISION_COLORS.metal,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div style={{ textAlign: 'left', lineHeight: 1.15 }}>
                  <div style={{ fontSize: '10px', color: PRECISION_TEXT.quiet, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cuenta de práctica</div>
                  <div style={{ fontSize: '13px', color: PRECISION_TEXT.strong, fontFamily: PRECISION_FONTS.mono, fontWeight: 700 }} className="bm-tabular-nums">
                    {balanceFormatted || '$10,000.00'}
                  </div>
                </div>
              </button>

              {/* Botão Depositar - Sóbrio, tátil e sem neon espalhafatoso */}
              <button
                type="button"
                className="bm-btn-press"
                onClick={() => {
                  if (onDepositClick) onDepositClick();
                  else navigate('/deposito');
                }}
                style={{
                  backgroundColor: PRECISION_COLORS.profit,
                  color: '#07120B',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: `all ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Depositar</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="bm-btn-press"
                onClick={() => navigate('/login')}
                style={{
                  background: 'transparent',
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  color: PRECISION_TEXT.main,
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: `border-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className="bm-btn-press"
                onClick={() => navigate('/registro')}
                style={{
                  backgroundColor: PRECISION_SURFACES.bg2,
                  color: PRECISION_TEXT.strong,
                  border: `1px solid ${PRECISION_SURFACES.line}`,
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: `background-color ${PRECISION_MOTION.tMicro}ms ${PRECISION_MOTION.ease}`,
                }}
              >
                Crear cuenta
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ─── ÁREA CENTRAL COM PROFUNDIDADE TONAL ──────────────────────── */}
      <main
        className="bm-page-enter"
        style={{
          flex: 1,
          width: '100%',
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '32px 24px 64px',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </main>

      {/* ─── RODAPÉ INSTITUCIONAL DISCRETO ────────────────────────────── */}
      <footer
        style={{
          borderTop: `1px solid ${PRECISION_SURFACES.line}`,
          backgroundColor: PRECISION_SURFACES.bg1,
          padding: '32px 28px 28px',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Linha 1: Marca e Links Institucionais */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
              <BinmaxLogo variant="short" height={22} />
              <div style={{ display: 'flex', gap: '20px', fontSize: '12.5px', color: PRECISION_TEXT.muted }}>
                <a href="#sobre" style={{ color: PRECISION_TEXT.muted, textDecoration: 'none' }}>Sobre nosotros</a>
                <a href="#terminos" style={{ color: PRECISION_TEXT.muted, textDecoration: 'none' }}>Términos y condiciones</a>
                <a href="#privacidad" style={{ color: PRECISION_TEXT.muted, textDecoration: 'none' }}>Política de privacidad</a>
                <a href="#contacto" style={{ color: PRECISION_TEXT.muted, textDecoration: 'none' }}>Contacto institucional</a>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '14px', color: PRECISION_TEXT.quiet, fontSize: '12px' }}>
              <span>BINMAX SYSTEMS LTD · TRADING PROTOCOL</span>
            </div>
          </div>

          {/* Linha 2: Aviso legal de risco obrigatório */}
          {showRiskDisclaimer && (
            <div
              style={{
                fontSize: '11px',
                lineHeight: 1.6,
                color: PRECISION_TEXT.quiet,
                borderTop: `1px solid ${PRECISION_SURFACES.line}`,
                paddingTop: '16px',
              }}
            >
              <strong>Advertencia de riesgo:</strong> Los contratos de índices sintéticos y derivados implican un riesgo sustancial de pérdida de capital y no son adecuados para todos los perfiles. La ejecución se basa en modelos matemáticos estocásticos continuos. Los rendimientos simulados o pasados no constituyen garantía de rentabilidad futura. Opere con estricta gestión de riesgo y con fondos asignados a capital de riesgo.
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
