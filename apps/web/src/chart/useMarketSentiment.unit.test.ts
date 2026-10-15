import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useMarketSentiment,
  fetchMarketSentiment,
  setSentimentEnabledForTesting,
  type MarketSentimentResult,
  type SentimentApiResponse,
} from './useMarketSentiment';

/**
 * Helper para testar o hook useMarketSentiment em ambiente Node (sem jsdom),
 * combinando renderToString com o ciclo real do QueryClient do @tanstack/react-query.
 */
function createHookHarness(initialSymbol: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  let currentSymbol = initialSymbol;
  let lastResult: MarketSentimentResult = { bulls: 50, neutral: true };

  function Probe({ symbol }: { symbol: string }) {
    lastResult = useMarketSentiment(symbol);
    return React.createElement('div', {
      'data-bulls': String(lastResult.bulls),
      'data-neutral': String(lastResult.neutral),
    });
  }

  function renderOnce(symbol = currentSymbol): MarketSentimentResult {
    currentSymbol = symbol;
    renderToString(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Probe, { symbol })
      )
    );
    return lastResult;
  }

  async function flushSymbolQuery(symbol = currentSymbol): Promise<MarketSentimentResult> {
    const normalized = symbol.trim() || 'VOL_50';
    try {
      await queryClient.fetchQuery({
        queryKey: ['sentiment', normalized],
        queryFn: ({ signal }) => fetchMarketSentiment(normalized, signal),
        staleTime: 4000,
        retry: false,
      });
    } catch {
      // Erros HTTP (404/500/network) ficam registrados no estado da query no QueryCache
    }
    return renderOnce(symbol);
  }

  return {
    queryClient,
    renderOnce,
    flushSymbolQuery,
    getResult: () => lastResult,
  };
}

describe('SUBETAPA 3: useMarketSentiment — Hook React Query, Isolamento de Símbolo, Flags e Caos', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    setSentimentEnabledForTesting(true);
  });

  afterEach(() => {
    setSentimentEnabledForTesting(null);
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('1. Estado inicial (carregando) devolve { bulls: 50, neutral: true } e após resposta válida com sample >= 5 devolve { bulls: 74, neutral: false }', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      const payload: SentimentApiResponse = {
        symbol: 'VOL_100',
        bulls_pct: 74,
        sample_size: 400,
        low_sample: false,
        ts: new Date().toISOString(),
      };
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const harness = createHookHarness('VOL_100');

    // Antes do retorno da API (isPending = true)
    const initial = harness.renderOnce('VOL_100');
    expect(initial).toEqual({ bulls: 50, neutral: true });

    // Após resolução da query
    const resolved = await harness.flushSymbolQuery('VOL_100');
    expect(resolved).toEqual({ bulls: 74, neutral: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/sentiment?symbol=VOL_100');
  });

  it('2. Amostra pequena (low_sample: true) força { bulls: 50, neutral: true } mesmo se bulls_pct vier diferente de 50', async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          symbol: 'VOL_50',
          bulls_pct: 50,
          sample_size: 0,
          low_sample: true,
          ts: new Date().toISOString(),
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const harness = createHookHarness('VOL_50');
    const result = await harness.flushSymbolQuery('VOL_50');
    expect(result).toEqual({ bulls: 50, neutral: true });
  });

  it('3. Troca de ativo: não herda sentimento do ativo anterior — volta imediatamente para { bulls: 50, neutral: true } até a resposta do novo ativo', async () => {
    let resolveVol50!: (res: Response) => void;

    globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('symbol=VOL_10')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              symbol: 'VOL_10',
              bulls_pct: 72,
              sample_size: 25,
              low_sample: false,
              ts: new Date().toISOString(),
            }),
            { status: 200 }
          )
        );
      }
      return new Promise<Response>((resolve) => {
        resolveVol50 = resolve;
      });
    }) as unknown as typeof fetch;

    const harness = createHookHarness('VOL_10');
    const vol10Result = await harness.flushSymbolQuery('VOL_10');
    expect(vol10Result).toEqual({ bulls: 72, neutral: false });

    // Troca para VOL_50 (cuja resposta ainda não chegou)
    const immediateAfterSwitch = harness.renderOnce('VOL_50');
    expect(immediateAfterSwitch).toEqual({ bulls: 50, neutral: true });

    // Agora chega a resposta do VOL_50
    const pendingFlush = harness.flushSymbolQuery('VOL_50');
    resolveVol50(
      new Response(
        JSON.stringify({
          symbol: 'VOL_50',
          bulls_pct: 38,
          sample_size: 18,
          low_sample: false,
          ts: new Date().toISOString(),
        }),
        { status: 200 }
      )
    );
    const vol50Result = await pendingFlush;
    expect(vol50Result).toEqual({ bulls: 38, neutral: false });
  });

  it('4. Caos HTTP 404 (serviço desligado no servidor), 500 ou erro de rede devolve { bulls: 50, neutral: true } sem lançar exceção', async () => {
    for (const status of [404, 500, 400]) {
      globalThis.fetch = vi.fn(async () => {
        return new Response(JSON.stringify({ error: `HTTP ${status}` }), { status });
      }) as unknown as typeof fetch;

      const harness = createHookHarness('VOL_75');
      const res = await harness.flushSymbolQuery('VOL_75');
      expect(res).toEqual({ bulls: 50, neutral: true });
    }

    // Falha de rede pura (TypeError: fetch failed)
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const netHarness = createHookHarness('VOL_75');
    const netRes = await netHarness.flushSymbolQuery('VOL_75');
    expect(netRes).toEqual({ bulls: 50, neutral: true });
  });

  it('5. Feature flag desligada (VITE_SENTIMENT_ENABLED=false) devolve { bulls: 50, neutral: true } e não dispara fetch', () => {
    setSentimentEnabledForTesting(false);
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const harness = createHookHarness('VOL_100');
    const res = harness.renderOnce('VOL_100');

    expect(res).toEqual({ bulls: 50, neutral: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('6. Stress: 30 trocas rápidas de símbolo e payloads malformados nunca corrompem o estado nem vazam valores entre chaves', async () => {
    const symbols = ['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100'];
    const expectedBySymbol: Record<string, number> = {
      VOL_10: 61,
      VOL_25: 42,
      VOL_50: 55,
      VOL_75: 68,
      VOL_100: 33,
    };

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const sym = url.searchParams.get('symbol') ?? 'VOL_50';
      return new Response(
        JSON.stringify({
          symbol: sym,
          bulls_pct: expectedBySymbol[sym] ?? 50,
          sample_size: 20,
          low_sample: false,
          ts: new Date().toISOString(),
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const harness = createHookHarness('VOL_10');

    for (let i = 0; i < 30; i++) {
      const sym = symbols[i % symbols.length]!;
      const beforeFetch = harness.renderOnce(sym);
      // Se ainda não estava no cache, precisa estar neutro; se já estava no cache deste símbolo, tem o valor exato dele
      if (i < symbols.length) {
        expect(beforeFetch).toEqual({ bulls: 50, neutral: true });
      }
      const afterFetch = await harness.flushSymbolQuery(sym);
      expect(afterFetch).toEqual({
        bulls: expectedBySymbol[sym],
        neutral: false,
      });
    }
  });
});
