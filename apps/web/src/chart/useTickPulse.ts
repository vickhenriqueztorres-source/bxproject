import { useEffect, useRef, useState } from 'react';
import type { Tick } from '../feed/protocol';

export type PulseDirection = 'UP' | 'DOWN' | null;

/**
 * Hook reativo de micro-interação que detecta mudanças instantâneas de cotação
 * e emite pulso de GPU (180ms) sem vazamento de memória ou timers.
 */
export function useTickPulse(tick: Tick | null): PulseDirection {
  const [pulse, setPulse] = useState<PulseDirection>(null);
  const lastPrice = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tick) return;
    const price = Number(tick.price);
    if (!Number.isFinite(price)) return;

    if (lastPrice.current !== null && lastPrice.current !== price) {
      const direction: PulseDirection = price > lastPrice.current ? 'UP' : 'DOWN';
      setPulse(direction);

      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        setPulse(null);
      }, 180);
    }
    lastPrice.current = price;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [tick]);

  return pulse;
}
