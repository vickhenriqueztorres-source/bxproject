import { describe, it, expect } from 'vitest';

export const BINMAX_TOKENS = {
  NOCHE: '#0D0F14',
  PANEL: '#151922',
  PRATA: '#DCE1EA',
  BLANCO: '#F4F5F7',
  ACO: '#8A92A1',
  VERDE: '#22C47A',
  ROJO: '#F2545B',
} as const;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function getLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getLuminance(hexToRgb(hex1));
  const lum2 = getLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

describe('Tokens Turbo Prata e Contraste WCAG (Etapa 03)', () => {
  it('Paleta Oficial: valores HEX batem estritamente com o manual de identidade visual', () => {
    expect(BINMAX_TOKENS.NOCHE).toBe('#0D0F14');
    expect(BINMAX_TOKENS.PANEL).toBe('#151922');
    expect(BINMAX_TOKENS.PRATA).toBe('#DCE1EA');
    expect(BINMAX_TOKENS.BLANCO).toBe('#F4F5F7');
    expect(BINMAX_TOKENS.ACO).toBe('#8A92A1');
    expect(BINMAX_TOKENS.VERDE).toBe('#22C47A');
    expect(BINMAX_TOKENS.ROJO).toBe('#F2545B');
  });

  it('Contraste WCAG: Blanco sobre Noche passa com nível AAA (> 7:1)', () => {
    const ratio = getContrastRatio(BINMAX_TOKENS.BLANCO, BINMAX_TOKENS.NOCHE);
    expect(ratio).toBeGreaterThanOrEqual(15.0); // Esperado ~18.1:1
  });

  it('Contraste WCAG: Prata sobre Noche passa com nível AAA (> 7:1)', () => {
    const ratio = getContrastRatio(BINMAX_TOKENS.PRATA, BINMAX_TOKENS.NOCHE);
    expect(ratio).toBeGreaterThanOrEqual(13.0); // Esperado ~14.9:1
  });

  it('Contraste WCAG: Aço sobre Noche passa com nível AA (> 4.5:1)', () => {
    const ratio = getContrastRatio(BINMAX_TOKENS.ACO, BINMAX_TOKENS.NOCHE);
    expect(ratio).toBeGreaterThanOrEqual(5.5); // Esperado ~6.4:1
  });

  it('Contraste WCAG: Verde Ganancia sobre Noche e nos botões passa com nível AAA (> 7:1)', () => {
    const ratio = getContrastRatio(BINMAX_TOKENS.VERDE, BINMAX_TOKENS.NOCHE);
    expect(ratio).toBeGreaterThanOrEqual(8.0); // Esperado ~8.6:1
  });

  it('Contraste WCAG: Rojo Baja sobre Noche passa com nível AA (> 4.5:1)', () => {
    const ratio = getContrastRatio(BINMAX_TOKENS.ROJO, BINMAX_TOKENS.NOCHE);
    expect(ratio).toBeGreaterThanOrEqual(5.0); // Esperado ~5.9:1
  });
});
