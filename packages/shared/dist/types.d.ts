import { z } from "zod";
export type Direction = "UP" | "DOWN";
export type ContractStatus = "CREATED" | "OPEN" | "SETTLED" | "CANCELLED";
export type ContractResult = "WIN" | "LOSS" | "DRAW";
export declare const OpenContractSchema: z.ZodObject<{
    symbol: z.ZodString;
    direction: z.ZodEnum<["UP", "DOWN"]>;
    stake_minor: z.ZodNumber;
}, "strict", z.ZodTypeAny, {
    symbol: string;
    direction: "UP" | "DOWN";
    stake_minor: number;
}, {
    symbol: string;
    direction: "UP" | "DOWN";
    stake_minor: number;
}>;
export type OpenContractDTO = z.infer<typeof OpenContractSchema>;
export interface TickDTO {
    symbol: string;
    sequence: string;
    price: string;
    ts: string;
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
