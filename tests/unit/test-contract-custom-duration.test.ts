import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenContractSchema } from '../../packages/shared/src/types';
import { openContract, type Receipt } from '../../apps/web/src/api/client';

vi.mock('../../apps/web/src/auth/oidc', () => ({
  isGuestMode: () => false,
  accessToken: async () => 'unit-auth-token-test',
  signIn: vi.fn(),
  userManager: { signinSilent: vi.fn() },
}));

const mockReceipt: Receipt = {
  id: 'contract-custom-duration-123',
  status: 'OPEN',
  expires_at: '2026-10-10T12:00:45.000Z',
};

const transport = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
  new Response(JSON.stringify({ success: true, is_duplicate: false, contract: mockReceipt }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', transport);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SUBETAPA 03 — Sincronização End-to-End: Duração Personalizada e Piso de 30s', () => {
  it('envia duration_seconds quando fornecida duração personalizada segura (ex: 45s fim de vela)', async () => {
    const receipt = await openContract(
      'BTCUSD_OTC',
      'UP',
      1000,
      'idemp-key-45s',
      45,
      '2026-10-10T12:00:45.000Z',
      'CANDLE_1M'
    );

    expect(transport).toHaveBeenCalledTimes(1);
    const init = transport.mock.calls[0][1];
    expect(init?.body).toBeDefined();
    const body = JSON.parse(init!.body as string);

    expect(body.symbol).toBe('BTCUSD_OTC');
    expect(body.direction).toBe('UP');
    expect(body.stake_minor).toBe(1000);
    expect(body.duration_seconds).toBe(45);

    const parseResult = OpenContractSchema.safeParse(body);
    expect(parseResult.success).toBe(true);
    expect(receipt.id).toBe('contract-custom-duration-123');
  });

  it('omite duration_seconds quando for o padrão de 60 segundos mantendo autoridade padrão do servidor', async () => {
    await openContract(
      'EURUSD_OTC',
      'DOWN',
      500,
      'idemp-key-60s',
      60,
      '2026-10-10T12:01:00.000Z',
      '1M_FIXED'
    );

    expect(transport).toHaveBeenCalledTimes(1);
    const init = transport.mock.calls[0][1];
    const body = JSON.parse(init!.body as string);

    expect(body.duration_seconds).toBeUndefined();
    expect(Object.keys(body).sort()).toEqual(['direction', 'stake_minor', 'symbol']);
  });
});
