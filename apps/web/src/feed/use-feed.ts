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
  const [stale, setStale] = useState(false);

  useEffect(() => {
    tradingFeedManager.connect();

    const unsubscribeStatus = tradingFeedManager.onStatusChange((conn) => {
      setConnected(conn);
    });

    const unsubscribeStaleness = tradingFeedManager.onSymbolStaleness(symbol, (isStale) => {
      setStale(isStale);
    });

    const unsubscribePrivate = tradingFeedManager.subscribePrivate(onPrivate);

    const unsubscribeSymbol = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      setTick(incomingTick);
    });

    return () => {
      unsubscribeSymbol();
      unsubscribePrivate();
      unsubscribeStaleness();
      unsubscribeStatus();
    };
  }, [symbol, onPrivate, onResync]);

  return { tick, connected, stale };
}
