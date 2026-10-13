import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getWallet, openContract } from '../../apps/web/src/api/client';
import { OpenContractSchema } from '../../packages/shared/src/types';

// UNITÁRIO: cliente/schema reais; auth/fetch doubles, sem DB/ledger/HTTP real.
// AC-E1-1: dado handlers locais v1, quando carteira/abertura, então rota oficial,
// payload strict, chave preservada e Receipt exclusivamente do envelope server.
// AC-E1-2: dado 201 malformado, quando abertura, então ApiError 502, nunca sucesso.
// Fixtures: routes/wallet.ts, routes/contracts.ts e services/contract-service.ts.
vi.mock('../../apps/web/src/auth/oidc', () => ({
  isGuestMode: () => false, accessToken: async () => 'unit-auth-double',
  signIn: vi.fn(), userManager: { signinSilent: vi.fn() },
}));
const key = 'unit-e1-intent';
const receipt = { id: '12345678-1234-4234-8234-123456789012', status: 'OPEN',
  expires_at: '2026-10-09T12:01:00.000Z' };
const contract = { ...receipt, user_id: 'unit-user', symbol: 'SYNTH_VOL_50',
  direction: 'UP', stake_minor: 101, payout_minor: null, entry_price: '500.000000',
  opened_at: '2026-10-09T12:00:00.000Z', idempotency_key: key };
const wallet = { user_id: 'unit-user', currency: 'USD', available_minor: 32101, reserved_minor: 101 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const transport = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
  async (url, init) => {
    if (url === '/api/v1/wallet' && (init?.method ?? 'GET') === 'GET') return json(wallet);
    if (url === '/api/v1/contracts' && init?.method === 'POST')
      return json({ success: true, is_duplicate: false, contract }, 201);
    return json({ error: 'NOT_FOUND' }, 404);
  });
const open = () => openContract('SYNTH_VOL_50', 'UP', 101, key,
  3600, '2026-10-09T18:00:00.000Z', 'CLIENT_EXPIRY_IGNORED');
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'));
  vi.stubGlobal('fetch', transport);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('[AC-E1-1] authenticated HTTP adapter unit, not real integration', () => {
  it('[AC-E1-1] wallet uses local v1 route and returns only the supplied fixture', async () => {
    await expect(getWallet()).resolves.toEqual(wallet);
    expect(transport.mock.calls[0][0]).toBe('/api/v1/wallet');
  });
  it('[S-05] opening uses v1 and preserves strict fields and intent key', async () => {
    await expect(open()).resolves.toEqual(receipt);
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe('/api/v1/contracts'); expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body));
    expect(OpenContractSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({ symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 101 });
    expect(new Headers(init?.headers).get('Idempotency-Key')).toBe(key);
  });
  it('[AC-E1-1] unwraps server Receipt independently of route discovery', async () => {
    // One response at any path isolates envelope decoding from the separate route test.
    transport.mockResolvedValueOnce(json({ success: true, is_duplicate: false, contract }, 201));
    await expect(open()).resolves.toEqual(receipt);
  });
  it('[AC-E1-1] wallet preserves a transport error without local fallback', async () => {
    transport.mockResolvedValueOnce(json({ code: 'WALLET_UNAVAILABLE' }, 503));
    await expect(getWallet()).rejects.toMatchObject({ status: 503, code: 'WALLET_UNAVAILABLE' });
  });
});

const malformed = [
  {}, receipt, { contract: null }, { contract: { ...receipt, id: undefined } },
  { contract: { ...receipt, id: '' } }, { contract: { ...receipt, status: undefined } },
  { contract: { ...receipt, status: 123 } }, { contract: { ...receipt, status: '' } },
  { contract: { ...receipt, expires_at: undefined } },
  { contract: { ...receipt, expires_at: 'not-an-ISO-date' } },
  { contract: { ...receipt, expires_at: '2026-99-99T12:01:00.000Z' } },
];
describe('[AC-E1-2] malformed 201 is a protocol error, not an order rejection', () => {
  it.each(malformed)('[AC-E1-2] rejects malformed envelope %#', async (body) => {
    // Explicit malformed fixture at any path prevents a 404 from hiding this defect.
    transport.mockResolvedValueOnce(json(body, 201));
    await expect(open()).rejects.toBeInstanceOf(ApiError);
    transport.mockResolvedValueOnce(json(body, 201));
    await expect(open()).rejects.toMatchObject({ status: 502, code: 'INVALID_CONTRACT_RESPONSE' });
  });
});
