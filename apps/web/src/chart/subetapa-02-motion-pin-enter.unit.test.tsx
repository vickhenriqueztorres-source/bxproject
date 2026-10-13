/**
 * Subetapa 02 — ExpirationResultPin com Motion Real
 *
 * Verifica que o componente usa os keyframes oficiais bmPinEnter,
 * tokens de cor corretos, sem referência ao keyframe órfão pinPopIn,
 * e zero anti-patterns de cassino.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExpirationResultPin } from './ExpirationResultPin';

function render(props: Partial<Parameters<typeof ExpirationResultPin>[0]> = {}) {
  return renderToString(
    React.createElement(ExpirationResultPin, {
      result: 'WIN',
      amountFormatted: '+$8.50',
      x: 200,
      y: 150,
      onClose: () => {},
      ...props,
    })
  );
}

describe('Subetapa 02 — ExpirationResultPin Motion', () => {
  // T01: WIN test-id
  it('T01 — Renderiza data-testid="expiration-result-pin-win" para WIN', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('data-testid="expiration-result-pin-win"');
  });

  // T02: LOSS test-id
  it('T02 — Renderiza data-testid="expiration-result-pin-loss" para LOSS', () => {
    const html = render({ result: 'LOSS', amountFormatted: '-$10.00' });
    expect(html).toContain('data-testid="expiration-result-pin-loss"');
  });

  // T03: WIN cor verde
  it('T03 — PIN WIN usa cor #22C47A (token --profit)', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('#22C47A');
  });

  // T04: LOSS cor vermelha
  it('T04 — PIN LOSS usa cor vermelha (#E5484D)', () => {
    const html = render({ result: 'LOSS', amountFormatted: '-$10.00' });
    expect(html).toContain('#E5484D');
  });

  // T05: DRAW cor cinza/metal
  it('T05 — PIN DRAW usa cor #8A92A1 (metal)', () => {
    const html = render({ result: 'DRAW', amountFormatted: '$0.00' });
    expect(html).toContain('#8A92A1');
  });

  // T06: Usa bmPinEnter (keyframe oficial)
  it('T06 — Contém bmPinEnter na animação inline', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('bmPinEnter');
  });

  // T07: Usa 260ms (token --t-enter)
  it('T07 — Contém 260ms na duração da animação', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('260ms');
  });

  // T08: Curva correta
  it('T08 — Contém cubic-bezier(0.16, 1, 0.3, 1) na curva', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('cubic-bezier(0.16, 1, 0.3, 1)');
    // Alternativa: pode usar cubic-bezier(0.16,1,0.3,1)
  });

  // T09: Removeu keyframe órfão
  it('T09 — NÃO contém pinPopIn (keyframe órfão removido)', () => {
    const html = render({ result: 'WIN' });
    expect(html).not.toContain('pinPopIn');
  });

  // T10: Anti-cassino
  it('T10 — NÃO contém bounce, elastic ou spring', () => {
    const html = render({ result: 'WIN' });
    expect(html.toLowerCase()).not.toContain('bounce');
    expect(html.toLowerCase()).not.toContain('elastic');
    expect(html.toLowerCase()).not.toContain('spring');
  });

  // T11: Botão de fechar
  it('T11 — pin-close-btn está presente', () => {
    const html = render({ result: 'WIN' });
    expect(html).toContain('pin-close-btn');
  });

  // T12: Valor do resultado
  it('T12 — Renderiza amountFormatted no body do card', () => {
    const html = render({ result: 'WIN', amountFormatted: '+$85.00' });
    expect(html).toContain('+$85.00');
  });

  // Testes de estresse
  it('T13-STRESS — 10 pins simultâneos renderizam sem erro', () => {
    for (let i = 0; i < 10; i++) {
      const html = render({ x: i * 50, y: i * 30, amountFormatted: `+$${i * 10}.00` });
      expect(html).toContain('expiration-result-pin');
    }
  });

  it('T14-STRESS — Pin com amountFormatted de 20 chars renderiza sem erro', () => {
    const html = render({ amountFormatted: '+$999,999,999,999.99' });
    expect(html).toContain('+$999,999,999,999.99');
  });
});
