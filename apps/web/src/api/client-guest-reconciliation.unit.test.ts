import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

class MockStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
}

const mockStorageInstance = new MockStorage();
Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockStorageInstance,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { sessionStorage: mockStorageInstance },
  writable: true,
  configurable: true,
});

import {
  reconcileGuestContracts,
  getContracts,
  getWallet,
  openContract,
  resetMockWallet,
  onMockPrivateEvent,
  type Contract,
} from './client';
import { setGuestMode } from '../auth/oidc';

describe('SUBETAPA 01: Motor de Reconciliação Autônomo e Liquidação Resiliente', () => {
  beforeEach(() => {
    mockStorageInstance.clear();
    setGuestMode(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1.1 RECUPERAÇÃO DE RELOAD: Liquida imediatamente contratos que expiraram enquanto a página estava fechada', async () => {
    resetMockWallet();
    const now = Date.now();

    // Simula store no sessionStorage com contratos que expiraram há 10 segundos
    const mockStore = {
      wallet: { currency: 'USD', available_minor: 900000, reserved_minor: 20000 },
      candles: {
        SYNTH_VOL_50: [{ time: Math.floor(now / 1000) - 60, open: '500', high: '510', low: '495', close: '505', volume: 100 }],
      },
      contracts: [
        {
          id: 'guest_exp_1',
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 10000, // $100
          status: 'OPEN',
          result: null,
          payout_minor: null,
          entry_price: 500,
          strike_price: 500,
          created_at: new Date(now - 70000).toISOString(),
          expires_at: new Date(now - 10000).toISOString(), // expirou há 10s
        },
        {
          id: 'guest_exp_2',
          symbol: 'SYNTH_VOL_50',
          direction: 'DOWN',
          stake_minor: 10000, // $100
          status: 'OPEN',
          result: null,
          payout_minor: null,
          entry_price: 500,
          strike_price: 500,
          created_at: new Date(now - 70000).toISOString(),
          expires_at: new Date(now - 10000).toISOString(), // expirou há 10s
        },
      ],
    };
    mockStorageInstance.setItem('synth_mock_store_v3', JSON.stringify(mockStore));

    // getContracts deve chamar a reconciliação e retornar ambos SETTLED
    const contracts = await getContracts('');
    expect(contracts).toHaveLength(2);
    expect(contracts[0].status).toBe('SETTLED');
    expect(contracts[1].status).toBe('SETTLED');

    // Um venceu (UP com close 505 > 500) e um perdeu (DOWN com close 505 > 500)
    const c1 = contracts.find((c) => c.id === 'guest_exp_1')!;
    const c2 = contracts.find((c) => c.id === 'guest_exp_2')!;
    expect(c1.result).toBe('WIN');
    expect(c1.payout_minor).toBe(18500); // 100 * 1.85 = 185
    expect(c2.result).toBe('LOSS');
    expect(c2.payout_minor).toBe(0);

    // Carteira deve ter liberado as reservas e creditado o payout
    const wallet = await getWallet();
    expect(wallet.reserved_minor).toBe(0);
    // Disponível = 900000 + 18500 = 918500
    expect(wallet.available_minor).toBe(918500);
  });

  it('1.2 INVARIANTE FINANCEIRO: Preservação estrita e transacional da carteira demo (sem perda de centavos)', async () => {
    resetMockWallet();
    const initialWallet = await getWallet();
    expect(initialWallet.available_minor).toBe(1000000);
    expect(initialWallet.reserved_minor).toBe(0);

    // Abre contrato de $100 (10000 centavos)
    const receipt = await openContract('SYNTH_VOL_50', 'UP', 10000, 'test-key-inv', 30);
    expect(receipt.status).toBe('OPEN');

    let currentWallet = await getWallet();
    expect(currentWallet.available_minor).toBe(990000);
    expect(currentWallet.reserved_minor).toBe(10000);

    // Força avanço de tempo para após a expiração
    const futureMs = Date.parse(receipt.expires_at) + 5000;
    const { settledCount, settledContracts } = reconcileGuestContracts(futureMs);

    expect(settledCount).toBe(1);
    expect(settledContracts[0].id).toBe(receipt.id);
    expect(settledContracts[0].status).toBe('SETTLED');

    currentWallet = await getWallet();
    expect(currentWallet.reserved_minor).toBe(0);
    // Se WIN: 990000 + 18500 = 1008500. Se DRAW: 990000 + 10000 = 1000000. Se LOSS: 990000 + 0 = 990000.
    if (settledContracts[0].result === 'WIN') {
      expect(currentWallet.available_minor).toBe(1008500);
    } else if (settledContracts[0].result === 'DRAW') {
      expect(currentWallet.available_minor).toBe(1000000);
    } else {
      expect(currentWallet.available_minor).toBe(990000);
    }
  });

  it('1.3 ESTRESSE & DETERMINISMO: Reconciliação em lote de 50 contratos expirados simultaneamente', () => {
    resetMockWallet();
    const now = Date.now();
    const mockContracts: Contract[] = [];

    for (let i = 0; i < 50; i++) {
      mockContracts.push({
        id: `guest_stress_${i}`,
        symbol: 'SYNTH_VOL_50',
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: 10000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        entry_price: 500,
        strike_price: 500,
        created_at: new Date(now - 65000).toISOString(),
        expires_at: new Date(now - 5000).toISOString(),
      });
    }

    const mockStore = {
      wallet: { currency: 'USD', available_minor: 500000, reserved_minor: 500000 },
      candles: {
        SYNTH_VOL_50: [{ time: Math.floor(now / 1000) - 60, open: '500', high: '510', low: '495', close: '505', volume: 100 }],
      },
      contracts: mockContracts,
    };
    mockStorageInstance.setItem('synth_mock_store_v3', JSON.stringify(mockStore));

    const startTime = Date.now();
    const result = reconcileGuestContracts(now);
    const duration = Date.now() - startTime;

    expect(result.settledCount).toBe(50);
    expect(duration).toBeLessThan(100); // Executa em menos de 100ms
  });

  it('1.4 ROBUSTEZ TEMPORAL: Não liquida contratos cujo tempo ainda não venceu', () => {
    resetMockWallet();
    const now = Date.now();

    const mockStore = {
      wallet: { currency: 'USD', available_minor: 900000, reserved_minor: 10000 },
      candles: {},
      contracts: [
        {
          id: 'guest_active_still',
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 10000,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          entry_price: 500,
          strike_price: 500,
          created_at: new Date(now).toISOString(),
          expires_at: new Date(now + 45000).toISOString(), // falta 45s
        },
      ],
    };
    mockStorageInstance.setItem('synth_mock_store_v3', JSON.stringify(mockStore));

    const result = reconcileGuestContracts(now);
    expect(result.settledCount).toBe(0);

    const storeAfter = JSON.parse(mockStorageInstance.getItem('synth_mock_store_v3')!);
    expect(storeAfter.contracts[0].status).toBe('OPEN');
    expect(storeAfter.wallet.reserved_minor).toBe(10000);
  });

  it('1.5 EMISSÃO DE EVENTOS: Dispara contract_settled e wallet_balance ao reconciliar', () => {
    resetMockWallet();
    const now = Date.now();
    const mockStore = {
      wallet: { currency: 'USD', available_minor: 900000, reserved_minor: 10000 },
      candles: {
        SYNTH_VOL_50: [{ time: Math.floor(now / 1000) - 60, open: '500', high: '510', low: '495', close: '505', volume: 100 }],
      },
      contracts: [
        {
          id: 'guest_event_test',
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 10000,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          entry_price: 500,
          strike_price: 500,
          created_at: new Date(now - 60000).toISOString(),
          expires_at: new Date(now - 1000).toISOString(),
        },
      ],
    };
    mockStorageInstance.setItem('synth_mock_store_v3', JSON.stringify(mockStore));

    const receivedEvents: any[] = [];
    const unsubscribe = onMockPrivateEvent((ev) => receivedEvents.push(ev));

    reconcileGuestContracts(now);
    unsubscribe();

    const settledEvent = receivedEvents.find((e) => e.type === 'contract_settled');
    const balanceEvent = receivedEvents.find((e) => e.type === 'wallet_balance');

    expect(settledEvent).toBeDefined();
    expect(settledEvent.contract_id).toBe('guest_event_test');
    expect(balanceEvent).toBeDefined();
  });
});
