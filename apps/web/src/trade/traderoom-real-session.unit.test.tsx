import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { isGuestMode, setGuestMode } from '../auth/oidc';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { openContract, type Contract } from '../api/client';

describe('Traderoom Real Session & Erradicação do Guest Trap (Etapa 3)', () => {
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
        pathname: '/operar',
        search: '',
        href: 'http://localhost:5173/operar',
      },
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. Erradicação do Guest Trap no Modo de Autenticação', () => {
    it('isGuestMode() retorna false se existe sessão autenticada ativa, mesmo que a flag guest estivesse true', () => {
      // Simula flag guest residual
      sessionStore.set('synth_guest_mode', 'true');
      
      // Usuário autentica-se com sessão real
      localStore.set('binmax_auth_session', JSON.stringify({
        token: 'real-user-token',
        user: { id: 'usr-123', email: 'trader@binmax.com', name: 'Trader Real' }
      }));

      expect(isGuestMode()).toBe(false);
    });

    it('setGuestMode(false) limpa a flag no sessionStorage', () => {
      sessionStore.set('synth_guest_mode', 'true');
      setGuestMode(false);
      expect(sessionStore.get('synth_guest_mode')).toBeUndefined();
      expect(isGuestMode()).toBe(false);
    });

    it('isGuestMode() retorna true somente quando NÃO há sessão e guest mode é explicitamente ativado', () => {
      expect(isGuestMode()).toBe(false); // Padrão sem sessão é false
      setGuestMode(true);
      expect(isGuestMode()).toBe(true);
    });
  });

  describe('2. Execução Real de Contratos (Sem Simulação em sessionStorage)', () => {
    it('openContract() despacha via fetch real para a API e não salva dados no sessionStorage', async () => {
      localStore.set('binmax_auth_session', JSON.stringify({
        token: 'valid-bearer-token',
        user: { id: 'usr-999', email: 'test@binmax.test' }
      }));

      const mockContract: Contract = {
        id: 'cnt_live_123',
        user_id: 'usr-999',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 2500, // $25.00
        payout_minor: 4625, // $46.25
        status: 'OPEN',
        entry_price: 1540.25,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60000).toISOString(),
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ contract: mockContract }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const contract = await openContract(
        'SYNTH_VOL_50',
        'UP',
        2500,
        'idem-key-123',
        60,
        undefined,
        'duration'
      );

      expect(contract.id).toBe('cnt_live_123');
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Prova que o payload foi enviado para o endpoint real do backend
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/contracts');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.symbol).toBe('SYNTH_VOL_50');
      expect(body.direction).toBe('UP');
      expect(body.stake_minor).toBe(2500);
      expect(body.duration_seconds).toBe(60);

      // Prova que nada foi gravado no synth_mock_store_v3 do sessionStorage
      expect(sessionStore.get('synth_mock_store_v3')).toBeUndefined();
    });

    it('limpa binmax_auth_session local quando a API responde 401 Unauthorized', async () => {
      localStore.set('binmax_auth_session', JSON.stringify({
        token: 'expired-token',
        user: { id: 'usr-expired' }
      }));

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      await expect(
        openContract('SYNTH_VOL_50', 'DOWN', 1000, 'idem-key-401')
      ).rejects.toThrow('AUTH_REQUIRED');

      // Prova que a sessão expirada foi invalidada
      expect(localStore.get('binmax_auth_session')).toBeUndefined();
    });
  });

  describe('3. Precisão Aritmética e Formatação de PnL no BinmaxPortfolioDrawer', () => {
    it('renderiza contrato aberto com PnL projetado e valor investido em centavos', () => {
      const openContractMock: Contract = {
        id: 'cnt_open_01',
        user_id: 'usr-1',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 1000, // $10.00
        payout_minor: 1850,
        status: 'OPEN',
        strike_price: 1500.00,
        created_at: new Date(Date.now() - 10000).toISOString(),
        expires_at: new Date(Date.now() + 50000).toISOString(),
      };

      const html = renderToString(
        <BinmaxPortfolioDrawer
          contracts={[openContractMock]}
          currentPrice={1505.00} // Preço acima do strike -> Ganha (+85%)
        />
      );

      // Investido formatado como $10.00
      expect(html).toContain('Invertido');
      expect(html).toContain('$10.00');

      // PnL projetado com 85%: 1000 * 0.85 = 850 centavos = +$8.50
      expect(html).toContain('+$8.50');
    });

    it('renderiza contrato fechado com WIN mostrando lucro exato (+$(payout - stake))', () => {
      const wonContractMock: Contract = {
        id: 'cnt_closed_win',
        user_id: 'usr-1',
        symbol: 'SYNTH_VOL_100',
        direction: 'UP',
        stake_minor: 2000, // $20.00
        payout_minor: 3700, // $37.00
        result: 'WIN',
        status: 'SETTLED',
        created_at: new Date(Date.now() - 120000).toISOString(),
        expires_at: new Date(Date.now() - 60000).toISOString(),
      };

      const html = renderToString(
        <BinmaxPortfolioDrawer
          initialTab="cerradas"
          contracts={[wonContractMock]}
        />
      );

      // Deve renderizar na aba cerradas
      expect(html).toContain('Invertido $20.00');
      expect(html).toContain('Ganada');
      expect(html).toContain('+$17.00'); // Lucro líquido: $37.00 - $20.00 = +$17.00
    });

    it('renderiza contrato fechado com LOSS mostrando perda exata (-$stake)', () => {
      const lostContractMock: Contract = {
        id: 'cnt_closed_loss',
        user_id: 'usr-1',
        symbol: 'SYNTH_VOL_25',
        direction: 'DOWN',
        stake_minor: 1550, // $15.50
        payout_minor: 0,
        result: 'LOSS',
        status: 'SETTLED',
        created_at: new Date(Date.now() - 120000).toISOString(),
        expires_at: new Date(Date.now() - 60000).toISOString(),
      };

      const html = renderToString(
        <BinmaxPortfolioDrawer
          initialTab="cerradas"
          contracts={[lostContractMock]}
        />
      );

      expect(html).toContain('Invertido $15.50');
      expect(html).toContain('Perdida');
      expect(html).toContain('-$15.50');
    });

    it('renderiza contrato fechado com DRAW mostrando $0.00 e badge Empate', () => {
      const drawContractMock: Contract = {
        id: 'cnt_closed_draw',
        user_id: 'usr-1',
        symbol: 'SYNTH_VOL_10',
        direction: 'UP',
        stake_minor: 1000, // $10.00
        payout_minor: 1000, // $10.00 devolvido
        result: 'DRAW',
        status: 'SETTLED',
        created_at: new Date(Date.now() - 120000).toISOString(),
        expires_at: new Date(Date.now() - 60000).toISOString(),
      };

      const html = renderToString(
        <BinmaxPortfolioDrawer
          initialTab="cerradas"
          contracts={[drawContractMock]}
        />
      );

      expect(html).toContain('Invertido $10.00');
      expect(html).toContain('Empate');
      expect(html).toContain('$0.00');
    });
  });
});
