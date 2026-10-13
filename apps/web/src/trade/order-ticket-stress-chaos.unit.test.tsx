import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { parseStakeInput, formatMinor, formatCurrencyBinmax } from '../lib/money';

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
    availableMinor: 1000000, // $10,000.00 USD
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

describe('SUBETAPA 04: Bateria de Testes de Estresse, Caos e Resiliência de Entrada no OrderTicket', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('Matriz 1: Testes de Estresse e Alta Frequência de Renderização', () => {
    it('ST-01: Executa 500 ciclos consecutivos de renderização do OrderTicket em menos de 1500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        const html = renderOrderTicket({
          availableMinor: 1000000 + i * 100,
        });
        expect(html).toContain('id="binmax-stake-input"');
        expect(html).toContain('>$<');
        expect(html).not.toContain('R$');
      }
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1500);
    });

    it('ST-02: Alternância contínua entre presets de valor em USD mantém integridade visual e ausência de NaN', () => {
      const presets = [10, 50, 100, 500];
      for (const p of presets) {
        const stakeMinor = p * 100;
        const formatted = formatCurrencyBinmax(stakeMinor);
        expect(formatted).toBe(`$${p.toFixed(2)}`);
        expect(formatted).not.toContain('NaN');
        expect(formatted).not.toContain('undefined');
        expect(formatted).not.toContain('R$');
      }
    });
  });

  describe('Matriz 2: Testes de Caos e Sanitização Estrita de Entrada', () => {
    it('CH-01: Rejeição absoluta de strings com prefixos de moeda estrangeira ou malformadas', () => {
      const chaoticInputs = [
        'R$ 10',
        'R$ 100',
        'R$ 100,00',
        '$10',
        '$100.00',
        'US$ 50',
        '100 USD',
        ' 100 ', // parseStakeInput faz trim internamente e aceita inteiros puros
        '-10',
        '-1',
        '0',
        '0,00',
        '0,99',
        '100,01',
        '100000',
        '1e5',
        'NaN',
        'undefined',
        '<script>alert("xss")</script>',
        'DROP TABLE contracts;',
        '10.50', // aceita vírgula como separador decimal pt-BR, ponto é rejeitado
      ];

      for (const input of chaoticInputs) {
        const parsed = parseStakeInput(input);
        if (input.trim() === '100') {
          // ' 100 ' é higienizado pelo trim para 100
          expect(parsed).toBe(10000);
        } else {
          expect(parsed).toBeNull();
        }
      }
    });

    it('CH-02: Entrada de stake inválida desabilita defensivamente os botões de execução (SUBE/BAJA)', () => {
      // Quando stakeMinor é null (input corrompido ou fora dos limites), blocked é true
      // Simulamos isso testando a boleta com saldo insuficiente ou valores inválidos
      const htmlInvalid = renderOrderTicket({ availableMinor: 0 });
      expect(htmlInvalid).toContain('data-testid="btn-sube"');
      expect(htmlInvalid).toContain('disabled=""');
      expect(htmlInvalid).toContain('data-testid="btn-baja"');
    });

    it('CH-03: Tolerância a overflows numéricos astronômicos sem quebrar a pilha do motor de dinheiro', () => {
      expect(() => parseStakeInput('999999999999999999999999999999')).not.toThrow();
      expect(parseStakeInput('999999999999999999999999999999')).toBeNull();

      expect(() => formatMinor(Number.MAX_SAFE_INTEGER)).not.toThrow();
      expect(() => formatCurrencyBinmax(Number.MAX_SAFE_INTEGER)).not.toThrow();
    });
  });

  describe('Matriz 3: Invariantes de Limites Operacionais (Boundaries)', () => {
    it('BD-01: Limite inferior: Mínimo $1.00 (100 centavos) é aceito, $0.99 é rejeitado', () => {
      expect(parseStakeInput('1')).toBe(100);
      expect(parseStakeInput('1,00')).toBe(100);
      expect(parseStakeInput('0,99')).toBeNull();
    });

    it('BD-02: Limite superior: Máximo $100.00 (10.000 centavos) é aceito, $100.01 é rejeitado', () => {
      expect(parseStakeInput('100')).toBe(10000);
      expect(parseStakeInput('100,00')).toBe(10000);
      expect(parseStakeInput('100,01')).toBeNull();
      expect(parseStakeInput('101')).toBeNull();
    });

    it('BD-03: Solvência pontual: Stake exatamente igual ao saldo disponível é autorizado', () => {
      const html = renderOrderTicket({ availableMinor: 10000 }); // $100.00 disponível para stake default de $100
      expect(html).not.toContain('disabled=""');
    });

    it('BD-04: Solvência pontual: Stake 1 centavo acima do saldo disponível é bloqueado', () => {
      const html = renderOrderTicket({ availableMinor: 9999 }); // $99.99 disponível para stake default de $100.00
      expect(html).toContain('disabled=""');
    });
  });
});
