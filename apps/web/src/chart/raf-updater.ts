import type { Tick } from '../feed/protocol';

export type RafRenderCallback = (tick: Tick) => void;

/**
 * Motor de Throttling e Batching Gráfico via requestAnimationFrame (Subetapa 4).
 * Coalesce rajadas de ticks e garante no máximo 1 render por frame de 60fps (16.6ms).
 */
export class RafChartUpdater {
  private pendingTick: Tick | null = null;
  private rafId: number | null = null;
  private isPaused = false;
  private droppedUpdatesCount = 0;
  private renderedUpdatesCount = 0;

  constructor(
    private rafFn: (cb: FrameRequestCallback) => number = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? (cb) => window.requestAnimationFrame(cb)
      : (cb) => setTimeout(cb, 16) as unknown as number,
    private cancelRafFn: (id: number) => void = typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function'
      ? (id) => window.cancelAnimationFrame(id)
      : (id) => clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  ) {}

  public push(tick: Tick, onRender: RafRenderCallback): void {
    if (this.pendingTick !== null) {
      this.droppedUpdatesCount++;
    }
    this.pendingTick = tick;

    if (this.isPaused) {
      return;
    }

    if (this.rafId === null) {
      this.rafId = this.rafFn(() => {
        const targetTick = this.pendingTick;
        this.pendingTick = null;
        this.rafId = null;

        if (targetTick) {
          this.renderedUpdatesCount++;
          onRender(targetTick);
        }
      });
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

  public getStats() {
    return {
      rendered: this.renderedUpdatesCount,
      dropped: this.droppedUpdatesCount,
      isPending: this.pendingTick !== null,
      isPaused: this.isPaused,
    };
  }
}
