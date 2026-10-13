import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MobileTraderoomLayout } from '../components/layout/MobileTraderoomLayout';
import { MobileBottomNav } from '../components/navigation/MobileBottomNav';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('SUBETAPA 09: Responsividade Mobile & Tablet (Sessão 11)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('9.1 MobileTraderoomLayout: Fidelidade Visual à Sessão 11', () => {
    it('Renderiza o shell mobile completo com cabeçalho, abas, gráfico, boleta e bottom nav', () => {
      const html = renderToString(
        <MobileTraderoomLayout
          activeSymbol="NZDJPY_OTC"
          openTabs={['NZDJPY_OTC', 'EURUSD_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={960375} // $9,603.75
          onResetDemo={vi.fn()}
          activeContractsCount={2}
          chartNode={<div data-testid="test-chart-mobile">Canvas Gráfico Mobile</div>}
          orderTicketNode={<div data-testid="test-ticket-mobile">Boleta Inferior</div>}
        />
      );

      // Root
      expect(html).toContain('data-testid="mobile-traderoom-root"');

      // 1. Header Mobile
      expect(html).toContain('data-testid="mobile-header"');
      expect(html).toContain('data-testid="mobile-hamburger-btn"');
      expect(html).toContain('data-testid="mobile-account-display"');
      expect(html).toContain('Cuenta real ▾');
      expect(html).toContain('$9,603.75');
      expect(html).toContain('data-testid="mobile-deposit-btn"');
      expect(html).toContain('Depositar');

      // 2. Abas de Ativos Touch
      expect(html).toContain('data-testid="mobile-asset-tabs"');
      expect(html).toContain('data-testid="mobile-tab-NZDJPY_OTC"');
      expect(html).toContain('NZD/JPY');
      expect(html).toContain('Turbo');

      // 3. Gráfico Central
      expect(html).toContain('data-testid="mobile-chart-area"');
      expect(html).toContain('data-testid="test-chart-mobile"');

      // 4. Ticket Inferior
      expect(html).toContain('data-testid="mobile-order-ticket-container"');
      expect(html).toContain('data-testid="test-ticket-mobile"');

      // 5. Barra Inferior de Navegação
      expect(html).toContain('data-testid="mobile-bottom-nav"');
      expect(html).toContain('Operar');
      expect(html).toContain('Portafolio');
      expect(html).toContain('Historial');
      expect(html).toContain('Torneos');
      expect(html).toContain('Más');
    });
  });

  describe('9.2 Ergonomia e Acessibilidade Touch (WCAG)', () => {
    it('Botões da navegação inferior possuem touch target mínimo de 44px de altura', () => {
      const html = renderToString(
        <MobileBottomNav activeTab="operar" onSelectTab={vi.fn()} />
      );

      expect(html).toContain('data-testid="mobile-bottom-nav"');
      expect(html).toContain('height:60px');
    });
  });

  describe('9.3 Teste de Estresse e Desempenho (Sessão 11)', () => {
    it('Executa 100 renderizações completas do layout mobile em menos de 800ms', () => {
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        renderToString(
          <MobileTraderoomLayout
            activeSymbol={i % 2 === 0 ? 'NZDJPY_OTC' : 'EURUSD_OTC'}
            openTabs={['NZDJPY_OTC', 'EURUSD_OTC']}
            onSelectTab={vi.fn()}
            balanceMinor={960375}
            onResetDemo={vi.fn()}
            chartNode={<div>Chart</div>}
            orderTicketNode={<div>Ticket</div>}
          />
        );
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(800);
    });
  });
});
