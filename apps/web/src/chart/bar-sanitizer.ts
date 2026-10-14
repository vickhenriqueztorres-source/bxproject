import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { normalizeTimeSeconds } from './chart-sanitizer';

/**
 * Filtro e Sanitizador Monotônico Estrito para Lightweight Charts (#1344):
 * 1. Normaliza qualquer timestamp (segundos, milissegundos ou ISO string UTC) para segundos UTC inteiros.
 * 2. Ordena estritamente em ordem crescente (time[i] > time[i-1]).
 * 3. Mescla barras com timestamps duplicados preservando Open original, maior High, menor Low e último Close,
 *    evitando perda de dados ou sobreposição de barras.
 */
export function ensureStrictAscendingBars(
  bars: CandlestickData<UTCTimestamp>[]
): CandlestickData<UTCTimestamp>[] {
  if (!bars || bars.length === 0) return [];

  const normalized: CandlestickData<UTCTimestamp>[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (!bar || typeof bar !== 'object') continue;

    const t = normalizeTimeSeconds(bar.time);
    if (t === null) continue;

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
      normalized.push({
        time: t as UTCTimestamp,
        open,
        high: Math.max(high, open, close),
        low: Math.min(low, open, close),
        close,
      });
    }
  }

  if (normalized.length === 0) return [];

  // Ordenação estável garantida por timestamp crescente
  normalized.sort((a, b) => Number(a.time) - Number(b.time));

  const result: CandlestickData<UTCTimestamp>[] = [normalized[0]];

  for (let i = 1; i < normalized.length; i++) {
    const cur = normalized[i];
    const prev = result[result.length - 1];

    if (cur.time === prev.time) {
      // Mescla duplicata no mesmo segundo UTC sem perder High/Low/Close atualizado (#1344)
      prev.high = Math.max(prev.high, cur.high, prev.open, cur.close);
      prev.low = Math.min(prev.low, cur.low, prev.open, cur.close);
      prev.close = cur.close;
    } else if (cur.time > prev.time) {
      result.push(cur);
    }
  }

  return result;
}
