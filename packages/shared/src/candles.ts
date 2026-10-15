/**
 * Regra Única de Vela OHLCV (Relatório #11 — Item 1, 2 e 4)
 * Compartilhada entre servidor (Tick Engine / Candle Worker / Monólito), cliente (Lightweight Charts) e jobs de auditoria/rebuild.
 *
 * Invariantes:
 * - Período [início, início + passo), com início = floor(ts / passo) * passo alinhado ao Unix epoch.
 * - open = primeiro tick do período (menor sequence / primeiro timestamp do bucket).
 * - high / low = máximo / mínimo exclusivamente dos ticks do período.
 * - close = último tick do período (maior sequence).
 * - Período sem tick NÃO vira vela.
 */

export interface SharedTickInput {
  timeSec?: number;
  ts?: number | string;
  price: number;
  sequence?: number | null;
}

export interface SharedCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  last_sequence?: number | null;
  source?: 'ticks' | 'official' | 'derived';
}

function extractTimeSec(tick: SharedTickInput | null | undefined): number {
  if (!tick) return NaN;
  if (typeof tick.timeSec === 'number' && Number.isFinite(tick.timeSec)) {
    return tick.timeSec > 1e11 ? Math.floor(tick.timeSec / 1000) : Math.floor(tick.timeSec);
  }
  if (typeof tick.ts === 'number' && Number.isFinite(tick.ts)) {
    return tick.ts > 1e11 ? Math.floor(tick.ts / 1000) : Math.floor(tick.ts);
  }
  if (typeof tick.ts === 'string') {
    const parsed = Date.parse(tick.ts);
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN;
  }
  return NaN;
}

export function bucketStartTime(tsSec: number, stepSec: number): number {
  const safeStep = stepSec > 0 && Number.isFinite(stepSec) ? Math.floor(stepSec) : 60;
  return Math.floor(Math.floor(tsSec) / safeStep) * safeStep;
}

/**
 * Aplica um único tick sobre a vela corrente (ou inicia nova vela se pertence a bucket posterior).
 * Retorna a vela atualizada/nova, ou null se o tick for inválido ou anterior ao bucket atual.
 */
export function applyTick(
  previous: SharedCandle | null,
  tick: SharedTickInput,
  stepSec: number = 5
): SharedCandle | null {
  const timeSec = extractTimeSec(tick);
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null;
  if (!Number.isFinite(tick.price) || tick.price <= 0) return null;

  const bucket = bucketStartTime(timeSec, stepSec);
  const seq = typeof tick.sequence === 'number' && Number.isFinite(tick.sequence) ? tick.sequence : null;

  if (!previous || bucket > previous.time) {
    return {
      time: bucket,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: 1,
      last_sequence: seq,
      source: 'ticks',
    };
  }

  if (bucket < previous.time) {
    return null;
  }

  const prevSeq =
    typeof previous.last_sequence === 'number' && Number.isFinite(previous.last_sequence)
      ? previous.last_sequence
      : null;
  const isNewerOrEqualSeq = seq === null || prevSeq === null || seq >= prevSeq;

  return {
    time: previous.time,
    open: previous.open,
    high: Math.max(previous.high, tick.price, previous.open),
    low: Math.min(previous.low, tick.price, previous.open),
    close: isNewerOrEqualSeq ? tick.price : previous.close,
    volume: (previous.volume || 0) + 1,
    last_sequence:
      seq !== null && prevSeq !== null ? Math.max(seq, prevSeq) : (seq ?? prevSeq),
    source: previous.source ?? 'ticks',
  };
}

/**
 * Constrói uma série de velas ordenada a partir de uma lista de ticks para qualquer intervalo stepSec (5, 15, 30, 60...).
 * Períodos sem ticks não geram velas.
 */
export function buildCandlesFromTicks(ticks: SharedTickInput[], stepSec: number = 5): SharedCandle[] {
  if (!Array.isArray(ticks) || ticks.length === 0) return [];

  const buckets = new Map<
    number,
    SharedCandle & { _minSeq: number; _maxSeq: number; _seenSeq: Set<number> }
  >();

  for (let i = 0; i < ticks.length; i++) {
    const t = ticks[i];
    const timeSec = extractTimeSec(t);
    if (!Number.isFinite(timeSec) || timeSec <= 0) continue;
    if (!Number.isFinite(t.price) || t.price <= 0) continue;

    const bucket = bucketStartTime(timeSec, stepSec);
    const seq = typeof t.sequence === 'number' && Number.isFinite(t.sequence) ? t.sequence : i + 1;
    const existing = buckets.get(bucket);

    if (!existing) {
      buckets.set(bucket, {
        time: bucket,
        open: t.price,
        high: t.price,
        low: t.price,
        close: t.price,
        volume: 1,
        last_sequence: seq,
        source: 'ticks',
        _minSeq: seq,
        _maxSeq: seq,
        _seenSeq: new Set([seq]),
      });
    } else if (!existing._seenSeq.has(seq)) {
      existing._seenSeq.add(seq);
      existing.volume += 1;
      existing.high = Math.max(existing.high, t.price);
      existing.low = Math.min(existing.low, t.price);
      if (seq < existing._minSeq) {
        existing._minSeq = seq;
        existing.open = t.price;
      }
      if (seq >= existing._maxSeq) {
        existing._maxSeq = seq;
        existing.close = t.price;
        existing.last_sequence = seq;
      }
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map(({ _minSeq, _maxSeq, _seenSeq, ...bar }) => bar);
}

/**
 * Soma velas base (ex: 5s) para intervalos múltiplos exatos (15s, 30s, 60s, 300s).
 * Como 5 divide 15/30/60 e os períodos são alinhados ao Unix epoch, o resultado é matematicamente idêntico a agregar ticks direto.
 */
export function aggregateSubCandles(
  baseCandles: SharedCandle[],
  targetStepSec: number
): SharedCandle[] {
  if (!Array.isArray(baseCandles) || baseCandles.length === 0) return [];

  const buckets = new Map<
    number,
    SharedCandle & { _minTime: number; _maxTime: number; _maxSeq: number | null }
  >();

  for (const bar of baseCandles) {
    if (!bar || !Number.isFinite(bar.time) || bar.time <= 0) continue;
    const bucket = bucketStartTime(bar.time, targetStepSec);
    const seq =
      typeof bar.last_sequence === 'number' && Number.isFinite(bar.last_sequence)
        ? bar.last_sequence
        : null;
    const existing = buckets.get(bucket);

    if (!existing) {
      buckets.set(bucket, {
        time: bucket,
        open: bar.open,
        high: Math.max(bar.high, bar.open, bar.close),
        low: Math.min(bar.low, bar.open, bar.close),
        close: bar.close,
        volume: bar.volume || 1,
        last_sequence: seq,
        source: bar.source ?? 'ticks',
        _minTime: bar.time,
        _maxTime: bar.time,
        _maxSeq: seq,
      });
    } else {
      existing.high = Math.max(existing.high, bar.high, bar.open, bar.close);
      existing.low = Math.min(existing.low, bar.low, bar.open, bar.close);
      existing.volume = (existing.volume || 0) + (bar.volume || 1);
      if (bar.time < existing._minTime) {
        existing._minTime = bar.time;
        existing.open = bar.open;
      }
      const isNewerSeq =
        seq !== null && existing._maxSeq !== null
          ? seq >= existing._maxSeq
          : bar.time >= existing._maxTime;
      if (bar.time > existing._maxTime || isNewerSeq) {
        existing._maxTime = Math.max(existing._maxTime, bar.time);
        existing.close = bar.close;
      }
      if (seq !== null) {
        existing._maxSeq = existing._maxSeq !== null ? Math.max(existing._maxSeq, seq) : seq;
        existing.last_sequence = existing._maxSeq;
      }
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map(({ _minTime, _maxTime, _maxSeq, ...bar }) => bar);
}

/**
 * Reconciliação Servidor × Cliente (Relatório #11 — Item 4):
 * - Velas fechadas (isClosed = true): vale a do servidor; reporta mismatch se houver diferença.
 * - Vela corrente (isClosed = false): open do servidor, high = max, low = min, close do lado com sequence maior.
 */
export function reconcileServerAndClientCandle(
  serverBar: SharedCandle,
  clientBar: SharedCandle,
  isClosed: boolean = false
): { merged: SharedCandle; mismatch: boolean } {
  const eps = 1e-9;
  const hasDiff =
    Math.abs(serverBar.open - clientBar.open) > eps ||
    Math.abs(serverBar.high - clientBar.high) > eps ||
    Math.abs(serverBar.low - clientBar.low) > eps ||
    Math.abs(serverBar.close - clientBar.close) > eps;

  if (isClosed) {
    return {
      merged: { ...serverBar },
      mismatch: hasDiff,
    };
  }

  const sSeq =
    typeof serverBar.last_sequence === 'number' && Number.isFinite(serverBar.last_sequence)
      ? serverBar.last_sequence
      : -1;
  const cSeq =
    typeof clientBar.last_sequence === 'number' && Number.isFinite(clientBar.last_sequence)
      ? clientBar.last_sequence
      : -1;

  const useClientClose = cSeq > sSeq || (cSeq === -1 && sSeq === -1);
  const close = useClientClose ? clientBar.close : serverBar.close;
  const open = serverBar.open;
  const high = Math.max(serverBar.high, clientBar.high, open, close);
  const low = Math.min(serverBar.low, clientBar.low, open, close);
  const maxSeq = Math.max(sSeq, cSeq);

  return {
    merged: {
      time: serverBar.time,
      open,
      high,
      low,
      close,
      volume: Math.max(serverBar.volume || 1, clientBar.volume || 1),
      last_sequence: maxSeq >= 0 ? maxSeq : (serverBar.last_sequence ?? clientBar.last_sequence ?? null),
      source: serverBar.source ?? clientBar.source ?? 'ticks',
    },
    mismatch: false,
  };
}

/**
 * Recalibra sigma e theta do processo Ornstein-Uhlenbeck ao alterar a frequência de ticks (Risco 1 do Relatório #11).
 * A dtRatio = (1000 / intervalMs)^-1 (ex: 250ms => dt = 0.25s):
 * - sigma_scaled = sigma_1Hz * sqrt(dt)
 * - theta_scaled = 1 - (1 - theta_1Hz)^dt
 */
export function scaleOuParamsForFrequency(
  sigma1Hz: number,
  theta1Hz: number,
  intervalMs: number = 1000
): { sigma: number; theta: number; dtSec: number } {
  const dtSec = Math.max(0.05, intervalMs / 1000);
  const sigma = sigma1Hz * Math.sqrt(dtSec);
  const clampedTheta = Math.min(0.9999, Math.max(0, theta1Hz));
  const theta = 1 - Math.pow(1 - clampedTheta, dtSec);
  return { sigma, theta, dtSec };
}
