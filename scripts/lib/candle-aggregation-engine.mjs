/**
 * Motor de Agregação e Cache O(1) de Velas OHLCV + Telemetria Real de Latência de Tick (Subetapa 4)
 * Skills aplicadas:
 * - 03-synthetic-market-engine (Invariantes OHLCV: High >= max(Open, Close), Low <= min(Open, Close))
 * - 05-resilience-patterns (Prevenção de exaustão de Event Loop sob rajada de F5 / troca de timeframe)
 */

export const VALID_INTERVALS_SEC = Object.freeze({
  '5s': 5,
  '15s': 15,
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
});

export function parseIntervalSeconds(intervalStr) {
  if (!intervalStr || typeof intervalStr !== 'string') return 60;
  return VALID_INTERVALS_SEC[intervalStr] || 60;
}

/**
 * Agrega velas base (1m) para timeframe superior preservando invariantes OHLCV,
 * protegendo contra chegada fora de ordem (open pelo menor time, close pelo maior time)
 * e deduplicando timestamps repetidos para não inflar volume.
 */
export function aggregateCandlesToInterval(baseBars, intervalSec) {
  if (!baseBars || baseBars.length === 0 || !intervalSec) return baseBars || [];
  const firstBar = baseBars[0];
  const secondBar = baseBars.length > 1 ? baseBars[1] : null;
  const baseStep = secondBar ? Math.abs(secondBar.time - firstBar.time) : (intervalSec < 60 ? 5 : 60);
  if (intervalSec <= baseStep) return baseBars || [];

  const map = new Map();
  let prevBucket = -Infinity;
  let isMonotonic = true;

  for (let i = 0; i < baseBars.length; i++) {
    const b = baseBars[i];
    const bucket = Math.floor(b.time / intervalSec) * intervalSec;
    if (bucket < prevBucket) {
      isMonotonic = false;
    }
    prevBucket = bucket;

    const offset = b.time - bucket;
    const slot = (offset % baseStep === 0 && baseStep > 0) ? offset / baseStep : -1;

    const existing = map.get(bucket);
    if (!existing) {
      let seenLo = 0;
      let seenHi = 0;
      let seenSet = null;
      if (slot >= 0 && slot < 31) {
        seenLo = 1 << slot;
      } else if (slot >= 31 && slot < 62) {
        seenHi = 1 << (slot - 31);
      } else {
        seenSet = new Set([b.time]);
      }
      map.set(bucket, {
        time: bucket,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
        legacy: b.legacy,
        provenance: b.provenance,
        _highNum: parseFloat(b.high),
        _lowNum: parseFloat(b.low),
        _minTime: b.time,
        _maxTime: b.time,
        _seenLo: seenLo,
        _seenHi: seenHi,
        _seenSet: seenSet,
      });
    } else {
      let isDuplicateTime = false;
      if (slot >= 0 && slot < 31) {
        const bit = 1 << slot;
        if ((existing._seenLo & bit) !== 0) {
          isDuplicateTime = true;
        } else {
          existing._seenLo |= bit;
        }
      } else if (slot >= 31 && slot < 62) {
        const bit = 1 << (slot - 31);
        if ((existing._seenHi & bit) !== 0) {
          isDuplicateTime = true;
        } else {
          existing._seenHi |= bit;
        }
      } else {
        if (!existing._seenSet) existing._seenSet = new Set();
        if (existing._seenSet.has(b.time)) {
          isDuplicateTime = true;
        } else {
          existing._seenSet.add(b.time);
        }
      }

      const bHigh = parseFloat(b.high);
      const bLow = parseFloat(b.low);
      if (bHigh > existing._highNum) {
        existing._highNum = bHigh;
        existing.high = b.high;
      }
      if (bLow < existing._lowNum) {
        existing._lowNum = bLow;
        existing.low = b.low;
      }
      if (!isDuplicateTime) {
        existing.volume += b.volume;
      }
      if (b.time < existing._minTime) {
        existing._minTime = b.time;
        existing.open = b.open;
      }
      if (b.time > existing._maxTime || (b.time === existing._maxTime && isDuplicateTime)) {
        existing._maxTime = b.time;
        existing.close = b.close;
      }
      if (b.legacy === false) {
        existing.legacy = false;
        existing.provenance = 'official';
      }
    }
  }

  const result = new Array(map.size);
  let idx = 0;
  for (const item of map.values()) {
    const bar = {
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
    };
    if (item.legacy !== undefined) bar.legacy = Boolean(item.legacy);
    if (item.provenance !== undefined) bar.provenance = item.provenance;
    result[idx++] = bar;
  }

  if (!isMonotonic) {
    result.sort((a, b) => a.time - b.time);
  }
  return result;
}

/**
 * Deriva velas oficiais em buckets UTC [início, fim) diretamente a partir de ticks oficiais,
 * definindo open pela menor sequence, close pela maior sequence e volume por sequences únicas.
 */
export function aggregateTicksToCandles(ticks, intervalSec, precision = 4) {
  if (!Array.isArray(ticks) || ticks.length === 0 || !Number.isFinite(intervalSec) || intervalSec <= 0) {
    return [];
  }

  const map = new Map();
  let prevBucket = -Infinity;
  let isMonotonic = true;

  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i];
    const seq = Number(t.sequence);
    const tsMs = Number.isFinite(t.event_time) ? Number(t.event_time) : Date.parse(t.ts);
    if (!Number.isFinite(tsMs) || !Number.isFinite(seq)) continue;
    const bucket = Math.floor(Math.floor(tsMs / 1000) / intervalSec) * intervalSec;
    if (bucket < prevBucket) {
      isMonotonic = false;
    }
    prevBucket = bucket;

    const priceNum = Number.isFinite(t.priceNum) ? t.priceNum : parseFloat(t.price);
    const formattedPrice = Number.isInteger(precision) ? priceNum.toFixed(precision) : String(t.price);
    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, {
        time: bucket,
        open: formattedPrice,
        high: formattedPrice,
        low: formattedPrice,
        close: formattedPrice,
        volume: 1,
        _highNum: priceNum,
        _lowNum: priceNum,
        _minSeq: seq,
        _maxSeq: seq,
        _seenSeq: new Set([seq]),
      });
    } else if (!existing._seenSeq.has(seq)) {
      existing._seenSeq.add(seq);
      existing.volume += 1;
      if (priceNum > existing._highNum) {
        existing._highNum = priceNum;
        existing.high = formattedPrice;
      }
      if (priceNum < existing._lowNum) {
        existing._lowNum = priceNum;
        existing.low = formattedPrice;
      }
      if (seq < existing._minSeq) {
        existing._minSeq = seq;
        existing.open = formattedPrice;
      }
      if (seq > existing._maxSeq) {
        existing._maxSeq = seq;
        existing.close = formattedPrice;
      }
    }
  }

  const result = new Array(map.size);
  let idx = 0;
  for (const item of map.values()) {
    result[idx++] = {
      time: item.time,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      legacy: false,
      provenance: 'official',
    };
  }

  if (!isMonotonic) {
    result.sort((a, b) => a.time - b.time);
  }
  return result;
}

/**
 * Aplica um tick oficial diretamente a um buffer de velas (5s ou 1m) segundo a Regra Única:
 * - Se bucket já existe: open permanece intocado (1º tick do período), high/low expandem, close atualiza e volume++.
 * - Se nova vela: open = close = high = low = priceStr (1º tick do período), volume = 1.
 */
export function applyTickToCandleBuffer(
  candlesArray,
  {
    timeSec,
    priceStr,
    precision = 4,
    sequence = null,
    stepSec = 60,
    maxBufferSize = 3600,
    provenance = 'official',
  }
) {
  if (!Array.isArray(candlesArray)) return;
  const bucketTime = Math.floor(timeSec / stepSec) * stepSec;
  const tickNum = parseFloat(priceStr);

  // Remove eventuais barras legacy do mesmo bucket se foram sobrepostas por ticks oficiais
  while (
    candlesArray.length > 0 &&
    candlesArray[candlesArray.length - 1].legacy &&
    candlesArray[candlesArray.length - 1].time >= bucketTime
  ) {
    candlesArray.pop();
  }

  const lastBar = candlesArray[candlesArray.length - 1];

  if (lastBar && !lastBar.legacy && lastBar.time === bucketTime) {
    const curHigh = parseFloat(lastBar.high);
    const curLow = parseFloat(lastBar.low);
    const openNum = parseFloat(lastBar.open);
    const newHigh = Math.max(curHigh, tickNum, openNum);
    const newLow = Math.min(curLow, tickNum, openNum);
    lastBar.high = newHigh.toFixed(precision);
    lastBar.low = newLow.toFixed(precision);
    lastBar.close = priceStr;
    lastBar.volume = (Number(lastBar.volume) || 0) + 1;
    if (sequence !== null && sequence !== undefined) {
      lastBar.last_sequence = sequence;
    }
  } else if (!lastBar || bucketTime > lastBar.time) {
    const newBar = {
      time: bucketTime,
      open: priceStr,
      high: priceStr,
      low: priceStr,
      close: priceStr,
      volume: 1,
      last_sequence: sequence !== null && sequence !== undefined ? sequence : null,
      legacy: false,
      provenance,
    };
    candlesArray.push(newBar);
    if (candlesArray.length > maxBufferSize) {
      candlesArray.shift();
    }
  }
}

/**
 * Cria cache em memória O(1) por (symbol, intervalSec, beforeKey) com invalidação
 * automática por assinatura da última vela + TTL configurável (default 2000ms).
 */
export function createCandleAggregationCache({ ttlMs = 2000, maxEntries = 500 } = {}) {
  // cacheKey -> { signature: string, expiresAt: number, bars: Array }
  const cache = new Map();

  const telemetry = {
    requestsTotal: 0,
    cacheHitsTotal: 0,
    cacheMissesTotal: 0,
    aggregationsComputedTotal: 0,
  };

  function computeSeriesSignature(bars) {
    if (!bars || bars.length === 0) return 'empty';
    const first = bars[0];
    const last = bars[bars.length - 1];
    return `${bars.length}:${first.time}:${last.time}:${last.open}:${last.high}:${last.low}:${last.close}:${last.volume}`;
  }

  function getAggregatedCandles({
    symbol,
    baseBars,
    intervalSec,
    beforeKey = 'latest',
    nowMs = Date.now(),
  }) {
    telemetry.requestsTotal += 1;

    if (!baseBars || baseBars.length === 0 || !intervalSec) {
      return baseBars || [];
    }

    const firstBar = baseBars[0];
    const secondBar = baseBars.length > 1 ? baseBars[1] : null;
    const baseStep = secondBar ? Math.abs(secondBar.time - firstBar.time) : (intervalSec < 60 ? 5 : 60);
    if (intervalSec <= baseStep) {
      return baseBars;
    }

    const cacheKey = `${symbol}:${intervalSec}:${beforeKey}`;
    const signature = computeSeriesSignature(baseBars);
    const entry = cache.get(cacheKey);

    if (entry && nowMs < entry.expiresAt && entry.signature === signature) {
      telemetry.cacheHitsTotal += 1;
      return entry.bars;
    }

    telemetry.cacheMissesTotal += 1;
    telemetry.aggregationsComputedTotal += 1;

    const aggregated = aggregateCandlesToInterval(baseBars, intervalSec);

    if (cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }

    cache.set(cacheKey, {
      signature,
      expiresAt: nowMs + ttlMs,
      bars: aggregated,
    });

    return aggregated;
  }

  function invalidateSymbol(symbol) {
    if (!symbol) return;
    const prefix = `${symbol}:`;
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  return {
    getAggregatedCandles,
    invalidateSymbol,
    telemetry,
    cache,
  };
}

/**
 * Calcula a latência real de geração e despacho do tick no servidor em milissegundos,
 * substituindo o antigo `latency_ms: 0` hardcoded (Subetapa 4 / Relatório 3.5).
 */
export function computeTickDispatchLatencyMs(eventTimeMs, dispatchTimeMs = Date.now()) {
  if (!Number.isFinite(eventTimeMs) || !Number.isFinite(dispatchTimeMs)) return 0;
  return Math.max(0, Math.round(dispatchTimeMs - eventTimeMs));
}
