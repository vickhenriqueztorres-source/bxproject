import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxWithdrawModal } from './BinmaxWithdrawModal';

describe('Subetapa 04 — Depósito e Saque (Gestão Financeira Sem Atrito)', () => {
  it('renderiza o modal de saque com escala suave, numerais tabulares e destaque ao PIX', () => {
    const html = renderToString(
      <BinmaxWithdrawModal
        isOpen={true}
        onClose={vi.fn()}
        availableBalanceFormatted="$12,450.00"
      />
    );

    expect(html).toContain('data-testid="binmax-withdraw-modal"');
    expect(html).toContain('bm-modal-scale');
    expect(html).toContain('bm-tabular-nums');
    expect(html).toContain('Retirar fondos');
    expect(html).toContain('$12,450.00');
    expect(html).toContain('⚡ PIX');
    expect(html).toContain('Instantáneo');
    expect(html).toContain('Primer retiro requiere verificación de identidad');
    expect(html).toContain('Simular solicitud');
    expect(html).toContain('Cuenta demo');
    expect(html).toContain('No se enviarán fondos');
    expect(html).toContain('Último retiro');
    expect(html).toContain('No disponible en esta demostración');
  });

  it('garante a ausência de elementos festivos de cassino ou confetes', () => {
    const html = renderToString(
      <BinmaxWithdrawModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(html).not.toContain('confetti');
    expect(html).not.toContain('sparkle');
    expect(html).not.toContain('jackpot');
  });

  it('quando isOpen = false não renderiza nada no DOM', () => {
    const html = renderToString(
      <BinmaxWithdrawModal
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(html).toBe('');
  });

  describe('Teste de Estresse de Renderização Financeira', () => {
    it('executa 100 ciclos de renderização do modal de saque em menos de 500ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        const html = renderToString(
          <BinmaxWithdrawModal
            isOpen={true}
            onClose={vi.fn()}
            availableBalanceFormatted={`$${(i * 150).toFixed(2)}`}
          />
        );
        expect(html.length).toBeGreaterThan(500);
        expect(html).toContain('Simular solicitud');
        expect(html).toContain(`$${(i * 150).toFixed(2)}`);
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
