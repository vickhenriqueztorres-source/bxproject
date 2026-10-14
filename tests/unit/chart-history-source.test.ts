import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../apps/web/src/auth/oidc', () => ({ isGuestMode: () => true }));
import { getCandles } from '../../apps/web/src/api/client';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('[M-05] history uses the selected feed source', () => {
  it('returns no invented bars or old cached bars when the online REST source fails', async () => {
    vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '0');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unit offline')));
    vi.stubGlobal('sessionStorage', { getItem: () => JSON.stringify({ candles: { NZDUSD_OTC: [
      { time: 1700000000, open: '0.59820', high: '0.59820', low: '0.59820', close: '0.59820', volume: 1 },
    ] } }), setItem: vi.fn(), removeItem: vi.fn() });
    expect(await getCandles('NZDUSD_OTC', '1m', 60)).toEqual([]);
  });
  it('preserves an empty official history instead of generating seed candles', async () => {
    vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '0');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await getCandles('NZDUSD_OTC', '1m', 60)).toEqual([]);
  });
  it('accepts official historical candles when VOL_50 has drifted >25% (e.g. 672.5526) while rejecting cross-asset contamination', async () => {
    vi.stubEnv('VITE_DEMO_OFFLINE_FEED', '0');
    const vol50Bars = [
      { time: 1700000000, open: '675.0000', high: '675.2000', low: '672.1000', close: '672.5526', volume: 42 },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => vol50Bars }));
    expect(await getCandles('VOL_50', '1m', 60)).toEqual(vol50Bars);

    const contaminatedBars = [
      { time: 1700000000, open: '64850.00', high: '64900.00', low: '64800.00', close: '64850.00', volume: 10 },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => contaminatedBars }));
    expect(await getCandles('EURUSD_OTC', '1m', 60)).toEqual([]);
  });
});
