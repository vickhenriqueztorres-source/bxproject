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
  const [isColdStarting, setIsColdStarting] = useState<boolean>(() =>
    tradingFeedManager.isColdStarting() || tradingFeedManager.isSymbolColdStarting(symbol)
  );

  useEffect(() => {
    let mounted = true;
    tradingFeedManager.connect(true);
    setIsColdStarting(
      tradingFeedManager.isColdStarting() || tradingFeedManager.isSymbolColdStarting(symbol)
    );

    const graceTimer = setTimeout(() => {
      if (mounted) {
        setIsColdStarting(false);
      }
    }, 3500);

    const unsubscribeStatus = tradingFeedManager.onStatusChange((conn) => {
      if (!mounted) return;
      setConnected(conn);
      if (conn) {
        setIsColdStarting(false);
      } else if (!tradingFeedManager.isColdStarting()) {
        setIsColdStarting(false);
      }
    });

    const unsubscribeStaleness = tradingFeedManager.onSymbolStaleness(symbol, (isStale) => {
      if (!mounted) return;
      setStale(isStale);
      if (!isStale) {
        setIsColdStarting(false);
      }
    });

    const unsubscribePrivate = tradingFeedManager.subscribePrivate((event) => {
      if (mounted) onPrivate(event);
    });

    const unsubscribeSymbol = tradingFeedManager.subscribeSymbol(symbol, (incomingTick) => {
      if (!mounted) return;
      setTick(incomingTick);
      setIsColdStarting(false);
    });

    return () => {
      mounted = false;
      clearTimeout(graceTimer);
      unsubscribeSymbol();
      unsubscribePrivate();
      unsubscribeStaleness();
      unsubscribeStatus();
    };
  }, [symbol, onPrivate, onResync]);

  return { tick, connected, stale, isColdStarting };
}
