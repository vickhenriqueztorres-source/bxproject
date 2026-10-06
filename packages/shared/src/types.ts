import { z } from "zod";

export type Direction = "UP" | "DOWN";
export type ContractStatus = "CREATED" | "OPEN" | "SETTLED" | "CANCELLED";
export type ContractResult = "WIN" | "LOSS" | "DRAW";

export const OpenContractSchema = z.object({
  symbol: z.string().min(1).max(32),
  direction: z.enum(["UP", "DOWN"]),
  stake_minor: z.number().int().min(100).max(10000) // US$ 1,00 a US$ 100,00 em centavos
}).strict();

export type OpenContractDTO = z.infer<typeof OpenContractSchema>;

export interface TickDTO {
  symbol: string;
  sequence: string; // string para preservar int64 no JSON
  price: string;    // decimal fixo string (numeric 18,6)
  ts: string;       // ISO 8601 UTC
  prev_hash: string;
  hash: string;
}

export interface CandleDTO {
  symbol: string;
  interval: string;
  bucket_start: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: number;
}
