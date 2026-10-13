import { useState, useEffect } from 'react';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';

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
  const isBinmax = isNewTraderoomEnabled();

  useEffect(() => {
    function updateClock() {
      const d = new Date();
      // Formato oficial Print 2: 08 OCT 2024, 02:20:22 (UTC-3)
      const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const day = d.getDate().toString().padStart(2, '0');
      const month = months[d.getMonth()];
      const year = d.getFullYear();
      const timeStr = d.toLocaleTimeString('es-ES', { hour12: false });
      setServerTime(`${day} ${month} ${year}, ${timeStr} (${timeZone})`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [timeZone]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  };

  if (isBinmax) {
    return (
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Status Conectado */}
          <div
            data-testid="footer-network-status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: isConnected ? '#22C55E' : '#FFA75D',
              fontWeight: 600,
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
              {isConnected ? 'Conectado' : 'Reconectando...'}
            </span>
          </div>

          {/* Divisor vertical sutil */}
          <div style={{ width: '1px', height: '12px', background: 'rgba(244, 245, 247, 0.08)' }} />

          {/* Métricas de Trading: Portafolio, Ganancia de hoy, Operaciones abiertas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '10px' }}>
            <span data-testid="footer-metric-portfolio">
              Portafolio total <strong style={{ color: '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{portfolioTotalFormatted}</strong>
            </span>
            <span data-testid="footer-metric-profit">
              Ganancia de hoy <strong style={{ color: todayProfitFormatted.startsWith('-') ? '#E5484D' : todayProfitFormatted.startsWith('+') ? '#22C55E' : '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{todayProfitFormatted}</strong>
            </span>
            <span data-testid="footer-metric-contracts">
              Operaciones abiertas <strong style={{ color: '#DCE1EA', fontFamily: "'Geist Mono', monospace" }}>{activeContractsCount}</strong>
            </span>
          </div>
        </div>

        {/* Lado Direito: Hora Oficial e Fullscreen Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <span style={{ color: '#8A92A1' }}>Hora actual:</span>
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
            title="Pantalla completa"
            aria-label="Alternar pantalla completa"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
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
        <button
          type="button"
          style={{
            background: '#151922',
            color: '#DCE1EA',
            border: '1px solid rgba(244, 245, 247, 0.08)',
            borderRadius: '4px',
            padding: '2px 8px',
            fontSize: '10px',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
          onClick={() => window.open('mailto:soporte@binmaxoption.com')}
        >
          SOPORTE
        </button>
        <span style={{ color: '#8A92A1' }}>
          ⓘ soporte@binmaxoption.com · <strong style={{ color: '#DCE1EA', fontWeight: 600 }}>TODOS LOS DÍAS, A TODA HORA</strong>
        </span>
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
        Operar opciones binarias implica un alto riesgo de pérdida. Opera solo con dinero que puedas permitirte perder.
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
  );
}
