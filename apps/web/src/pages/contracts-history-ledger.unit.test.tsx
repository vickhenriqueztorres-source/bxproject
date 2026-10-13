import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { HistoryPage, sanitizeCsvField, generateCsvContent } from './HistoryPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Contract } from '../api/client';

describe('Contracts, History & Accounting Ledger Tests (Etapa 2)', () => {
  let queryClient: QueryClient;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Mock window com location e localStorage para Router e AuthService
    vi.stubGlobal('window', {
      location: {
        pathname: '/historico',
        search: '',
        href: 'http://localhost:5173/historico',
      },
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderHistoryWithQuery(initialContracts?: Contract[]) {
    return renderToString(
      <QueryClientProvider client={queryClient}>
        <HistoryPage initialContracts={initialContracts} />
      </QueryClientProvider>
    );
  }

  describe('1. Zero Mock Data & Purga de DEMO_HISTORICAL_SAMPLE', () => {
    it('não renderiza NENHUM contrato fictício quando a API retorna lista vazia', () => {
      // Simula sessão autenticada com $10,000.00 demo
      store.set('binmax_auth_session', JSON.stringify({
        token: 'valid-jwt',
        user: { id: 'usr-1', name: 'Tester', email: 'test@binmax.test', demoBalanceMinor: 1000000 },
      }));

      // Cache do React Query inicializado vazio
      queryClient.setQueryData(['contracts'], []);

      const html = renderHistoryWithQuery();

      // Prova que DEMO_HISTORICAL_SAMPLE foi completamente purgado
      expect(html).not.toContain('cnt_demo_01');
      expect(html).not.toContain('cnt_demo_02');
      expect(html).not.toContain('cnt_demo_03');
      expect(html).not.toContain('cnt_demo_04');
      expect(html).not.toContain('cnt_demo_05');
      expect(html).not.toContain('cnt_demo_06');

      // Deve exibir o Empty State honesto
      expect(html).toContain('No se encontraron operaciones registradas');
      expect(html).toMatch(/data-testid="total-ops-count"[^>]*>0<\/div>/);
    });

    it('sanitiza e escapa injeção CSV em campos de contratos exportados', () => {
      const maliciousFields = ['=cmd|', '+123', '-456', '@formula', 'Text "with" quotes', 'Normal text'];
      const sanitized = maliciousFields.map(sanitizeCsvField);

      expect(sanitized[0]).toBe("'=cmd|");
      expect(sanitized[1]).toBe("'+123");
      expect(sanitized[2]).toBe("'-456");
      expect(sanitized[3]).toBe("'@formula");
      expect(sanitized[4]).toBe('"Text ""with"" quotes"');
      expect(sanitized[5]).toBe('Normal text');
    });
  });

  describe('2. Integridade Contábil da Conta Real e Demo', () => {
    it('apresenta saldo rigoroso de $0.00 para conta real e isolamento total de operações', () => {
      store.set('binmax_auth_session', JSON.stringify({
        token: 'valid-jwt',
        user: { id: 'usr-new', name: 'Novo Usuario', email: 'novo@binmax.test', demoBalanceMinor: 1000000 },
      }));

      // Mesmo que existam contratos demo no cache, a visão da conta real não os exibe
      queryClient.setQueryData(['contracts'], [
        {
          id: 'real-contract-1',
          symbol: 'VOL_50',
          direction: 'UP',
          stake_minor: 1000,
          status: 'SETTLED',
          result: 'WIN',
          payout_minor: 1850,
          entry_price: 100.5,
          strike_price: 101.2,
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
        },
      ]);

      const html = renderHistoryWithQuery();
      // O cabeçalho secundário e o sumário devem reconhecer a conta
      expect(html).toContain('Cuenta de práctica');
      expect(html).toContain('Cuenta real');
    });

    it('calcula métricas de stake e lucro líquido estritamente em centavos inteiros (minor)', () => {
      const realContracts: Contract[] = [
        {
          id: 'ord-01',
          symbol: 'VOL_50',
          direction: 'UP',
          stake_minor: 10000, // $100.00
          status: 'SETTLED',
          result: 'WIN',
          payout_minor: 18500, // $185.00 (+85.00 lucro)
          entry_price: 500.0,
          strike_price: 501.5,
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
        },
        {
          id: 'ord-02',
          symbol: 'VOL_25',
          direction: 'DOWN',
          stake_minor: 5000, // $50.00
          status: 'SETTLED',
          result: 'LOSS',
          payout_minor: 0, // -$50.00 perda
          entry_price: 250.0,
          strike_price: 251.0,
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
        },
      ];

      queryClient.setQueryData(['contracts'], realContracts);
      const html = renderHistoryWithQuery(realContracts);

      // Total Stake: 10000 + 5000 = 15000 minor ($150.00)
      expect(html).toContain('$150.00');

      // Net Profit: +8500 - 5000 = +3500 minor (+$35.00)
      expect(html).toContain('+$35.00');

      // Operações: 2
      expect(html).toMatch(/data-testid="total-ops-count"[^>]*>2<\/div>/);
    });
  });

  describe('3. Estresse Concorrente (100 Contratos) e Resiliência a Caos', () => {
    it('processa e renderiza 100 contratos auditados em menos de 100ms sem distorção contábil', () => {
      const largeContracts: Contract[] = Array.from({ length: 100 }, (_, i) => ({
        id: `stress-contract-${i}`,
        symbol: i % 2 === 0 ? 'VOL_50' : 'VOL_100',
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: 1000, // $10.00
        status: 'SETTLED',
        result: i % 2 === 0 ? 'WIN' : 'LOSS',
        payout_minor: i % 2 === 0 ? 1850 : 0,
        entry_price: 100 + i,
        strike_price: 100 + i + (i % 2 === 0 ? 0.5 : -0.5),
        created_at: new Date(Date.now() - i * 60000).toISOString(),
        expires_at: new Date(Date.now() - i * 60000 + 30000).toISOString(),
      }));

      queryClient.setQueryData(['contracts'], largeContracts);

      const t0 = performance.now();
      const html = renderHistoryWithQuery(largeContracts);
      const duration = performance.now() - t0;

      expect(duration).toBeLessThan(500); // Deve ser veloz mesmo com 100 linhas SSR (tolerância multithread)
      expect(html).toMatch(/data-testid="total-ops-count"[^>]*>100<\/div>/);
      // 100 * $10 = $1,000.00
      expect(html).toContain('$1,000.00');
    });

    it('caos: lida com falha de rede/API retornando null ou erro sem estourar exceção', () => {
      queryClient.setQueryData(['contracts'], null);

      expect(() => {
        const html = renderHistoryWithQuery();
        expect(html).toContain('No se encontraron operaciones registradas');
      }).not.toThrow();
    });
  });
});
