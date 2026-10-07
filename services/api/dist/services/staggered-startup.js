"use strict";
/**
 * Staggered Startup (Padrão de Resiliência contra Reconnect Storm no Deploy/Restart)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_STAGGERED_DELAY_MS = void 0;
exports.getStaggeredDelay = getStaggeredDelay;
exports.MAX_STAGGERED_DELAY_MS = 10000; // 10 segundos
function getStaggeredDelay(maxDelayMs = exports.MAX_STAGGERED_DELAY_MS, forceImmediate = false, randomFn = Math.random) {
    if (forceImmediate)
        return 0;
    return Math.floor(randomFn() * maxDelayMs);
}
