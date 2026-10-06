"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenContractSchema = void 0;
const zod_1 = require("zod");
exports.OpenContractSchema = zod_1.z.object({
    symbol: zod_1.z.string().min(1).max(32),
    direction: zod_1.z.enum(["UP", "DOWN"]),
    stake_minor: zod_1.z.number().int().min(100).max(10000) // US$ 1,00 a US$ 100,00 em centavos
}).strict();
