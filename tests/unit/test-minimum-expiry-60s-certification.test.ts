import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenContractSchema } from '../../packages/shared/src/index';
import {
  calculateExecutionExpiry,
  calculateExpirySlots,
  formatSecondsToMmSs,
  type ExpiryMode,
} from '../../apps/web/src/trade/expiry-calculator';
import { openContract, type Receipt } from '../../apps/web/src/api/client';
import { ContractService } from '../../services/api/src/services/contract-service';

let mockGuestMode = false;

vi.mock('../../apps/web/src/auth/oidc', () => ({
  isGuestMode: () => mockGuestMode,
  accessToken: async () => 'cert-auth-token-60s',
  signIn: vi.fn(),
  userManager: { signinSilent: vi.fn() },
}));

describe('[SUBETAPA 03] Certificação de Estresse, Segurança, Caos e Regressão — Expiração Mínima 60s', () => {
  const mockReceipt: Receipt = {
    id: 'cert-contract-60s-001',
    status: 'OPEN',
    expires_at: '2026-10-14T12:01:00.000Z',
  };

  const transport = vi.fn<(url: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async () =>
      new Response(JSON.stringify({ success: true, is_duplicate: false, contract: mockReceipt }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
  );

  beforeEach(() => {
    mockGuestMode = false;
    vi.clearAllMocks();
    vi.stubGlobal('fetch', transport);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // 1. SEGURANÇA (S-05, I-03, I-04): Fuzzing de Underflow, Overflow e Injeção
  // =========================================================================
  describe('1. Matriz de Segurança (SEC-60S): Bloqueio Estrito < 60s e Anti-Mass Assignment', () => {
    it('SEC-01: Bloqueia 100% das durações inteiras de -100s até 59s no OpenContractSchema', () => {
      for (let d = -100; d <= 59; d++) {
        const res = OpenContractSchema.safeParse({
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 1000,
          duration_seconds: d,
        });
        expect(res.success, `Duração ${d}s deveria ser rejeitada`).toBe(false);
      }
    });

    it('SEC-02: Aceita 100% das durações inteiras válidas de 60s até 300s no OpenContractSchema', () => {
      for (let d = 60; d <= 300; d++) {
        const res = OpenContractSchema.safeParse({
          symbol: 'SYNTH_VOL_50',
          direction: d % 2 === 0 ? 'UP' : 'DOWN',
          stake_minor: 1000,
          duration_seconds: d,
        });
        expect(res.success, `Duração válida ${d}s deveria ser aceita`).toBe(true);
      }
    });

    it('SEC-03: Bloqueia durações acima do teto de 300s (301s a 400s e extremos)', () => {
      const overflowValues = [
        ...Array.from({ length: 100 }, (_, i) => 301 + i),
        600,
        3600,
        86400,
        Number.MAX_SAFE_INTEGER,
      ];
      for (const d of overflowValues) {
        const res = OpenContractSchema.safeParse({
          symbol: 'BTCUSD_OTC',
          direction: 'DOWN',
          stake_minor: 500,
          duration_seconds: d,
        });
        expect(res.success).toBe(false);
      }
    });

    it('SEC-04: Rejeita floats, NaN, Infinity e tipos maliciosos em duration_seconds', () => {
      const invalidValues: unknown[] = [
        59.9999,
        60.0001,
        60.5,
        120.25,
        NaN,
        Infinity,
        -Infinity,
        '60',
        '60s',
        null,
        true,
        false,
        [60],
        { duration: 60 },
      ];

      for (const val of invalidValues) {
        const res = OpenContractSchema.safeParse({
          symbol: 'EURUSD_OTC',
          direction: 'UP',
          stake_minor: 1000,
          duration_seconds: val,
        });
        expect(res.success).toBe(false);
      }
    });

    it('SEC-05: Bloqueia Mass Assignment de campos de autoridade do servidor (.strict())', () => {
      const forbiddenFields = [
        { expires_at: '2026-10-14T12:00:10.000Z' },
        { opened_at: '2026-10-14T12:00:00.000Z' },
        { entry_price: '500.00' },
        { exit_price: '510.00' },
        { payout_minor: 999999 },
        { user_id: 'attacker-uuid' },
        { status: 'SETTLED' },
        { result: 'WIN' },
      ];

      for (const extra of forbiddenFields) {
        const res = OpenContractSchema.safeParse({
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 1000,
          duration_seconds: 60,
          ...extra,
        });
        expect(res.success).toBe(false);
      }
    });
  });

  // =========================================================================
  // 2. ESTRESSE DE ALTA FREQUÊNCIA (STRESS-60S)
  // =========================================================================
  describe('2. Matriz de Estresse (STRESS-60S): 10.000 Cálculos e Rajadas Concorrentes', () => {
    it('STRESS-01: 10.000 cálculos de calculateExecutionExpiry nos 3 modos jamais retornam < 60.000ms', () => {
      const baseEpoch = Date.UTC(2026, 9, 14, 0, 0, 0, 0);
      const modes: ExpiryMode[] = ['1M_FIXED', 'CANDLE_1M', 'CANDLE_5M'];
      const start = performance.now();

      let minDurationObserved = Infinity;
      let minDeltaObserved = Infinity;
      let allFinite = true;

      for (let i = 0; i < 10_000; i++) {
        // Avança em passos de 373ms cobrindo múltiplos minutos, horas e sub-segundos
        const testNowMs = baseEpoch + i * 373;
        const mode = modes[i % 3];
        const { durationMs, targetEpochMs } = calculateExecutionExpiry(mode, testNowMs);

        if (durationMs < minDurationObserved) minDurationObserved = durationMs;
        if (targetEpochMs - testNowMs < minDeltaObserved) minDeltaObserved = targetEpochMs - testNowMs;
        if (!Number.isFinite(durationMs) || !Number.isFinite(targetEpochMs)) allFinite = false;
      }

      const elapsed = performance.now() - start;
      expect(allFinite).toBe(true);
      expect(minDurationObserved).toBeGreaterThanOrEqual(60_000);
      expect(minDeltaObserved).toBeGreaterThanOrEqual(60_000);
      expect(elapsed).toBeLessThan(250);
    });

    it('STRESS-02: 3.600 segundos contínuos (1 hora inteira) em calculateExpirySlots mantêm remainingSeconds >= 60', () => {
      const baseEpoch = Date.UTC(2026, 9, 14, 12, 0, 0, 0);
      let minRemaining = Infinity;
      let minDuration = Infinity;
      let minEpochDiff = Infinity;

      for (let sec = 0; sec < 3600; sec++) {
        const nowMs = baseEpoch + sec * 1000;
        const slots = calculateExpirySlots(new Date(nowMs), -3);
        if (slots.length !== 3) throw new Error('Expected 3 slots');

        for (const slot of slots) {
          if (slot.remainingSeconds < minRemaining) minRemaining = slot.remainingSeconds;
          if (slot.durationSeconds < minDuration) minDuration = slot.durationSeconds;
          if (slot.targetEpochMs - nowMs < minEpochDiff) minEpochDiff = slot.targetEpochMs - nowMs;
        }
      }

      expect(minRemaining).toBeGreaterThanOrEqual(60);
      expect(minDuration).toBeGreaterThanOrEqual(60);
      expect(minEpochDiff).toBeGreaterThanOrEqual(60_000);
    });

    it('STRESS-03: 500 validações concorrentes de OpenContractSchema (60s a 300s) em < 100ms', () => {
      const start = performance.now();
      const payloads = Array.from({ length: 500 }, (_, i) => ({
        symbol: i % 2 === 0 ? 'SYNTH_VOL_50' : 'BTCUSD_OTC',
        direction: (i % 2 === 0 ? 'UP' : 'DOWN') as 'UP' | 'DOWN',
        stake_minor: 100 + (i % 9900),
        duration_seconds: 60 + (i % 241),
      }));

      const results = payloads.map((p) => OpenContractSchema.safeParse(p));
      const elapsed = performance.now() - start;

      expect(results.every((r) => r.success)).toBe(true);
      expect(elapsed).toBeLessThan(100);
    });
  });

  // =========================================================================
  // 3. ENGENHARIA DE CAOS E RESILIÊNCIA (CHAOS-60S)
  // =========================================================================
  describe('3. Matriz de Caos (CHAOS-60S): Fronteiras de Milissegundo, NaN e Clock Skew', () => {
    it('CHAOS-01: Fronteiras exatas de milissegundo (:00.000, :00.001, :29.999, :30.000, :59.999)', () => {
      const minuteStart = Date.UTC(2026, 9, 14, 15, 0, 0, 0);
      const offsets = [0, 1, 15_000, 29_999, 30_000, 30_001, 45_000, 59_000, 59_999, 60_000];

      for (const offset of offsets) {
        const nowMs = minuteStart + offset;
        for (const mode of ['1M_FIXED', 'CANDLE_1M', 'CANDLE_5M'] as ExpiryMode[]) {
          const { durationMs, targetEpochMs } = calculateExecutionExpiry(mode, nowMs);
          expect(durationMs).toBeGreaterThanOrEqual(60_000);
          expect(targetEpochMs - nowMs).toBeGreaterThanOrEqual(60_000);
        }
      }
    });

    it('CHAOS-02: Resiliência contra timestamps corrompidos (NaN, Infinity, -Infinity, 0, Date inválida)', () => {
      const corruptedTimestamps = [NaN, Infinity, -Infinity, 0, -1000];
      for (const badTs of corruptedTimestamps) {
        const res = calculateExecutionExpiry('CANDLE_1M', badTs);
        expect(Number.isFinite(res.durationMs)).toBe(true);
        expect(res.durationMs).toBeGreaterThanOrEqual(60_000);
        expect(Number.isFinite(res.targetEpochMs)).toBe(true);
      }

      const slotsFromInvalidDate = calculateExpirySlots(new Date(NaN), -3);
      expect(slotsFromInvalidDate.length).toBe(3);
      for (const s of slotsFromInvalidDate) {
        expect(s.remainingSeconds).toBeGreaterThanOrEqual(60);
        expect(s.durationSeconds).toBeGreaterThanOrEqual(60);
      }

      expect(formatSecondsToMmSs(-50)).toBe('00:00');
    });

    it('CHAOS-03: ContractService.openContract impõe piso de 60s mesmo se DTO vier com valor < 60s', async () => {
      const serverTickTs = new Date();
      let insertedOpenedAt: Date | null = null;
      let insertedExpiresAt: Date | null = null;

      const mockClient = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          if (sql.includes('INSERT INTO contracts')) {
            insertedOpenedAt = params?.[6] as Date;
            insertedExpiresAt = params?.[7] as Date;
            return {
              rows: [
                {
                  id: 'cnt-backend-60s',
                  user_id: params?.[0],
                  symbol: params?.[1],
                  direction: params?.[2],
                  status: 'OPEN',
                  stake_minor: params?.[3],
                  payout_minor: params?.[4],
                  entry_price: params?.[5],
                  opened_at: insertedOpenedAt,
                  expires_at: insertedExpiresAt,
                  idempotency_key: params?.[8],
                },
              ],
            };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('FROM contracts')) return { rows: [] };
          if (sql.includes('FROM index_state')) {
            return {
              rows: [
                {
                  last_sequence: '1050',
                  last_price: '500.123456',
                  last_ts: serverTickTs.toISOString(),
                },
              ],
            };
          }
          return { rows: [] };
        }),
        connect: vi.fn(async () => mockClient),
      };

      const mockRedis = {
        exists: vi.fn(async () => 1),
        get: vi.fn(async () => null),
        set: vi.fn(async () => 'OK'),
        eval: vi.fn(async () => [1, 'OK', 1000]),
        zadd: vi.fn(async () => 1),
      };

      const service = new ContractService(mockPool as any, mockRedis as any);

      // Mesmo forçando duration_seconds = 15 no DTO interno, o ContractService aplica Math.max(60, ...)
      const { contract } = await service.openContract('user-cert-1', 'idem-cert-60s', {
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 1000,
        duration_seconds: 15,
      });

      const actualDurationMs = contract.expires_at.getTime() - contract.opened_at.getTime();
      expect(actualDurationMs).toBe(60_000);
    });
  });

  // =========================================================================
  // 4. INTEGRAÇÃO CLIENTE -> SCHEMA (E2E-60S)
  // =========================================================================
  describe('4. Matriz End-to-End Cliente HTTP (E2E-60S): Blindagem em openContract', () => {
    it('E2E-01: openContract autenticado com tentativa de duração < 60s (15s, 30s, 45s) não envia duration_seconds inválido e passa no OpenContractSchema', async () => {
      for (const sub60 of [15, 30, 45, 59]) {
        transport.mockClear();
        await openContract('SYNTH_VOL_50', 'UP', 1000, `idem-sub60-${sub60}`, sub60);

        expect(transport).toHaveBeenCalledTimes(1);
        const init = transport.mock.calls[0][1];
        const body = JSON.parse(String(init?.body));

        expect(body.duration_seconds).toBeUndefined();
        expect(OpenContractSchema.safeParse(body).success).toBe(true);
      }
    });

    it('E2E-02: openContract em Guest Mode clampeia qualquer duração < 60s para exatamente 60s', async () => {
      mockGuestMode = true;
      for (const sub60 of [5, 15, 30, 45]) {
        transport.mockClear();
        await openContract('SYNTH_VOL_50', 'DOWN', 1000, `idem-guest-${sub60}`, sub60);

        expect(transport).toHaveBeenCalledTimes(1);
        const init = transport.mock.calls[0][1];
        const body = JSON.parse(String(init?.body));

        expect(body.duration_seconds).toBeGreaterThanOrEqual(60);
        expect(body.duration_seconds).toBe(60);
      }
    });
  });
});
