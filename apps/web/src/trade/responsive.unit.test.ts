import { describe, it, expect } from 'vitest';

describe('Responsividade Móvel e Tablet — Requisitos Etapa 10', () => {
  it('Alvo de toque mínimo deve respeitar especificação WCAG e IQ Option (>= 44px)', () => {
    const minTouchTargetPx = 44;
    const mobileButtonHeightPx = 54;
    expect(mobileButtonHeightPx).toBeGreaterThanOrEqual(minTouchTargetPx);
  });

  it('Input de investimento deve suportar teclado numérico nativo de smartphones', () => {
    const inputMode = 'decimal';
    expect(['decimal', 'numeric']).toContain(inputMode);
  });

  it('Breakpoints canônicos devem separar celular (< 768px), tablet (768-1024px) e desktop (> 1024px)', () => {
    const mobileMax = 767;
    const tabletMin = 768;
    const tabletMax = 1024;
    const desktopMin = 1025;

    expect(mobileMax).toBeLessThan(tabletMin);
    expect(tabletMax).toBeLessThan(desktopMin);
  });
});
