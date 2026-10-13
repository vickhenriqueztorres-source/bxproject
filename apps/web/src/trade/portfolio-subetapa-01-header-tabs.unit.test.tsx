import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { BinmaxPortfolioDrawer } from '../components/drawer/BinmaxPortfolioDrawer';
import { SidebarDock } from '../components/sidebar/SidebarDock';

describe('SUBETAPA 01: Header Institucional & Abas Underline do Portafolio', () => {
  it('1.1 SidebarDock no modo Binmax: Renderiza título "Portafolio total" sem emoji de maleta', () => {
    const html = renderToString(
      <SidebarDock
        activeTab="portfolio"
        onSelectTab={vi.fn()}
        activeContractsCount={2}
        soundEnabled={true}
        onToggleSound={vi.fn()}
        timeZone="UTC-3"
        onToggleTimeZone={vi.fn()}
        portfolioContent={<div data-testid="dummy-portfolio" />}
      />
    );

    expect(html).toContain('Portafolio total');
    // Não deve conter o emoji de maleta no header
    expect(html).not.toMatch(/<strong[^>]*>.*💼.*Portafolio total/);
    expect(html).toContain('data-testid="dummy-portfolio"');
  });

  it('1.2 BinmaxPortfolioDrawer: Renderiza Abas Underline com Abiertas N e Cerradas', () => {
    const html = renderToString(
      <BinmaxPortfolioDrawer
        contracts={[
          {
            id: 'c-1',
            symbol: 'EURUSD_OTC',
            direction: 'UP',
            stake_minor: 10000,
            status: 'OPEN',
            result: null,
            payout_minor: null,
            entry_price: '1.0850',
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30000).toISOString(),
          },
        ]}
        currentPrice={1.0855}
      />
    );

    expect(html).toContain('data-testid="tab-portfolio-abiertas"');
    expect(html).toContain('Abiertas 1');
    expect(html).toContain('data-testid="tab-portfolio-cerradas"');
    expect(html).toContain('Cerradas');
    // Indicador ativo com border-bottom sólido branco
    expect(html).toContain('border-bottom:2px solid #FFFFFF');
  });
});
