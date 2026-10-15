import { useContext } from 'react';
import { useQuery, QueryClient, QueryClientContext } from '@tanstack/react-query';

export interface SentimentApiResponse {
  symbol: string;
  bulls_pct: number;
  sample_size: number;
  low_sample: boolean;
  ts: string;
}

export interface MarketSentimentResult {
  bulls: number;
  neutral: boolean;
}

let sentimentEnabledOverride: boolean | null = null;

export function setSentimentEnabledForTesting(enabled: boolean | null): void {
  sentimentEnabledOverride = enabled;
}

export function isSentimentEnabled(): boolean {
  if (sentimentEnabledOverride !== null) {
    return sentimentEnabledOverride;
  }
  const metaEnv =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, unknown> }).env
      ? (import.meta as unknown as { env: Record<string, unknown> }).env.VITE_SENTIMENT_ENABLED
      : undefined;
  const globalProc = (globalThis as unknown as { process?: { env?: Record<string, unknown> } }).process;
  const procEnv = globalProc?.env ? globalProc.env.VITE_SENTIMENT_ENABLED : undefined;
  const raw = metaEnv !== undefined ? metaEnv : procEnv;

  if (raw === false || raw === 'false' || raw === '0') {
    return false;
  }
  return true;
}

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export async function fetchMarketSentiment(
  symbol: string,
  signal?: AbortSignal
): Promise<SentimentApiResponse> {
  const baseUrlRaw =
    typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, unknown> }).env
      ? (import.meta as unknown as { env: Record<string, unknown> }).env.VITE_API_URL
      : undefined;
  const baseUrl = typeof baseUrlRaw === 'string' ? baseUrlRaw.replace(/\/+$/, '') : '';
  const url = `${baseUrl}/api/sentiment?symbol=${encodeURIComponent(symbol)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal,
  });

  if (!res.ok) {
    throw new Error(`Sentiment HTTP ${res.status}`);
  }

  const data = (await res.json()) as SentimentApiResponse;
  if (!data || typeof data.bulls_pct !== 'number' || !Number.isFinite(data.bulls_pct)) {
    throw new Error('Invalid sentiment payload');
  }

  return data;
}

export function useMarketSentiment(symbol: string): MarketSentimentResult {
  const normalizedSymbol = typeof symbol === 'string' && symbol.trim() ? symbol.trim() : 'VOL_50';
  const flagEnabled = isSentimentEnabled();
  const contextClient = QueryClientContext ? useContext(QueryClientContext) : undefined;
  const hasProvider = Boolean(contextClient);

  const { data, isLoading, isPending, isError } = useQuery<SentimentApiResponse>(
    {
      queryKey: ['sentiment', normalizedSymbol],
      queryFn: ({ signal }) => fetchMarketSentiment(normalizedSymbol, signal),
      enabled: flagEnabled && (hasProvider || typeof window !== 'undefined'),
      refetchInterval: 5000,
      staleTime: 4000,
      retry: false,
    },
    contextClient ?? fallbackQueryClient
  );

  if (!flagEnabled || isLoading || isPending || isError || !data) {
    return { bulls: 50, neutral: true };
  }

  const lowSample = Boolean(data.low_sample);
  const neutral = lowSample;
  const bulls = neutral
    ? 50
    : Math.min(100, Math.max(0, Math.round(Number(data.bulls_pct))));

  return { bulls, neutral };
}
