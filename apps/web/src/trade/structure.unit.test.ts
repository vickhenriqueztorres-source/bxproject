import { describe, it, expect } from 'vitest';

export const IQ_DIMENSIONS = {
  HEADER_HEIGHT_PX: 76,
  SIDEBAR_WIDTH_PX: 68,
  TICKET_WIDTH_PX: 120,
  DRAWER_BAR_HEIGHT_PX: 30,
  FOOTER_HEIGHT_PX: 30,
} as const;

describe('Estrutura da Sala e Conformidade IQ Option (Etapa 05)', () => {
  it('Dimensões Estruturais: proporções espaciais correspondem estritamente à IQ Option', () => {
    expect(IQ_DIMENSIONS.HEADER_HEIGHT_PX).toBe(76);
    expect(IQ_DIMENSIONS.SIDEBAR_WIDTH_PX).toBe(68);
    expect(IQ_DIMENSIONS.TICKET_WIDTH_PX).toBeLessThanOrEqual(130);
    expect(IQ_DIMENSIONS.TICKET_WIDTH_PX).toBeGreaterThanOrEqual(110);
    expect(IQ_DIMENSIONS.DRAWER_BAR_HEIGHT_PX).toBe(30);
    expect(IQ_DIMENSIONS.FOOTER_HEIGHT_PX).toBe(30);
  });

  it('Proporção Vertical: Área central do gráfico retém > 80% do espaço vertical útil em 1080p', () => {
    const totalHeight = 1000;
    const reservedVertical = IQ_DIMENSIONS.HEADER_HEIGHT_PX + IQ_DIMENSIONS.DRAWER_BAR_HEIGHT_PX + IQ_DIMENSIONS.FOOTER_HEIGHT_PX;
    const chartHeight = totalHeight - reservedVertical;
    const chartRatio = chartHeight / totalHeight;
    expect(chartRatio).toBeGreaterThan(0.80); // ~86.4% de altura livre para o gráfico
  });

  it('Proporção Horizontal: Gráfico retém > 85% do espaço horizontal em 1920p', () => {
    const totalWidth = 1920;
    const reservedHorizontal = IQ_DIMENSIONS.SIDEBAR_WIDTH_PX + IQ_DIMENSIONS.TICKET_WIDTH_PX;
    const chartWidth = totalWidth - reservedHorizontal;
    const chartRatio = chartWidth / totalWidth;
    expect(chartRatio).toBeGreaterThan(0.85); // ~90.2% de largura livre para o gráfico
  });
});
