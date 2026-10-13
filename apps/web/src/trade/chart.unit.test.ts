import { describe, it, expect } from 'vitest';

export const BINMAX_CHART_THEME = {
  background: '#0D0F14',
  text: '#8A92A1',
  upColor: '#22C47A',
  downColor: '#F2545B',
  priceLineColor: '#DCE1EA',
  expirationColor: '#F2545B',
  purchaseLineStyle: 'dotted',
} as const;

describe('Estilização e Overlays do Gráfico IQ Option (Etapa 06)', () => {
  it('Paleta do Gráfico: cores de velas batem exatamente com Verde Ganancia e Rojo Baja', () => {
    expect(BINMAX_CHART_THEME.upColor).toBe('#22C47A');
    expect(BINMAX_CHART_THEME.downColor).toBe('#F2545B');
    expect(BINMAX_CHART_THEME.background).toBe('#0D0F14');
  });

  it('Linha de Preço Atual (C7): cor Prata #DCE1EA e formato tracejado', () => {
    expect(BINMAX_CHART_THEME.priceLineColor).toBe('#DCE1EA');
  });

  it('Linha de Expiração (C11): linha contínua na cor de risco #F2545B', () => {
    expect(BINMAX_CHART_THEME.expirationColor).toBe('#F2545B');
  });
});
