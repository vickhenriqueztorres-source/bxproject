import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCandles, type Contract, type Candle } from '../api/client';
import { PriceChart } from './PriceChart';
import { tradingFeedManager } from '../feed/TradingFeedManager';
import type { Tick } from '../feed/protocol';
import { ASSET_CATALOG, type AssetCategory } from '../catalog/assets';

export type GridLayout = '1x1' | '2x1' | '2x2';

export interface MultiChartGridProps {
  activeSymbol: string;
  onActiveSymbolChange: (symbol: string) => void;
  allContracts: Contract[];
  availableSymbols?: string[];
}

const DEFAULT_SYMBOLS = ASSET_CATALOG.map((a) => a.symbol);

interface CellState {
  id: string;
  symbol: string;
}

function GridCell({
  symbol,
  isActive,
  onFocus,
  onSymbolChange,
  contracts,
  availableSymbols,
}: {
  symbol: string;
  isActive: boolean;
  onFocus: () => void;
  onSymbolChange: (newSymbol: string) => void;
  contracts: Contract[];
  availableSymbols: string[];
}) {
  const [tick, setTick] = useState<Tick | null>(null);

  // Subscribe to symbol ticks via single WebSocket manager (De-duplication in browser)
  useEffect(() => {
    tradingFeedManager.connect();
    const unsubscribe = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      setTick(incomingTick);
    });
    return () => {
      unsubscribe();
    };
  }, [symbol]);

  // Fetch candle history for this cell's symbol
  const candlesQuery = useQuery({
    queryKey: ['candles', symbol],
    queryFn: () => getCandles(symbol),
    staleTime: 60_000,
  });

  const relevantContracts = contracts.filter((c) => c.status === 'OPEN' && c.symbol === symbol);

  return (
    <div
      onClick={onFocus}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#070c18',
        boxSizing: 'border-box',
        border: isActive ? '1px solid #00e676' : '1px solid #1a253a',
        borderRadius: '4px',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Cell Header */}
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
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#8597b4', fontSize: '10px' }}>
            {tick ? tick.price : '—'}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <PriceChart
          candles={candlesQuery.data ?? []}
          tick={tick}
          symbol={symbol}
          activeContracts={relevantContracts}
        />
      </div>
    </div>
  );
}

export function MultiChartGrid({
  activeSymbol,
  onActiveSymbolChange,
  allContracts,
  availableSymbols = DEFAULT_SYMBOLS,
}: MultiChartGridProps) {
  const [layout, setLayout] = useState<GridLayout>('1x1');

  // Maintain cell symbols for up to 4 grid viewports with real distinct fallbacks
  const [cells, setCells] = useState<CellState[]>([
    { id: 'cell-0', symbol: activeSymbol },
    { id: 'cell-1', symbol: 'EURUSD_OTC' },
    { id: 'cell-2', symbol: 'BTCUSD_OTC' },
    { id: 'cell-3', symbol: 'XAUUSD_OTC' },
  ]);

  const [activeCellIndex, setActiveCellIndex] = useState(0);

  // Keep cell 0 synchronized if activeSymbol changes from outside (e.g., top tabs)
  useEffect(() => {
    setCells((prev) => {
      const next = [...prev];
      if (next[activeCellIndex]?.symbol !== activeSymbol) {
        next[activeCellIndex] = { ...next[activeCellIndex], symbol: activeSymbol };
      }
      return next;
    });
  }, [activeSymbol, activeCellIndex]);

  const handleCellSymbolChange = (cellIndex: number, newSymbol: string) => {
    setCells((prev) => {
      const next = [...prev];
      next[cellIndex] = { ...next[cellIndex], symbol: newSymbol };
      return next;
    });
    if (cellIndex === activeCellIndex) {
      onActiveSymbolChange(newSymbol);
    }
  };

  const handleFocusCell = (index: number) => {
    setActiveCellIndex(index);
    const sym = cells[index]?.symbol;
    if (sym && sym !== activeSymbol) {
      onActiveSymbolChange(sym);
    }
  };

  const visibleCellsCount = layout === '1x1' ? 1 : layout === '2x1' ? 2 : 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', position: 'relative' }}>
      {/* Grid Layout Switcher Bar */}
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
          </div>
        </div>

        <span style={{ fontSize: '11px', color: '#8597b4' }}>
          Ativo em Foco: <strong style={{ color: '#00e676' }}>{activeSymbol}</strong>
        </span>
      </div>

      {/* Grid Canvas Area */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          padding: '6px',
          boxSizing: 'border-box',
          display: 'grid',
          gap: '6px',
          gridTemplateColumns: layout === '1x1' ? '1fr' : '1fr 1fr',
          gridTemplateRows: layout === '2x2' ? '1fr 1fr' : '1fr',
        }}
      >
        {cells.slice(0, visibleCellsCount).map((cell, index) => (
          <GridCell
            key={cell.id}
            symbol={cell.symbol}
            isActive={index === activeCellIndex}
            onFocus={() => handleFocusCell(index)}
            onSymbolChange={(sym) => handleCellSymbolChange(index, sym)}
            contracts={allContracts}
            availableSymbols={availableSymbols}
          />
        ))}
      </div>
    </div>
  );
}
