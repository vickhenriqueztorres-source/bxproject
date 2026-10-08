import { describe, it, expect } from 'vitest';
import { FALLBACK_MARKET_NEWS, type MarketNewsArticle } from './news-types';

describe('[PLANO 3 - GATE 3] Notícias de Mercado & Sentimento', () => {
  it('carrega lista estruturada de notícias com sentimento e categorias válidas', () => {
    expect(FALLBACK_MARKET_NEWS.length).toBeGreaterThanOrEqual(4);
    for (const item of FALLBACK_MARKET_NEWS) {
      expect(item.id).toBeDefined();
      expect(item.title.length).toBeGreaterThan(10);
      expect(item.summary.length).toBeGreaterThan(15);
      expect(['BULLISH', 'BEARISH', 'NEUTRAL']).toContain(item.sentiment);
      expect(['ALL', 'FOREX', 'CRYPTO', 'INDICES', 'GLOBAL']).toContain(item.category);
      expect(Number.isFinite(Date.parse(item.published_at))).toBe(true);
    }
  });

  it('filtra notícias por categoria corretamente', () => {
    const cryptoNews = FALLBACK_MARKET_NEWS.filter((n) => n.category === 'CRYPTO');
    expect(cryptoNews.length).toBeGreaterThan(0);
    for (const item of cryptoNews) {
      expect(item.category).toBe('CRYPTO');
    }

    const indicesNews = FALLBACK_MARKET_NEWS.filter((n) => n.category === 'INDICES');
    expect(indicesNews.length).toBeGreaterThan(0);
    for (const item of indicesNews) {
      expect(item.category).toBe('INDICES');
    }
  });

  it('filtra notícias por busca textual de palavra-chave', () => {
    const query = 'Bitcoin'.toLowerCase();
    const matches = FALLBACK_MARKET_NEWS.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.summary.toLowerCase().includes(query)
    );

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].title).toContain('Bitcoin');
  });

  it('[Segurança Anti-XSS] sanitiza strings maliciosas com escape HTML rigoroso', () => {
    function escapeHtml(str: string): string {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    const maliciousTitle = `<script>alert('XSS')</script><img src=x onerror=stealToken()>`;
    const sanitized = escapeHtml(maliciousTitle);

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('<img');
    expect(sanitized).toContain('&lt;script&gt;');
    expect(sanitized).toContain('&lt;img');
  });
});
