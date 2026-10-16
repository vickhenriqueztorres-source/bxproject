import React, { useState } from 'react';
import { ArrowLeft, Gem, ShieldAlert } from 'lucide-react';
import { ArenaRoom, type ArenaRoomProps } from '../arena/ArenaRoom';
import { useArena } from '../arena/use-arena';
import { useRouter } from '../router/RouterContext';
import { useUiLanguage } from '../i18n';
import { BinmaxLogo } from '../components/brand/BinmaxLogo';
import { SidebarDock, type SidebarTab } from '../components/sidebar/SidebarDock';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { LanguageSelectorDropdown } from '../components/header/LanguageSelectorDropdown';
export type ArenaRoomTier = 'bronze' | 'silver' | 'gold';

export interface ArenaPageProps extends ArenaRoomProps {
  /** Permite abrir o modal de trava de saída diretamente em testes determinísticos */
  initialExitLockOpen?: boolean;
  initialPendingExitAction?: 'lobby' | 'traderoom';
}

const VALID_TIERS: ReadonlySet<string> = new Set(['bronze', 'silver', 'gold']);
const ROOM_INDEX_BY_TIER: Record<ArenaRoomTier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
};

export function sanitizeArenaRoomParam(rawRoom: string | null | undefined): ArenaRoomTier | undefined {
  if (!rawRoom || typeof rawRoom !== 'string') return undefined;
  const normalized = rawRoom.trim().toLowerCase();
  if (VALID_TIERS.has(normalized)) {
    return normalized as ArenaRoomTier;
  }
  return undefined;
}

export function ArenaPage(props: ArenaPageProps = {}) {
  const { navigate } = useRouter();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [timeZone, setTimeZone] = useState<'UTC-3' | 'UTC'>('UTC-3');
  const [exitLockOpen, setExitLockOpen] = useState<boolean>(Boolean(props.initialExitLockOpen));
  const [pendingExitAction, setPendingExitAction] = useState<'lobby' | 'traderoom'>(
    props.initialPendingExitAction ?? 'lobby',
  );

  let sanitizedQueryTier: ArenaRoomTier | undefined;
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      const params = new URLSearchParams(window.location.search);
      sanitizedQueryTier = sanitizeArenaRoomParam(params.get('room'));
    }
  } catch {
    sanitizedQueryTier = undefined;
  }

  const effectiveRoomIndex =
    props.initialRoomIndex ??
    (sanitizedQueryTier ? ROOM_INDEX_BY_TIER[sanitizedQueryTier] : undefined);

  const internalArena = useArena({
    initialStage: props.initialStage,
    initialRoomIndex: effectiveRoomIndex,
  });
  const arena = props.arenaOverride ?? internalArena;

  const currentStage = arena.s?.stage ?? 'lobby';
  const isTournamentActive =
    currentStage === 'countdown' ||
    currentStage === 'running' ||
    currentStage === 'settling';

  const handleBackButtonClick = () => {
    if (isTournamentActive) {
      setPendingExitAction('lobby');
      setExitLockOpen(true);
      return;
    }
    if (currentStage === 'ended') {
      arena.leave();
      return;
    }
    navigate('/operar');
  };

  const handleGoToTraderoomClick = () => {
    if (isTournamentActive) {
      setPendingExitAction('traderoom');
      setExitLockOpen(true);
      return;
    }
    navigate('/operar');
  };

  const handleConfirmExit = () => {
    setExitLockOpen(false);
    if (pendingExitAction === 'lobby') {
      arena.leave();
      return;
    }
    arena.leave();
    navigate('/operar');
  };

  const handleSidebarProtectedExitAttempt = (targetRoute: 'operar' | 'tournaments' | 'arena'): boolean => {
    if (isTournamentActive) {
      if (targetRoute === 'operar') {
        setPendingExitAction('traderoom');
      } else {
        setPendingExitAction('lobby');
      }
      setExitLockOpen(true);
      return true;
    }
    if (currentStage === 'ended' && (targetRoute === 'tournaments' || targetRoute === 'arena')) {
      arena.leave();
      return true;
    }
    return false;
  };

  return (
    <div
      data-testid="arena-page-container"
      className="theme-binmax"
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#07090c',
        color: '#f2f4f7',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header da Arena Blitz */}
      <div
        style={{
          height: '48px',
          minHeight: '48px',
          borderBottom: '1px solid #1c232c',
          backgroundColor: '#0f1318',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            data-testid="arena-back-to-tournaments"
            onClick={handleBackButtonClick}
            style={{
              background: 'transparent',
              border: '1px solid #1c232c',
              borderRadius: '8px',
              color: '#8b95a3',
              padding: '5px 10px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <ArrowLeft className="size-3.5" />
            <span>
              {isTournamentActive
                ? isPt
                  ? 'Sair · Torneios'
                  : 'Salir · Torneos'
                : isPt
                  ? 'Voltar · Torneios'
                  : 'Volver · Torneos'}
            </span>
          </button>
          <div
            data-testid="arena-header-logo"
            onClick={handleGoToTraderoomClick}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <BinmaxLogo variant="horizontal" height={22} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LanguageSelectorDropdown />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              color: '#9d4edd',
              backgroundColor: '#1a0b2e',
              border: '1px solid #5a189a',
              borderRadius: '6px',
              padding: '4px 10px',
              fontWeight: 600,
            }}
          >
            <Gem style={{ width: 13, height: 13 }} />
            ARENA BLITZ · 15 MIN
          </span>
          <button
            type="button"
            data-testid="arena-go-to-traderoom"
            onClick={handleGoToTraderoomClick}
            style={{
              backgroundColor: '#161b22',
              border: '1px solid #1c232c',
              borderRadius: '8px',
              color: '#f2f4f7',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sala de Trading →
          </button>
        </div>
      </div>

      {/* Corpo Principal: Menu Lateral Integrado (SidebarDock) + Área Central da Arena */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <aside
          data-testid="arena-sidebar-shell"
          style={{
            width: '68px',
            minWidth: '68px',
            backgroundColor: '#0B0E14',
            borderRight: '1px solid rgba(244, 245, 247, 0.07)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 95,
          }}
        >
          <SidebarDock
            activeTab={sidebarTab}
            onSelectTab={setSidebarTab}
            activeContractsCount={0}
            soundEnabled={soundEnabled}
            onToggleSound={() => setSoundEnabled((prev) => !prev)}
            timeZone={timeZone}
            onToggleTimeZone={() => setTimeZone((prev) => (prev === 'UTC-3' ? 'UTC' : 'UTC-3'))}
            activeRoute="arena"
            onProtectedExitAttempt={handleSidebarProtectedExitAttempt}
          />
        </aside>

        <main
          data-testid="arena-page-main"
          style={{
            flex: '1 1 0%',
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            maxHeight: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ArenaRoom {...props} initialRoomIndex={effectiveRoomIndex} arenaOverride={arena} />
        </main>
      </div>

      {/* Modal de Trava de Segurança durante Torneio Ativo */}
      {exitLockOpen && isTournamentActive && (
        <div
          data-testid="arena-exit-lock-dialog"
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            backgroundColor: 'rgba(7, 9, 12, 0.78)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              backgroundColor: '#101622',
              border: '1px solid rgba(255, 77, 79, 0.35)',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
              color: '#f2f4f7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 77, 79, 0.14)',
                  border: '1px solid rgba(255, 77, 79, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ff4d4f',
                  flexShrink: 0,
                }}
              >
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#f2f4f7' }}>
                  {isPt ? 'Torneio em Andamento' : 'Torneo en Curso'}
                </div>
                <div style={{ fontSize: '11px', color: '#8b95a3', fontFamily: 'var(--font-mono)' }}>
                  {arena.room?.label ?? 'Arena Blitz'} · BLITZ #492
                </div>
              </div>
            </div>

            <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#c9d1d9', margin: '0 0 18px 0' }}>
              {isPt
                ? 'Você está em uma sessão ativa da Arena Blitz. Se abandonar o torneio agora, sua sessão atual será encerrada e seu progresso nesta rodada será perdido.'
                : 'Estás en una sesión activa de Arena Blitz. Si abandonas el torneo ahora, tu sesión actual se cerrará y perderás tu progreso en esta ronda.'}
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                data-testid="arena-exit-lock-stay-btn"
                onClick={() => setExitLockOpen(false)}
                style={{
                  backgroundColor: '#0ecb81',
                  border: '1px solid #0ecb81',
                  borderRadius: '8px',
                  color: '#07130d',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isPt ? 'Continuar no Torneio' : 'Continuar en el Torneo'}
              </button>
              <button
                type="button"
                data-testid="arena-exit-lock-leave-btn"
                onClick={handleConfirmExit}
                style={{
                  backgroundColor: 'rgba(255, 77, 79, 0.12)',
                  border: '1px solid rgba(255, 77, 79, 0.4)',
                  borderRadius: '8px',
                  color: '#ff4d4f',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isPt ? 'Abandonar Torneio' : 'Abandonar Torneo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rodapé Institucional Integrado */}
      <TerminalFooter
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        timeZone={timeZone}
        onToggleTimeZone={() => setTimeZone((prev) => (prev === 'UTC-3' ? 'UTC' : 'UTC-3'))}
        isConnected={true}
        activeContractsCount={0}
      />
    </div>
  );
}

