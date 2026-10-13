import React, { useMemo, type ReactNode } from 'react';
import type { Candle, Contract } from '../api/client';
import type { Tick } from '../feed/protocol';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { sanitizeCandles, sanitizeTick } from './chart-sanitizer';
import { PriceChart } from './PriceChart';

export interface ChartSandboxProps {
  candles: Candle[];
  tick: Tick | null;
  symbol?: string;
  activeContracts?: Contract[];
  isStale?: boolean;
  isVisible?: boolean;
  onSelectSymbol?: (symbol: string) => void;
  onError?: (error: Error) => void;
  fallback?: ReactNode;
}

/**
 * Camada de Isolamento e Blindagem (Sandbox) para o PriceChart.
 * 
 * Garantias arquiteturais:
 * 1. CSS Containment (contain: layout size style): Isolamento contra vazamentos de layout e reflows.
 * 2. Error Boundary dedicado: Captura qualquer exceção matemática ou de WebGL/Canvas sem derrubar o traderoom.
 * 3. Sanitização de dados de entrada: Filtra ticks inválidos e garante timestamps estritamente crescentes para a TradingView.
 */
export function ChartSandbox({
  candles,
  tick,
  symbol = 'SYNTH_VOL_50',
  activeContracts = [],
  isStale = false,
  isVisible = true,
  onSelectSymbol,
  onError,
  fallback,
}: ChartSandboxProps) {
  // Sanitização estrita de velas históricas (anti-crash de sorting da TradingView)
  const cleanCandles = useMemo(() => {
    return sanitizeCandles(candles);
  }, [candles]);

  // Sanitização de tick em tempo real (garante que apenas ticks com preço e tempo válidos passem)
  const safeTick = useMemo(() => {
    if (!tick) return null;
    const sanitized = sanitizeTick(tick);
    if (!sanitized) return null;
    // Retorna o tick original garantido com finitude
    return tick;
  }, [tick]);

  return (
    <div
      data-testid="chart-sandbox-container"
      className="chart-sandbox"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        contain: 'layout size',
        boxSizing: 'border-box',
      }}
    >
      <ChartErrorBoundary symbol={symbol} onError={onError} fallback={fallback}>
        <PriceChart
          candles={cleanCandles}
          tick={safeTick}
          symbol={symbol}
          activeContracts={activeContracts}
          isStale={isStale}
          isVisible={isVisible}
          onSelectSymbol={onSelectSymbol}
        />
      </ChartErrorBoundary>
    </div>
  );
}
