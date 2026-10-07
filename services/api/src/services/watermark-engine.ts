export interface WatermarkConfig {
  boundedDelayMs: number; // Tolerância a atrasos (default: 2000ms)
}

export interface TickEvent {
  symbol: string;
  sequence: number;
  price: string;
  event_time: number;
  arrival_time?: number;
  latency_ms?: number;
}

export type TickClassification = 'ON_TIME' | 'LATE_DATA';

export interface ProcessedTickResult {
  tick: TickEvent;
  classification: TickClassification;
  watermark: number;
  isLate: boolean;
}

export class WatermarkStreamEngine {
  private readonly boundedDelayMs: number;
  private symbolMaxEventTime = new Map<string, number>();
  private symbolWatermark = new Map<string, number>();
  private symbolLateCount = new Map<string, number>();
  private globalWatermark = 0;

  constructor(config: Partial<WatermarkConfig> = {}) {
    this.boundedDelayMs = config.boundedDelayMs ?? 2000;
  }

  public processEvent(tick: TickEvent): ProcessedTickResult {
    const symbol = tick.symbol;
    const currentWatermark = this.symbolWatermark.get(symbol) ?? 0;

    // 1. Verificação contra a linha d'água existente (Late Data Detection)
    const isLate = currentWatermark > 0 && tick.event_time < currentWatermark;

    if (isLate) {
      const lateCount = (this.symbolLateCount.get(symbol) ?? 0) + 1;
      this.symbolLateCount.set(symbol, lateCount);

      return {
        tick,
        classification: 'LATE_DATA',
        watermark: currentWatermark,
        isLate: true,
      };
    }

    // 2. Avanço monotônico do maior event_time visto para o ativo
    const prevMax = this.symbolMaxEventTime.get(symbol) ?? 0;
    const newMax = Math.max(prevMax, tick.event_time);
    this.symbolMaxEventTime.set(symbol, newMax);

    // 3. Atualização do Watermark (monotonically non-decreasing)
    const candidateWatermark = newMax - this.boundedDelayMs;
    const updatedWatermark = Math.max(currentWatermark, candidateWatermark);
    this.symbolWatermark.set(symbol, updatedWatermark);

    // 4. Atualização do Watermark Global (mínimo entre todos os ativos conhecidos)
    if (this.symbolWatermark.size > 0) {
      let minW = Infinity;
      for (const w of this.symbolWatermark.values()) {
        if (w < minW) minW = w;
      }
      this.globalWatermark = minW;
    }

    return {
      tick,
      classification: 'ON_TIME',
      watermark: updatedWatermark,
      isLate: false,
    };
  }

  public getSymbolWatermark(symbol: string): number {
    return this.symbolWatermark.get(symbol) ?? 0;
  }

  public getGlobalWatermark(): number {
    return this.globalWatermark;
  }

  public getLateTicksCount(symbol: string): number {
    return this.symbolLateCount.get(symbol) ?? 0;
  }

  public getTotalLateTicksCount(): number {
    let sum = 0;
    for (const count of this.symbolLateCount.values()) {
      sum += count;
    }
    return sum;
  }
}
