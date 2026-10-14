import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCandles, type Contract, type Candle } from '../api/client';
import { ChartSandbox } from './ChartSandbox';
import { StalenessOverlay } from './StalenessOverlay';
import { ReconnectingOverlay } from './ReconnectingOverlay';
import { useVisibilityPause } from './useVisibilityPause';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import type { Tick } from '../feed/protocol';
import { ASSET_CATALOG, type AssetCategory, isSameAsset } from '../catalog/assets';
import { isNewTraderoomEnabled } from '../lib/feature-flags';
import { OrderTicket } from '../trade/OrderTicket';

import { MAX_CHARTS } from './constants';
export { MAX_CHARTS };

export type GridLayout = '1x1' | '2x1' | '2x2' | '3x2';

export interface MultiChartGridProps {
  activeSymbol: string;
  onActiveSymbolChange: (symbol: string) => void;
  allContracts: Contract[];
  availableSymbols?: string[];
  layout?: GridLayout;
  onLayoutChange?: (layout: GridLayout) => void;
  openTabs?: string[];
  availableMinor?: number | null;
  soundEnabled?: boolean;
  onChanged?: () => void;
}

const DEFAULT_SYMBOLS = ASSET_CATALOG.map((a) => a.symbol);
const EMPTY_CANDLES: Candle[] = [];

interface CellState {
  id: string;
  symbol: string;
}

const GridCell = React.memo(function GridCell({
  symbol,
  isActive,
  onFocus,
  onSymbolChange,
  contracts,
  availableSymbols,
  onTickUpdate,
  showHeader = true,
  availableMinor,
  soundEnabled,
  onChanged,
  showCellTicket = false,
}: {
  symbol: string;
  isActive: boolean;
  onFocus: () => void;
  onSymbolChange: (newSymbol: string) => void;
  contracts: Contract[];
  availableSymbols: string[];
  onTickUpdate?: (symbol: string, eventTime: number) => void;
  showHeader?: boolean;
  availableMinor?: number | null;
  soundEnabled?: boolean;
  onChanged?: () => void;
  showCellTicket?: boolean;
}) {
  const isBinmax = isNewTraderoomEnabled();
  const cellRef = useRef<HTMLDivElement>(null);
  const isVisible = useVisibilityPause(cellRef);
  const [tick, setTick] = useState<Tick | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [tickAgeMs, setTickAgeMs] = useState(0);

  // Subscribe to symbol ticks & per-symbol staleness via single WebSocket manager
  useEffect(() => {
    tradingFeedManager.connect();
    const unsubscribeTick = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      setTick(incomingTick);
      if (onTickUpdate) {
        onTickUpdate(symbol, incomingTick.event_time ?? Date.now());
      }
    });
    const unsubscribeStale = tradingFeedManager.onSymbolStaleness(symbol, (stale, age) => {
      setIsStale(stale);
      setTickAgeMs(age);
    });
    return () => {
      unsubscribeTick();
      unsubscribeStale();
      setTick(null);
      setIsStale(false);
    };
  }, [symbol]);

  // Fetch candle history for this cell's symbol
  const candlesQuery = useQuery({
    queryKey: ['candles', symbol],
    queryFn: () => getCandles(symbol),
    staleTime: 60_000,
  });

  const relevantContracts = useMemo(
    () => contracts.filter((c) => c.status === 'OPEN' && isSameAsset(c.symbol, symbol)),
    [contracts, symbol]
  );

  return (
    <div
      ref={cellRef}
      onClick={onFocus}
      data-testid={`grid-cell-${symbol}`}
      data-cell-symbol={symbol}
      data-active={isActive ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: isBinmax ? '#0D0F14' : '#070c18',
        boxSizing: 'border-box',
        border: isBinmax
          ? (showCellTicket ? (isActive ? '1px solid #22C55E' : '1px solid rgba(244, 245, 247, 0.08)') : 'none')
          : (isActive ? '1px solid #00e676' : '1px solid #1a253a'),
        borderRadius: isBinmax ? '6px' : '4px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Cell Header */}
      {showHeader && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 8px',
            background: isActive ? '#0d1829' : '#0a101f',
            borderBottom: '1px solid #1a253a',
            fontSize: '11px',
            height: '32px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={symbol}
              onChange={(e) => {
                e.stopPropagation();
                onSymbolChange(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#131e33',
                border: '1px solid #243555',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '3px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {(['Sintéticos', 'Forex', 'Cripto', 'Commodities'] as AssetCategory[]).map((cat) => {
                const catAssets = ASSET_CATALOG.filter(
                  (a) => a.category === cat && (!availableSymbols || availableSymbols.length === 0 || availableSymbols.includes(a.symbol))
                );
                if (catAssets.length === 0) return null;
                return (
                  <optgroup key={cat} label={cat} style={{ background: '#0a101f', color: '#8898b8' }}>
                    {catAssets.map((a) => (
                      <option key={a.symbol} value={a.symbol} style={{ background: '#131e33', color: '#fff' }}>
                        {a.symbol} (+{a.payout}%)
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>

            {isActive && (
              <span
                style={{
                  fontSize: '9px',
                  background: 'rgba(0, 230, 118, 0.2)',
                  color: '#00e676',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontWeight: 700,
                }}
              >
                ATIVO
              </span>
            )}
            {isStale && (
              <span
                style={{
                  fontSize: '9px',
                  background: 'rgba(239, 68, 68, 0.25)',
                  color: '#ff6b6b',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  fontWeight: 800,
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                }}
              >
                ⚠️ COTAÇÃO CONGELADA
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                color: (tick?.latency_ms ?? 0) > 200 ? '#ffab00' : '#4ade80',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1px 5px',
                borderRadius: '3px',
              }}
              title="Latência estimada (Monotonic Arrival - Event Time)"
            >
              ⚡ {tick?.latency_ms ?? 0}ms
            </span>
            <span style={{ color: isStale ? '#ff6b6b' : '#8597b4', fontSize: '10px', fontWeight: isStale ? 700 : 400 }}>
              {tick ? tick.price : '—'} {isStale && '(stale)'}
            </span>
          </div>
        </div>
      )}

      {/* Chart Canvas Area + Cell Order Ticket */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', position: 'relative' }}>
        <div style={{ flex: 1, height: '100%', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <ReconnectingOverlay isReconnecting={isStale} symbol={symbol} />
          <StalenessOverlay isStale={isStale} symbol={symbol} tickAgeMs={tickAgeMs} />
          <ChartSandbox
            candles={candlesQuery.data ?? EMPTY_CANDLES}
            tick={tick}
            symbol={symbol}
            activeContracts={relevantContracts}
            isStale={isStale}
            isVisible={isVisible}
            onSelectSymbol={onSymbolChange}
          />
        </div>

        {/* Boleta Individual Integrada por Célula em Multi-Gráficos */}
        {showCellTicket && isBinmax && (
          <div
            className="cell-order-ticket-container bm-stealth-scroll"
            data-testid={`cell-order-ticket-${symbol}`}
            style={{
              width: '144px',
              minWidth: '144px',
              maxWidth: '144px',
              borderLeft: '1px solid rgba(244, 245, 247, 0.08)',
              background: '#101622',
              padding: '4px 3px',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <OrderTicket
              symbol={symbol}
              paused={false}
              stale={isStale}
              availableMinor={availableMinor ?? null}
              soundEnabled={soundEnabled}
              onChanged={onChanged ?? (() => {})}
              isCompact={true}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export function MultiChartGrid({
  activeSymbol,
  onActiveSymbolChange,
  allContracts,
  availableSymbols = DEFAULT_SYMBOLS,
  layout: propLayout,
  onLayoutChange,
  openTabs,
  availableMinor,
  soundEnabled,
  onChanged,
}: MultiChartGridProps) {
  const [internalLayout, setInternalLayout] = useState<GridLayout>('1x1');
  const layout = propLayout ?? internalLayout;
  const setLayout = useCallback(
    (l: GridLayout) => {
      setInternalLayout(l);
      onLayoutChange?.(l);
    },
    [onLayoutChange]
  );

  // Maintain cell symbols for up to 6 grid viewports (MAX_CHARTS) with distinct fallbacks
  const [cells, setCells] = useState<CellState[]>(() => {
    if (openTabs && openTabs.length > 0) {
      const distinct = DEFAULT_SYMBOLS.filter((s) => !openTabs.includes(s));
      return Array.from({ length: MAX_CHARTS }, (_, i) => ({
        id: `cell-${i}`,
        symbol: i < openTabs.length ? openTabs[i] : distinct[i - openTabs.length] || 'EURUSD_OTC',
      }));
    }
    return [
      { id: 'cell-0', symbol: activeSymbol },
      { id: 'cell-1', symbol: 'EURUSD_OTC' },
      { id: 'cell-2', symbol: 'BTCUSD_OTC' },
      { id: 'cell-3', symbol: 'XAUUSD_OTC' },
      { id: 'cell-4', symbol: 'ETHUSD_OTC' },
      { id: 'cell-5', symbol: 'SOLUSD_OTC' },
    ];
  });

  const [activeCellIndex, setActiveCellIndex] = useState(() => {
    if (openTabs && openTabs.length > 0) {
      const idx = openTabs.indexOf(activeSymbol);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  });
  const [maxSkewMs, setMaxSkewMs] = useState(0);
  const cellEventTimes = useRef(new Map<string, number>());

  const visibleCellsCount = Math.min(layout === '1x1' ? 1 : layout === '2x1' ? 2 : layout === '2x2' ? 4 : 6, MAX_CHARTS);

  // Sincroniza células dinamicamente quando openTabs ou activeSymbol mudam
  useEffect(() => {
    if (layout === '1x1') {
      // No modo 1x1, a célula 0 espelha rigorosamente o activeSymbol
      setCells((prev) => {
        if (prev[0]?.symbol === activeSymbol) return prev;
        const next = [...prev];
        next[0] = { ...next[0], symbol: activeSymbol };
        return next;
      });
      setActiveCellIndex(0);
      return;
    }

    // Para layouts multi-gráfico (2x1, 2x2, 3x2)
    setCells((prev) => {
      const next = [...prev];
      const visibleCount = visibleCellsCount;

      // 1. Se openTabs estiver definido, preenche as células a partir de openTabs
      if (openTabs && openTabs.length > 0) {
        const distinct = availableSymbols.filter((s) => !openTabs.includes(s));
        for (let i = 0; i < MAX_CHARTS; i++) {
          const sym = i < openTabs.length ? openTabs[i] : distinct[i - openTabs.length] || 'EURUSD_OTC';
          next[i] = { id: `cell-${i}`, symbol: sym };
        }
      }

      // 2. Garante que activeSymbol está presente nas células visíveis
      const visibleSymbols = next.slice(0, visibleCount).map((c) => c.symbol);
      const existingVisibleIndex = visibleSymbols.indexOf(activeSymbol);

      if (existingVisibleIndex >= 0) {
        // Já está visível em uma célula: apenas foca ela
        setActiveCellIndex(existingVisibleIndex);
      } else {
        // Não está visível nas células da grade: coloca o activeSymbol na célula ativa
        const targetIdx = activeCellIndex < visibleCount ? activeCellIndex : 0;
        next[targetIdx] = { ...next[targetIdx], symbol: activeSymbol };
        setActiveCellIndex(targetIdx);
      }

      return next;
    });
  }, [layout, activeSymbol, openTabs, availableSymbols, visibleCellsCount]);

  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const visibleCellsCountRef = useRef(visibleCellsCount);
  visibleCellsCountRef.current = visibleCellsCount;
  const isBinmax = isNewTraderoomEnabled();
  const isBinmaxRef = useRef(isBinmax);
  isBinmaxRef.current = isBinmax;

  const handleCellTickUpdate = useCallback((sym: string, eventTime: number) => {
    cellEventTimes.current.set(sym, eventTime);
    if (isBinmaxRef.current || visibleCellsCountRef.current <= 1) return;
    const visibleSyms = cellsRef.current.slice(0, visibleCellsCountRef.current).map((c) => c.symbol);
    if (visibleSyms.length > 1) {
      let minT = Infinity;
      let maxT = -Infinity;
      for (const s of visibleSyms) {
        const t = cellEventTimes.current.get(s);
        if (t) {
          if (t < minT) minT = t;
          if (t > maxT) maxT = t;
        }
      }
      if (minT !== Infinity && maxT !== -Infinity) {
        setMaxSkewMs(Math.max(0, maxT - minT));
      }
    }
  }, []);

  const noopFocus = useCallback(() => {}, []);

  const handleCellSymbolChange = useCallback((cellIndex: number, newSymbol: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[cellIndex] = { ...next[cellIndex], symbol: newSymbol };
      return next;
    });
    if (cellIndex === activeCellIndex) {
      onActiveSymbolChange(newSymbol);
    }
  }, [activeCellIndex, onActiveSymbolChange]);

  const handleFocusCell = useCallback((index: number) => {
    setActiveCellIndex(index);
    const sym = cells[index]?.symbol;
    if (sym && sym !== activeSymbol) {
      onActiveSymbolChange(sym);
    }
  }, [cells, activeSymbol, onActiveSymbolChange]);

  return (
    <div
      data-testid="multi-chart-grid"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, width: '100%', height: '100%', position: 'relative' }}
    >
      {/* Grid Layout Switcher Bar (Removido completamente no modo Binmax / Turbo Prata) */}
      {!isBinmax && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 12px',
            background: '#070c18',
            borderBottom: '1px solid #162035',
            height: '34px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#687896', fontWeight: 600 }}>Grade de Gráficos:</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setLayout('1x1')}
                style={{
                  background: layout === '1x1' ? '#1c2d4a' : '#0e1626',
                  border: layout === '1x1' ? '1px solid #00e676' : '1px solid #243555',
                  color: layout === '1x1' ? '#00e676' : '#8597b4',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="1 Gráfico (Full)"
              >
                [ 1 ]
              </button>
              <button
                type="button"
                onClick={() => setLayout('2x1')}
                style={{
                  background: layout === '2x1' ? '#1c2d4a' : '#0e1626',
                  border: layout === '2x1' ? '1px solid #00e676' : '1px solid #243555',
                  color: layout === '2x1' ? '#00e676' : '#8597b4',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="2 Gráficos (Split Screen)"
              >
                [ 2 ]
              </button>
              <button
                type="button"
                onClick={() => setLayout('2x2')}
                style={{
                  background: layout === '2x2' ? '#1c2d4a' : '#0e1626',
                  border: layout === '2x2' ? '1px solid #00e676' : '1px solid #243555',
                  color: layout === '2x2' ? '#00e676' : '#8597b4',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="4 Gráficos (Grade 2x2)"
              >
                [ 4 ]
              </button>
              <button
                type="button"
                onClick={() => setLayout('3x2')}
                style={{
                  background: layout === '3x2' ? '#1c2d4a' : '#0e1626',
                  border: layout === '3x2' ? '1px solid #00e676' : '1px solid #243555',
                  color: layout === '3x2' ? '#00e676' : '#8597b4',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                title="6 Gráficos (Grade 3x2 - Limite Institucional Máximo)"
              >
                [ 6 ]
              </button>
            </div>

            {layout === '3x2' && (
              <span
                style={{
                  fontSize: '10px',
                  color: '#00e676',
                  background: 'rgba(0, 230, 118, 0.12)',
                  border: '1px solid rgba(0, 230, 118, 0.3)',
                  borderRadius: '3px',
                  padding: '2px 6px',
                  fontWeight: 600,
                }}
                title="Máximo de 6 gráficos simultâneos para manter fluidez e estabilidade"
              >
                🛡️ Limite Máximo (6)
              </span>
            )}
          </div>

          {/* Indicador de Sincronização Cross-Asset entre os Gráficos Visíveis */}
          {visibleCellsCount > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: maxSkewMs > 2000 ? 'rgba(239, 68, 68, 0.2)' : maxSkewMs > 1000 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  color: maxSkewMs > 2000 ? '#ef4444' : maxSkewMs > 1000 ? '#f59e0b' : '#10b981',
                  border: `1px solid ${maxSkewMs > 2000 ? 'rgba(239, 68, 68, 0.4)' : maxSkewMs > 1000 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                }}
                title="Diferença máxima de tempo de evento entre os gráficos visíveis"
              >
                {maxSkewMs > 2000 ? `🔴 DESSINCRONIZADO (Δ ${maxSkewMs}ms)` : maxSkewMs > 1000 ? `🟡 SKEW LEVE (Δ ${maxSkewMs}ms)` : `🟢 SINCRONIZADO (Δ ${maxSkewMs}ms)`}
              </span>
            </div>
          )}

          <span style={{ fontSize: '11px', color: '#8597b4' }}>
            Ativo em Foco: <strong style={{ color: '#00e676' }}>{activeSymbol}</strong>
          </span>
        </div>
      )}

      {/* Grid Canvas Area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: isBinmax && layout === '1x1' ? '0px' : '6px',
          boxSizing: 'border-box',
          display: 'grid',
          gap: isBinmax && layout === '1x1' ? '0px' : '6px',
          gridTemplateColumns: layout === '1x1' ? '1fr' : layout === '3x2' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
          gridTemplateRows: layout === '1x1' ? '1fr' : layout === '2x1' ? '1fr' : 'repeat(2, 1fr)',
        }}
      >
        {layout === '1x1' ? (
          <GridCell
            key="cell-0"
            symbol={activeSymbol}
            isActive={true}
            onFocus={noopFocus}
            onSymbolChange={onActiveSymbolChange}
            contracts={allContracts}
            availableSymbols={availableSymbols}
            onTickUpdate={handleCellTickUpdate}
            showHeader={!isBinmax}
            availableMinor={availableMinor}
            soundEnabled={soundEnabled}
            onChanged={onChanged}
            showCellTicket={false}
          />
        ) : (
          cells.slice(0, visibleCellsCount).map((cell, index) => (
            <GridCell
              key={cell.id}
              symbol={cell.symbol}
              isActive={index === activeCellIndex}
              onFocus={() => handleFocusCell(index)}
              onSymbolChange={(sym) => handleCellSymbolChange(index, sym)}
              contracts={allContracts}
              availableSymbols={availableSymbols}
              onTickUpdate={handleCellTickUpdate}
              showHeader={!isBinmax}
              availableMinor={availableMinor}
              soundEnabled={soundEnabled}
              onChanged={onChanged}
              showCellTicket={true}
            />
          ))
        )}
      </div>
    </div>
  );
}
