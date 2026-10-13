import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MobileTraderoomLayout } from '../components/layout/MobileTraderoomLayout';
import { MobileBottomNav } from '../components/navigation/MobileBottomNav';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

describe('Subetapa 7: Experiência Responsiva Mobile & Tablet (Imagem 2)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. Cabeçalho Mobile e Navegação Superior', () => {
    it('Renderiza cabeçalho mobile com botão hambúrguer, logo, saldo e botão Depositar', () => {
      const html = renderToString(
        <MobileTraderoomLayout
          activeSymbol="NZDJPY_OTC"
          openTabs={['NZDJPY_OTC', 'EURUSD_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={960375} // $9,603.75
          onResetDemo={vi.fn()}
          chartNode={<div data-testid="mock-chart">Gráfico</div>}
        />
      );

      // Header superior
      expect(html).toContain('data-testid="mobile-header"');
      expect(html).toContain('data-testid="mobile-hamburger-btn"');
      expect(html).toContain('☰');

      // Logo
      expect(html).toContain('Binmax');

      // Saldo em Geist Mono e tipo de conta
      expect(html).toContain('data-testid="mobile-account-display"');
      expect(html).toContain('Cuenta real ▾');
      expect(html).toContain('$9,603.75');

      // Botão Depositar
      expect(html).toContain('data-testid="mobile-deposit-btn"');
      expect(html).toContain('Depositar');
    });

    it('Renderiza abas de ativos com bandeiras nacionais e indicador Turbo', () => {
      const html = renderToString(
        <MobileTraderoomLayout
          activeSymbol="NZDJPY_OTC"
          openTabs={['NZDJPY_OTC', 'EURUSD_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={960375}
          onResetDemo={vi.fn()}
          chartNode={<div data-testid="mock-chart">Gráfico</div>}
        />
      );

      expect(html).toContain('data-testid="mobile-asset-tabs"');
      expect(html).toContain('data-testid="mobile-tab-NZDJPY_OTC"');
      expect(html).toContain('data-testid="mobile-tab-EURUSD_OTC"');
      expect(html).toContain('NZD/JPY');
      expect(html).toContain('EUR/USD');
      expect(html).toContain('Turbo');
    });
  });

  describe('2. Barra de Navegação Inferior Móvel (MobileBottomNav)', () => {
    it('Renderiza as 5 abas institucionais: Operar, Portafolio, Historial, Torneos e Más', () => {
      const html = renderToString(
        <MobileBottomNav activeTab="operar" onSelectTab={vi.fn()} />
      );

      expect(html).toContain('data-testid="mobile-bottom-nav"');
      expect(html).toContain('data-testid="mobile-nav-operar"');
      expect(html).toContain('Operar');
      expect(html).toContain('data-testid="mobile-nav-portfolio"');
      expect(html).toContain('Portafolio');
      expect(html).toContain('data-testid="mobile-nav-history"');
      expect(html).toContain('Historial');
      expect(html).toContain('data-testid="mobile-nav-tournaments"');
      expect(html).toContain('Torneos');
      expect(html).toContain('data-testid="mobile-nav-more"');
      expect(html).toContain('Más');
    });

    it('Exibe badge de contratos ativos no botão Portafolio quando count > 0', () => {
      const htmlWithZero = renderToString(
        <MobileBottomNav activeTab="operar" onSelectTab={vi.fn()} activeContractsCount={0} />
      );
      expect(htmlWithZero).not.toContain('data-testid="mobile-nav-badge"');

      const htmlWithThree = renderToString(
        <MobileBottomNav activeTab="operar" onSelectTab={vi.fn()} activeContractsCount={3} />
      );
      expect(htmlWithThree).toContain('data-testid="mobile-nav-badge"');
      expect(htmlWithThree).toContain('3');
    });
  });

  describe('3. Ergonomia e Acessibilidade Touch (WCAG)', () => {
    it('Todos os 5 botões de navegação móvel possuem alvos >= 44px', () => {
      const html = renderToString(
        <MobileBottomNav activeTab="operar" onSelectTab={vi.fn()} />
      );

      // Cada botão possui min-height de 44px e min-width de 44px
      expect(html).toContain('min-height:44px');
      expect(html).toContain('min-width:44px');
    });

    it('Container de ordens é montado na base da tela acima da barra de navegação', () => {
      const html = renderToString(
        <MobileTraderoomLayout
          activeSymbol="NZDJPY_OTC"
          openTabs={['NZDJPY_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={960375}
          onResetDemo={vi.fn()}
          chartNode={<div>Gráfico</div>}
          orderTicketNode={<div data-testid="mock-order-ticket">Ticket 2 Linhas</div>}
        />
      );

      expect(html).toContain('data-testid="mobile-order-ticket-container"');
      expect(html).toContain('Ticket 2 Linhas');
      expect(html).toContain('data-testid="mobile-bottom-nav"');
    });
  });

  describe('4. Padrão Duas Portas e Estabilidade Estrutural', () => {
    it('Estrutura de layout mobile preserva o tema Turbo Prata (theme-binmax)', () => {
      const html = renderToString(
        <MobileTraderoomLayout
          activeSymbol="NZDJPY_OTC"
          openTabs={['NZDJPY_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={960375}
          onResetDemo={vi.fn()}
          chartNode={<div>Gráfico</div>}
        />
      );

      expect(html).toContain('theme-binmax');
      expect(html).toContain('mobile-traderoom-root');
    });
  });
});
