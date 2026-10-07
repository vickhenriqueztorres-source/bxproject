export interface TickSyncInfo {
  symbol: string;
  event_time: number;
  price: string;
}

export interface CrossAssetSyncValidationResult {
  synchronized: boolean;
  skewMs: number;
  symbolA: string;
  symbolB: string;
  error?: string;
}

export const MAX_CROSS_ASSET_SKEW_MS = 2000;
export const MAX_INDIVIDUAL_TICK_AGE_MS = 5000;

export function validateCrossAssetSync(
  tickA: TickSyncInfo,
  tickB: TickSyncInfo,
  maxSkewMs: number = MAX_CROSS_ASSET_SKEW_MS,
  now: number = Date.now()
): CrossAssetSyncValidationResult {
  const ageA = Math.max(0, now - tickA.event_time);
  const ageB = Math.max(0, now - tickB.event_time);

  // 1. Validação de frescor individual (nenhum dos dois pode ser stale > 5s)
  if (ageA > MAX_INDIVIDUAL_TICK_AGE_MS) {
    return {
      synchronized: false,
      skewMs: Math.abs(tickA.event_time - tickB.event_time),
      symbolA: tickA.symbol,
      symbolB: tickB.symbol,
      error: `TICK_STALE_${tickA.symbol}: Cotação com atraso de ${ageA}ms (> ${MAX_INDIVIDUAL_TICK_AGE_MS}ms)`,
    };
  }

  if (ageB > MAX_INDIVIDUAL_TICK_AGE_MS) {
    return {
      synchronized: false,
      skewMs: Math.abs(tickA.event_time - tickB.event_time),
      symbolA: tickA.symbol,
      symbolB: tickB.symbol,
      error: `TICK_STALE_${tickB.symbol}: Cotação com atraso de ${ageB}ms (> ${MAX_INDIVIDUAL_TICK_AGE_MS}ms)`,
    };
  }

  // 2. Validação de descompasso mútuo (skew) entre ambos os ativos
  const skewMs = Math.abs(tickA.event_time - tickB.event_time);
  if (skewMs > maxSkewMs) {
    console.warn(JSON.stringify({
      event: 'CROSS_ASSET_SKEW_EXCEEDED',
      symbolA: tickA.symbol,
      symbolB: tickB.symbol,
      skew_ms: skewMs,
      limit_ms: maxSkewMs,
      timestamp: new Date().toISOString(),
    }));

    return {
      synchronized: false,
      skewMs,
      symbolA: tickA.symbol,
      symbolB: tickB.symbol,
      error: `CROSS_ASSET_DESYNCHRONIZED: Descompasso de ${skewMs}ms entre ${tickA.symbol} e ${tickB.symbol} excede o limite de ${maxSkewMs}ms`,
    };
  }

  return {
    synchronized: true,
    skewMs,
    symbolA: tickA.symbol,
    symbolB: tickB.symbol,
  };
}
