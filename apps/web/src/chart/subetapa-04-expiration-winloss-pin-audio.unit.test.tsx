import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ExpirationResultPin } from './ExpirationResultPin';
import { soundEngine } from '../lib/sound-engine';

describe('SUBETAPA 04: Pin de Expiração no Gráfico e Áudio Dopaminérgico', () => {
  it('4.1 Renderiza Pin de Vitória com fundo verde #22C47A, RESULTADO (L/P) e +$9.02', () => {
    const onClose = vi.fn();
    const html = renderToString(
      <ExpirationResultPin
        result="WIN"
        amountFormatted="+$9.02"
        x={320}
        y={180}
        onClose={onClose}
      />
    );

    expect(html).toContain('data-testid="expiration-result-pin-win"');
    expect(html).toContain('RESULTADO (L/P)');
    expect(html).toContain('+$9.02');
    expect(html).toContain('background:#22C47A');
    expect(html).toContain('data-testid="pin-close-btn"');
    // Coordenadas
    expect(html).toContain('left:320px');
    expect(html).toContain('top:180px');
  });

  it('4.2 Renderiza Pin de Derrota com fundo vermelho #E5484D e -$10.00', () => {
    const onClose = vi.fn();
    const html = renderToString(
      <ExpirationResultPin
        result="LOSS"
        amountFormatted="-$10.00"
        x={250}
        y={140}
        onClose={onClose}
      />
    );

    expect(html).toContain('data-testid="expiration-result-pin-loss"');
    expect(html).toContain('RESULTADO (L/P)');
    expect(html).toContain('-$10.00');
    expect(html).toContain('background:#E5484D');
  });

  it('4.3 SoundEngine sintetiza áudio dopaminérgico para Win e Loss sem falhas', () => {
    soundEngine.setMuted(false);
    expect(() => soundEngine.playWin()).not.toThrow();
    expect(() => soundEngine.playLoss()).not.toThrow();
  });
});
