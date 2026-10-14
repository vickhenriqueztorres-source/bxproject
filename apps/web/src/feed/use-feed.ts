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
    let mounted = true;
    tradingFeedManager.connect();

    const unsubscribeStatus = tradingFeedManager.onStatusChange((conn) => {
      if (mounted) setConnected(conn);
    });

    const unsubscribeStaleness = tradingFeedManager.onSymbolStaleness(symbol, (isStale) => {
      if (mounted) setStale(isStale);
    });

    const unsubscribePrivate = tradingFeedManager.subscribePrivate((event) => {
      if (mounted) onPrivate(event);
    });

    const unsubscribeSymbol = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      if (mounted) setTick(incomingTick);
    });

    return () => {
      mounted = false;
      unsubscribeSymbol();
      unsubscribePrivate();
      unsubscribeStaleness();
      unsubscribeStatus();
    };
  }, [symbol, onPrivate, onResync]);

  return { tick, connected, stale };
}
