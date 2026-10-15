import React, { useState } from 'react';
import { ArrowLeft, Gem } from 'lucide-react';
import { ArenaRoom, type ArenaRoomProps } from '../arena/ArenaRoom';
import { useRouter } from '../router/RouterContext';
import { useUiLanguage } from '../i18n';
import { BinmaxLogo } from '../components/brand/BinmaxLogo';
import { SidebarDock, type SidebarTab } from '../components/sidebar/SidebarDock';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { LanguageSelectorDropdown } from '../components/header/LanguageSelectorDropdown';
export type ArenaRoomTier = 'bronze' | 'silver' | 'gold';

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

export function ArenaPage(props: ArenaRoomProps = {}) {
  const { navigate } = useRouter();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [timeZone, setTimeZone] = useState<'UTC-3' | 'UTC'>('UTC-3');

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
            onClick={() => navigate('/torneos')}
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
            <span>{isPt ? 'Torneios' : 'Torneos'}</span>
          </button>
          <div
            onClick={() => navigate('/operar')}
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
            onClick={() => navigate('/operar')}
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
          <ArenaRoom {...props} initialRoomIndex={effectiveRoomIndex} />
        </main>
      </div>

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

