import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  requestDeposit,
  confirmDeposit,
  requestWithdrawal,
  getWalletTransactions,
  type DepositResponse,
  type DepositConfirmResponse,
  type WithdrawResponse,
  type WalletTransaction,
} from '../api/client';
import { BinmaxDepositModal } from './BinmaxDepositModal';
import { BinmaxWithdrawModal } from './BinmaxWithdrawModal';

describe('Cashier, Deposits & Withdrawals (Etapa 4)', () => {
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  const mockLocalStorage = {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => localStore.set(k, v),
    removeItem: (k: string) => localStore.delete(k),
    clear: () => localStore.clear(),
    key: (i: number) => Array.from(localStore.keys())[i] ?? null,
    length: 0,
  };

  const mockSessionStorage = {
    getItem: (k: string) => sessionStore.get(k) ?? null,
    setItem: (k: string, v: string) => sessionStore.set(k, v),
    removeItem: (k: string) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
    key: (i: number) => Array.from(sessionStore.keys())[i] ?? null,
    length: 0,
  };

  beforeEach(() => {
    localStore.clear();
    sessionStore.clear();

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    vi.stubGlobal('window', {
      location: {
        pathname: '/deposito',
        search: '',
        href: 'http://localhost:5173/deposito',
      },
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    });

    localStore.set(
      'binmax_auth_session',
      JSON.stringify({
        token: 'test-cashier-bearer-token',
        user: { id: 'usr-cashier-1', email: 'cashier@binmax.test', demoBalanceMinor: 1000000 },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. API de Depósito (requestDeposit & confirmDeposit)', () => {
    it('requestDeposit() envia amount_minor exato e header Idempotency-Key', async () => {
      const mockRes: DepositResponse = {
        success: true,
        transaction: {
          id: 'tx_dep_100',
          type: 'DEPOSIT',
          method: 'PIX',
          amount_minor: 10000, // $100.00
          status: 'PENDING',
          pix_code: '00020126580014BR.GOV.BCB.PIX...tx_dep_100',
          expires_at: new Date(Date.now() + 1800000).toISOString(),
        },
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await requestDeposit({
        amount_minor: 10000,
        method: 'PIX',
        idempotency_key: 'idem-test-dep-01',
      });

      expect(res.success).toBe(true);
      expect(res.transaction.id).toBe('tx_dep_100');
      expect(res.transaction.amount_minor).toBe(10000);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/wallet/deposit');
      expect(options.method).toBe('POST');
      expect(options.headers['Idempotency-Key']).toBe('idem-test-dep-01');

      const body = JSON.parse(options.body);
      expect(body.amount_minor).toBe(10000);
      expect(body.method).toBe('PIX');
    });

    it('confirmDeposit() despacha transação para /confirm e recebe novo saldo', async () => {
      const mockConfirmRes: DepositConfirmResponse = {
        success: true,
        transaction_id: 'tx_dep_100',
        status: 'COMPLETED',
        new_balance_minor: 1010000, // $10,100.00
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockConfirmRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await confirmDeposit('tx_dep_100');
      expect(res.success).toBe(true);
      expect(res.status).toBe('COMPLETED');
      expect(res.new_balance_minor).toBe(1010000);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/wallet/deposit/confirm');
      const body = JSON.parse(options.body);
      expect(body.transaction_id).toBe('tx_dep_100');
    });
  });

  describe('2. API de Saque (requestWithdrawal)', () => {
    it('requestWithdrawal() despacha débito em centavos menores e dados de destino', async () => {
      const mockWithdrawRes: WithdrawResponse = {
        success: true,
        transaction: {
          id: 'tx_wth_500',
          type: 'WITHDRAWAL',
          method: 'PIX',
          amount_minor: 50000, // $500.00
          status: 'PENDING',
          destination_account: 'chave-pix-teste@banco.com',
        },
        new_balance_minor: 950000, // $9,500.00
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => mockWithdrawRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await requestWithdrawal({
        amount_minor: 50000,
        method: 'PIX',
        destination_account: 'chave-pix-teste@banco.com',
        idempotency_key: 'idem-wth-01',
      });

      expect(res.success).toBe(true);
      expect(res.transaction.amount_minor).toBe(50000);
      expect(res.new_balance_minor).toBe(950000);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/wallet/withdraw');
      expect(options.headers['Idempotency-Key']).toBe('idem-wth-01');

      const body = JSON.parse(options.body);
      expect(body.amount_minor).toBe(50000);
      expect(body.destination_account).toBe('chave-pix-teste@banco.com');
    });

    it('requestWithdrawal() rejeita quando o saldo é insuficiente com erro da API', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'INSUFFICIENT_FUNDS', message: 'Saldo insuficiente' }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(
        requestWithdrawal({
          amount_minor: 5000000, // $50,000.00 (acima do saldo)
          method: 'PIX',
          destination_account: 'chave-pix@teste.com',
        })
      ).rejects.toThrow();
    });
  });

  describe('3. Extrato de Transações (getWalletTransactions)', () => {
    it('getWalletTransactions() recupera histórico de transações ordenadas', async () => {
      const mockList: WalletTransaction[] = [
        {
          id: 'tx-1',
          type: 'DEPOSIT',
          method: 'PIX',
          amount_minor: 10000,
          fee_minor: 0,
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
        },
        {
          id: 'tx-2',
          type: 'WITHDRAWAL',
          method: 'PIX',
          amount_minor: 5000,
          fee_minor: 0,
          status: 'PENDING',
          destination_account: 'chave-pix-1',
          created_at: new Date().toISOString(),
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockList,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const list = await getWalletTransactions();
      expect(list.length).toBe(2);
      expect(list[0].type).toBe('DEPOSIT');
      expect(list[1].type).toBe('WITHDRAWAL');
    });
  });

  describe('4. Renderização dos Modais de Depósito e Saque', () => {
    it('BinmaxDepositModal renderiza método PIX e valores pré-definidos', () => {
      const html = renderToString(
        <BinmaxDepositModal isOpen={true} onClose={() => {}} />
      );

      expect(html).toContain('Depositar');
      expect(html).toContain('PIX');
      expect(html).toContain('$100');
      expect(html).toContain('$50');
      expect(html).toContain('$500');
    });

    it('BinmaxWithdrawModal renderiza saldo disponível e piso mínimo de $50.00', () => {
      const html = renderToString(
        <BinmaxWithdrawModal
          isOpen={true}
          onClose={() => {}}
          availableBalanceFormatted="$10,000.00"
        />
      );

      expect(html).toContain('Retirar fondos');
      expect(html).toContain('$10,000.00');
      expect(html).toContain('Monto a retirar');
      expect(html).toContain('Mínimo de retiro: $50.00');
    });
  });
});
