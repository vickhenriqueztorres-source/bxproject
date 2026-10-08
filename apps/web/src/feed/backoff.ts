/**
 * Exponential Backoff com Full Jitter (Padrão Canônico AWS & Padrão R-02 de Resiliência)
 * 
 * Fórmula:
 * delay = random(0, min(cap, base * 2^attempt))
 * 
 * Referência: AWS Architecture Blog - Exponential Backoff And Jitter
 */

export const DEFAULT_BASE_MS = 1000;   // 1 segundo
export const DEFAULT_CAP_MS = 60000;   // 60 segundos

/**
 * Calcula o atraso de reconexão aplicando Exponential Backoff com Full Jitter.
 * @param attempt Número de tentativas falhas já realizadas (0-indexed ou 1-indexed)
 * @param baseMs Atraso base em milissegundos (default: 1000ms)
 * @param capMs Atraso máximo permitido em milissegundos (default: 60000ms)
 * @param randomFn Função geradora de número pseudo-aleatório no intervalo [0, 1)
 */
export function calculateFullJitterDelay(
  attempt: number,
  baseMs = DEFAULT_BASE_MS,
  capMs = DEFAULT_CAP_MS,
  randomFn: () => number = Math.random
): number {
  const safeAttempt = Math.max(0, Math.min(attempt, 30));
  const maxDelay = Math.min(capMs, baseMs * Math.pow(2, safeAttempt));
  return Math.floor(randomFn() * maxDelay);
}

/**
 * Alias compatível com o ecossistema existente de feeds e testes canônicos (T13).
 */
export function reconnectDelay(attempt: number, random: () => number = Math.random): number {
  const ceiling = Math.min(30_000, 500 * 2 ** Math.min(attempt, 16));
  return 100 + Math.floor(random() * (ceiling - 100));
}
