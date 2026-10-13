import React from 'react';

export type MobileNavTab = 'operar' | 'portfolio' | 'history' | 'tournaments' | 'more';

export interface MobileBottomNavProps {
  activeTab: MobileNavTab;
  onSelectTab: (tab: MobileNavTab) => void;
  activeContractsCount?: number;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  activeContractsCount = 0,
}: MobileBottomNavProps) {
  const tabs = [
    {
      id: 'operar' as const,
      label: 'Operar',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      ),
    },
    {
      id: 'portfolio' as const,
      label: 'Portafolio',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
      badge: activeContractsCount > 0 ? activeContractsCount : undefined,
    },
    {
      id: 'history' as const,
      label: 'Historial',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'tournaments' as const,
      label: 'Torneos',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H7" />
          <path d="M14 14.66V17c0 .55.45 1 1 1h2" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
        </svg>
      ),
    },
    {
      id: 'more' as const,
      label: 'Más',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Navegación inferior móvil"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        background: '#0D0F14',
        borderTop: '1px solid rgba(244, 245, 247, 0.08)',
        height: '60px',
        minHeight: '60px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxSizing: 'border-box',
        width: '100%',
        zIndex: 50,
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            data-testid={`mobile-nav-${tab.id}`}
            aria-label={tab.label}
            onClick={() => onSelectTab(tab.id)}
            style={{
              flex: 1,
              height: '100%',
              minHeight: '44px',
              minWidth: '44px',
              background: 'none',
              border: 'none',
              color: isActive ? '#22C47A' : '#8A92A1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              position: 'relative',
              padding: '6px 0',
              transition: 'color 0.15s ease',
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {tab.icon}
              {tab.badge !== undefined && (
                <span
                  data-testid="mobile-nav-badge"
                  style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-8px',
                    background: '#22C47A',
                    color: '#0D0F14',
                    fontSize: '9px',
                    fontWeight: 800,
                    borderRadius: '8px',
                    padding: '1px 5px',
                    lineHeight: 1,
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.2px',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
