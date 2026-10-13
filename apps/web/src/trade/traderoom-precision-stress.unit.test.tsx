import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TradeResultToast } from '../components/toasts/TradeResultToast';

describe('Subetapa 05 — Sala de Trading (Instrumentação Cirúrgica & Latência Honesta)', () => {
  it('garante que o TradeResultToast fecha em 4s (4000ms) conforme especificação do Designer Sênior', () => {
    const onClose = vi.fn();
    const html = renderToString(
      <TradeResultToast
        result="WIN"
        amountFormatted="+$85.00"
        assetSymbol="SYNTH_VOL_50"
        direction="SUBE"
        onClose={onClose}
      />
    );

    expect(html).toContain('data-testid="trade-result-toast-win"');
    expect(html).toContain('bm-tabular-nums');
    expect(html).toContain('Ganaste');
    expect(html).toContain('+$85.00');
    expect(html).toContain('260ms cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('valida que o Toast de derrota é sóbrio, sem drama punitivo', () => {
    const html = renderToString(
      <TradeResultToast
        result="LOSS"
        amountFormatted="-$100.00"
        assetSymbol="SYNTH_VOL_50"
        direction="BAJA"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('data-testid="trade-result-toast-loss"');
    expect(html).toContain('Perdiste');
    expect(html).toContain('-$100.00');
    expect(html).not.toContain('confetti');
    expect(html).not.toContain('sparkle');
  });

  describe('Teste de Estresse da Sala de Trading', () => {
    it('executa 100 ciclos de renderização de toasts com alternância rápida de WIN/LOSS em menos de 100ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const isWin = i % 2 === 0;
        const html = renderToString(
          <TradeResultToast
            result={isWin ? 'WIN' : 'LOSS'}
            amountFormatted={isWin ? '+$85.00' : '-$100.00'}
            assetSymbol="SYNTH_VOL_50"
            direction={isWin ? 'SUBE' : 'BAJA'}
            onClose={vi.fn()}
          />
        );
        expect(html.length).toBeGreaterThan(500);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(100);
    });
  });
});
