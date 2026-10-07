"use strict";
/**
 * Motor de Coalescing de Ticks (Padrão de Resiliência contra Sobrecarga de Fan-Out)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TickCoalescer = void 0;
class TickCoalescer {
    windowMs;
    pendingTicks = new Map();
    timers = new Map();
    droppedCount = 0;
    emittedCount = 0;
    constructor(config = {}) {
        this.windowMs = config.windowMs ?? 50;
    }
    push(tick, onEmit) {
        const symbol = tick.symbol;
        const existing = this.pendingTicks.get(symbol);
        if (existing) {
            this.droppedCount++;
            if (tick.sequence >= existing.sequence) {
                this.pendingTicks.set(symbol, tick);
            }
        }
        else {
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
    getDroppedCount() {
        return this.droppedCount;
    }
    getEmittedCount() {
        return this.emittedCount;
    }
    flushAll(onEmit) {
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
    destroy() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.timers.clear();
        this.pendingTicks.clear();
    }
}
exports.TickCoalescer = TickCoalescer;
