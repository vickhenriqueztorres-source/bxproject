import { useEffect, useState } from 'react';
import { type Tick } from './protocol';
import { tradingFeedManager, type PrivateEvent } from './TradingFeedManager';

export type { PrivateEvent };

export function useFeed(
  symbol: string,
  onPrivate: (event: PrivateEvent) => void,
  onResync: () => void
) {
  const [tick, setTick] = useState<Tick | null>(null);
  const [connected, setConnected] = useState(false);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    tradingFeedManager.connect();

    const unsubscribeStatus = tradingFeedManager.onStatusChange((conn, st) => {
      setConnected(conn);
      setStale(st);
    });

    const unsubscribePrivate = tradingFeedManager.subscribePrivate(onPrivate);

    const unsubscribeSymbol = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      setTick(incomingTick);
    });

    return () => {
      unsubscribeSymbol();
      unsubscribePrivate();
      unsubscribeStatus();
    };
  }, [symbol, onPrivate, onResync]);

  return { tick, connected, stale };
}
