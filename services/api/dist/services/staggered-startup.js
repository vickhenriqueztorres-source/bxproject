/**
 * Staggered Startup (Padrão de Resiliência contra Reconnect Storm no Deploy/Restart)
 */
export const MAX_STAGGERED_DELAY_MS = 10000; // 10 segundos
export function getStaggeredDelay(maxDelayMs = MAX_STAGGERED_DELAY_MS, forceImmediate = false, randomFn = Math.random) {
    if (forceImmediate)
        return 0;
    return Math.floor(randomFn() * maxDelayMs);
}
