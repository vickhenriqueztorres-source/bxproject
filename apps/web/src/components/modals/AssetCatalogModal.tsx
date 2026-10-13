import React, { useState, useEffect, useMemo } from 'react';
import { ASSET_CATALOG, type AssetCategory, type AssetOption } from '../../catalog/assets';
import { AssetFlagBadge } from '../header/AssetFlagBadge';

export interface AssetCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (symbol: string) => void;
  openTabs: string[];
  activeSymbol: string;
}

export type CatalogCategoryFilter = 'TODOS' | 'FAVORITOS' | AssetCategory;

export function getAsset24hChange(symbol: string): { text: string; isPositive: boolean } {
  const overrides: Record<string, string> = {
    EURUSD_OTC: '+0.21%',
    GBPJPY_OTC: '-0.32%',
    NZDJPY_OTC: '+0.18%',
    USDJPY_OTC: '-0.11%',
    EURCAD_OTC: '+0.14%',
    AUDUSD_OTC: '+0.36%',
    VOL_10: '+1.34%',
    VOL_25: '+0.98%',
    VOL_50: '+1.24%',
    VOL_75: '-0.52%',
    VOL_100: '+0.26%',
    CRASH_BOOM_100: '+0.72%',
    SYNTH_VOL_50: '+1.24%',
    SYNTH_VOL_75: '-0.52%',
  };
  if (overrides[symbol]) {
    const val = overrides[symbol];
    return { text: val, isPositive: val.startsWith('+') };
  }
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  const pct = ((Math.abs(hash) % 180) / 100).toFixed(2);
  const isPositive = hash % 2 === 0;
  return { text: `${isPositive ? '+' : '-'}${pct}%`, isPositive };
}

export function AssetCatalogModal({
  isOpen,
  onClose,
  onSelectAsset,
  openTabs,
  activeSymbol,
}: AssetCatalogModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategoryFilter>('TODOS');
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('binmax_favorite_assets');
      return raw ? JSON.parse(raw) : ['EURUSD_OTC', 'BTCUSD_OTC', 'SYNTH_VOL_50'];
    } catch {
      return ['EURUSD_OTC', 'BTCUSD_OTC', 'SYNTH_VOL_50'];
    }
  });

  // Salvar favoritos no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('binmax_favorite_assets', JSON.stringify(favorites));
    } catch {
      // Ignora erro de storage restrito
    }
  }, [favorites]);

  const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
    );
  };

  // Fechar com tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredAssets = useMemo(() => {
    return ASSET_CATALOG.filter((a) => {
      // Filtro de categoria
      if (selectedCategory === 'FAVORITOS') {
        if (!favorites.includes(a.symbol)) return false;
      } else if (selectedCategory !== 'TODOS') {
        if (a.category !== selectedCategory) return false;
      }

      // Filtro de busca
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery, favorites]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop com desfoque institucional */}
      <div
        data-testid="asset-catalog-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 8, 16, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 1000,
        }}
      />

      {/* Janela Modal Estilo IQ Option */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Catálogo de Activos de Trading"
        data-testid="asset-catalog-modal"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '740px',
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '85vh',
          background: '#151922',
          border: '1px solid rgba(244, 245, 247, 0.1)',
          borderRadius: '12px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          fontFamily: "'Geist', sans-serif",
          animation: 'fadeInScale 0.18s ease-out',
        }}
      >
        {/* Cabeçalho do Modal */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
            background: '#0D0F14',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚡</span>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#F4F5F7', margin: 0 }}>
                Catálogo de Activos · Opciones Digitales
              </h2>
              <span style={{ fontSize: '11px', color: '#8A92A1' }}>
                Selecciona un activo para operar con vencimiento rápido y payouts de hasta 85%
              </span>
            </div>
          </div>
          <button
            type="button"
            data-testid="btn-close-asset-catalog"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8A92A1',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
            }}
            title="Cerrar (ESC)"
          >
            ✕
          </button>
        </div>

        {/* Barra de Pesquisa e Categorias */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#11151D' }}>
          {/* Campo de Busca */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              data-testid="asset-catalog-search-input"
              placeholder="Buscar activo por par o nombre (ej: EUR, BTC, Vol, Oro, JPY)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0D0F14',
                border: '1px solid rgba(244, 245, 247, 0.12)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#F4F5F7',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#8A92A1',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Abas de Categorias */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '4px' }}>
            {(
              [
                { id: 'TODOS', label: 'Todos' },
                { id: 'FAVORITOS', label: '★ Favoritos' },
                { id: 'Sintéticos', label: 'Índices Sintéticos' },
                { id: 'Forex', label: 'Forex OTC' },
                { id: 'Cripto', label: 'Criptomonedas' },
                { id: 'Commodities', label: 'Materias Primas' },
              ] as const
            ).map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`catalog-tab-${cat.id}`}
                  onClick={() => setSelectedCategory(cat.id)}
                  style={{
                    background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'rgba(244, 245, 247, 0.05)',
                    border: isActive ? '1px solid #00e5ff' : '1px solid rgba(244, 245, 247, 0.08)',
                    color: isActive ? '#00e5ff' : '#8A92A1',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabela de Listagem de Ativos */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 16px' }}>
          {/* Cabeçalho de Colunas Estilo Prancha 2 */}
          <div
            data-testid="asset-catalog-table-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px 6px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#8A92A1',
              borderBottom: '1px solid rgba(244, 245, 247, 0.08)',
              userSelect: 'none',
            }}
          >
            <span>Activo</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <span style={{ width: '70px', textAlign: 'right' }}>Ganancia</span>
              <span style={{ width: '80px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '3px' }}>
                Cambio 24h <span style={{ fontSize: '8px' }}>▼</span>
              </span>
              <span style={{ width: '24px' }}></span>
            </div>
          </div>

          {filteredAssets.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#8A92A1', fontSize: '13px' }}>
              Ningún activo encontrado para &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '8px' }}>
              {filteredAssets.map((asset) => {
                const isOpened = openTabs.includes(asset.symbol);
                const isCurrent = activeSymbol === asset.symbol;
                const isFav = favorites.includes(asset.symbol);
                const change24h = getAsset24hChange(asset.symbol);

                return (
                  <div
                    key={asset.symbol}
                    data-testid={`catalog-row-${asset.symbol}`}
                    onClick={() => {
                      onSelectAsset(asset.symbol);
                      onClose();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: isCurrent ? 'rgba(0, 229, 255, 0.08)' : 'rgba(21, 25, 34, 0.5)',
                      border: isCurrent ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(244, 245, 247, 0.05)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Ativo + Bandeira */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <AssetFlagBadge symbol={asset.symbol} size={22} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13px', color: isCurrent ? '#00e5ff' : '#F4F5F7' }}>
                            {asset.category === 'Sintéticos'
                              ? asset.name
                              : asset.symbol.replace('_OTC', '').replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')}
                          </strong>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              background: 'rgba(0, 229, 255, 0.12)',
                              color: '#00e5ff',
                              padding: '1px 5px',
                              borderRadius: '3px',
                            }}
                          >
                            Digital
                          </span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#8A92A1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asset.subtitle || asset.name}
                        </span>
                      </div>
                    </div>

                    {/* Ganancia + Cambio 24h + Favoritos Estilo Prancha 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                      {/* Ganancia (Payout) */}
                      <strong
                        data-testid={`payout-${asset.symbol}`}
                        style={{
                          fontSize: '13px',
                          color: '#F4F5F7',
                          fontFamily: "'Geist Mono', monospace",
                          width: '70px',
                          textAlign: 'right',
                        }}
                        title={`Retorno: +${asset.payout}%`}
                      >
                        {`+${asset.payout}%`}
                      </strong>

                      {/* Cambio 24h */}
                      <strong
                        data-testid={`change24h-${asset.symbol}`}
                        style={{
                          fontSize: '12px',
                          color: change24h.isPositive ? '#22C47A' : '#F2545B',
                          fontFamily: "'Geist Mono', monospace",
                          width: '80px',
                          textAlign: 'right',
                        }}
                      >
                        {change24h.text}
                      </strong>

                      {/* Botão Favorito */}
                      <button
                        type="button"
                        data-testid={`btn-fav-${asset.symbol}`}
                        onClick={(e) => toggleFavorite(asset.symbol, e)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: isFav ? '#ffab00' : '#455065',
                          fontSize: '16px',
                          cursor: 'pointer',
                          padding: '4px',
                          width: '24px',
                          textAlign: 'center',
                        }}
                        title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        {isFav ? '★' : '☆'}
                      </button>

                      {/* Indicador de Aberto */}
                      {isOpened && (
                        <span
                          style={{
                            fontSize: '9px',
                            color: '#8A92A1',
                            border: '1px solid rgba(244, 245, 247, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          Abierta
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
