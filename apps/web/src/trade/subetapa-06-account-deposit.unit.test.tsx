import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { TurboDepositModal, PRESET_AMOUNTS } from '../wallet/TurboDepositModal';

describe('SUBETAPA 06: Seletor de Contas Demo/Real & Modal de Depósito Turbo (Sessões 8 & 9)', () => {
  describe('6.1 AccountSelectorDropdown: Fidelidade Visual à Sessão 8', () => {
    it('Renderiza o trigger fechado com visual verde e informações da conta ativa', () => {
      const htmlDemo = renderToString(
        <AccountSelectorDropdown
          balanceMinor={1000000} // $10,000.00
          accountType="DEMO"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
          accountEmail="demo@binmax.com"
          initialOpen={false}
        />
      );

      expect(htmlDemo).toContain('data-testid="account-selector-container"');
      expect(htmlDemo).toContain('data-testid="account-selector-button"');
      expect(htmlDemo).toContain('Cuenta de práctica');
      expect(htmlDemo).toContain('$10,000.00');

      const htmlReal = renderToString(
        <AccountSelectorDropdown
          balanceMinor={null}
          accountType="REAL"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
          accountEmail="real@binmax.com"
          initialOpen={false}
        />
      );

      expect(htmlReal).toContain('Cuenta real');
      expect(htmlReal).toContain('$0.00');
    });

    it('Renderiza o menu aberto com as opções Cuenta Real e Cuenta de Práctica da Sessão 8', () => {
      const html = renderToString(
        <AccountSelectorDropdown
          balanceMinor={1000000}
          accountType="DEMO"
          onSelectAccountType={vi.fn()}
          onResetDemo={vi.fn()}
          accountEmail="trader@binmax.com"
          initialOpen={true}
        />
      );

      expect(html).toContain('data-testid="account-dropdown-menu"');

      // Opção 1: Cuenta real
      expect(html).toContain('data-testid="account-option-real"');
      expect(html).toContain('Cuenta real');
      expect(html).toContain('trader@binmax.com');
      expect(html).toContain('$0.00');

      // Opção 2: Cuenta de práctica
      expect(html).toContain('data-testid="account-option-demo"');
      expect(html).toContain('Cuenta de práctica');
      expect(html).toContain('Saldo demonstrativo');
      expect(html).toContain('$10,000.00');
      expect(html).toContain('data-testid="demo-account-check"');

      // Botão de recarga direta
      expect(html).toContain('data-testid="btn-reload-demo"');
      expect(html).toContain('Recargar práctica');
    });
  });

  describe('6.2 TurboDepositModal: Modal de Alta Conversão da Sessão 9', () => {
    it('Renderiza cabeçalho, métodos PIX, Tarjeta, USDT, presets de valores e rodapé seguro', () => {
      const html = renderToString(
        <TurboDepositModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
          onResetDemo={vi.fn()}
        />
      );

      // Título e Fechamento
      expect(html).toContain('data-testid="turbo-deposit-modal"');
      expect(html).toContain('data-testid="deposit-modal-title"');
      expect(html).toContain('Depositar');
      expect(html).toContain('data-testid="deposit-modal-close-btn"');

      // 1. Método PIX
      expect(html).toContain('data-testid="payment-method-pix"');
      expect(html).toContain('PIX');
      expect(html).toContain('Mínimo $10');

      // 2. Método Tarjeta
      expect(html).toContain('data-testid="payment-method-tarjeta"');
      expect(html).toContain('Tarjeta');

      // 3. Método Cripto (USDT)
      expect(html).toContain('data-testid="payment-method-usdt"');
      expect(html).toContain('Cripto (USDT)');

      // Presets de Monto ($20, $50, $100, $200)
      expect(PRESET_AMOUNTS).toEqual([20, 50, 100, 200]);
      expect(html).toContain('data-testid="amount-pill-20"');
      expect(html).toContain('data-testid="amount-pill-50"');
      expect(html).toContain('data-testid="amount-pill-100"');
      expect(html).toContain('data-testid="amount-pill-200"');

      // Botão de Ação Continuar
      expect(html).toContain('data-testid="turbo-deposit-continue-btn"');
      expect(html).toContain('Continuar');

      // Rodapé de Segurança
      expect(html).toContain('data-testid="turbo-deposit-security-footer"');
      expect(html).toContain('Tus pagos son procesados de forma segura');
    });

    it('Não renderiza quando isOpen é falso', () => {
      const html = renderToString(
        <TurboDepositModal
          isOpen={false}
          onClose={vi.fn()}
        />
      );
      expect(html).toBe('');
    });
  });

  describe('6.3 Teste de Estresse e Desempenho (Sessões 8 & 9)', () => {
    it('Executa 100 ciclos de renderização do Seletor de Contas e Modal de Depósito em alta velocidade', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <AccountSelectorDropdown
            balanceMinor={1000000}
            accountType={i % 2 === 0 ? 'DEMO' : 'REAL'}
            onSelectAccountType={vi.fn()}
            onResetDemo={vi.fn()}
            initialOpen={true}
          />
        );
        renderToString(
          <TurboDepositModal
            isOpen={true}
            onClose={vi.fn()}
          />
        );
      }
      const elapsed = performance.now() - start;
      // 200 renders completos de SSR em menos de 800ms
      expect(elapsed).toBeLessThan(800);
    });
  });
});
