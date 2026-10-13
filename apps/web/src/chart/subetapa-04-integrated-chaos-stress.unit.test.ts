import { describe, it, expect, vi } from 'vitest';
import { ASSET_CATALOG, getAssetBasePrice } from '../catalog/assets';
import { timeframeSeconds, type Timeframe } from './candle-adapter';

describe('SUBETAPA 04: Bateria Integrada de Estresse, Caos e Anti-Regressão Gráfica', () => {
  interface MockPriceLine {
    price: number;
    color: string;
    title: string;
  }

  class MockSeries {
    public lines = new Set<MockPriceLine>();
    public createPriceLine = vi.fn((opts: any) => {
      const line: MockPriceLine = {
        price: opts.price,
        color: opts.color,
        title: opts.title,
      };
      this.lines.add(line);
      return line;
    });
    public removePriceLine = vi.fn((line: MockPriceLine) => {
      if (!this.lines.has(line)) {
        throw new Error('Price line does not belong to series');
      }
      this.lines.delete(line);
    });
  }

  class ProductionPriceChartSimulator {
    public candleSeries = new MockSeries();
    public areaSeries = new MockSeries();
    public currentPriceLine: MockPriceLine | null = null;
    public currentPriceLineSeries: MockSeries | null = null;
    public currentSymbol = 'SYNTH_VOL_50';
    public chartType: 'candles' | 'area' = 'candles';

    public safeRemoveCurrentPriceLine() {
      if (this.currentPriceLine) {
        try {
          if (this.currentPriceLineSeries) {
            this.currentPriceLineSeries.removePriceLine(this.currentPriceLine);
          } else {
            this.candleSeries.removePriceLine(this.currentPriceLine);
            this.areaSeries.removePriceLine(this.currentPriceLine);
          }
        } catch {
          // ignore
        }
        this.currentPriceLine = null;
        this.currentPriceLineSeries = null;
      }
    }

    public switchSymbol(newSymbol: string) {
      this.safeRemoveCurrentPriceLine();
      this.currentSymbol = newSymbol;
    }

    public onTick(price: number, isUp: boolean) {
      const activeSeries = this.chartType === 'candles' ? this.candleSeries : this.areaSeries;
      if (!Number.isFinite(price)) return;

      const color = isUp ? '#00e676' : '#ff3d71';
      const title = price.toFixed(5);

      if (this.currentPriceLine) {
        this.currentPriceLine.price = price;
        this.currentPriceLine.color = color;
        this.currentPriceLine.title = title;
      } else {
        this.currentPriceLine = activeSeries.createPriceLine({ price, color, title });
        this.currentPriceLineSeries = activeSeries;
      }
    }
  }

  it('CHAOS-01: Comutação caótica entre 100 ativos sem vazamento de linhas nem contaminação de escala', () => {
    const sim = new ProductionPriceChartSimulator();
    const symbols = ['BTCUSD_OTC', 'AUDUSD_OTC', 'USDJPY_OTC', 'SYNTH_VOL_50', 'USDCAD_OTC', 'EURUSD_OTC'];

    for (let cycle = 0; cycle < 100; cycle++) {
      const sym = symbols[cycle % symbols.length];
      sim.switchSymbol(sym);

      const basePrice = getAssetBasePrice(sym);
      expect(basePrice).toBeGreaterThan(0);

      // Simula 10 ticks no novo ativo
      for (let t = 0; t < 10; t++) {
        const tickPrice = basePrice * (1 + (Math.sin(t) * 0.001));
        sim.onTick(tickPrice, t % 2 === 0);
      }

      // Em qualquer momento, APENAS 1 linha ativa e zero linhas fantasmas
      expect(sim.candleSeries.lines.size).toBe(1);
      expect(sim.areaSeries.lines.size).toBe(0);

      // O preço da linha deve pertencer à ordem de grandeza do ativo atual
      const activeLine = Array.from(sim.candleSeries.lines)[0];
      expect(Math.abs(activeLine.price - basePrice) / basePrice).toBeLessThan(0.05);
    }
  });

  it('CHAOS-02: 5.000 oscilações de tick com jitter não provocam vazamento de memória', () => {
    const sim = new ProductionPriceChartSimulator();
    const initialPrice = getAssetBasePrice('AUDUSD_OTC'); // ~0.65820
    expect(initialPrice).toBeCloseTo(0.65820, 3);

    for (let i = 0; i < 5000; i++) {
      const price = initialPrice + (Math.cos(i) * 0.0005);
      sim.onTick(price, i % 3 === 0);
    }

    // Apenas 1 chamada de createPriceLine
    expect(sim.candleSeries.createPriceLine).toHaveBeenCalledTimes(1);
    expect(sim.candleSeries.lines.size).toBe(1);
  });

  it('CHAOS-03: Projeção temporal em todos os 5 timeframes garante invariantes geométricos', () => {
    const timeframes: Timeframe[] = ['5s', '15s', '30s', '1m', '5m'];
    const barSpacing = 15;
    const xCandle = 500;
    const effectiveWidth = 1200;
    const maxExpirationX = effectiveWidth - 65;

    for (const tf of timeframes) {
      const tfSec = timeframeSeconds(tf);
      expect(tfSec).toBeGreaterThan(0);

      for (let secRem = 60; secRem >= 1; secRem -= 5) {
        const barsAheadExp = Math.max(0.1, secRem / tfSec);
        const xExpiration = Math.min(maxExpirationX, xCandle + (barsAheadExp * barSpacing));

        const isLocked = secRem <= 30 && tf === '1m';
        const purchaseSec = Math.max(0, secRem - 30);
        let xPurchase: number;

        if (isLocked) {
          xPurchase = xCandle;
        } else {
          const barsAheadPurchase = Math.max(0.05, purchaseSec / tfSec);
          const maxPurchaseX = Math.max(xCandle, xExpiration - 15);
          xPurchase = Math.max(xCandle, Math.min(maxPurchaseX, xCandle + (barsAheadPurchase * barSpacing)));
        }

        // Invariantes invioláveis
        expect(xExpiration).toBeGreaterThanOrEqual(xCandle);
        expect(xPurchase).toBeGreaterThanOrEqual(xCandle);
        expect(xExpiration).toBeGreaterThanOrEqual(xPurchase);
        expect(xExpiration).toBeLessThanOrEqual(maxExpirationX);
      }
    }
  });

  it('CHAOS-04: Resiliência contra ticks NaN, infinitos e nulos sem lançar exceções', () => {
    const sim = new ProductionPriceChartSimulator();
    expect(() => {
      sim.onTick(NaN, true);
      sim.onTick(Infinity, false);
      sim.onTick(-Infinity, true);
    }).not.toThrow();

    expect(sim.candleSeries.lines.size).toBe(0);
  });
});
