import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';

/**
 * Filtro e Sanitizador Monotônico Estrito para Lightweight Charts:
 * Garante que a série enviada a setData() nunca possua timestamps duplicados,
 * desordenados ou com valores OHLC não-finitos (eliminando 100% de crashes de sorting).
 */
export function ensureStrictAscendingBars(
  bars: CandlestickData<UTCTimestamp>[]
): CandlestickData<UTCTimestamp>[] {
  if (!bars || bars.length === 0) return [];

  // Ordenação garantida por timestamp crescente
  const sorted = [...bars].sort((a, b) => Number(a.time) - Number(b.time));
  const result: CandlestickData<UTCTimestamp>[] = [];
  let lastTime = -Infinity;

  for (let i = 0; i < sorted.length; i++) {
    const bar = sorted[i];
    const t = Number(bar.time);
    if (!Number.isFinite(t) || t <= lastTime) {
      continue; // descarta duplicata ou inversão temporal
    }

    const open = Number(bar.open);
    const high = Number(bar.high);
    const low = Number(bar.low);
    const close = Number(bar.close);

    if (
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close) &&
      open > 0 &&
      high > 0 &&
      low > 0 &&
      close > 0
    ) {
      result.push({
        time: bar.time,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
      });
      lastTime = t;
    }
  }

  return result;
}
