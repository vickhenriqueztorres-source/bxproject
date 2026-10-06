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
