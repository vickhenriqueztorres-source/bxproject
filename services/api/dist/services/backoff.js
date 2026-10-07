"use strict";
/**
 * Exponential Backoff com Full Jitter (Padrão Canônico AWS & Padrão R-02 de Resiliência)
 *
 * Fórmula:
 * delay = random(0, min(cap, base * 2^attempt))
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CAP_MS = exports.DEFAULT_BASE_MS = void 0;
exports.calculateFullJitterDelay = calculateFullJitterDelay;
exports.reconnectDelay = reconnectDelay;
exports.DEFAULT_BASE_MS = 1000; // 1 segundo
exports.DEFAULT_CAP_MS = 60000; // 60 segundos
function calculateFullJitterDelay(attempt, baseMs = exports.DEFAULT_BASE_MS, capMs = exports.DEFAULT_CAP_MS, randomFn = Math.random) {
    const safeAttempt = Math.max(0, Math.min(attempt, 30));
    const maxDelay = Math.min(capMs, baseMs * Math.pow(2, safeAttempt));
    return Math.floor(randomFn() * maxDelay);
}
function reconnectDelay(attempt, randomFn = Math.random, baseMs = exports.DEFAULT_BASE_MS, capMs = exports.DEFAULT_CAP_MS) {
    return calculateFullJitterDelay(attempt, baseMs, capMs, randomFn);
}
