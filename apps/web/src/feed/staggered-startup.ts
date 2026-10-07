/**
 * Staggered Startup (Padrão de Resiliência contra Reconnect Storm no Deploy/Restart)
 * 
 * Regra:
 * delay_inicial = random(0, 10s)
 * 
 * Evita que um restart ou deploy simultâneo crie um pico imediato no instante 0s.
 */

export const MAX_STAGGERED_DELAY_MS = 10000; // 10 segundos

/**
 * Calcula o atraso inicial escalonado para arranque a frio.
 * @param maxDelayMs Atraso máximo permitido (default: 10000ms = 10s)
 * @param forceImmediate Se verdadeiro, retorna 0ms imediatamente (bypass para ação do usuário)
 * @param randomFn Função geradora pseudo-aleatória
 */
export function getStaggeredDelay(
  maxDelayMs = MAX_STAGGERED_DELAY_MS,
  forceImmediate = false,
  randomFn: () => number = Math.random
): number {
  if (forceImmediate) return 0;
  return Math.floor(randomFn() * maxDelayMs);
}
