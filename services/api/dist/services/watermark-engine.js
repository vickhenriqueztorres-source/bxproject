export class WatermarkStreamEngine {
    boundedDelayMs;
    symbolMaxEventTime = new Map();
    symbolWatermark = new Map();
    symbolLateCount = new Map();
    globalWatermark = 0;
    constructor(config = {}) {
        this.boundedDelayMs = config.boundedDelayMs ?? 2000;
    }
    processEvent(tick) {
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
                if (w < minW)
                    minW = w;
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
    getSymbolWatermark(symbol) {
        return this.symbolWatermark.get(symbol) ?? 0;
    }
    getGlobalWatermark() {
        return this.globalWatermark;
    }
    getLateTicksCount(symbol) {
        return this.symbolLateCount.get(symbol) ?? 0;
    }
    getTotalLateTicksCount() {
        let sum = 0;
        for (const count of this.symbolLateCount.values()) {
            sum += count;
        }
        return sum;
    }
}
