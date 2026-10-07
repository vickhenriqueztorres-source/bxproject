/**
 * Motor de Coalescing de Ticks (Padrão de Resiliência contra Sobrecarga de Fan-Out)
 * 
 * Regra Fixa:
 * A cada 50ms por símbolo:
 * - Mantém e envia apenas o tick mais recente
 * - Descarta com segurança os ticks intermediários acumulados na janela
 */

export interface CoalescerConfig {
  windowMs?: number; // Padrão: 50ms
}

export type TickMessage = {
  symbol: string;
  sequence: number;
  price: string;
  ts: string;
  event_time?: number;
  [key: string]: unknown;
};

export class TickCoalescer {
  private readonly windowMs: number;
  private pendingTicks = new Map<string, TickMessage>();
  private timers = new Map<string, NodeJS.Timeout>();
  private droppedCount = 0;
  private emittedCount = 0;

  constructor(config: CoalescerConfig = {}) {
    this.windowMs = config.windowMs ?? 50;
  }

  /**
   * Adiciona um tick ao buffer de coalescing.
   * Se já houver um tick aguardando na janela de 50ms, o anterior é descartado
   * e substituído pelo mais recente.
   */
  public push(tick: TickMessage, onEmit: (tick: TickMessage) => void): void {
    const symbol = tick.symbol;
    const existing = this.pendingTicks.get(symbol);

    if (existing) {
      this.droppedCount++;
      if (tick.sequence >= existing.sequence) {
        this.pendingTicks.set(symbol, tick);
      }
    } else {
      this.pendingTicks.set(symbol, tick);
      const timer = setTimeout(() => {
        this.timers.delete(symbol);
        const finalTick = this.pendingTicks.get(symbol);
        this.pendingTicks.delete(symbol);
        if (finalTick) {
          this.emittedCount++;
          onEmit(finalTick);
        }
      }, this.windowMs);
      this.timers.set(symbol, timer);
    }
  }

  public getDroppedCount(): number {
    return this.droppedCount;
  }

  public getEmittedCount(): number {
    return this.emittedCount;
  }

  public flushAll(onEmit: (tick: TickMessage) => void): void {
    for (const [symbol, timer] of this.timers.entries()) {
      clearTimeout(timer);
      const tick = this.pendingTicks.get(symbol);
      if (tick) {
        this.emittedCount++;
        onEmit(tick);
      }
    }
    this.timers.clear();
    this.pendingTicks.clear();
  }

  public destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pendingTicks.clear();
  }
}
