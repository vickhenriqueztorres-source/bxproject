import type { Tick } from '../feed/protocol';

export type RafRenderCallback = (tick: Tick) => void;

/**
 * Motor de Throttling e Batching Gráfico via requestAnimationFrame (Subetapa 01/02).
 * Coalesce rajadas de ticks e garante no máximo 1 render por frame de 60fps (16.6ms).
 * Sanitiza defensivamente ticks malformados e descarta duplicados/fora de ordem
 * com particionamento estrito por símbolo para prevenir bloqueios na troca de ativo.
 */
export class RafChartUpdater {
  private pendingTick: Tick | null = null;
  private rafId: number | null = null;
  private isPaused = false;
  private droppedUpdatesCount = 0;
  private renderedUpdatesCount = 0;
  private symbolSequences: Map<string, bigint> = new Map();

  constructor(
    private rafFn: (cb: FrameRequestCallback) => number = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? (cb) => window.requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number,
    private cancelRafFn: (id: number) => void = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
      ? (id) => window.cancelAnimationFrame(id)
      : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  ) {}

  private lastFrameDurationMs = 0;
  private highLoadFramesCount = 0;

  private lastGlobalSequence: bigint = 0n;

  public push(tick: Tick, onRender: RafRenderCallback): void {
    if (!tick) return;

    // Sanitização Numérica: descarta preços não finitos ou menores/iguais a zero
    const price = Number(tick.price);
    if (!Number.isFinite(price) || price <= 0) {
      this.droppedUpdatesCount++;
      return;
    }

    const symbolKey = tick.symbol || '__default__';

    // Monotonicidade Sequencial por Símbolo: descarta ticks fora de ordem ou duplicados (F-06 / Subetapa 01)
    if (tick.sequence !== undefined && tick.sequence !== null) {
      try {
        const seq = BigInt(tick.sequence);
        const lastSeq = this.symbolSequences.get(symbolKey) ?? 0n;
        if (seq <= lastSeq) {
          this.droppedUpdatesCount++;
          return;
        }
        this.symbolSequences.set(symbolKey, seq);
        this.lastGlobalSequence = seq;
      } catch {
        // Se sequence não for conversível para BigInt, processa normalmente
      }
    }

    if (this.pendingTick !== null) {
      this.droppedUpdatesCount++;
    }
    this.pendingTick = tick;

    if (this.isPaused) {
      return;
    }

    if (this.rafId === null) {
      let isRunning = true;
      const scheduledId = this.rafFn(() => {
        isRunning = false;
        const targetTick = this.pendingTick;
        this.pendingTick = null;
        this.rafId = null;

        if (targetTick) {
          const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
          this.renderedUpdatesCount++;
          try {
            onRender(targetTick);
          } finally {
            const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
            this.lastFrameDurationMs = elapsed;
            if (elapsed > 25) {
              this.highLoadFramesCount++;
            }
          }
        }
      });

      // Se a função de rAF for assíncrona, guarda o ID retornado.
      // Se executou de forma síncrona (ex: em testes síncronos), isRunning já é false e rafId permanece null.
      if (isRunning) {
        this.rafId = scheduledId;
      }
    }
  }

  public pause(): void {
    this.isPaused = true;
    if (this.rafId !== null) {
      this.cancelRafFn(this.rafId);
      this.rafId = null;
    }
  }

  public resume(onRender?: RafRenderCallback): void {
    this.isPaused = false;
    if (this.pendingTick !== null && onRender) {
      this.push(this.pendingTick, onRender);
    }
  }

  public cancel(): void {
    if (this.rafId !== null) {
      this.cancelRafFn(this.rafId);
      this.rafId = null;
    }
    this.pendingTick = null;
  }

  /**
   * Reseta o estado do updater e expurga ticks pendentes (Subetapa 01).
   * Se um símbolo for passado, remove apenas a sequência desse símbolo (ou tick pendente se for dele).
   * Sem argumentos, limpa todos os símbolos e cancela qualquer quadro pendente.
   */
  public reset(symbol?: string): void {
    if (this.rafId !== null) {
      this.cancelRafFn(this.rafId);
      this.rafId = null;
    }

    if (symbol) {
      this.symbolSequences.delete(symbol);
      if (this.pendingTick?.symbol === symbol) {
        this.pendingTick = null;
      }
    } else {
      this.symbolSequences.clear();
      this.lastGlobalSequence = 0n;
      this.pendingTick = null;
    }
  }

  public resetSequence(symbol?: string): void {
    if (symbol) {
      this.symbolSequences.delete(symbol);
    } else {
      this.symbolSequences.clear();
      this.lastGlobalSequence = 0n;
    }
  }

  public getLastSequence(symbol: string = '__default__'): bigint | undefined {
    return this.symbolSequences.get(symbol);
  }

  public getStats() {
    return {
      rendered: this.renderedUpdatesCount,
      dropped: this.droppedUpdatesCount,
      isPending: this.pendingTick !== null,
      isPaused: this.isPaused,
      lastSequence: this.lastGlobalSequence.toString(),
      activeSymbolsCount: this.symbolSequences.size,
      lastFrameDurationMs: this.lastFrameDurationMs,
      highLoadFramesCount: this.highLoadFramesCount,
    };
  }
}
