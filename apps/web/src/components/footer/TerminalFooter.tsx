import { useState, useEffect } from 'react';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';
import { useTranslation, useUiLanguage } from '../../i18n';

export interface TerminalFooterProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
  timeZone?: string;
  onToggleTimeZone?: () => void;
  isConnected?: boolean;
  activeContractsCount?: number;
  portfolioTotalFormatted?: string;
  todayProfitFormatted?: string;
}

export function TerminalFooter({
  soundEnabled,
  onToggleSound,
  timeZone = 'UTC-3',
  onToggleTimeZone,
  isConnected = true,
  activeContractsCount = 0,
  portfolioTotalFormatted = '$0.00',
  todayProfitFormatted = '$0.00',
}: TerminalFooterProps) {
  const [serverTime, setServerTime] = useState('');
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const { t, locale, timezone: regionalTz } = useTranslation();
  const isBinmax = isNewTraderoomEnabled();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      // Formato oficial Print 2: 08 OCT 2024, 02:20:22 (UTC-3)
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const day = d.getDate().toString().padStart(2, '0');
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      let timeStr = '';
      try {
        timeStr = new Intl.DateTimeFormat(locale || 'es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: regionalTz || 'America/Sao_Paulo',
        }).format(d);
      } catch {
        timeStr = d.toLocaleTimeString('es-ES', { hour12: false });
      }
      setServerTime(`${day} ${month} ${year}, ${timeStr} (${timeZone})`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [timeZone, locale, regionalTz]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const renderLegalModal = () => {
    if (!legalModal) return null;
    const isTerms = legalModal === 'terms';
    return (
      <div
        data-testid="footer-legal-modal"
        onClick={() => setLegalModal(null)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(11, 14, 20, 0.78)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: '#101622',
            border: '1px solid rgba(244, 245, 247, 0.12)',
            borderRadius: '10px',
            padding: '24px',
            maxWidth: '520px',
            width: '90%',
            color: '#F4F5F7',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#22C55E' }}>
              {isTerms ? t('common.legal.terms_title') : t('common.legal.privacy_title')}
            </h3>
            <button
              type="button"
              onClick={() => setLegalModal(null)}
              style={{ background: 'none', border: 'none', color: '#8A92A1', cursor: 'pointer', fontSize: '16px' }}
            >
              ×
            </button>
          </div>
          <p style={{ fontSize: '12.5px', color: '#DCE1EA', lineHeight: 1.6, marginBottom: '14px' }}>
            {isTerms ? t('common.legal.terms_body') : t('common.legal.privacy_body')}
          </p>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              background: 'rgba(246, 195, 68, 0.12)',
              color: '#F6C344',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {t('common.demo_banner')} · {t('common.risk_warning')}
          </div>
        </div>
      </div>
    );
  };

  if (isBinmax) {
    return (
      <>
        <div
          className="terminal-footer-bar"
          data-testid="terminal-footer-binmax"
          style={{
            height: '28px',
            minHeight: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 12px',
            fontSize: '10px',
            color: '#8A92A1',
            background: '#0D0F14',
            borderTop: '1px solid rgba(244, 245, 247, 0.08)',
            userSelect: 'none',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          {/* Lado Esquerdo: Status da Conexão (Wi-Fi + Conectado) e Métricas da Sessão */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            {/* Status Conectado */}
            <div
              data-testid="footer-network-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: isConnected ? '#22C55E' : '#FFA75D',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isConnected ? '#22C55E' : '#FFA75D',
                  boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.6)' : '0 0 6px rgba(255, 167, 93, 0.6)',
                }}
              />
              {/* Ícone de Wi-Fi */}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span style={{ fontSize: '10px', color: '#DCE1EA' }}>
                {isConnected ? t('common.online') : 'Reconectando...'}
              </span>
            </div>

            {/* Divisor vertical sutil */}
            <div style={{ width: '1px', height: '12px', background: 'rgba(244, 245, 247, 0.08)', flexShrink: 0 }} />

            {/* Métricas de Trading: Portafolio, Ganancia de hoy, Operaciones abiertas */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '10px', flexShrink: 0 }}>
              <span data-testid="footer-metric-portfolio">
                {isPt ? 'Portfólio total' : 'Portafolio total'} <strong style={{ color: '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{portfolioTotalFormatted}</strong>
              </span>
              <span data-testid="footer-metric-profit">
                {isPt ? 'Lucro de hoje' : 'Ganancia de hoy'} <strong style={{ color: todayProfitFormatted.startsWith('-') ? '#E5484D' : todayProfitFormatted.startsWith('+') ? '#22C55E' : '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{todayProfitFormatted}</strong>
              </span>
              <span data-testid="footer-metric-contracts">
                {isPt ? 'Operações abertas' : 'Operaciones abiertas'} <strong style={{ color: '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{activeContractsCount}</strong>
              </span>
            </div>

            {/* Banner Demo & Aviso de Risco + Termos/Privacidade por País (Seções 4.4, 9.2, 16) */}
            <div
              data-testid="footer-compliance-strip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              <span
                data-testid="demo-mode-banner"
                style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  background: 'rgba(246, 195, 68, 0.14)',
                  color: '#F6C344',
                  fontWeight: 700,
                  fontSize: '9.5px',
                }}
              >
                {t('common.demo_banner')}
              </span>
              <span data-testid="footer-risk-warning" style={{ color: '#8A92A1', fontSize: '9.5px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('common.risk_warning')}
              </span>
              <button
                type="button"
                data-testid="footer-terms-btn"
                onClick={() => setLegalModal('terms')}
                style={{ background: 'none', border: 'none', color: '#DCE1EA', fontSize: '9.5px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                {t('common.legal.terms_link')}
              </button>
              <button
                type="button"
                data-testid="footer-privacy-btn"
                onClick={() => setLegalModal('privacy')}
                style={{ background: 'none', border: 'none', color: '#DCE1EA', fontSize: '9.5px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                {t('common.legal.privacy_link')}
              </button>
            </div>
          </div>

          {/* Lado Direito: Hora Oficial e Fullscreen Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Relógio Oficial com ícone */}
            <div
              data-testid="footer-official-clock"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontFamily: "'Geist Mono', monospace",
                color: '#DCE1EA',
                fontSize: '10px',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A92A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span style={{ color: '#8A92A1' }}>{isPt ? 'Hora atual:' : 'Hora actual:'}</span>
              <span>{serverTime || '08 OCT 2024, 02:20:22 (UTC-3)'}</span>
            </div>

            {/* Botão Fullscreen Toggle */}
            <button
              type="button"
              data-testid="footer-fullscreen-btn"
              onClick={toggleFullscreen}
              style={{
                background: 'none',
                border: 'none',
                color: '#8A92A1',
                cursor: 'pointer',
                padding: '2px',
                display: 'grid',
                placeItems: 'center',
                lineHeight: 1,
                transition: 'color 0.15s ease',
              }}
              title={isPt ? 'Tela cheia' : 'Pantalla completa'}
              aria-label={isPt ? 'Alternar tela cheia' : 'Alternar pantalla completa'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>
        {renderLegalModal()}
      </>
    );
  }

  return (
    <>
      <div
        className="terminal-footer-bar"
        data-testid="terminal-footer-legacy"
        style={{
          height: '30px',
          minHeight: '30px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 14px',
          fontSize: '11px',
          color: '#8A92A1',
          background: '#0D0F14',
          borderTop: '1px solid rgba(244, 245, 247, 0.08)',
          userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            data-testid="demo-mode-banner"
            style={{
              background: 'rgba(246, 195, 68, 0.14)',
              color: '#F6C344',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {t('common.demo_banner')}
          </span>
          <button
            type="button"
            onClick={() => setLegalModal('terms')}
            style={{ background: 'none', border: 'none', color: '#DCE1EA', fontSize: '10px', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {t('common.legal.terms_link')}
          </button>
          <button
            type="button"
            onClick={() => setLegalModal('privacy')}
            style={{ background: 'none', border: 'none', color: '#DCE1EA', fontSize: '10px', textDecoration: 'underline', cursor: 'pointer' }}
          >
            {t('common.legal.privacy_link')}
          </button>
        </div>

        <div
          style={{
            color: '#8A92A1',
            fontSize: '10.5px',
            textAlign: 'center',
            maxWidth: '550px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {t('common.risk_warning')}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onToggleSound}
            style={{ background: 'none', border: 'none', color: '#8A92A1', cursor: 'pointer', fontSize: '13px', padding: 0 }}
            title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {soundEnabled ? '🔊' : '🔇'}
          </button>
          <button
            type="button"
            onClick={onToggleTimeZone}
            style={{ background: 'none', border: 'none', color: '#8A92A1', cursor: 'pointer', fontSize: '12px', padding: 0 }}
            title="Configuración de zona horaria"
          >
            ⚙
          </button>
          <span style={{ fontFamily: "'Geist Mono', monospace", color: '#DCE1EA', fontSize: '11px', letterSpacing: '0.02em' }}>
            HORA ACTUAL: {serverTime || '02:00:00 (UTC-3)'}
          </span>
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{ background: 'none', border: 'none', color: '#8A92A1', cursor: 'pointer', fontSize: '13px', padding: 0 }}
            title="Pantalla completa"
          >
            ⛶
          </button>
        </div>
      </div>
      {renderLegalModal()}
    </>
  );
}
