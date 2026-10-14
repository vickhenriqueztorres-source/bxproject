import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

export interface SanitizedOHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Normaliza timestamps para segundos UTC inteiros.
 * Detecta se o timestamp está em milissegundos (> 10.000.000.000) e converte.
 */
export function normalizeTimeSeconds(time: unknown): number | null {
  if (time === null || time === undefined) return null;

  let num: number;
  if (typeof time === 'number') {
    num = time;
  } else if (typeof time === 'string') {
    const trimmed = time.trim();
    if (!trimmed) return null;
    num = Number(trimmed);
    if (isNaN(num)) {
      // Tentar parse de data ISO em UTC estrito (ex: "2026-10-08T22:00:00Z" ou "2026-10-08 22:00:00")
      // Se não possuir sufixo de fuso ('Z' ou ±HH:MM), força 'Z' para evitar buracos por fuso local (#1344)
      const isoCandidate = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
      const hasExplicitTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoCandidate);
      const parsedUtc = Date.parse(hasExplicitTz ? isoCandidate : `${isoCandidate}Z`);
      if (!isNaN(parsedUtc)) {
        num = parsedUtc;
      } else {
        const parsedFallback = Date.parse(trimmed);
        if (!isNaN(parsedFallback)) {
          num = parsedFallback;
        } else {
          return null;
        }
      }
    }
  } else {
    return null;
  }

  if (!Number.isFinite(num) || num <= 0) return null;

  // Se o número for em milissegundos (> ano 2286 em segundos ou > ano 1973 em ms)
  if (num > 10_000_000_000) {
    num = Math.floor(num / 1000);
  } else {
    num = Math.floor(num);
  }

  return num > 0 ? num : null;
}

/**
 * Converte valor numérico com fallback seguro para finitude.
 */
export function safeNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

/**
 * Sanitiza conjunto completo de velas para Lightweight Charts.
 * Invariantes garantidos:
 * 1. Timestamps estritamente crescentes (time[i] > time[i-1]).
 * 2. Deduplicação automática de timestamps repetidos (mesclagem OHLC correta).
 * 3. Valores OHLC finitos e não-negativos.
 * 4. Invariante geométrico da vela: low <= min(open, close) e high >= max(open, close).
 */
export function sanitizeCandles(rawCandles: Candle[] | null | undefined): Candle[] {
  if (!rawCandles || !Array.isArray(rawCandles) || rawCandles.length === 0) {
    return [];
  }

  const validCandles: Candle[] = [];

  for (let i = 0; i < rawCandles.length; i++) {
    const raw = rawCandles[i];
    if (!raw || typeof raw !== 'object') continue;

    const timeSec = normalizeTimeSeconds(raw.time);
    if (timeSec === null) continue;

    const open = safeNumber(raw.open);
    const high = safeNumber(raw.high);
    const low = safeNumber(raw.low);
    const close = safeNumber(raw.close);

    // Rejeita velas com preços inválidos (<= 0)
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0) continue;

    const minOC = Math.min(open, close);
    const maxOC = Math.max(open, close);

    const adjustedHigh = Math.max(high, maxOC);
    const adjustedLow = Math.min(low, minOC);

    validCandles.push({
      time: timeSec,
      open: String(open),
      high: String(adjustedHigh),
      low: String(adjustedLow),
      close: String(close),
      volume: raw.volume !== undefined ? Math.max(0, safeNumber(raw.volume, 0)) : 0,
    });
  }

  if (validCandles.length === 0) return [];

  // Ordenação estrita por tempo ascendente
  validCandles.sort((a, b) => Number(a.time) - Number(b.time));

  // Deduplicação de velas com mesmo timestamp (agrupamento OHLC)
  const deduplicated: Candle[] = [validCandles[0]];

  for (let i = 1; i < validCandles.length; i++) {
    const current = validCandles[i];
    const prev = deduplicated[deduplicated.length - 1];

    if (Number(current.time) === Number(prev.time)) {
      // Mescla velas de mesmo timestamp:
      // Mantém open da primeira, close da última, maior high, menor low
      const prevH = safeNumber(prev.high);
      const currH = safeNumber(current.high);
      const prevL = safeNumber(prev.low);
      const currL = safeNumber(current.low);

      prev.high = String(Math.max(prevH, currH));
      prev.low = String(Math.min(prevL, currL));
      prev.close = current.close;
      prev.volume = (prev.volume ?? 0) + (current.volume ?? 0);
    } else if (Number(current.time) > Number(prev.time)) {
      deduplicated.push(current);
    }
    // Se por alguma razão for menor, o sort já resolveu, mas ignoramos para garantir monotonia estrita
  }

  return deduplicated;
}

/**
 * Sanitiza um tick recebido em tempo real.
 * Rejeita valores não-finitos, preços <= 0 ou corrompidos.
 */
export function sanitizeTick(tick: Tick | null | undefined): { price: number; timeSec: number } | null {
  if (!tick) return null;

  const priceNum = safeNumber(tick.price, -1);
  if (priceNum <= 0) return null;

  const rawTime = tick.event_time ?? (tick.ts ? Date.parse(tick.ts) : Date.now());
  const timeSec = normalizeTimeSeconds(rawTime);
  if (timeSec === null) return null;

  return {
    price: priceNum,
    timeSec,
  };
}

/**
 * Valida se uma atualização incremental de vela é segura para o método .update() da Lightweight Charts.
 * A biblioteca lança erro fatal se newBar.time < lastBar.time.
 */
export function isSafeBarUpdate(newBarTime: number, lastBarTime: number | null): boolean {
  if (lastBarTime === null) return true;
  return newBarTime >= lastBarTime;
}
