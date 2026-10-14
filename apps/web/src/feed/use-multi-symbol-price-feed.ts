import { useEffect, useState } from 'react';
import { tradingFeedManager, type TradingFeedManager } from './TradingFeedManager';
import { normalizeSymbol } from '../catalog/assets';

/**
 * MultiSymbolPriceTracker gerencia a inscrição e o ciclo de vida
 * de cotações em tempo real para múltiplos símbolos simultaneamente
 * sobre a conexão WebSocket única do TradingFeedManager.
 */
export class MultiSymbolPriceTracker {
  private unsubs = new Map<string, () => void>();
  private prices: Record<string, number> = {};
  private listeners = new Set<(prices: Record<string, number>) => void>();

  constructor(private manager: TradingFeedManager = tradingFeedManager) {}

  public getPrices(): Record<string, number> {
    return { ...this.prices };
  }

  public setSymbols(symbols: string[]): void {
    const desired = new Set(symbols.filter(Boolean));
    let changed = false;

    // Desinscreve símbolos que não são mais necessários
    for (const [sym, unsub] of this.unsubs.entries()) {
      if (!desired.has(sym)) {
        unsub();
        this.unsubs.delete(sym);
        delete this.prices[sym];
        changed = true;
      }
    }

    // Inscreve novos símbolos
    for (const sym of desired) {
      if (!this.unsubs.has(sym)) {
        // Contratos antigos guardam o símbolo legado (SYNTH_VOL_50), mas o feed envia os
        // ticks com o canônico (VOL_50). Escuta os dois e grava sempre na chave pedida.
        const canonical = normalizeSymbol(sym);
        const aliases = canonical && canonical !== sym ? [canonical, sym] : [sym];

        // Seed inicial a partir do cache do manager (o canônico é o mais recente)
        for (const alias of aliases) {
          const last = this.manager.getLastPrice(alias);
          const num = last !== null ? Number(last) : NaN;
          if (Number.isFinite(num)) {
            this.prices[sym] = num;
            changed = true;
            break;
          }
        }

        const onTick = (tick: { price: string | number }) => {
          const num = Number(tick.price);
          if (Number.isFinite(num) && this.prices[sym] !== num) {
            this.prices[sym] = num;
            this.notify();
          }
        };
        const subs = aliases.map((alias) => this.manager.subscribeSymbol(alias, onTick));
        this.unsubs.set(sym, () => subs.forEach((unsub) => unsub()));
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public subscribe(cb: (prices: Record<string, number>) => void): () => void {
    this.listeners.add(cb);
    cb(this.getPrices());
    return () => {
      this.listeners.delete(cb);
    };
  }

  public destroy(): void {
    for (const unsub of this.unsubs.values()) {
      try {
        unsub();
      } catch {
        /* ignore */
      }
    }
    this.unsubs.clear();
    this.listeners.clear();
    this.prices = {};
  }

  private notify(): void {
    const snapshot = this.getPrices();
    for (const cb of this.listeners) {
      try {
        cb(snapshot);
      } catch (err) {
        console.error('Error notifying price tracker listener:', err);
      }
    }
  }
}

/**
 * Hook React para obter um mapa reativo { [symbol]: price } sempre atualizado
 * em tempo real para todos os símbolos informados.
 */
export function useMultiSymbolPriceFeed(
  symbols: string[],
  manager: TradingFeedManager = tradingFeedManager
): Record<string, number> {
  const [prices, setPrices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const sym of symbols) {
      const p = manager.getLastPrice(sym);
      if (p !== null) {
        const n = Number(p);
        if (Number.isFinite(n)) initial[sym] = n;
      }
    }
    return initial;
  });

  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    manager.connect();
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(symbols);

    const unsub = tracker.subscribe((updated) => {
      setPrices(updated);
    });

    return () => {
      unsub();
      tracker.destroy();
    };
  }, [symbols.slice().sort().join(','), manager]);

  return prices;
}
