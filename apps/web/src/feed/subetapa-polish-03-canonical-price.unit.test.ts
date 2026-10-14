/**
 * Subetapa 03 — Bug: a gaveta do Portafolio mostrava "+$85.00" em posições perdedoras.
 *
 * Causa: o contrato guarda o símbolo legado ("SYNTH_VOL_50"), mas o feed envia os ticks
 * com o símbolo canônico ("VOL_50"). O MultiSymbolPriceTracker só escutava o símbolo
 * legado, então o preço daquele contrato ficava congelado no valor da inscrição.
 */
import { describe, it, expect } from 'vitest';
import { TradingFeedManager } from './TradingFeedManager';
import { MultiSymbolPriceTracker } from './use-multi-symbol-price-feed';

function tick(manager: TradingFeedManager, symbol: string, sequence: number, price: string) {
  (manager as any).applyTick({ type: 'tick', symbol, sequence, price, ts: new Date().toISOString() });
}

describe('Subetapa 03 — preço do contrato com símbolo legado acompanha o feed canônico', () => {
  it('reprodução do bug de produção: SYNTH_VOL_50 recebe ticks enviados como VOL_50', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    // Preço do momento da inscrição (quando as ordens foram abertas)
    (manager as any).symbolLastPrices.set('SYNTH_VOL_50', '519.6277');

    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['VOL_50', 'SYNTH_VOL_50']);

    // O feed passa a enviar só o símbolo canônico, e o preço cai abaixo dos strikes
    tick(manager, 'VOL_50', 10, '517.2891');

    const prices = tracker.getPrices();
    expect(prices['VOL_50']).toBe(517.2891);
    expect(prices['SYNTH_VOL_50']).toBe(517.2891);
    tracker.destroy();
  });

  it('o semeio inicial prefere o último preço canônico ao preço legado antigo', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    (manager as any).symbolLastPrices.set('SYNTH_VOL_50', '519.6277');
    (manager as any).symbolLastPrices.set('VOL_50', '517.2891');

    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50']);
    expect(tracker.getPrices()['SYNTH_VOL_50']).toBe(517.2891);
    tracker.destroy();
  });

  it('não regride: tick com o símbolo legado continua atualizando a chave legada', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50']);
    tick(manager, 'SYNTH_VOL_50', 1, '502.10');
    expect(tracker.getPrices()['SYNTH_VOL_50']).toBe(502.10);
    tracker.destroy();
  });

  it('isolamento: tick de outro ativo não contamina o preço', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50', 'EURUSD_OTC']);
    tick(manager, 'VOL_100', 1, '1243.60');
    tick(manager, 'EURUSD_OTC', 1, '1.08550');
    const prices = tracker.getPrices();
    expect(prices['SYNTH_VOL_50']).toBeUndefined();
    expect(prices['EURUSD_OTC']).toBe(1.0855);
    tracker.destroy();
  });

  it('caos: ticks inválidos não sobrescrevem o último preço válido', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50']);
    tick(manager, 'VOL_50', 1, '517.29');
    tick(manager, 'VOL_50', 2, 'NaN');
    tick(manager, 'VOL_50', 3, 'invalid');
    expect(tracker.getPrices()['SYNTH_VOL_50']).toBe(517.29);
    tracker.destroy();
  });

  it('sem vazamento: destroy remove as inscrições legada e canônica', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50']);
    tracker.destroy();
    expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(0);
    expect(manager.getSubscriberCount('VOL_50')).toBe(0);
  });

  it('remover o símbolo da lista também remove a inscrição canônica', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    tracker.setSymbols(['SYNTH_VOL_50']);
    tracker.setSymbols([]);
    expect(manager.getSubscriberCount('VOL_50')).toBe(0);
    expect(tracker.getPrices()['SYNTH_VOL_50']).toBeUndefined();
    tracker.destroy();
  });

  it('estresse: 36 ativos x 200 ticks canônicos em menos de 500 ms', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');
    const tracker = new MultiSymbolPriceTracker(manager);
    const legacy = Array.from({ length: 36 }, (_, i) => `SYNTH_VOL_${i + 1}`);
    tracker.setSymbols(legacy);
    const t0 = performance.now();
    for (let s = 1; s <= 200; s++) {
      for (let i = 1; i <= 36; i++) tick(manager, `VOL_${i}`, s, (500 + s / 100).toFixed(2));
    }
    expect(performance.now() - t0).toBeLessThan(500);
    expect(tracker.getPrices()['SYNTH_VOL_7']).toBe(502);
    tracker.destroy();
  });
});
