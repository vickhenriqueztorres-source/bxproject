/**
 * Exponential Backoff com Full Jitter (Padrão Canônico AWS & Padrão R-02 de Resiliência)
 *
 * Fórmula:
 * delay = random(0, min(cap, base * 2^attempt))
 */
export const DEFAULT_BASE_MS = 1000; // 1 segundo
export const DEFAULT_CAP_MS = 60000; // 60 segundos
export function calculateFullJitterDelay(attempt, baseMs = DEFAULT_BASE_MS, capMs = DEFAULT_CAP_MS, randomFn = Math.random) {
    const safeAttempt = Math.max(0, Math.min(attempt, 30));
    const maxDelay = Math.min(capMs, baseMs * Math.pow(2, safeAttempt));
    return Math.floor(randomFn() * maxDelay);
}
export function reconnectDelay(attempt, randomFn = Math.random, baseMs = DEFAULT_BASE_MS, capMs = DEFAULT_CAP_MS) {
    return calculateFullJitterDelay(attempt, baseMs, capMs, randomFn);
}
