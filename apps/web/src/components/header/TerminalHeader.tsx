import { useState, useMemo } from 'react';
import { formatMinor } from '../../lib/money';
import { ASSET_CATALOG, CATEGORIES, type AssetCategory, type AssetOption } from '../../catalog/assets';

export type SymbolOption = AssetOption;
export const AVAILABLE_SYMBOLS = ASSET_CATALOG;

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
}: TerminalHeaderProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [accountType, setAccountType] = useState<'DEMO' | 'REAL'>('DEMO');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todos' | AssetCategory>('Todos');

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
        {/* Branding Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, paddingRight: '8px', borderRight: '1px solid #1c273e' }}>
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
        </div>

        {/* Abas de Ativos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none', minWidth: 0 }}>
          {openTabs.map((sym) => {
            const isActive = sym === activeSymbol;
            const meta = AVAILABLE_SYMBOLS.find((s) => s.symbol === sym);
            const payout = meta?.payout ?? 85;

            return (
              <div
                key={sym}
                onClick={() => onSelectTab(sym)}
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
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#00e676',
                  background: 'rgba(0, 230, 118, 0.12)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                }}>
                  +{payout}%
                </span>
                {openTabs.length > 1 && (
                  <button
                    type="button"
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
              onClick={() => setShowAddMenu((prev) => !prev)}
              style={{
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
              }}
              title="Abrir novo ativo"
            >
              +
            </button>

            {/* Modal / Popover de Seleção de Ativos (36 Ativos Institucionais) */}
            {showAddMenu && (
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontWeight: 700, fontSize: '12px', color: '#fff' }}>
                                  {s.symbol}
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
            )}
          </div>
        </div>
      </div>

      {/* Lado Direito: Latência + Seletor de Conta + Botão DEPOSITAR */}
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
                ? balanceMinor !== null
                  ? formatMinor(balanceMinor)
                  : '$10.000,00'
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

      {/* Modal de Depósito */}
      {showDepositModal && (
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
      )}
    </div>
  );
}
