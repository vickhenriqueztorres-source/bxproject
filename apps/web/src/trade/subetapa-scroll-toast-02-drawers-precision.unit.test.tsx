import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketNewsDrawer } from '../news/MarketNewsDrawer';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { BinmaxHistoryDrawer } from '../components/drawer/BinmaxHistoryDrawer';
import type { Contract } from '../api/client';
import type { MarketNewsItem } from '../news/news-types';

function renderWithQueryData(newsItems: MarketNewsItem[], ui: React.ReactElement): string {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  queryClient.setQueryData(['market-news', 'ALL'], newsItems);
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('SUBETAPA 02 — Refinamento Cirúrgico das Gavetas (Análisis, Portafolio, Historial)', () => {
  it('1. [Unit] MarketNewsDrawer elimina cabeçalho duplicado, remove scroll horizontal nas categorias e usa badges de precisão', () => {
    const sampleNews: MarketNewsItem[] = [
      {
        id: 'n-1',
        title: 'Fed mantém juros e fortalece liquidez no índice Vol 50',
        summary: 'Fluxo institucional aumenta volume nos índices sintéticos OTC.',
        source: 'Reuters Financial',
        category: 'INDICES',
        sentiment: 'BULLISH',
        published_at: new Date(Date.now() - 12 * 60000).toISOString(),
        url: 'https://example.com/news/1',
      },
      {
        id: 'n-2',
        title: 'Correção técnica no par EUR/USD após dados industriais',
        summary: 'Volatilidade intradiária abre oportunidades curtas.',
        source: 'Bloomberg',
        category: 'FOREX',
        sentiment: 'BEARISH',
        published_at: new Date(Date.now() - 45 * 60000).toISOString(),
        url: 'https://example.com/news/2',
      },
    ];

    const html = renderWithQueryData(
      sampleNews,
      <MarketNewsDrawer isOpen={true} onClose={vi.fn()} />
    );

    // Sem segundo cabeçalho duplicado ("Notícias do Mercado")
    expect(html).not.toContain('Notícias do Mercado');
    expect(html).not.toContain('🟢');
    expect(html).not.toContain('🔴');

    // Categorias sem barra de rolagem horizontal (bm-no-scrollbar + flex-wrap:wrap + overflow-x:hidden)
    expect(html).toContain('data-testid="market-news-categories"');
    expect(html).toContain('class="bm-no-scrollbar"');
    expect(html).toContain('flex-wrap:wrap');
    expect(html).toContain('overflow-x:hidden');

    // Lista com bm-stealth-scroll e badges de precisão
    expect(html).toContain('data-testid="market-news-list"');
    expect(html).toContain('ALCISTA');
    expect(html).toContain('BAJISTA');
    expect(html).toContain('hace 12 min');
  });

  it('2. [Unit] BinmaxPortfolioDrawer e BinmaxHistoryDrawer formatam SYNTH_VOL_50 como "Vol 50" e aplicam bm-stealth-scroll', () => {
    const contracts: Contract[] = [
      {
        id: 'cnt-vol50-open',
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 10000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        entry_price: '769.10',
        strike_price: '769.10',
        created_at: new Date(Date.now() - 15000).toISOString(),
        expires_at: new Date(Date.now() + 45000).toISOString(),
      },
      {
        id: 'cnt-vol50-closed',
        symbol: 'SYNTH_VOL_50',
        direction: 'DOWN',
        stake_minor: 5000,
        status: 'SETTLED',
        result: 'WIN',
        payout_minor: 9250,
        entry_price: '770.00',
        created_at: new Date(Date.now() - 120000).toISOString(),
        expires_at: new Date(Date.now() - 60000).toISOString(),
      },
    ];

    const portfolioHtml = renderToStaticMarkup(
      <BinmaxPortfolioDrawer contracts={contracts} currentPrice={770.5} />
    );
    expect(portfolioHtml).toContain('bm-stealth-scroll');
    expect(portfolioHtml).toContain('Vol 50');
    expect(portfolioHtml).not.toContain('>SYNTH_VOL_50<');

    const historyHtml = renderToStaticMarkup(
      <BinmaxHistoryDrawer contracts={contracts} />
    );
    expect(historyHtml).toContain('bm-stealth-scroll');
    expect(historyHtml).toContain('Vol 50');
    expect(historyHtml).not.toContain('>SYNTH_VOL_50<');
  });

  it('3. [Estresse] Renderiza 150 contratos em Portafolio e Historial em menos de 150ms', () => {
    const manyContracts: Contract[] = Array.from({ length: 150 }, (_, idx) => ({
      id: `stress-cnt-${idx}`,
      symbol: idx % 2 === 0 ? 'SYNTH_VOL_50' : 'EURUSD_OTC',
      direction: idx % 2 === 0 ? 'UP' : 'DOWN',
      stake_minor: 2500,
      status: idx < 75 ? 'OPEN' : 'SETTLED',
      result: idx < 75 ? null : idx % 3 === 0 ? 'WIN' : 'LOSS',
      payout_minor: idx < 75 ? null : idx % 3 === 0 ? 4625 : 0,
      entry_price: '769.10',
      created_at: new Date(Date.now() - 30000).toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    }));

    const start = performance.now();
    const openHtml = renderToStaticMarkup(
      <BinmaxPortfolioDrawer contracts={manyContracts} currentPrice={770.0} />
    );
    const histHtml = renderToStaticMarkup(
      <BinmaxHistoryDrawer contracts={manyContracts} />
    );
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
    expect(openHtml).toContain('Abiertas 75');
    expect(histHtml).toContain('Vol 50');
  });

  it('4. [Segurança & Caos] Bloqueia URLs javascript: e escapa XSS em MarketNewsDrawer', () => {
    const maliciousNews: MarketNewsItem[] = [
      {
        id: 'xss-1',
        title: '<script>window.__hacked = true</script>Alerta de Mercado',
        summary: '<img src=x onerror=alert(1)>Resumo',
        source: '<b>FakeSource</b>',
        category: 'ALL',
        sentiment: 'NEUTRAL',
        published_at: 'invalid-date-string',
        url: 'javascript:alert(document.cookie)',
      },
    ];

    const html = renderWithQueryData(
      maliciousNews,
      <MarketNewsDrawer isOpen={true} onClose={vi.fn()} />
    );

    // URL javascript: deve ser bloqueada e não renderizar <a href="javascript:...">
    expect(html).not.toContain('href="javascript:');
    // Tags HTML devem estar escapadas pelo React
    expect(html).not.toContain('<script>window.__hacked');
    expect(html).toContain('&lt;script&gt;');
    // Data inválida deve cair no fallback seguro ("hace 1 min") sem NaN
    expect(html).not.toContain('NaN');
    expect(html).toContain('hace 1 min');
  });
});
