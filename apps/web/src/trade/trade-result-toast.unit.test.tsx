import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradeResultToast } from '../components/toasts/TradeResultToast';

describe('SUBETAPA 04: TradeResultToast (Aviso de Resultado da Sessão 4)', () => {
  it('4.1 Renderiza Toast de Vitória com checkmark verde, Ganaste e +$85.00', () => {
    const html = renderToString(
      <TradeResultToast
        result="WIN"
        amountFormatted="+$85.00"
        assetSymbol="NZDJPY_OTC"
        direction="SUBE"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="trade-result-toast-win"');
    expect(html).toContain('✓');
    expect(html).toContain('Ganaste');
    expect(html).toContain('+$85.00');
    expect(html).toContain('NZD/JPY · SUBE');
    expect(html).toContain('data-testid="btn-close-toast"');
  });

  it('4.2 Renderiza Toast de Derrota com X vermelho, Perdiste e -$100.00', () => {
    const html = renderToString(
      <TradeResultToast
        result="LOSS"
        amountFormatted="-$100.00"
        assetSymbol="NZDJPY_OTC"
        direction="BAJA"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="trade-result-toast-loss"');
    expect(html).toContain('✕');
    expect(html).toContain('Perdiste');
    expect(html).toContain('-$100.00');
    expect(html).toContain('NZD/JPY · BAJA');
  });

  it('4.3 Papel semântico acessível de alert com rótulo ARIA', () => {
    const html = renderToString(
      <TradeResultToast
        result="WIN"
        amountFormatted="+$85.00"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-label="Resultado de la operación"');
  });
});
