import React, { useEffect, useState } from 'react';
import { useRouter } from '../../router/RouterContext';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';
import { useUiLanguage } from '../../i18n';
import {
  IconOperar,
  IconPortafolio,
  IconHistorial,
  IconTorneos,
  IconArena,
  IconAnalisis,
  IconTutoriales,
  IconPromociones,
  IconAjustes,
  IconChevronDouble,
} from './SidebarIcons';
import { TournamentsDrawer } from '../drawer/TournamentsDrawer';
import { TournamentModal } from '../tournaments/TournamentModal';

export type SidebarTab =
  | 'operar'
  | 'portfolio'
  | 'history'
  | 'tournaments'
  | 'news'
  | 'tutorials'
  | 'promotions'
  | 'settings'
  | 'alerts'
  | null;

export interface SidebarDockProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
  activeContractsCount: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  timeZone: 'UTC-3' | 'UTC';
  onToggleTimeZone: () => void;
  historyContent?: React.ReactNode;
  portfolioContent?: React.ReactNode;
  newsContent?: React.ReactNode;
  tournamentsContent?: React.ReactNode;
  activeRoute?: 'trade' | 'arena' | 'tournaments';
  onProtectedExitAttempt?: (target: 'operar' | 'tournaments' | 'arena') => boolean;
}

export function SidebarDock({
  activeTab,
  onSelectTab,
  activeContractsCount,
  soundEnabled,
  onToggleSound,
  timeZone,
  onToggleTimeZone,
  historyContent,
  portfolioContent,
  newsContent,
  tournamentsContent,
  activeRoute,
  onProtectedExitAttempt,
}: SidebarDockProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && activeTab !== null) {
        onSelectTab(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, onSelectTab]);

  const isBinmax = isNewTraderoomEnabled();
  const { navigate, currentPath } = useRouter();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';
  const [isTournamentsModalOpen, setIsTournamentsModalOpen] = useState(false);
  const isArenaActive =
    activeRoute === 'arena' ||
    currentPath === '/arena' ||
    currentPath.startsWith('/arena/') ||
    currentPath === '/sala/arena';
  const isOperarActive = !isArenaActive && (activeTab === null || activeTab === 'operar');

  const toggleTab = (tab: SidebarTab) => {
    onSelectTab(activeTab === tab ? null : tab);
  };

  return (
    <>
      {/* Coluna de Ícones Vertical Fixa (~68px na Binmax, 48px legado) */}
      <div
        className="sidebar-dock-icons"
        data-testid={isBinmax ? 'sidebar-dock-binmax' : 'sidebar-dock-legacy'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isBinmax ? '3px' : '12px',
          width: '100%',
          height: '100%',
          paddingTop: '4px',
          boxSizing: 'border-box',
        }}
      >
        {isBinmax ? (
          <>
            {/* Top Chevron Header (▲▲) */}
            <div
              data-testid="sidebar-top-chevron"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#55657E',
                padding: '2px 0 4px 0',
                cursor: 'pointer',
                userSelect: 'none',
              }}
              title={isPt ? 'Barra de ferramentas' : 'Barra de herramientas'}
            >
              <IconChevronDouble size={14} color="#55657E" />
            </div>

            {/* 1. Operar */}
            <button
              type="button"
              data-testid="sidebar-item-operar"
              className="sidebar-dock-btn"
              onClick={() => {
                if (onProtectedExitAttempt?.('operar')) {
                  return;
                }
                onSelectTab(null);
                if (isArenaActive) {
                  navigate('/operar');
                }
              }}
              style={{
                width: '100%',
                padding: '8px 0 4px',
                background: 'transparent',
                border: 'none',
                color: isOperarActive ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={isPt ? 'Operar no gráfico' : 'Operar en gráfico'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: isOperarActive ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconOperar size={22} color={isOperarActive ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>Operar</span>
            </button>

            {/* 2. Portafolio Total */}
            <button
              type="button"
              data-testid="sidebar-item-portfolio"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('portfolio')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'portfolio' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
              }}
              title={isPt ? 'Portfólio total' : 'Portafolio total'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'portfolio' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconPortafolio size={22} color={activeTab === 'portfolio' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Portfólio' : 'Portafolio'}
              </span>
              {activeContractsCount > 0 && (
                <span
                  data-testid="sidebar-portfolio-badge"
                  style={{
                    position: 'absolute',
                    top: '1px',
                    right: '4px',
                    background: '#22C55E',
                    color: '#0D0F14',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '6px',
                    padding: '1px 5px',
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {activeContractsCount}
                </span>
              )}
            </button>

            {/* 3. Historial de trading */}
            <button
              type="button"
              data-testid="sidebar-item-history"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('history')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'history' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={isPt ? 'Histórico de trading' : 'Historial de trading'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'history' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconHistorial size={22} color={activeTab === 'history' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Histórico' : 'Historial'}
              </span>
            </button>

            {/* 4. Torneos de trading */}
            <button
              type="button"
              data-testid="sidebar-item-tournaments"
              className="sidebar-dock-btn"
              onClick={() => {
                if (onProtectedExitAttempt?.('tournaments')) {
                  return;
                }
                toggleTab('tournaments');
                setIsTournamentsModalOpen(true);
              }}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'tournaments' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={isPt ? 'Torneios de trading' : 'Torneos de trading'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'tournaments' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconTorneos size={22} color={activeTab === 'tournaments' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Torneios' : 'Torneos'}
              </span>
            </button>

            {/* 4b. Arena Blitz (Competição 15min — rota /arena) */}
            <button
              type="button"
              data-testid="sidebar-item-arena"
              className="sidebar-dock-btn"
              onClick={() => {
                if (onProtectedExitAttempt?.('arena')) {
                  return;
                }
                navigate('/arena');
              }}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: isArenaActive ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title="Arena Blitz — 15 min"
              aria-current={isArenaActive ? 'page' : undefined}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: isArenaActive ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconArena size={22} color={isArenaActive ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>Arena</span>
            </button>

            {/* 5. Análisis de mercado */}
            <button
              type="button"
              data-testid="sidebar-item-news"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('news')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'news' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={isPt ? 'Análise de mercado' : 'Análisis de mercado'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'news' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconAnalisis size={22} color={activeTab === 'news' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Análises' : 'Análisis'}
              </span>
            </button>

            {/* 6. Tutoriales en video */}
            <button
              type="button"
              data-testid="sidebar-item-tutorials"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('tutorials')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'tutorials' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              title={isPt ? 'Tutoriais em vídeo' : 'Tutoriales en video'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'tutorials' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconTutoriales size={22} color={activeTab === 'tutorials' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Tutoriais' : 'Tutoriales'}
              </span>
            </button>

            {/* 7. Promociones y bonos */}
            <button
              type="button"
              data-testid="sidebar-item-promotions"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('promotions')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'promotions' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                boxSizing: 'border-box',
              }}
              title={isPt ? 'Promoções e bônus' : 'Promociones y bonos'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'promotions' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconPromociones size={22} color={activeTab === 'promotions' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>
                {isPt ? 'Promoções' : 'Promociones'}
              </span>
            </button>

            {/* Espaçador flexível para empurrar Ajustes para o rodapé */}
            <div style={{ flex: 1, minHeight: '6px' }} />

            {/* 8. Ajustes de la plataforma (Fixo na extremidade inferior) */}
            <button
              type="button"
              data-testid="sidebar-item-settings"
              className="sidebar-dock-btn"
              onClick={() => toggleTab('settings')}
              style={{
                width: '100%',
                padding: '4px 0',
                background: 'transparent',
                border: 'none',
                color: activeTab === 'settings' ? '#F4F5F7' : '#8A92A1',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
                marginBottom: '8px',
              }}
              title={isPt ? 'Ajustes da plataforma' : 'Ajustes de la plataforma'}
            >
              <div style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: activeTab === 'settings' ? '1.5px solid #22C55E' : '1.5px solid transparent',
                transition: 'border-color 100ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}>
                <IconAjustes size={22} color={activeTab === 'settings' ? '#F4F5F7' : 'currentColor'} />
              </div>
              <span style={{ fontSize: '10px', fontWeight: 500, letterSpacing: '0.01em', lineHeight: 1 }}>Ajustes</span>
            </button>
          </>
        ) : (
          <>
            {/* Histórico legado */}
            <button
              type="button"
              onClick={() => toggleTab('history')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'history' ? '#192b4a' : 'transparent',
                border: activeTab === 'history' ? '1px solid #2d4677' : '1px solid transparent',
                color: activeTab === 'history' ? '#00e676' : '#8295b3',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              title="Histórico de Negociações"
            >
              📊
            </button>

            {/* Portfólio legado */}
            <button
              type="button"
              onClick={() => toggleTab('portfolio')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'portfolio' ? '#192b4a' : 'transparent',
                border: activeTab === 'portfolio' ? '1px solid #2d4677' : '1px solid transparent',
                color: activeTab === 'portfolio' ? '#00e676' : '#8295b3',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              title="Posições Abertas"
            >
              💼
              {activeContractsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: '#00e676',
                    color: '#051827',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    padding: '1px 5px',
                    boxShadow: '0 0 6px rgba(0, 230, 118, 0.6)',
                  }}
                >
                  {activeContractsCount}
                </span>
              )}
            </button>

            {/* Alertas legado */}
            <button
              type="button"
              onClick={() => toggleTab('alerts')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'alerts' ? '#192b4a' : 'transparent',
                border: activeTab === 'alerts' ? '1px solid #2d4677' : '1px solid transparent',
                color: activeTab === 'alerts' ? '#00e676' : '#8295b3',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
              }}
              title="Notificações e Alertas"
            >
              🔔
            </button>

            {/* Notícias legado */}
            <button
              type="button"
              onClick={() => toggleTab('news')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'news' ? '#192b4a' : 'transparent',
                border: activeTab === 'news' ? '1px solid #2d4677' : '1px solid transparent',
                color: activeTab === 'news' ? '#00e676' : '#8295b3',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
              }}
              title="Notícias do Mercado"
            >
              📰
            </button>

            <div style={{ flex: 1 }} />

            {/* Configurações legado */}
            <button
              type="button"
              onClick={() => toggleTab('settings')}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: activeTab === 'settings' ? '#192b4a' : 'transparent',
                border: activeTab === 'settings' ? '1px solid #2d4677' : '1px solid transparent',
                color: activeTab === 'settings' ? '#00e676' : '#8295b3',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: '16px',
                transition: 'all 0.15s ease',
                marginBottom: '8px',
              }}
              title="Ajustes do Terminal"
            >
              ⚙️
            </button>
          </>
        )}
      </div>

      {/* Fly-out Drawer Lateral (340px) */}
      {activeTab !== null && !(activeTab === 'tournaments' && isTournamentsModalOpen) && (
        <>
          {/* Backdrop sutil */}
          <div
            onClick={() => onSelectTab(null)}
            style={{
              position: 'fixed',
              top: isBinmax ? '56px' : '48px',
              left: isBinmax ? '72px' : '48px',
              right: 0,
              bottom: 0,
              background: 'rgba(5, 8, 16, 0.45)',
              zIndex: 80,
            }}
          />

          {/* Drawer Panel */}
          <div
            style={{
              position: 'fixed',
              top: isBinmax ? '56px' : '48px',
              left: isBinmax ? '72px' : '48px',
              bottom: 0,
              width: '360px',
              maxWidth: isBinmax ? 'calc(100vw - 72px)' : 'calc(100vw - 48px)',
              background: isBinmax ? '#151922' : '#0d1628',
              borderRight: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1f2e4b',
              boxShadow: '10px 0 30px rgba(0,0,0,0.5)',
              zIndex: 90,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              animation: 'drawerSlideIn 0.18s ease-out',
            }}
          >
            {/* Header do Drawer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1a273e',
                background: isBinmax ? '#151922' : '#0a101d',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!(isBinmax && activeTab === 'portfolio') && (
                  <span style={{ fontSize: '16px' }}>
                    {activeTab === 'history' && '📊'}
                    {activeTab === 'portfolio' && '💼'}
                    {activeTab === 'tournaments' && '🏆'}
                    {activeTab === 'alerts' && '🔔'}
                    {activeTab === 'news' && '📰'}
                    {activeTab === 'tutorials' && '🎓'}
                    {activeTab === 'promotions' && '🎁'}
                    {activeTab === 'settings' && '⚙️'}
                  </span>
                )}
                <strong
                  style={{
                    fontSize: '14px',
                    color: '#fff',
                    letterSpacing: '0.3px',
                    fontFamily: isBinmax ? "'Geist', sans-serif" : 'inherit',
                    fontWeight: 700,
                  }}
                >
                  {activeTab === 'history' && (isBinmax ? (isPt ? 'Histórico de trading' : 'Historial de trading') : 'Histórico de Trades')}
                  {activeTab === 'portfolio' && (isBinmax ? (isPt ? 'Portfólio total' : 'Portafolio total') : 'Posições Ativas')}
                  {activeTab === 'tournaments' && (isPt ? 'Torneios de trading' : 'Torneos de trading')}
                  {activeTab === 'alerts' && (isBinmax ? (isPt ? 'Alertas e suporte' : 'Alertas y soporte') : 'Alertas & Notificações')}
                  {activeTab === 'news' && (isBinmax ? (isPt ? 'Análise de mercado' : 'Análisis de mercado') : 'Notícias do Mercado')}
                  {activeTab === 'tutorials' && (isPt ? 'Tutoriais em vídeo' : 'Tutoriales en video')}
                  {activeTab === 'promotions' && (isPt ? 'Promoções e bônus' : 'Promociones y bonos')}
                  {activeTab === 'settings' && (isBinmax ? (isPt ? 'Ajustes da plataforma' : 'Ajustes de la plataforma') : 'Ajustes da Plataforma')}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isBinmax ? '#8A92A1' : '#7184a4',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '2px 6px',
                  transition: 'color 0.15s ease',
                }}
                title="Cerrar (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div
              className="bm-stealth-scroll sidebar-drawer-scroll"
              data-testid="sidebar-drawer-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: activeTab === 'news' ? 0 : '16px',
                boxSizing: 'border-box',
              }}
            >
              {activeTab === 'history' && (
                <div>{historyContent ?? <p style={{ color: '#7a8ba7' }}>Nenhum trade finalizado.</p>}</div>
              )}

              {activeTab === 'portfolio' && (
                <div>
                  {portfolioContent ?? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#7a8ba7' }}>
                      <div style={{ fontSize: '28px', marginBottom: '8px' }}>💼</div>
                      <p style={{ margin: 0 }}>Nenhuma ordem em andamento no momento.</p>
                      <small style={{ color: '#556682' }}>Abra uma ordem ACIMA ou ABAIXO na boleta.</small>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tournaments' && (
                tournamentsContent ?? <TournamentsDrawer onClose={() => onSelectTab(null)} />
              )}

              {activeTab === 'tutorials' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: 'rgba(21, 25, 34, 0.7)',
                      border: '1px solid rgba(244, 245, 247, 0.08)',
                      borderRadius: '10px',
                      padding: '14px',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: '#F4F5F7', display: 'block', marginBottom: '4px' }}>1. Opciones Digitales: Cómo Operar SUBE y BAJA</strong>
                    <p style={{ fontSize: '12px', color: '#8A92A1', margin: 0, lineHeight: 1.4 }}>
                      Aprende cómo funciona el tiempo de expiración y el payout del 85% en índices sintéticos OTC.
                    </p>
                  </div>
                  <div
                    style={{
                      background: 'rgba(21, 25, 34, 0.7)',
                      border: '1px solid rgba(244, 245, 247, 0.08)',
                      borderRadius: '10px',
                      padding: '14px',
                    }}
                  >
                    <strong style={{ fontSize: '13px', color: '#F4F5F7', display: 'block', marginBottom: '4px' }}>2. Herramientas de Análisis Técnico</strong>
                    <p style={{ fontSize: '12px', color: '#8A92A1', margin: 0, lineHeight: 1.4 }}>
                      Utiliza medias móviles, bandas de Bollinger y retrocesos de Fibonacci para identificar puntos de entrada.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'promotions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(34, 196, 122, 0.1) 0%, rgba(21, 25, 34, 0.8) 100%)',
                      border: '1px solid rgba(34, 196, 122, 0.25)',
                      borderRadius: '10px',
                      padding: '16px',
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#22C47A', letterSpacing: '0.5px' }}>BONO EXCLUSIVO</span>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#F4F5F7', margin: '4px 0 6px' }}>100% en tu Primer Depósito</h3>
                    <p style={{ fontSize: '12px', color: '#8A92A1', margin: '0 0 12px', lineHeight: 1.4 }}>
                      Duplica tu capital operativo al recargar tu cuenta real por primera vez.
                    </p>
                    <div style={{ background: '#0D0F14', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', color: '#DCE1EA', fontFamily: "'Geist Mono', monospace", textAlign: 'center' }}>
                      Código: TURBO100
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'news' && (
                <div>{newsContent}</div>
              )}

              {activeTab === 'alerts' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      background: '#121b2f',
                      border: '1px solid #1d2c49',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '12px', color: '#00e676' }}>● Feed de Mercado Ativo</strong>
                      <span style={{ fontSize: '10px', color: '#687b99' }}>Agora</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a2b3cf' }}>
                      Conexão em tempo real estabelecida com gerador Browniano OTC.
                    </p>
                  </div>

                  <div
                    style={{
                      background: '#121b2f',
                      border: '1px solid #1d2c49',
                      borderRadius: '8px',
                      padding: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '12px', color: '#ffab00' }}>⚡ Alta Liquidez</strong>
                      <span style={{ fontSize: '10px', color: '#687b99' }}>Há 2 min</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a2b3cf' }}>
                      Índice Volatilidad 50 (V-50) con payout de 85% activado.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Som */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#111a2e',
                      borderRadius: '8px',
                      border: '1px solid #1c2b48',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Efeitos Sonoros</div>
                      <small style={{ color: '#7687a4', fontSize: '11px' }}>Sons de abertura e encerramento de ordem</small>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleSound}
                      style={{
                        background: soundEnabled ? '#00e676' : '#223250',
                        color: soundEnabled ? '#051827' : '#8ba0c2',
                        border: 'none',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {soundEnabled ? 'LIGADO' : 'MUDO'}
                    </button>
                  </div>

                  {/* Fuso Horário */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px',
                      background: '#111a2e',
                      borderRadius: '8px',
                      border: '1px solid #1c2b48',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Fuso Horário</div>
                      <small style={{ color: '#7687a4', fontSize: '11px' }}>Exibição do relógio das velas</small>
                    </div>
                    <button
                      type="button"
                      onClick={onToggleTimeZone}
                      style={{
                        background: '#1c2b48',
                        color: '#65d5ff',
                        border: '1px solid #2e446d',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '11px',
                        cursor: 'pointer',
                      }}
                    >
                      {timeZone}
                    </button>
                  </div>

                  {/* Versão */}
                  <div style={{ padding: '12px', color: '#576882', fontSize: '11px', textAlign: 'center' }}>
                    Broker Terminal v1.0.0 (Fase 1 MVP) · CSPRNG OTC Engine
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Modal Popup Oficial de Torneios com Design Fiel às Imagens */}
      <TournamentModal
        isOpen={isTournamentsModalOpen}
        onClose={() => {
          setIsTournamentsModalOpen(false);
          if (activeTab === 'tournaments') {
            onSelectTab(null);
          }
        }}
      />
    </>
  );
}
