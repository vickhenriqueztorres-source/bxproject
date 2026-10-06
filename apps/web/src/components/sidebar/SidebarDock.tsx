import React, { useEffect } from 'react';

export type SidebarTab = 'history' | 'portfolio' | 'alerts' | 'settings' | null;

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

  const toggleTab = (tab: SidebarTab) => {
    onSelectTab(activeTab === tab ? null : tab);
  };

  return (
    <>
      {/* Coluna de Ícones Vertical Fixa (48px) */}
      <div
        className="sidebar-dock-icons"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          width: '100%',
          height: '100%',
          paddingTop: '8px',
          boxSizing: 'border-box',
        }}
      >
        {/* Histórico */}
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

        {/* Portfólio / Posições Abertas */}
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

        {/* Alertas */}
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

        <div style={{ flex: 1 }} />

        {/* Configurações */}
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
      </div>

      {/* Fly-out Drawer Lateral (340px) */}
      {activeTab !== null && (
        <>
          {/* Backdrop sutil */}
          <div
            onClick={() => onSelectTab(null)}
            style={{
              position: 'fixed',
              top: '48px',
              left: '48px',
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
              top: '48px',
              left: '48px',
              bottom: 0,
              width: '360px',
              maxWidth: 'calc(100vw - 48px)',
              background: '#0d1628',
              borderRight: '1px solid #1f2e4b',
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
                borderBottom: '1px solid #1a273e',
                background: '#0a101d',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '16px' }}>
                  {activeTab === 'history' && '📊'}
                  {activeTab === 'portfolio' && '💼'}
                  {activeTab === 'alerts' && '🔔'}
                  {activeTab === 'settings' && '⚙️'}
                </span>
                <strong style={{ fontSize: '14px', color: '#fff', letterSpacing: '0.3px' }}>
                  {activeTab === 'history' && 'Histórico de Trades'}
                  {activeTab === 'portfolio' && 'Posições Ativas'}
                  {activeTab === 'alerts' && 'Alertas & Notificações'}
                  {activeTab === 'settings' && 'Ajustes da Plataforma'}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => onSelectTab(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7184a4',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '2px 6px',
                }}
                title="Fechar (ESC)"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Drawer */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', boxSizing: 'border-box' }}>
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
                      Índice SYNTH_VOL_50 com payout de 85% ativado.
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
    </>
  );
}
