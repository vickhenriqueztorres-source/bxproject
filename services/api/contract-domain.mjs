import { z } from 'zod';

/**
 * Schema estrito para criação de contratos (Invariantes A-07, S-02).
 * Rejeição obrigatória de mass-assignment: entry_price, exit_price, user_id, result são proibidos.
 */
export const contractCreateSchema = z
  .object({
    symbol: z.string().min(1),
    direction: z.enum(['UP', 'DOWN']),
    stake_minor: z.number().int().min(100).max(10000),
  })
  .strict();

export const MAX_TICK_AGE_MS = 5000;

/**
 * Validação rigorosa de frescor de cotação contra feed stale (Método 3 - Indústria).
 */
export function validateTickFreshness(symbol, lastTs, maxAgeMs = MAX_TICK_AGE_MS) {
  if (!lastTs) {
    throw new Error(`TICK_UNAVAILABLE: Nenhum tick oficial para ${symbol}`);
  }
  const ageMs = Date.now() - new Date(lastTs).getTime();
  if (ageMs > maxAgeMs) {
    throw new Error(`FEED_STALE: Cotação para ${symbol} desatualizada há ${ageMs}ms (limite: ${maxAgeMs}ms)`);
  }
  return { ok: true, ageMs };
}
