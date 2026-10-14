import { useState, useMemo, useEffect } from 'react';
import { formatMinor } from '../../lib/money';
import { ASSET_CATALOG, CATEGORIES, type AssetCategory, type AssetOption, isSameAsset } from '../../catalog/assets';
import { BinmaxLogo } from '../brand/BinmaxLogo';
import { isNewTraderoomEnabled } from '../../lib/feature-flags';
import { AssetFlagBadge } from './AssetFlagBadge';
import { AccountSelectorDropdown } from './AccountSelectorDropdown';
import { BilleteraModal } from '../../wallet/BilleteraModal';
import { TurboDepositModal } from '../../wallet/TurboDepositModal';
import { AssetCatalogModal } from '../modals/AssetCatalogModal';
import { GridLayoutPopover, type GridLayout } from '../../chart/GridLayoutPopover';
import { LanguageSelectorDropdown } from './LanguageSelectorDropdown';
import type { Contract } from '../../api/client';
import { tradingFeedManager } from '../../feed/TradingFeedManager';
import { AuthService } from '../../auth/auth-service';
import { useUiLanguage } from '../../i18n';

export type SymbolOption = AssetOption;
const AVAILABLE_SYMBOLS = ASSET_CATALOG;

export function getTabDisplayTitle(symbol: string): string {
  const clean = symbol.replace('_OTC', '').toUpperCase();
  if (clean.startsWith('VOL_') || clean.startsWith('SYNTH_VOL_')) {
    const num = clean.replace('SYNTH_VOL_', '').replace('VOL_', '');
    return `Vol ${num}`;
  }
  if (clean === 'CRASH_BOOM_100' || clean === 'SYNTH_CRASH_BOOM_100') {
    return 'Crash 100';
  }
  if (clean === 'XAUUSD') return 'Gold';
  if (clean === 'XAGUSD') return 'Silver';
  if (clean === 'USOIL') return 'WTI Oil';
  if (clean === 'UKOIL') return 'Brent Oil';
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}/${clean.slice(3)}`;
  }
  return symbol;
}

export interface TerminalHeaderProps {
  activeSymbol: string;
  openTabs: string[];
  onSelectTab: (symbol: string) => void;
  onCloseTab: (symbol: string) => void;
  onAddTab: (symbol: string) => void;
  balanceMinor: number | null;
  accountEmail: string;
  isLive: boolean;
  latencyMs?: number;
  onResetDemo: () => void;
  onSignOut: () => void;
  currentLayout?: GridLayout;
  onSelectLayout?: (layout: GridLayout) => void;
  contracts?: Contract[];
  currentPrices?: Record<string, number>;
}

export function TerminalHeader({
  activeSymbol,
  openTabs,
  onSelectTab,
  onCloseTab,
  onAddTab,
  balanceMinor,
  accountEmail,
  isLive,
  latencyMs = 16,
  onResetDemo,
  onSignOut,
  currentLayout = '1x1',
  onSelectLayout,
  contracts = [],
  currentPrices = {},
}: TerminalHeaderProps) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showGridPopover, setShowGridPopover] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [accountType, setAccountType] = useState<'DEMO' | 'REAL'>('DEMO');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | AssetCategory>('Todos');
  const isBinmax = isNewTraderoomEnabled();
  const uiLang = useUiLanguage('es');
  const isPt = uiLang === 'pt';

  const filteredSymbols = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ASSET_CATALOG.filter((item) => {
      const matchCat = selectedCategory === 'Todos' || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="terminal-header-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%' }}>
      {/* Lado Esquerdo: Logo + Abas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        {/* Branding Logo & Layout Grid */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: '10px', borderRight: isBinmax ? '1px solid rgba(244, 245, 247, 0.08)' : '1px solid #1c273e' }}>
          {isBinmax ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
              <BinmaxLogo variant="horizontal" height={28} />
              <button
                type="button"
                data-testid="header-grid-layout-btn"
                title={isPt ? 'Distribuição de grade' : 'Distribución de cuadrícula'}
                onClick={() => setShowGridPopover((prev) => !prev)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: showGridPopover || currentLayout !== '1x1' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(244, 245, 247, 0.04)',
                  border: showGridPopover || currentLayout !== '1x1' ? '1px solid #22C55E' : '1px solid rgba(244, 245, 247, 0.08)',
                  color: showGridPopover || currentLayout !== '1x1' ? '#22C55E' : '#8A92A1',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
                  <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
                  <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
                  <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
                </svg>
              </button>
              <GridLayoutPopover
                isOpen={showGridPopover}
                currentLayout={currentLayout}
                onSelectLayout={(layout) => {
                  onSelectLayout?.(layout);
                  setShowGridPopover(false);
                }}
                onClose={() => setShowGridPopover(false)}
              />
            </div>
          ) : (
            <>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: '16px',
                color: '#051827',
                boxShadow: '0 0 12px rgba(0, 230, 118, 0.35)',
              }}>
                ∿
              </div>
              <span style={{ fontWeight: 800, fontSize: '13px', letterSpacing: '0.8px', color: '#fff' }}>
                BROKER<span style={{ color: '#00e676' }}>PRO</span>
              </span>
            </>
          )}
        </div>

        {/* Abas de Ativos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}>
          {openTabs.map((sym) => {
            const isActive = sym === activeSymbol;
            const meta = AVAILABLE_SYMBOLS.find((s) => s.symbol === sym);
            const payout = meta?.payout ?? 85;
            const displayTitle = getTabDisplayTitle(sym);

            // Análise de Contratos para este símbolo (TODOS os contratos, não apenas o primeiro)
            const activeContracts = contracts?.filter((c) => isSameAsset(c.symbol, sym) && c.status === 'OPEN') ?? [];
            const settledContract = activeContracts.length === 0
              ? contracts?.find((c) => isSameAsset(c.symbol, sym) && c.status === 'SETTLED')
              : null;

            let tradeStatus: 'none' | 'winning' | 'losing' | 'settled' = 'none';
            let secondsLeft = 0;
            let pnlFormatted = '';

            if (activeContracts.length > 0) {
              let netPnlMinor = 0;
              let earliestExpiryMs = Infinity;

              for (const c of activeContracts) {
                const stakeMin = Number(c.stake_minor || 1000);
                const payMin = c.payout_minor
                  ? Number(c.payout_minor)
                  : Math.round(stakeMin * (payout / 100));
                const strike = Number(c.strike_price ?? c.entry_price ?? 0);
                const managerLastPrice = tradingFeedManager.getLastPrice(sym);
                const curP = currentPrices?.[sym] ?? (managerLastPrice !== null && Number.isFinite(Number(managerLastPrice)) ? Number(managerLastPrice) : (c.entry_price ? Number(c.entry_price) : 0));
                const isUp = c.direction === 'UP';
                const isWin = isUp ? curP > strike : curP < strike;
                const isDraw = curP === strike;

                if (isWin) {
                  netPnlMinor += payMin;
                } else if (!isDraw) {
                  netPnlMinor -= stakeMin;
                }

                if (c.expires_at) {
                  const expMs = Date.parse(c.expires_at);
                  if (Number.isFinite(expMs) && expMs < earliestExpiryMs) {
                    earliestExpiryMs = expMs;
                  }
                }
              }

              const targetExpiry = Number.isFinite(earliestExpiryMs) ? earliestExpiryMs : now;
              secondsLeft = Math.max(0, Math.ceil((targetExpiry - now) / 1000));
              tradeStatus = netPnlMinor >= 0 ? 'winning' : 'losing';
              pnlFormatted = netPnlMinor >= 0
                ? `+$${(netPnlMinor / 100).toFixed(2)}`
                : `-$${(Math.abs(netPnlMinor) / 100).toFixed(2)}`;
            } else if (settledContract) {
              tradeStatus = 'settled';
              const isWin = settledContract.result === 'WIN';
              const stakeMin = Number(settledContract.stake_minor || 1000);
              const payMin = settledContract.payout_minor
                ? Number(settledContract.payout_minor)
                : Math.round(stakeMin * (payout / 100));
              pnlFormatted = isWin
                ? `+$${(payMin / 100).toFixed(2)}`
                : `-$${(stakeMin / 100).toFixed(2)}`;
            }

            const hasTrade = tradeStatus !== 'none';
            const isWinning = tradeStatus === 'winning';
            const isLosing = tradeStatus === 'losing';
            const isSettled = tradeStatus === 'settled';
            const isSettledWin = isSettled && settledContract?.result === 'WIN';

            if (isBinmax) {
              const tabBg = isActive ? '#151922' : 'rgba(21, 25, 34, 0.45)';

              const tabBorder = '1px solid rgba(244, 245, 247, 0.06)';

              const tabBorderBottom = isWinning || isSettledWin
                ? '2px solid #22C47A'
                : isLosing || (isSettled && !isSettledWin)
                ? '2px solid #E5484D'
                : (isActive ? '2px solid #22C55E' : '1px solid rgba(244, 245, 247, 0.05)');

              return (
                <div
                  key={sym}
                  onClick={() => onSelectTab(sym)}
                  data-testid={`tab-${sym}`}
                  data-active={isActive ? 'true' : 'false'}
                  data-trade-status={tradeStatus}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    height: '44px',
                    minHeight: '44px',
                    padding: openTabs.length > 1 ? '0 12px 0 20px' : '0 12px',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                    background: tabBg,
                    border: tabBorder,
                    borderBottom: tabBorderBottom,
                    boxShadow: 'none',
                    cursor: 'pointer',
                    color: isActive ? '#F4F5F7' : '#8A92A1',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 700 : 500,
                    transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    flexShrink: 0,
                    userSelect: 'none',
                    position: 'relative',
                  }}
                >
                  {/* Botão de Fechar no Canto Superior Esquerdo (Fidelidade IQ Option) */}
                  {openTabs.length > 1 && (
                    <button
                      type="button"
                      data-testid={`close-tab-${sym}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(sym);
                      }}
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: '5px',
                        background: 'transparent',
                        border: 'none',
                        color: '#8A92A1',
                        cursor: 'pointer',
                        padding: 0,
                        width: '18px',
                        height: '18px',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '13px',
                        lineHeight: 1,
                        transition: 'color 0.14s ease',
                        zIndex: 2,
                      }}
                      title={isPt ? 'Fechar aba' : 'Cerrar pestaña'}
                    >
                      ×
                    </button>
                  )}

                  {/* Ícone: Anel Temporizador Ampliado vs Bandeira vs Flag do Ativo */}
                  {activeContracts.length > 0 ? (
                    <div
                      data-testid={`tab-countdown-ring-${sym}`}
                      style={{
                        position: 'relative',
                        width: '34px',
                        height: '34px',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                      title={`Expiração em ${secondsLeft}s`}
                    >
                      <svg width="34" height="34" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.15)"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke={isWinning ? '#22C47A' : '#E5484D'}
                          strokeWidth="2.5"
                          strokeDasharray={2 * Math.PI * 14}
                          strokeDashoffset={2 * Math.PI * 14 * (1 - Math.min(60, secondsLeft) / 60)}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span
                        style={{
                          position: 'absolute',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#FFFFFF',
                          fontFamily: "'Geist Mono', monospace",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {`:${secondsLeft.toString().padStart(2, '0')}`}
                      </span>
                    </div>
                  ) : isSettled ? (
                    <div
                      data-testid={`tab-settled-flag-${sym}`}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: isSettledWin ? 'rgba(34, 196, 122, 0.2)' : 'rgba(229, 72, 77, 0.2)',
                        border: `1.5px solid ${isSettledWin ? '#22C47A' : '#E5484D'}`,
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                      title="Operação concluída"
                    >
                      🏁
                    </div>
                  ) : (
                    <AssetFlagBadge symbol={sym} size={22} />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: isActive ? '#F4F5F7' : '#DCE1EA', letterSpacing: '-0.01em' }}>
                      {displayTitle}
                    </span>
                    {hasTrade ? (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: isWinning || isSettledWin ? '#22C47A' : '#E5484D',
                          fontFamily: "'Geist Mono', monospace",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {pnlFormatted}
                      </span>
                    ) : (
                      <span style={{ fontSize: '10px', color: '#8A92A1', fontWeight: 600, letterSpacing: '0.02em' }}>Digital</span>
                    )}
                  </div>

                  {!hasTrade && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#22C55E',
                        background: 'rgba(34, 197, 94, 0.12)',
                        border: '1px solid rgba(34, 197, 94, 0.25)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: "'Geist Mono', monospace",
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {`+${payout}%`}
                    </span>
                  )}
                </div>
              );
            }

            return (
              <div
                key={sym}
                onClick={() => onSelectTab(sym)}
                data-testid={`tab-${sym}`}
                data-active={isActive ? 'true' : 'false'}
                data-trade-status={tradeStatus}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  background: isActive ? '#142036' : '#0c1322',
                  border: isActive ? '1px solid #29406b' : '1px solid #141c2c',
                  cursor: 'pointer',
                  color: isActive ? '#fff' : '#8898b8',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span>{sym}</span>
                {hasTrade ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: isWinning || isSettledWin ? '#00e676' : '#ff3d71',
                      fontFamily: 'monospace',
                    }}
                  >
                    {pnlFormatted}
                  </span>
                ) : (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#00e676',
                    background: 'rgba(0, 230, 118, 0.12)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                  }}>
                    {`+${payout}%`}
                  </span>
                )}
                {openTabs.length > 1 && (
                  <button
                    type="button"
                    data-testid={`close-tab-${sym}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(sym);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#657796',
                      cursor: 'pointer',
                      padding: '0 2px',
                      fontSize: '13px',
                      lineHeight: 1,
                    }}
                    title="Fechar aba"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Botão [+] Adicionar Ativo */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              data-testid="add-tab-button"
              onClick={() => setShowAddMenu((prev) => !prev)}
              style={
                isBinmax
                  ? {
                      width: '38px',
                      height: '38px',
                      borderRadius: '6px',
                      background: 'rgba(21, 25, 34, 0.45)',
                      border: '1px solid rgba(244, 245, 247, 0.08)',
                      color: '#8A92A1',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 600,
                      transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                    }
                  : {
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: '#111a2d',
                      border: '1px solid #1f2e4b',
                      color: '#8e9ebc',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 700,
                    }
              }
              title="Abrir novo ativo"
            >
              +
            </button>

            {/* Modal / Popover de Seleção de Ativos (36 Ativos Institucionais) */}
            {showAddMenu && isBinmax ? (
              <AssetCatalogModal
                isOpen={showAddMenu}
                onClose={() => setShowAddMenu(false)}
                onSelectAsset={(sym) => {
                  onAddTab(sym);
                  onSelectTab(sym);
                }}
                openTabs={openTabs}
                activeSymbol={activeSymbol}
              />
            ) : showAddMenu ? (
              <>
                <div
                  onClick={() => setShowAddMenu(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999,
                    background: 'rgba(0, 0, 0, 0.45)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '34px',
                    left: 0,
                    background: '#0d1527',
                    border: '1px solid #26385a',
                    borderRadius: '10px',
                    padding: '12px',
                    width: '380px',
                    maxHeight: '520px',
                    zIndex: 1000,
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  {/* Topo do Explorer: Título e Contador */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#e0e8f6', letterSpacing: '0.5px' }}>
                      CATÁLOGO DE ATIVOS ({ASSET_CATALOG.length})
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddMenu(false)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#6e82a5',
                        fontSize: '16px',
                        cursor: 'pointer',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {/* Campo de Busca em Tempo Real */}
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Buscar por código ou nome (ex: EUR, BTC, Gold, Vol)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        background: '#070c18',
                        border: '1px solid #203150',
                        borderRadius: '6px',
                        padding: '7px 10px',
                        fontSize: '12px',
                        color: '#fff',
                        outline: 'none',
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: '#8e9ebc',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Abas de Categorias */}
                  <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const count =
                        cat === 'Todos'
                          ? ASSET_CATALOG.length
                          : ASSET_CATALOG.filter((a) => a.category === cat).length;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: isSelected ? '#1b2d4b' : '#09101f',
                            border: isSelected ? '1px solid #00e676' : '1px solid #162238',
                            color: isSelected ? '#00e676' : '#7b8dae',
                            fontSize: '10px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cat} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Lista de Ativos Filtrados */}
                  <div
                    style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      paddingRight: '2px',
                    }}
                  >
                    {filteredSymbols.length === 0 ? (
                      <div style={{ padding: '24px 12px', textAlign: 'center', color: '#6e82a5', fontSize: '12px' }}>
                        Nenhum ativo encontrado para &quot;{searchQuery}&quot;.
                      </div>
                    ) : (
                      filteredSymbols.map((s) => {
                        const isOpen = openTabs.includes(s.symbol);
                        const isCurrentActive = activeSymbol === s.symbol;
                        const catColor =
                          s.category === 'Forex'
                            ? '#3d82f6'
                            : s.category === 'Cripto'
                            ? '#f59e0b'
                            : s.category === 'Commodities'
                            ? '#eab308'
                            : '#10b981';

                        return (
                          <div
                            key={s.symbol}
                            onClick={() => {
                              onAddTab(s.symbol);
                              setShowAddMenu(false);
                              setSearchQuery('');
                            }}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: isCurrentActive ? '#162846' : '#080e1c',
                              border: isCurrentActive ? '1px solid #2b4573' : '1px solid #131d31',
                              transition: 'background 0.1s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {isBinmax && <AssetFlagBadge symbol={s.symbol} size={18} />}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>
                                    {isBinmax ? getTabDisplayTitle(s.symbol) : s.symbol}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      padding: '1px 4px',
                                      borderRadius: '3px',
                                      color: catColor,
                                      background: `${catColor}18`,
                                      border: `1px solid ${catColor}33`,
                                    }}
                                  >
                                    {s.category}
                                  </span>
                                </div>
                                <small style={{ color: '#7284a3', fontSize: '10px' }}>{s.name}</small>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isOpen && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    color: '#8496b5',
                                    background: '#121e33',
                                    padding: '2px 5px',
                                    borderRadius: '3px',
                                  }}
                                >
                                  Aberto
                                </span>
                              )}
                              <span
                                style={{
                                  color: '#00e676',
                                  fontWeight: 800,
                                  fontSize: '11px',
                                  background: 'rgba(0, 230, 118, 0.1)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                +{s.payout}%
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Lado Direito: Latência + Seletor de Conta + Botão DEPOSITAR */}
      {isBinmax ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {/* Latência / Feed Status */}
          <div
            data-testid="header-feed-status"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: '#8A92A1',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isLive ? '#22C55E' : '#8A92A1',
                boxShadow: isLive ? '0 0 8px rgba(34, 197, 94, 0.4)' : 'none',
              }}
            />
            <span style={{ fontFamily: isLive ? "'Geist Mono', monospace" : 'inherit' }}>
              {isLive ? `${latencyMs}ms` : 'Reconectando…'}
            </span>
          </div>

          {/* Seletor de Idioma Regional (Fase 2 - 10.2) */}
          <LanguageSelectorDropdown />

          {/* Seletor Institucional de Conta (Avatar + Saldo Tabular Verde + Dropdown) */}
          <AccountSelectorDropdown
            balanceMinor={balanceMinor}
            accountType={accountType}
            onSelectAccountType={setAccountType}
            onResetDemo={onResetDemo}
            accountEmail={accountEmail}
            onSignOut={onSignOut}
          />

          {/* Botão DEPOSITAR Refinado e Delicado (Instrumento de Precisão) */}
          <button
            type="button"
            data-testid="header-deposit-button"
            aria-label="DEPOSITAR"
            onClick={() => setShowDepositModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              height: '38px',
              background: 'linear-gradient(180deg, #22C55E 0%, #1CAE6C 100%)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              color: '#0A0D14',
              padding: '0 16px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '0.2px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(34, 196, 122, 0.2)',
              transition: 'all 100ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = 'brightness(1.05)';
              e.currentTarget.style.boxShadow = '0 3px 12px rgba(34, 196, 122, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = 'none';
              e.currentTarget.style.boxShadow = '0 2px 10px rgba(34, 196, 122, 0.2)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Depositar</span>
          </button>

          {/* Botão Sair */}
          <button
            type="button"
            data-testid="header-signout-button"
            onClick={onSignOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8A92A1',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '6px 10px',
              borderRadius: '6px',
              transition: 'color 0.15s ease',
            }}
            title={isPt ? `Sair (${accountEmail})` : `Cerrar sesión (${accountEmail})`}
          >
            {isPt ? 'Sair' : 'Salir'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {/* Latência / Feed Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#7e90af' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isLive ? '#00e676' : '#ff9100',
                boxShadow: isLive ? '0 0 8px #00e676' : '0 0 6px #ff9100',
              }}
            />
            <span>{latencyMs}ms</span>
          </div>

          {/* Seletor de Idioma Regional (Fase 2 - 10.2) */}
          <LanguageSelectorDropdown />

          {/* Seletor de Conta (Demo vs Real) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#101a2f',
              border: '1px solid #1f2e4b',
              borderRadius: '8px',
              padding: '3px 8px',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    color: accountType === 'DEMO' ? '#ffab00' : '#00e676',
                    letterSpacing: '0.5px',
                  }}
                >
                  {accountType === 'DEMO' ? 'CONTA PRÁTICA' : 'CONTA REAL'}
                </span>
              </div>
              <strong style={{ fontSize: '14px', color: '#fff', fontFamily: "'Space Grotesk', sans-serif" }}>
                {accountType === 'DEMO'
                  ? formatMinor(balanceMinor ?? (AuthService.getSession()?.user?.demoBalanceMinor ?? 1000000))
                  : '$0,00'}
              </strong>
            </div>

            {accountType === 'DEMO' && (
              <button
                type="button"
                onClick={onResetDemo}
                style={{
                  background: 'rgba(255, 171, 0, 0.12)',
                  border: '1px solid rgba(255, 171, 0, 0.3)',
                  color: '#ffab00',
                  borderRadius: '6px',
                  width: '24px',
                  height: '24px',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
                title="Recarregar US$ 10.000 demo"
              >
                ↺
              </button>
            )}
          </div>

          {/* Botão DEPOSITAR Neon */}
          <button
            type="button"
            onClick={() => setShowDepositModal(true)}
            style={{
              background: 'linear-gradient(135deg, #00e676 0%, #00c853 100%)',
              border: 'none',
              color: '#051827',
              padding: '7px 16px',
              borderRadius: '7px',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '0.6px',
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(0, 230, 118, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            DEPOSITAR
          </button>

          {/* Menu do Usuário */}
          <button
            type="button"
            onClick={onSignOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#7b8ea7',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px',
            }}
            title={`Sair (${accountEmail})`}
          >
            Sair
          </button>
        </div>
      )}

      {/* Modal de Depósito Turbo (Sessão 9) */}
      {showDepositModal && (
        isBinmax ? (
          <TurboDepositModal
            isOpen={showDepositModal}
            onClose={() => setShowDepositModal(false)}
            onResetDemo={onResetDemo}
          />
        ) : (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(5, 8, 16, 0.8)',
              backdropFilter: 'blur(4px)',
              display: 'grid',
              placeItems: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowDepositModal(false)}
          >
            <div
              style={{
                background: '#0e172a',
                border: '1px solid #233454',
                borderRadius: '16px',
                padding: '28px',
                width: '90%',
                maxWidth: '420px',
                boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                textAlign: 'center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>💳</div>
              <h2 style={{ fontSize: '20px', margin: '0 0 8px', color: '#fff' }}>Depósito na Plataforma</h2>
              <p style={{ color: '#8898b8', fontSize: '13px', margin: '0 0 20px' }}>
                No ambiente demonstrativo, você pode restabelecer seu saldo de US$ 10.000 instantaneamente ou alternar para a conta demo.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    onResetDemo();
                    setAccountType('DEMO');
                    setShowDepositModal(false);
                  }}
                  style={{
                    background: '#00e676',
                    color: '#051827',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Recarregar Conta Prática (+US$ 10.000)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountType(accountType === 'DEMO' ? 'REAL' : 'DEMO');
                    setShowDepositModal(false);
                  }}
                  style={{
                    background: '#16243d',
                    color: '#d0dff6',
                    border: '1px solid #293d62',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Alternar para {accountType === 'DEMO' ? 'Conta Real ($0,00)' : 'Conta Prática ($10.000)'}
                </button>

                <button
                  type="button"
                  onClick={() => setShowDepositModal(false)}
                  style={{
                    background: 'transparent',
                    color: '#7184a4',
                    border: 'none',
                    padding: '8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    marginTop: '6px',
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
