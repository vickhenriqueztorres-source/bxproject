import { describe, it, expect, vi } from 'vitest';

describe('SUBETAPA 01: Prevenção de Vazamento de Linhas de Preço e Distorção de Escala', () => {
  interface MockPriceLine {
    price: number;
    color: string;
    title: string;
    applyOptions: ReturnType<typeof vi.fn>;
  }

  interface MockSeries {
    name: string;
    lines: Set<MockPriceLine>;
    createPriceLine: ReturnType<typeof vi.fn>;
    removePriceLine: ReturnType<typeof vi.fn>;
  }

  function createMockSeries(name: string): MockSeries {
    const lines = new Set<MockPriceLine>();
    const series: MockSeries = {
      name,
      lines,
      createPriceLine: vi.fn((opts: any) => {
        const line: MockPriceLine = {
          price: opts.price,
          color: opts.color,
          title: opts.title,
          applyOptions: vi.fn((newOpts: any) => {
            if (newOpts.price !== undefined) line.price = newOpts.price;
            if (newOpts.color !== undefined) line.color = newOpts.color;
            if (newOpts.title !== undefined) line.title = newOpts.title;
          }),
        };
        lines.add(line);
        return line;
      }),
      removePriceLine: vi.fn((line: MockPriceLine) => {
        if (!lines.has(line)) {
          throw new Error(`Price line does not belong to series ${name}`);
        }
        lines.delete(line);
      }),
    };
    return series;
  }

  class PriceLineLifecycleManager {
    public candleSeries: MockSeries | null = null;
    public areaSeries: MockSeries | null = null;
    public currentPriceLine: MockPriceLine | null = null;
    public currentPriceLineSeries: MockSeries | null = null;
    public chartType: 'candles' | 'area' = 'candles';

    constructor(candleSeries: MockSeries, areaSeries: MockSeries) {
      this.candleSeries = candleSeries;
      this.areaSeries = areaSeries;
    }

    public safeRemoveCurrentPriceLine() {
      if (this.currentPriceLine) {
        try {
          if (this.currentPriceLineSeries) {
            this.currentPriceLineSeries.removePriceLine(this.currentPriceLine);
          } else {
            if (this.candleSeries) this.candleSeries.removePriceLine(this.currentPriceLine);
            if (this.areaSeries) this.areaSeries.removePriceLine(this.currentPriceLine);
          }
        } catch {
          // ignore
        }
        this.currentPriceLine = null;
        this.currentPriceLineSeries = null;
      }
    }

    public onChartTypeChange(newType: 'candles' | 'area', lastPrice: number | null) {
      this.safeRemoveCurrentPriceLine();
      this.chartType = newType;
      const activeSeries = newType === 'candles' ? this.candleSeries : this.areaSeries;
      if (activeSeries && lastPrice !== null) {
        this.currentPriceLine = activeSeries.createPriceLine({
          price: lastPrice,
          color: '#DCE1EA',
          title: lastPrice.toFixed(5),
        });
        this.currentPriceLineSeries = activeSeries;
      }
    }

    public onTick(price: number, direction: 'UP' | 'DOWN' | 'NEUTRAL') {
      const activeSeries = this.chartType === 'candles' ? this.candleSeries : this.areaSeries;
      if (!activeSeries || !Number.isFinite(price)) return;

      const color = direction === 'UP' ? '#00e676' : '#ff3d71';
      const title = price.toFixed(5);

      if (this.currentPriceLine) {
        this.currentPriceLine.applyOptions({ price, color, title });
      } else {
        this.currentPriceLine = activeSeries.createPriceLine({
          price,
          color,
          title,
        });
        this.currentPriceLineSeries = activeSeries;
      }
    }

    public onSymbolChange() {
      this.safeRemoveCurrentPriceLine();
    }
  }

  it('PL-01: Estresse de 1.000 oscilações de tick mantém exatamente 1 linha ativa e zero linhas órfãs', () => {
    const candleSeries = createMockSeries('candles');
    const areaSeries = createMockSeries('area');
    const manager = new PriceLineLifecycleManager(candleSeries, areaSeries);

    // 1.000 ticks rápidos alternando UP/DOWN
    for (let i = 0; i < 1000; i++) {
      const price = 100.0 + (i % 2 === 0 ? 0.05 : -0.05);
      const direction = i % 2 === 0 ? 'UP' : 'DOWN';
      manager.onTick(price, direction);
    }

    // Prova que createPriceLine foi chamado APENAS UMA VEZ
    expect(candleSeries.createPriceLine).toHaveBeenCalledTimes(1);
    expect(candleSeries.lines.size).toBe(1);
    expect(areaSeries.lines.size).toBe(0);

    // Prova que applyOptions foi chamado 999 vezes para atualizar sem recriar
    expect(manager.currentPriceLine?.applyOptions).toHaveBeenCalledTimes(999);
  });

  it('PL-02: Alternar tipo de gráfico (candles <-> area) transfere a linha sem vazar na série anterior', () => {
    const candleSeries = createMockSeries('candles');
    const areaSeries = createMockSeries('area');
    const manager = new PriceLineLifecycleManager(candleSeries, areaSeries);

    // Inicializa com tick em candles
    manager.onTick(151.20, 'UP');
    expect(candleSeries.lines.size).toBe(1);
    expect(areaSeries.lines.size).toBe(0);

    // Comuta para area
    manager.onChartTypeChange('area', 151.20);
    expect(candleSeries.lines.size).toBe(0); // Linha removida de candles
    expect(areaSeries.lines.size).toBe(1);   // Linha criada em area

    // Comuta de volta para candles
    manager.onChartTypeChange('candles', 151.25);
    expect(candleSeries.lines.size).toBe(1); // Linha recriada em candles
    expect(areaSeries.lines.size).toBe(0);   // Linha removida de area
  });

  it('PL-03: Troca de ativo (SYNTH_VOL_50 -> USDJPY) remove a linha de 100.00 sem contaminar o ativo de 151.20', () => {
    const candleSeries = createMockSeries('candles');
    const areaSeries = createMockSeries('area');
    const manager = new PriceLineLifecycleManager(candleSeries, areaSeries);

    // Ativo 1: Vol 50 a 100.00
    manager.onTick(100.00, 'UP');
    expect(candleSeries.lines.size).toBe(1);
    const lineVol50 = Array.from(candleSeries.lines)[0];
    expect(lineVol50.price).toBe(100.00);

    // Troca de ativo disparada
    manager.onSymbolChange();
    expect(candleSeries.lines.size).toBe(0); // Zero linhas remanescentes
    expect(manager.currentPriceLine).toBeNull();

    // Ativo 2: USD/JPY a 151.20
    manager.onTick(151.20, 'UP');
    expect(candleSeries.lines.size).toBe(1);
    const lineUsdJpy = Array.from(candleSeries.lines)[0];
    expect(lineUsdJpy.price).toBe(151.20); // Preço exclusivo do novo ativo, sem escala distorcida
  });
});
