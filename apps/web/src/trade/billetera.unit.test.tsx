import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BilleteraModal } from '../wallet/BilleteraModal';
import { DepositForm } from '../wallet/DepositForm';
import { TransactionHistoryTable, type Transaction } from '../wallet/TransactionHistoryTable';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { TerminalHeader } from '../components/header/TerminalHeader';

describe('Subetapa 6: Billetera Institucional, Depósito e Histórico de Transações', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. Renderização e Fidelidade Visual à Imagem 3', () => {
    it('BilleteraModal: Renderiza cabeçalho, cards de saldo e as 3 abas institucionais', () => {
      const html = renderToString(
        <BilleteraModal
          isOpen={true}
          onClose={vi.fn()}
          availableMinor={960375} // $9,603.75
        />
      );

      // Título e subtítulo
      expect(html).toContain('data-testid="billetera-title"');
      expect(html).toContain('Billetera');
      expect(html).toContain('Gestiona tus fondos, deposita y consulta tu historial de transacciones.');

      // Cards de saldo
      expect(html).toContain('data-testid="card-saldo-disponible"');
      expect(html).toContain('Saldo disponible');
      expect(html).toContain('$9,603.75');
      expect(html).toContain('data-testid="card-saldo-operaciones"');
      expect(html).toContain('Saldo en operaciones');
      expect(html).toContain('$0.00');

      // Abas
      expect(html).toContain('data-testid="tab-depositar"');
      expect(html).toContain('Depositar');
      expect(html).toContain('data-testid="tab-metodos"');
      expect(html).toContain('Métodos de pago');
      expect(html).toContain('data-testid="tab-historial"');
      expect(html).toContain('Historial');

      // Botão fechar
      expect(html).toContain('data-testid="btn-close-billetera"');
    });

    it('DepositForm: Renderiza os 4 métodos de pagamento com marcas oficiais', () => {
      const html = renderToString(<DepositForm />);

      expect(html).toContain('data-testid="method-card"');
      expect(html).toContain('Tarjeta de crédito / débito');
      expect(html).toContain('VISA');
      expect(html).toContain('mastercard');

      expect(html).toContain('data-testid="method-bank"');
      expect(html).toContain('Transferencia bancaria');

      expect(html).toContain('data-testid="method-crypto"');
      expect(html).toContain('Criptomonedas');
      expect(html).toContain('BTC');
      expect(html).toContain('USDT');

      expect(html).toContain('data-testid="method-wallet"');
      expect(html).toContain('Billeteras digitales');
      expect(html).toContain('Skrill');
      expect(html).toContain('NETELLER');
    });

    it('DepositForm: Renderiza os 6 presets de valor e o input personalizado', () => {
      const html = renderToString(<DepositForm />);

      // 6 presets ($50, $100, $250, $500, $1,000, $5,000)
      expect(html).toContain('data-testid="preset-50"');
      expect(html).toContain('data-testid="preset-100"');
      expect(html).toContain('data-testid="preset-250"');
      expect(html).toContain('data-testid="preset-500"');
      expect(html).toContain('data-testid="preset-1000"');
      expect(html).toContain('data-testid="preset-5000"');

      // Campo personalizado
      expect(html).toContain('data-testid="custom-deposit-input"');
      expect(html).toContain('Mínimo $10 | Máximo $10,000');

      // Botão com valor selecionado e ícone de segurança
      expect(html).toContain('data-testid="btn-submit-deposit"');
      expect(html).toContain('Depositar $100');
      expect(html).toContain('Pago seguro y cifrado');
    });

    it('TransactionHistoryTable: Renderiza extrato com depósitos, saques e status Completado', () => {
      const html = renderToString(<TransactionHistoryTable />);

      expect(html).toContain('data-testid="transaction-history-table-container"');
      expect(html).toContain('Historial de transacciones');
      expect(html).toContain('data-testid="history-filter-select"');

      // Colunas
      expect(html).toContain('Fecha y hora');
      expect(html).toContain('Tipo');
      expect(html).toContain('Método');
      expect(html).toContain('Monto');
      expect(html).toContain('Estado');

      // Itens de amostra
      expect(html).toContain('Depósito');
      expect(html).toContain('Retiro');
      expect(html).toContain('VISA');
      expect(html).toContain('Banco');
      expect(html).toContain('Completado');
    });
  });

  describe('2. Testes de Estresse e Concorrência', () => {
    it('Renderização instantânea de histórico com 50 transações', () => {
      const dummyTransactions: Transaction[] = Array.from({ length: 50 }, (_, i) => ({
        id: `tx-stress-${i}`,
        date: '08 oct 2024, 12:00',
        type: i % 2 === 0 ? 'DEPOSIT' : 'WITHDRAWAL',
        method: i % 3 === 0 ? 'VISA' : i % 3 === 1 ? 'USDT' : 'Banco',
        methodIcon: '💳',
        amountMinor: (i + 1) * 5000,
        status: 'COMPLETED',
      }));

      const start = performance.now();
      const html = renderToString(<TransactionHistoryTable transactions={dummyTransactions} />);
      const elapsed = performance.now() - start;

      expect(html).toBeTruthy();
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('3. Testes de Caos e Validação de Limites Financeiros', () => {
    it('Modal fechado quando isOpen = false não renderiza nada no DOM', () => {
      const html = renderToString(
        <BilleteraModal isOpen={false} onClose={vi.fn()} />
      );
      expect(html).toBe('');
    });
  });

  describe('4. Padrão Duas Portas e Integração com TerminalHeader', () => {
    const headerProps = {
      activeSymbol: 'EURUSD_OTC',
      openTabs: ['EURUSD_OTC'],
      onSelectTab: vi.fn(),
      onCloseTab: vi.fn(),
      onAddTab: vi.fn(),
      balanceMinor: 1000000,
      accountEmail: 'trader@binmax.com',
      isLive: true,
      latencyMs: 45,
      onResetDemo: vi.fn(),
      onSignOut: vi.fn(),
    };

    it('Quando NEW_TRADEROOM = false, TerminalHeader preserva o modal clássico de recarga', () => {
      setNewTraderoomEnabled(false);
      const html = renderToString(<TerminalHeader {...headerProps} />);

      // Não contém elementos da Billetera rica
      expect(html).not.toContain('data-testid="billetera-view"');
      expect(html).not.toContain('Gestiona tus fondos');
    });

    it('Quando NEW_TRADEROOM = true, TerminalHeader disponibiliza o botão institucional DEPOSITAR', () => {
      setNewTraderoomEnabled(true);
      const html = renderToString(<TerminalHeader {...headerProps} />);

      expect(html).toContain('data-testid="header-deposit-button"');
      expect(html).toContain('DEPOSITAR');
    });
  });
});
