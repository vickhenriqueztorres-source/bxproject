/**
 * Subetapa 01 — Testes do MultiSymbolPriceTracker e useMultiSymbolPriceFeed
 *
 * Valida:
 * 1. Inicialização e seed com getLastPrice
 * 2. Atualização via stream de ticks para múltiplos ativos
 * 3. De-duplicação e preservação de estado
 * 4. Limpeza e remoção de listeners (zero memory leak)
 * 5. Resiliência contra ticks malformados ou NaN
 * 6. Teste de estresse com 36 ativos e rajada de ticks
 */
import { describe, it, expect, vi } from 'vitest';
import { TradingFeedManager } from './TradingFeedManager';
import { MultiSymbolPriceTracker, useMultiSymbolPriceFeed } from './use-multi-symbol-price-feed';

describe('Subetapa 01 — MultiSymbolPriceTracker', () => {
  it('T01-INIT: Inicializa com objeto vazio quando nenhum símbolo é fornecido', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    expect(tracker.getPrices()).toEqual({});
    tracker.destroy();
  });

  it('T02-INITIAL-SEED: Popula cotação imediatamente a partir do cache do manager', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    // Simula cotação existente no manager
    (manager as any).symbolLastPrices.set('EURUSD_OTC', '1.08542');
    (manager as any).symbolLastPrices.set('SYNTH_VOL_50', '500.25');

    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC', 'SYNTH_VOL_50']);

    const prices = tracker.getPrices();
    expect(prices['EURUSD_OTC']).toBe(1.08542);
    expect(prices['SYNTH_VOL_50']).toBe(500.25);
    tracker.destroy();
  });

  it('T03-STREAM-UPDATE: Atualiza cotação reativa assim que um tick chega', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC']);

    const listener = vi.fn();
    tracker.subscribe(listener);

    // Simula chegada de tick via applyTick no manager
    (manager as any).applyTick({
      type: 'tick',
      symbol: 'EURUSD_OTC',
      sequence: 1,
      price: '1.08550',
      ts: new Date().toISOString(),
    });

    const prices = tracker.getPrices();
    expect(prices['EURUSD_OTC']).toBe(1.08550);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ EURUSD_OTC: 1.08550 }));
    tracker.destroy();
  });

  it('T04-MULTI-SYMBOLS: Mantém cotações distintas de múltiplos ativos simultaneamente', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC', 'SYNTH_VOL_50', 'BTCUSD_OTC']);

    (manager as any).applyTick({ type: 'tick', symbol: 'EURUSD_OTC', sequence: 1, price: '1.08550' });
    (manager as any).applyTick({ type: 'tick', symbol: 'SYNTH_VOL_50', sequence: 1, price: '502.10' });
    (manager as any).applyTick({ type: 'tick', symbol: 'BTCUSD_OTC', sequence: 1, price: '65400.00' });

    const prices = tracker.getPrices();
    expect(prices['EURUSD_OTC']).toBe(1.08550);
    expect(prices['SYNTH_VOL_50']).toBe(502.10);
    expect(prices['BTCUSD_OTC']).toBe(65400.00);
    tracker.destroy();
  });

  it('T05-CLEANUP: Desinscreve do símbolo removido e remove do mapa de preços', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC', 'SYNTH_VOL_50']);

    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(1);
    expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(1);

    // Remove EURUSD_OTC
    tracker.setSymbols(['SYNTH_VOL_50']);
    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(0);
    expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(1);

    const prices = tracker.getPrices();
    expect(prices['EURUSD_OTC']).toBeUndefined();

    tracker.destroy();
    expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(0);
  });

  it('T06-DEDUP: Não dispara notificação se o preço recebido for idêntico', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC']);

    const listener = vi.fn();
    tracker.subscribe(listener);
    listener.mockClear();

    (manager as any).applyTick({ type: 'tick', symbol: 'EURUSD_OTC', sequence: 1, price: '1.08550' });
    expect(listener).toHaveBeenCalledTimes(1);

    // Mesmo preço no próximo tick
    (manager as any).applyTick({ type: 'tick', symbol: 'EURUSD_OTC', sequence: 2, price: '1.08550' });
    expect(listener).toHaveBeenCalledTimes(1);

    tracker.destroy();
  });

  it('T07-RESILIENCE: Lida graciosamente com ticks malformados ou NaN', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['EURUSD_OTC']);

    (manager as any).applyTick({ type: 'tick', symbol: 'EURUSD_OTC', sequence: 1, price: 'invalid' });
    (manager as any).applyTick({ type: 'tick', symbol: 'EURUSD_OTC', sequence: 2, price: 'NaN' });

    expect(tracker.getPrices()['EURUSD_OTC']).toBeUndefined();
    tracker.destroy();
  });

  it('T08-STRESS: 36 ativos com rajada de 200 ticks executam com alta performance', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    const symbols = Array.from({ length: 36 }, (_, i) => `ASSET_${i}_OTC`);
    tracker.setSymbols(symbols);

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      const sym = symbols[i % symbols.length];
      (manager as any).applyTick({
        type: 'tick',
        symbol: sym,
        sequence: i + 1,
        price: (100 + i * 0.1).toFixed(2),
      });
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100); // Executa em menos de 100ms
    expect(Object.keys(tracker.getPrices()).length).toBe(36);
    tracker.destroy();
  });

  it('T09-HOOK-EXPORT: Hook useMultiSymbolPriceFeed está exportado como função', () => {
    expect(typeof useMultiSymbolPriceFeed).toBe('function');
  });
});
