import { describe, expect, it, vi } from 'vitest';
import { TradingFeedManager } from './TradingFeedManager';

describe('TradingFeedManager Single Connection & De-duplication', () => {
  it('manages reference counting and prevents duplicate subscriptions', () => {
    const manager = new TradingFeedManager('ws://localhost:9999');

    // Chart 1 and Chart 2 subscribe to EURUSD_OTC
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = manager.subscribeSymbol('EURUSD_OTC', cb1);
    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(1);

    const unsub2 = manager.subscribeSymbol('EURUSD_OTC', cb2);
    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(2);

    // Chart 3 subscribes to BTCUSD_OTC
    const cb3 = vi.fn();
    const unsub3 = manager.subscribeSymbol('BTCUSD_OTC', cb3);
    expect(manager.getSubscriberCount('BTCUSD_OTC')).toBe(1);
    expect(manager.getActiveSymbolsCount()).toBe(2);

    // Chart 4 subscribes to SYNTH_VOL_50
    const cb4 = vi.fn();
    const unsub4 = manager.subscribeSymbol('SYNTH_VOL_50', cb4);
    expect(manager.getSubscriberCount('SYNTH_VOL_50')).toBe(1);
    expect(manager.getActiveSymbolsCount()).toBe(3);

    // Unsubscribing Chart 1 from EURUSD retains the subscription for Chart 2
    unsub1();
    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(1);
    expect(manager.getActiveSymbolsCount()).toBe(3);

    // Unsubscribing Chart 2 from EURUSD drops the symbol subscription
    unsub2();
    expect(manager.getSubscriberCount('EURUSD_OTC')).toBe(0);
    expect(manager.getActiveSymbolsCount()).toBe(2);

    unsub3();
    unsub4();
    expect(manager.getActiveSymbolsCount()).toBe(0);
  });
});
