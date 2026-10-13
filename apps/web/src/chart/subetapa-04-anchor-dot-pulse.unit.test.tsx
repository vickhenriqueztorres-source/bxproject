/**
 * Subetapa 04 — Anchor Dot Pulse (WIN Only)
 *
 * Verifica que o anchor dot do ExpirationResultPin:
 * - WIN: tem animação bmAnchorPulse com iteration count 1
 * - LOSS/DRAW: NÃO tem animação bmAnchorPulse
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExpirationResultPin } from './ExpirationResultPin';

function render(result: 'WIN' | 'LOSS' | 'DRAW') {
  return renderToString(
    React.createElement(ExpirationResultPin, {
      result,
      amountFormatted: result === 'WIN' ? '+$8.50' : '-$10.00',
      x: 200,
      y: 150,
      onClose: () => {},
    })
  );
}

describe('Subetapa 04 — Anchor Dot Pulse', () => {
  // T01: WIN anchor dot has pulse
  it('T01 — WIN: anchor dot tem bmAnchorPulse na animation', () => {
    const html = render('WIN');
    // Find the anchor dot section
    const anchorMatch = html.match(/data-testid="pin-anchor-dot"[^>]*style="([^"]*)"/);
    expect(anchorMatch).not.toBeNull();
    const anchorStyle = anchorMatch![1];
    expect(anchorStyle).toContain('bmAnchorPulse');
  });

  // T02: LOSS anchor dot has NO pulse
  it('T02 — LOSS: anchor dot NÃO tem bmAnchorPulse', () => {
    const html = render('LOSS');
    const anchorMatch = html.match(/data-testid="pin-anchor-dot"[^>]*style="([^"]*)"/);
    expect(anchorMatch).not.toBeNull();
    const anchorStyle = anchorMatch![1];
    expect(anchorStyle).not.toContain('bmAnchorPulse');
  });

  // T03: DRAW anchor dot has NO pulse
  it('T03 — DRAW: anchor dot NÃO tem bmAnchorPulse', () => {
    const html = render('DRAW');
    const anchorMatch = html.match(/data-testid="pin-anchor-dot"[^>]*style="([^"]*)"/);
    expect(anchorMatch).not.toBeNull();
    const anchorStyle = anchorMatch![1];
    expect(anchorStyle).not.toContain('bmAnchorPulse');
  });

  // T04: Pulse count is 1, not infinite (anti-casino)
  it('T04 — Pulse é iteration count 1, não infinite', () => {
    const html = render('WIN');
    const anchorMatch = html.match(/data-testid="pin-anchor-dot"[^>]*style="([^"]*)"/);
    expect(anchorMatch).not.toBeNull();
    const anchorStyle = anchorMatch![1];
    expect(anchorStyle).not.toContain('infinite');
  });

  // T05: Anchor dot base size
  it('T05 — Anchor dot mantém width: 7px e height: 7px base', () => {
    const html = render('WIN');
    const anchorMatch = html.match(/data-testid="pin-anchor-dot"[^>]*style="([^"]*)"/);
    expect(anchorMatch).not.toBeNull();
    const anchorStyle = anchorMatch![1];
    expect(anchorStyle).toContain('width:7px');
    expect(anchorStyle).toContain('height:7px');
  });
});
