import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenContractSchema } from '../../packages/shared/src/types';
import { openContract, type Receipt } from '../../apps/web/src/api/client';

// UNITÁRIO de contrato do payload: auth/fetch são doubles; função/schema são reais.
// AC-BMR-03: dado modo autenticado e prazo cliente, ao abrir, body passa no
// schema strict e contém exatamente symbol/direction/stake_minor (S-05).
// AC-BMR-10: dado stake inteiro/chave, ao enviar, ambos são preservados;
// expiração cliente está ausente e o receipt recebido mantém o prazo da fixture.
// Receipt é fixture dentro do envelope oficial; ledger/auth/HTTP reais não são validados.
vi.mock('../../apps/web/src/auth/oidc', () => ({
  isGuestMode: () => false,
  accessToken: async () => 'unit-auth-double',
  signIn: vi.fn(),
  userManager: { signinSilent: vi.fn() },
}));

const bareReceipt: Receipt = {
  id: 'unit-server-contract',
  status: 'CREATED',
  expires_at: '2026-10-09T12:01:00.000Z',
};
const clientExpiry = '2026-10-09T18:00:00.000Z';
const key = 'unit-intent-fixed-key';
const transport = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () =>
  new Response(JSON.stringify({ success: true, is_duplicate: false, contract: bareReceipt }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  }));

async function captureRequest(stakeMinor: number) {
  const receipt = await openContract('SYNTH_VOL_50', 'UP', stakeMinor, key,
    3600, clientExpiry, 'CLIENT_TIME_MUST_NOT_BE_AUTHORITY');
  expect(transport).toHaveBeenCalledTimes(1);
  const init = transport.mock.calls[0][1];
  if (!init || typeof init.body !== 'string') throw new Error('Missing JSON request body');
  const body: Record<string, unknown> = JSON.parse(init.body);
  return { body, headers: new Headers(init.headers), receipt };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-09T12:00:00.000Z'));
  vi.stubGlobal('fetch', transport);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('[AC-BMR-03] authenticated payload unit contract; no real integration', () => {
  it('[S-05] real openContract emits only the fields accepted by the real strict schema', async () => {
    const { body } = await captureRequest(101);
    const parsed = OpenContractSchema.safeParse(body);
    expect(parsed.success, parsed.success ? undefined : JSON.stringify(parsed.error.issues)).toBe(true);
    expect(Object.keys(body).sort()).toEqual(['direction', 'stake_minor', 'symbol']);
    expect(body).toEqual({ symbol: 'SYNTH_VOL_50', direction: 'UP', stake_minor: 101 });
  });

  it('[I-03][S-05] preserves integer stake/key and receipt while omitting client expiry', async () => {
    const { body, headers, receipt } = await captureRequest(199);
    expect(body.stake_minor).toBe(199);
    expect(Number.isSafeInteger(body.stake_minor)).toBe(true);
    expect(headers.get('Idempotency-Key')).toBe(key);
    expect(receipt).toEqual(bareReceipt);
    expect(receipt.expires_at).not.toBe(clientExpiry);
    expect(body).not.toHaveProperty('expires_at');
    expect(body).not.toHaveProperty('duration_seconds');
    expect(body).not.toHaveProperty('expiry_mode');
  });
});
