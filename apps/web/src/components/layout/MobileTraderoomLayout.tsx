import React, { useState } from 'react';
import { BinmaxLogo } from '../brand/BinmaxLogo';
import { AssetFlagBadge } from '../header/AssetFlagBadge';
import { MobileBottomNav, type MobileNavTab } from '../navigation/MobileBottomNav';
import { BilleteraModal } from '../../wallet/BilleteraModal';
import { TurboDepositModal } from '../../wallet/TurboDepositModal';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';
import { ASSET_CATALOG } from '../../catalog/assets';

export interface MobileTraderoomLayoutProps {
  activeSymbol: string;
  openTabs: string[];
  onSelectTab: (symbol: string) => void;
  balanceMinor: number | null;
  onResetDemo: () => void;
  activeContractsCount?: number;
  chartNode: React.ReactNode;
  orderTicketNode?: React.ReactNode;
  onOpenSidebarMenu?: () => void;
}

export function MobileTraderoomLayout({
  activeSymbol,
  openTabs,
  onSelectTab,
  balanceMinor = 1000000,
  onResetDemo,
  activeContractsCount = 0,
  chartNode,
  orderTicketNode,
  onOpenSidebarMenu,
}: MobileTraderoomLayoutProps) {
  const [activeNavTab, setActiveNavTab] = useState<MobileNavTab>('operar');
  const [showBilletera, setShowBilletera] = useState(false);

  const formattedBalance = balanceMinor !== null && balanceMinor !== undefined
    ? `$${(balanceMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '$0.00';

  return (
    <div
      data-testid="mobile-traderoom-root"
      className="mobile-traderoom-container theme-binmax"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        background: '#0D0F14',
        color: '#F4F5F7',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 1. Header Mobile Superior */}
      <header
        data-testid="mobile-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '52px',
          minHeight: '52px',
          padding: '0 12px',
          background: '#151922',
          borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
          boxSizing: 'border-box',
          zIndex: 40,
        }}
      >
        {/* Esquerda: Menu Hambúrguer + Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            data-testid="mobile-hamburger-btn"
            aria-label="Abrir menú"
            onClick={onOpenSidebarMenu}
            style={{
              background: 'none',
              border: 'none',
              color: '#DCE1EA',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '6px',
              display: 'grid',
              placeItems: 'center',
              lineHeight: 1,
            }}
          >
            ☰
          </button>

          <BinmaxLogo height={22} variant="horizontal" />
        </div>

        {/* Direita: Conta Real / Saldo + Botão Depositar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            data-testid="mobile-account-display"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.04)',
              padding: '4px 8px',
              borderRadius: '20px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: '#2A3142',
                display: 'grid',
                placeItems: 'center',
                fontSize: '11px',
              }}
            >
              👤
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '9px', color: '#8A92A1', lineHeight: 1 }}>Cuenta real ▾</span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: '#22C47A',
                  fontFamily: "'Geist Mono', monospace",
                  lineHeight: 1.2,
                }}
              >
                {formattedBalance}
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="mobile-deposit-btn"
            aria-label="Depositar fondos"
            onClick={() => setShowBilletera(true)}
            style={{
              background: 'rgba(34, 196, 122, 0.15)',
              border: '1px solid #22C47A',
              color: '#22C47A',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>📥</span>
            <span>Depositar</span>
          </button>
        </div>
      </header>

      {/* 2. Barra de Abas de Ativos com Rolagem Horizontal Touch */}
      <div
        data-testid="mobile-asset-tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          background: '#0D0F14',
          borderBottom: '1px solid rgba(244, 245, 247, 0.06)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          flexShrink: 0,
        }}
      >
        {openTabs.map((sym) => {
          const isActive = sym === activeSymbol;
          const meta = ASSET_CATALOG.find((a) => a.symbol === sym);
          const cleanName = sym.replace('_OTC', '');
          const formattedName = cleanName.length === 6 ? `${cleanName.slice(0, 3)}/${cleanName.slice(3)}` : cleanName;

          return (
            <button
              key={sym}
              type="button"
              data-testid={`mobile-tab-${sym}`}
              onClick={() => onSelectTab(sym)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '6px',
                background: isActive ? '#151922' : 'transparent',
                border: isActive ? '1px solid #00e5ff' : '1px solid rgba(244, 245, 247, 0.08)',
                color: isActive ? '#FFFFFF' : '#8A92A1',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <AssetFlagBadge symbol={sym} size={16} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '11px', fontWeight: 700 }}>{formattedName}</span>
                <span style={{ fontSize: '9px', color: '#00e5ff', opacity: 0.85 }}>Turbo</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Área Central: Gráfico de Trading Touch */}
      <main
        data-testid="mobile-chart-area"
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {chartNode}
      </main>

      {/* 4. Boleta de Ordens Inferior em Grade (2 Linhas) — Imagem 2 */}
      {orderTicketNode && (
        <section
          data-testid="mobile-order-ticket-container"
          style={{
            background: '#151922',
            borderTop: '1px solid rgba(244, 245, 247, 0.08)',
            padding: '10px 12px',
            boxSizing: 'border-box',
            flexShrink: 0,
          }}
        >
          {orderTicketNode}
        </section>
      )}

      {/* 5. Barra Inferior de Navegação Móvel (5 Abas) */}
      <MobileBottomNav
        activeTab={activeNavTab}
        onSelectTab={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'portfolio' || tab === 'tournaments') {
            onOpenSidebarMenu?.();
          }
        }}
        activeContractsCount={activeContractsCount}
      />

      {/* Modal de Depósito quando acionado pelo botão Depositar */}
      {showBilletera && (
        isNewTraderoomEnabled() ? (
          <TurboDepositModal
            isOpen={showBilletera}
            onClose={() => setShowBilletera(false)}
            onResetDemo={onResetDemo}
          />
        ) : (
          <BilleteraModal
            isOpen={showBilletera}
            onClose={() => setShowBilletera(false)}
            availableMinor={balanceMinor}
            onResetDemo={onResetDemo}
          />
        )
      )}
    </div>
  );
}
