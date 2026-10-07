import { describe, expect, it } from 'vitest';
import { bucketStart, deriveCandle } from './core.mjs';

describe('T07 candle derivation', () => {
  it('[T07-UNIT] groups by UTC epoch and keeps exact decimal prices', () => {
    expect(bucketStart('2026-10-04T23:59:59.999-03:00', '1m'))
      .toBe('2026-10-05T02:59:00.000Z');
    const rows = [
      { sequence: 7, price: '100.000001' },
      { sequence: 8, price: '99.999999' },
      { sequence: 9, price: '100.100000' },
      { sequence: 10, price: '100.000000' },
    ];
    const candle = deriveCandle(rows);
    expect(candle).toEqual({ open: '100.000001', high: '100.100000',
      low: '99.999999', close: '100.000000', volume: 4, first_seq: 7, last_seq: 10 });
    expect(Number(candle.low)).toBeLessThanOrEqual(Number(candle.open));
    expect(Number(candle.high)).toBeGreaterThanOrEqual(Number(candle.close));
    expect(deriveCandle(rows)).toEqual(candle);
  });

  it('[T07-UNIT] handles multi-symbol precisions: Forex (5 dec), Crypto (2 dec), JPY (3 dec)', () => {
    // Forex EURUSD (5 decimals)
    const forexRows = [
      { sequence: 1, price: '1.08540' },
      { sequence: 2, price: '1.08552' },
      { sequence: 3, price: '1.08535' },
    ];
    const forexCandle = deriveCandle(forexRows);
    expect(forexCandle.open).toBe('1.08540');
    expect(forexCandle.high).toBe('1.08552');
    expect(forexCandle.low).toBe('1.08535');
    expect(forexCandle.close).toBe('1.08535');

    // Crypto BTCUSD (2 decimals)
    const cryptoRows = [
      { sequence: 1, price: '64500.00' },
      { sequence: 2, price: '64580.50' },
      { sequence: 3, price: '64490.25' },
      { sequence: 4, price: '64520.10' },
    ];
    const cryptoCandle = deriveCandle(cryptoRows);
    expect(cryptoCandle.open).toBe('64500.00');
    expect(cryptoCandle.high).toBe('64580.50');
    expect(cryptoCandle.low).toBe('64490.25');
    expect(cryptoCandle.close).toBe('64520.10');

    // JPY (3 decimals)
    const jpyRows = [
      { sequence: 1, price: '151.850' },
      { sequence: 2, price: '151.895' },
      { sequence: 3, price: '151.820' },
    ];
    const jpyCandle = deriveCandle(jpyRows);
    expect(jpyCandle.high).toBe('151.895');
    expect(jpyCandle.low).toBe('151.820');
  });

  it('[T07-UNIT] refuses gaps and malformed intervals', () => {
    expect(() => deriveCandle([{ sequence: 1, price: '100.000000' },
      { sequence: 3, price: '101.000000' }])).toThrow('CANDLE_SEQUENCE_GAP');
    expect(() => bucketStart('2026-10-04T00:00:00Z', 'local')).toThrow('INVALID_CANDLE_INTERVAL');
  });
});
