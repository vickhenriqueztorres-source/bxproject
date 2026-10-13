import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderTicket } from './OrderTicket';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { formatCurrencyBinmax, parseStakeInput } from '../lib/money';

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

describe('SUBETAPA 02: Unificação Monetária (USD) e Rótulo Institucional no OrderTicket', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('TC-01: O container de entrada de stake exibe estritamente o símbolo $ (USD) e NUNCA exibe R$', () => {
    const html = renderOrderTicket();

    // Deve conter o símbolo de dólar $
    expect(html).toContain('>$<');
    expect(html).toContain('id="binmax-stake-input"');

    // NUNCA deve conter o resquício brasileiro R$ no ticket
    expect(html).not.toContain('R$');
    expect(html).not.toContain('>R$<');
  });

  it('TC-02: O rótulo visível do bloco de montante é "Monto" (espanhol neutro), erradicando "Valor" (pt-BR)', () => {
    const html = renderOrderTicket();

    // Rótulo textual visível deve ser Monto
    expect(html).toContain('>Monto<');

    // Não deve conter a tag span com o texto Valor residual
    expect(html).not.toMatch(/<span[^>]*>\s*Valor\s*<\/span>/);

    // Blocos irmãos em espanhol continuam íntegros
    expect(html).toContain('Expiración');
    expect(html).toContain('Ganancia');
    expect(html).toContain('SUBE');
    expect(html).toContain('BAJA');
  });

  it('TC-03: Coerência matemática monetária entre stake USD ($100), presets e Ganancia USD (+$85.00)', () => {
    const html = renderOrderTicket();

    // Input default 100 USD
    expect(html).toContain('value="100"');

    // Presets em USD: 10, 50, 100, 500
    expect(html).toContain('data-testid="preset-10"');
    expect(html).toContain('data-testid="preset-50"');
    expect(html).toContain('data-testid="preset-100"');
    expect(html).toContain('data-testid="preset-500"');

    // Ganancia de 85% sobre $100 deve ser +$85.00
    expect(html).toContain('data-testid="ganancia-amount"');
    expect(html).toContain('+$85.00');
  });

  it('TC-04: Conformidade com D-18: saldo $10,000.00 e bloqueio quando saldo for menor que o stake USD', () => {
    // Quando usuário tem $50.00 (5000 cents) e stake padrão é $100.00 (10000 cents)
    const htmlLowBalance = renderOrderTicket({ availableMinor: 5000 });
    expect(htmlLowBalance).toContain('disabled=""');

    // Quando usuário tem saldo suficiente ($10,000.00 = 1000000 cents)
    const htmlSufficient = renderOrderTicket({ availableMinor: 1000000 });
    expect(htmlSufficient).not.toContain('disabled=""');
  });

  it('TC-05: Modos compacto (isCompact=true) e padrão exibem uniformemente $ e Monto', () => {
    const htmlCompact = renderOrderTicket({ isCompact: true });
    expect(htmlCompact).toContain('>$<');
    expect(htmlCompact).toContain('>Monto<');
    expect(htmlCompact).not.toContain('R$');

    const htmlRegular = renderOrderTicket({ isCompact: false });
    expect(htmlRegular).toContain('>$<');
    expect(htmlRegular).toContain('>Monto<');
    expect(htmlRegular).not.toContain('R$');
  });
});
