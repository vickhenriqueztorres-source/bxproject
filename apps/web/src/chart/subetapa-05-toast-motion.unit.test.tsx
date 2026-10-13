/**
 * Subetapa 05 — TradeResultToast com Motion Real
 *
 * Verifica que o toast usa keyframes oficiais bmToastSlideIn,
 * sem referência ao keyframe órfão slideUpFade.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradeResultToast } from '../components/toasts/TradeResultToast';

function render(props: Partial<Parameters<typeof TradeResultToast>[0]> = {}) {
  return renderToString(
    React.createElement(TradeResultToast, {
      result: 'WIN',
      amountFormatted: '+$8.50',
      onClose: () => {},
      ...props,
    })
  );
}

describe('Subetapa 05 — TradeResultToast Motion', () => {
  // T01: WIN test-id
  it('T01 — Toast WIN renderiza data-testid="trade-result-toast-win"', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('data-testid="trade-result-toast-win"');
  });

  // T02: LOSS test-id
  it('T02 — Toast LOSS renderiza data-testid="trade-result-toast-loss"', () => {
    const html = render({ result: 'LOSS', amountFormatted: '-$10.00' });
    expect(html).toContain('data-testid="trade-result-toast-loss"');
  });

  // T03: Uses bmToastSlideIn
  it('T03 — Contém bmToastSlideIn na animação', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('bmToastSlideIn');
  });

  // T04: 260ms duration
  it('T04 — Contém 260ms na duração da animação', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('260ms');
  });

  // T05: No orphan slideUpFade
  it('T05 — NÃO contém slideUpFade (keyframe órfão removido)', () => {
    const html = render({ result: 'WIN' });
    expect(html).not.toContain('slideUpFade');
  });

  // T06: Close button
  it('T06 — btn-close-toast presente', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('btn-close-toast');
  });

  // T07: Amount
  it('T07 — toast-amount exibe amountFormatted', () => {
    const html = render({ result: 'WIN', amountFormatted: '+$85.00' });
    expect(html).toContain('+$85.00');
  });

  // T08: Details
  it('T08 — toast-details exibe par e direção', () => {
    const html = render({ result: 'WIN', assetSymbol: 'NZDJPY', direction: 'SUBE' });
    expect(html).toContain('NZD/JPY');
    expect(html).toContain('SUBE');
  });

  // Stress test
  it('T09-STRESS — Toast com texto longo não quebra layout', () => {
    const html = render({ amountFormatted: '+$999,999,999,999.99' });
    expect(html).toContain('+$999,999,999,999.99');
  });
});
