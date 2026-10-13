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
});
