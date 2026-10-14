export type ExpiryMode = '1M_FIXED' | 'CANDLE_1M' | 'CANDLE_5M';

export interface ExpirySlot {
  id: string;
  type: '1M' | '5M' | '15M' | 'TURBO_1M' | 'TURBO_2M' | 'TURBO_5M';
  mode: ExpiryMode;
  category: 'CANDLE_END' | 'TURBO';
  label: string;
  targetTimeFormatted: string; // ex: "19:05"
  remainingSeconds: number;
  remainingFormatted: string; // ex: "in 01:23"
  targetEpochMs: number;
  durationSeconds: number;
}

/**
 * Formata segundos no padrão MM:SS (ex: 83 -> "01:23")
 */
export function formatSecondsToMmSs(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safeSec / 60);
  const s = safeSec % 60;
  return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
}

/**
 * Formata Date para HH:MM em UTC ou fuso horário local do usuário
 */
export function formatTimeHhMm(date: Date, timeZoneOffsetHours: number = -3): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const targetDate = new Date(utc + 3600000 * timeZoneOffsetHours);
  const h = targetDate.getHours();
  const m = targetDate.getMinutes();
  return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
}

/**
 * Calcula os slots de tempo de expiração disponíveis no momento exato (Modelo IQ Option)
 * 
 * Regra dos 60 segundos (Piso Mínimo Inviolável):
 * O tempo mínimo de expiração das operações é de 60 segundos.
 * Se faltar menos de 60s para o fechamento da vela atual, a expiração
 * avança para a vela seguinte, garantindo duração >= 60s.
 */
export function calculateExpirySlots(now: Date = new Date(), timeZoneOffsetHours: number = -3): ExpirySlot[] {
  const rawNowMs = now instanceof Date && Number.isFinite(now.getTime()) ? now.getTime() : Date.now();
  const nowMs = rawNowMs;

  // 1. Fim de Vela de 1 Minuto (1M) — Piso mínimo de 60s
  const cur1mEndMs = Math.ceil(nowMs / 60_000) * 60_000;
  const rem1mSec = Math.floor((cur1mEndMs - nowMs) / 1000);
  const target1mMs = rem1mSec < 60 ? cur1mEndMs + 60_000 : cur1mEndMs;
  const final1mSec = Math.max(60, Math.floor((target1mMs - nowMs) / 1000));

  // 2. Fim de Vela de 5 Minutos (5M) — Piso mínimo de 60s
  const cur5mEndMs = Math.ceil(nowMs / 300_000) * 300_000;
  const rem5mSec = Math.floor((cur5mEndMs - nowMs) / 1000);
  const target5mMs = rem5mSec < 60 ? cur5mEndMs + 300_000 : cur5mEndMs;
  const final5mSec = Math.max(60, Math.floor((target5mMs - nowMs) / 1000));

  // 3. 1 Minuto Corrido (Turbo 60s)
  const turbo1mSec = 60;

  return [
    {
      id: 'turbo_1m',
      type: 'TURBO_1M',
      mode: '1M_FIXED',
      category: 'TURBO',
      label: '1 Minuto (60s)',
      targetTimeFormatted: formatTimeHhMm(new Date(nowMs + 60_000), timeZoneOffsetHours),
      remainingSeconds: turbo1mSec,
      remainingFormatted: 'in 01:00',
      targetEpochMs: nowMs + 60_000,
      durationSeconds: turbo1mSec,
    },
    {
      id: 'candle_1m',
      type: '1M',
      mode: 'CANDLE_1M',
      category: 'CANDLE_END',
      label: 'Fim da Vela 1M',
      targetTimeFormatted: formatTimeHhMm(new Date(target1mMs), timeZoneOffsetHours),
      remainingSeconds: final1mSec,
      remainingFormatted: `in ${formatSecondsToMmSs(final1mSec)}`,
      targetEpochMs: target1mMs,
      durationSeconds: final1mSec,
    },
    {
      id: 'candle_5m',
      type: '5M',
      mode: 'CANDLE_5M',
      category: 'CANDLE_END',
      label: 'Fim da Vela 5M',
      targetTimeFormatted: formatTimeHhMm(new Date(target5mMs), timeZoneOffsetHours),
      remainingSeconds: final5mSec,
      remainingFormatted: `in ${formatSecondsToMmSs(final5mSec)}`,
      targetEpochMs: target5mMs,
      durationSeconds: final5mSec,
    },
  ];
}

/**
 * Calcula o tempo oficial de expiração no momento do envio da ordem
 * Impondo a garantia inviolável de NUNCA liquidar em menos de 60 segundos!
 */
export function calculateExecutionExpiry(
  mode: ExpiryMode = '1M_FIXED',
  nowMs: number = Date.now()
): { durationMs: number; targetEpochMs: number } {
  const safeNowMs = Number.isFinite(nowMs) && nowMs > 0 ? nowMs : Date.now();
  let targetEpochMs: number;

  if (mode === 'CANDLE_1M') {
    const cur1mEndMs = Math.ceil(safeNowMs / 60_000) * 60_000;
    const remSec = Math.floor((cur1mEndMs - safeNowMs) / 1000);
    // Se faltar menos de 60s para o minuto fechar, expira no fim do próximo minuto (+1m)
    targetEpochMs = remSec < 60 ? cur1mEndMs + 60_000 : cur1mEndMs;
  } else if (mode === 'CANDLE_5M') {
    const cur5mEndMs = Math.ceil(safeNowMs / 300_000) * 300_000;
    const remSec = Math.floor((cur5mEndMs - safeNowMs) / 1000);
    // Se faltar menos de 60s para o bloco de 5m fechar, expira no próximo bloco de 5m
    targetEpochMs = remSec < 60 ? cur5mEndMs + 300_000 : cur5mEndMs;
  } else {
    // 1M_FIXED (60 segundos corridos a partir do clique)
    targetEpochMs = safeNowMs + 60_000;
  }

  // PISO DE SEGURANÇA: NUNCA MENOS DE 60 SEGUNDOS (60.000ms)!
  const diffMs = targetEpochMs - safeNowMs;
  const durationMs = Math.max(60_000, diffMs);

  return {
    durationMs,
    targetEpochMs: safeNowMs + durationMs,
  };
}
