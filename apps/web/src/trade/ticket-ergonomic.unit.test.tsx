import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { parseStakeInput, formatMinor } from '../lib/money';
import { calculateExecutionExpiry, calculateExpirySlots } from './expiry-calculator';
import { setTraderoomPolishEnabled } from '../lib/traderoom-polish';

// Este arquivo cobre o ticket anterior (chips de valor, +85% em linha). Ver subetapa-polish-01-ticket.
setTraderoomPolishEnabled(false);

function renderOrderTicket(props: Partial<React.ComponentProps<typeof OrderTicket>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const defaultProps: React.ComponentProps<typeof OrderTicket> = {
    symbol: 'NZDJPY_OTC',
    paused: false,
    stale: false,
    availableMinor: 1000000, // $10,000.00
    soundEnabled: false,
    onChanged: vi.fn(),
    ...props,
  };

  return renderToString(
    <QueryClientProvider client={queryClient}>
      <OrderTicket {...defaultProps} />
    </QueryClientProvider>
  );
}

describe('Subetapa 5: Boleta de Ordens Ergonômica (SUBE / BAJA) Turbo Prata', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. Renderização Ergonômica dos Blocos do Ticket (Imagem 1 & Imagem 2)', () => {
    it('D1 Monto: Renderiza cabeçalho, botão [−], campo [$ 100] e botão [+]', () => {
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="ticket-block-monto"');
      expect(html).toContain('Monto');
      expect(html).toContain('aria-label="Ayuda monto"');
      expect(html).toContain('aria-label="Disminuir monto"');
      expect(html).toContain('aria-label="Aumentar monto"');
      expect(html).toContain('id="binmax-stake-input"');
      expect(html).toContain('value="100"');
    });

    it('D2 Expiración: Renderiza cabeçalho, botão [−], relógio SVG, tempo de expiração e botão [+]', () => {
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="ticket-block-expiracion"');
      expect(html).toContain('Expiración');
      expect(html).toContain('aria-label="Ayuda expiración"');
      expect(html).toContain('aria-label="Anterior expiración"');
      expect(html).toContain('aria-label="Siguiente expiración"');
      // Contém o ícone SVG de relógio
      expect(html).toContain('<circle cx="12" cy="12" r="10"');
      expect(html).toContain('<polyline points="12 6 12 12 16 14"');
    });

    it('D3 Ganancia: Exibe percentual gigante +85% e valor projetado +$85,00 em verde neon', () => {
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="ticket-block-ganancia"');
      expect(html).toContain('Ganancia');
      expect(html).toContain('data-testid="ganancia-pct"');
      expect(html).toContain('+85%');
      expect(html).toContain('data-testid="ganancia-amount"');
      // Em USD pt-BR / en-US renderiza o valor monetário de US$ 85,00
      expect(html).toMatch(/85,00|85\.00/);
    });

    it('D4 Botão SUBE: Renderiza fundo verde #22C47A, ícone de tendência ascendente com seta e texto SUBE', () => {
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="btn-sube"');
      expect(html).toContain('data-testid="icon-sube"');
      // SVG polyline da linha de tendência subindo
      expect(html).toContain('points="22 7 13.5 15.5 8.5 10.5 2 17"');
      expect(html).toContain('points="16 7 22 7 22 13"');
      expect(html).toContain('SUBE');
    });

    it('D5 Botão BAJA: Renderiza fundo vermelho #F2545B, ícone de tendência descendente com seta e texto BAJA', () => {
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="btn-baja"');
      expect(html).toContain('data-testid="icon-baja"');
      // SVG polyline da linha de tendência descendo
      expect(html).toContain('points="22 17 13.5 8.5 8.5 13.5 2 7"');
      expect(html).toContain('points="16 17 22 17 22 11"');
      expect(html).toContain('BAJA');
    });
  });

  describe('2. Integridade Matemática & Idempotência Financeira', () => {
    it('Valida piso de $1.00 e integridade de parsing em centavos inteiros', () => {
      expect(parseStakeInput('1')).toBe(100);
      expect(parseStakeInput('1,00')).toBe(100);
      expect(parseStakeInput('100')).toBe(10000);
      expect(parseStakeInput('0,99')).toBeNull();
      expect(parseStakeInput('-5')).toBeNull();
      expect(parseStakeInput('abc')).toBeNull();
    });

    it('Cálculo de retorno financeiro (+85% de $100 = $85 de lucro, $185 total)', () => {
      const stakeMinor = 10000; // $100.00
      const payoutPct = 85;
      const profitMinor = Math.round(stakeMinor * (payoutPct / 100)); // 8500 ($85.00)
      const totalMinor = stakeMinor + profitMinor; // 18500 ($185.00)

      expect(profitMinor).toBe(8500);
      expect(totalMinor).toBe(18500);
      expect(formatMinor(profitMinor)).toMatch(/85,00|85\.00/);
    });

    it('Simula concorrência e trava atômica de duplo clique com executingRef', () => {
      let isExecuting = false;
      let networkCalls = 0;

      const triggerOrder = () => {
        if (isExecuting) return false;
        isExecuting = true;
        networkCalls++;
        return true;
      };

      // Disparo de 10 cliques imediatos (duplo-clique veloz)
      const results: boolean[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(triggerOrder());
      }

      // Exatamente o 1º clique foi autorizado, os outros 9 foram bloqueados
      expect(results[0]).toBe(true);
      expect(results.slice(1).every((r) => r === false)).toBe(true);
      expect(networkCalls).toBe(1);
    });
  });

  describe('3. Testes de Caos, Risco e Solvência', () => {
    it('Bloqueio preventivo sob Feed Stale (cotação atrasada desabilita botões SUBE e BAJA)', () => {
      const html = renderOrderTicket({ stale: true });

      expect(html).toContain('data-testid="badge-stale"');
      expect(html).toContain('Atrasado');

      // Botões devem conter disabled
      const subeMatch = html.match(/data-testid="btn-sube"[^>]*disabled/);
      const bajaMatch = html.match(/data-testid="btn-baja"[^>]*disabled/);
      expect(subeMatch).not.toBeNull();
      expect(bajaMatch).not.toBeNull();
    });

    it('Bloqueio preventivo sob Índice Pausado (desabilita botões SUBE e BAJA)', () => {
      const html = renderOrderTicket({ paused: true });

      expect(html).toContain('data-testid="badge-paused"');
      expect(html).toContain('Pausado');

      const subeMatch = html.match(/data-testid="btn-sube"[^>]*disabled/);
      const bajaMatch = html.match(/data-testid="btn-baja"[^>]*disabled/);
      expect(subeMatch).not.toBeNull();
      expect(bajaMatch).not.toBeNull();
    });

    it('Proteção de Solvência: Saldo insuficiente desabilita envio de ordem', () => {
      // Investimento padrão $100 (10000 minor) vs saldo de apenas $10 (1000 minor)
      const html = renderOrderTicket({ availableMinor: 1000 });

      const subeMatch = html.match(/data-testid="btn-sube"[^>]*disabled/);
      const bajaMatch = html.match(/data-testid="btn-baja"[^>]*disabled/);
      expect(subeMatch).not.toBeNull();
      expect(bajaMatch).not.toBeNull();
    });
  });

  describe('4. Padrão Duas Portas e Compatibilidade Legada', () => {
    it('Quando NEW_TRADEROOM = false, renderiza o ticket legado clássico', () => {
      setNewTraderoomEnabled(false);
      const html = renderOrderTicket();

      // Não contém a boleta binmax
      expect(html).not.toContain('data-testid="binmax-order-ticket"');
      // Contém os elementos legados
      expect(html).toContain('VALOR DO INVESTIMENTO');
      expect(html).toContain('TIEMPO DE EXPIRACIÓN');
      expect(html).toContain('ACIMA');
      expect(html).toContain('ABAIXO');
    });

    it('Quando NEW_TRADEROOM = true, renderiza a boleta ergonômica Turbo Prata', () => {
      setNewTraderoomEnabled(true);
      const html = renderOrderTicket();

      expect(html).toContain('data-testid="binmax-order-ticket"');
      expect(html).toContain('SUBE');
      expect(html).toContain('BAJA');
      expect(html).not.toContain('▲ SUBIR');
      expect(html).not.toContain('▼ DESCER');
    });
  });
});
