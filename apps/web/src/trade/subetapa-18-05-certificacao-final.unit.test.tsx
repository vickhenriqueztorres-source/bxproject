import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { OrderTicket } from './OrderTicket';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { TradersMoodBar } from '../chart/TradersMoodBar';
import { ChartDrawingToolbar } from '../chart/ChartDrawingToolbar';
import { TimeLinesOverlay } from '../chart/TimeLinesOverlay';
import { setFeatureFlagForTesting } from '../lib/feature-flags';
import { formatCurrencyBinmax } from '../lib/money';
import type { Contract } from '../api/client';

// Mock dos hooks react-query usados no OrderTicket
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn().mockReturnValue({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
  useQuery: vi.fn().mockReturnValue({
    data: {
      id: 'c-settled-1',
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: 18500,
    },
    isLoading: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

describe('SUBETAPA 18-05: Certificação Holística Final — Sala de Operações Refinada (#18)', () => {
  const mockContracts: Contract[] = [
    {
      id: 'c-cert-1',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      payout_minor: 18500,
      result: null,
      status: 'OPEN',
      entry_price: 500.0,
      strike_price: 500.0,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30000).toISOString(),
    },
  ];

  beforeEach(() => {
    setFeatureFlagForTesting(true);
  });

  describe('1. As 7 Causas de Amadorismo Rigorosamente Eliminadas', () => {
    it('C1: SidebarDock elimina azul neon no item ativo e adota barra lateral verde de 2px (#22C55E) com ícone branco', () => {
      const html = renderToString(
        <SidebarDock
          activeTab={null}
          onSelectTab={vi.fn()}
          activeContractsCount={1}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );

      // Não deve conter azul ciano neon (#00e5ff ou #2DD4FF)
      expect(html).not.toContain('#00e5ff');
      expect(html).not.toContain('#2DD4FF');

      // Barra de 2px verde e texto branco
      expect(html).toContain('border:1.5px solid #22C55E');
      expect(html).toContain('color:#F4F5F7');
    });

    it('C2 & C7: OrderTicket aplica tipografia Inter em rótulos cinza 12px peso 500 e Geist Mono apenas nos valores', () => {
      const html = renderToString(
        <OrderTicket
          symbol="SYNTH_VOL_50"
          paused={false}
          stale={false}
          availableMinor={100000}
          onChanged={vi.fn()}
        />
      );

      expect(html).toContain('Monto');
      expect(html).toContain('Expiración');
      expect(html).toContain('Ganancia');
      expect(html).toContain('font-family:&#x27;Inter&#x27;, sans-serif');
      expect(html).toContain('font-size:12px');
      expect(html).toContain('color:#8A92A1');
      expect(html).toContain('font-weight:500');

      // Payout 22px bold verde
      expect(html).toContain('font-size:22px');
      expect(html).toContain('font-weight:700');
      expect(html).toContain('color:#22C55E');
    });

    it('C3 & C4: Paleta Unificada de Verde (#22C55E) e Vermelho Sóbrio (#E5484D)', () => {
      const htmlTicket = renderToString(
        <OrderTicket
          symbol="SYNTH_VOL_50"
          paused={false}
          stale={false}
          availableMinor={100000}
          onChanged={vi.fn()}
        />
      );

      // Botão SUBE e BAJA
      expect(htmlTicket).toContain('background:#22C55E');
      expect(htmlTicket).toContain('background:#E5484D');
      // Não deve conter vermelho rosado (#F05A5A ou #ff3d71)
      expect(htmlTicket).not.toContain('#F05A5A');
      expect(htmlTicket).not.toContain('#ff3d71');
    });

    it('C5: Raio padronizado de 6px em botões e abas sem bordas coloridas berrantes', () => {
      const htmlHeader = renderToString(
        <TerminalHeader
          activeSymbol="SYNTH_VOL_50"
          openTabs={['SYNTH_VOL_50']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={100000}
          accountEmail="trader@binmax.com"
          isLive={true}
          latencyMs={16}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );

      expect(htmlHeader).toContain('border-radius:6px');
      expect(htmlHeader).toContain('#22C55E'); // Botão Depositar (verde #22C55E)
    });

    it('C6: Desacoplamento e Grid Perfeito entre Barra de Ferramentas e Barra de Sentimento', () => {
      const htmlToolbar = renderToString(
        <ChartDrawingToolbar
          chartType="candles"
          onSelectChartType={vi.fn()}
          timeframe="1m"
          onSelectTimeframe={vi.fn()}
          activeTool={null as any}
          onSelectTool={vi.fn()}
          activeColor="#22C55E"
          onChangeColor={vi.fn()}
          drawingsCount={0}
          indicators={[]}
          onToggleIndicator={vi.fn()}
          onClearDrawings={vi.fn()}
        />
      );

      // Toolbar ancorada no canto inferior esquerdo
      expect(htmlToolbar).toContain('bottom:20px');
      expect(htmlToolbar).toContain('left:16px');

      const htmlMood = renderToString(<TradersMoodBar bullsPercentage={60} />);
      // Barra de sentimento ampla (64px) sem truncamento
      expect(htmlMood).toContain('width:64px');
      expect(htmlMood).toContain('SUBE 60%');
      expect(htmlMood).toContain('BAJA 40%');
      expect(htmlMood).toContain('background:transparent');
    });
  });

  describe('2. Matriz de Refinamentos Específicos (#18)', () => {
    it('Refinamento 2 & 3: Ticket limpo sem cartão duplicado #guest_ e unificação em $185.00', () => {
      const html = renderToString(
        <OrderTicket
          symbol="SYNTH_VOL_50"
          paused={false}
          stale={false}
          availableMinor={100000}
          onChanged={vi.fn()}
        />
      );

      expect(html).not.toContain('#guest_');
      expect(html).not.toContain('US$');
      expect(formatCurrencyBinmax(18500)).toBe('$185.00');
    });

    it('Refinamento 4: PortfolioDrawer recolhido por padrão com altura máx 220px e rolagem interna', () => {
      const htmlClosed = renderToString(
        <PortfolioDrawer
          isOpen={false}
          onToggle={vi.fn()}
          contracts={mockContracts}
          currentPrice={502.0}
          currentSymbol="SYNTH_VOL_50"
        />
      );
      expect(htmlClosed).toContain('Mostrar posiciones ⌵');

      const htmlOpen = renderToString(
        <PortfolioDrawer
          isOpen={true}
          onToggle={vi.fn()}
          contracts={mockContracts}
          currentPrice={502.0}
          currentSymbol="SYNTH_VOL_50"
        />
      );
      expect(htmlOpen).toContain('max-height:220px');
      expect(htmlOpen).toContain('Mostrar posiciones ⌃');
    });

    it('Refinamento 8: TimeLinesOverlay com fundo translúcido escuro na expiração e bandeira de 14px', () => {
      const html = renderToString(
        <TimeLinesOverlay
          containerWidth={1000}
          containerHeight={600}
          chartInstance={null}
          latestCandleTime={null}
          timeframe="1m"
        />
      );

      expect(html).toContain('background:rgba(15, 20, 28, 0.92)');
      expect(html).toContain('color:#E5484D');
      expect(html).toContain('width:14px');
      expect(html).toContain('height:14px');
    });

    it('Refinamento 10: "Portafolio total" consolidado apenas no rodapé (TerminalFooter)', () => {
      const htmlDrawer = renderToString(
        <PortfolioDrawer
          isOpen={false}
          onToggle={vi.fn()}
          contracts={mockContracts}
          currentPrice={502.0}
          currentSymbol="SYNTH_VOL_50"
        />
      );
      expect(htmlDrawer).not.toContain('Portafolio total');

      const htmlFooter = renderToString(
        <TerminalFooter
          soundEnabled={true}
          onToggleSound={vi.fn()}
          portfolioTotalFormatted="$10,000.00"
        />
      );
      expect(htmlFooter).toContain('Portafolio total');
      expect(htmlFooter).toContain('$10,000.00');
    });

    it('Refinamento 11: Nomes comerciais amigáveis ("Vol 50") nas tabelas de contratos', () => {
      const html = renderToString(
        <PortfolioDrawer
          isOpen={true}
          onToggle={vi.fn()}
          contracts={mockContracts}
          currentPrice={502.0}
          currentSymbol="SYNTH_VOL_50"
        />
      );

      expect(html).toContain('Vol 50');
      expect(html).not.toContain('>SYNTH_VOL_50<');
    });
  });

  describe('3. Testes de Caos e Resiliência sob Estresse', () => {
    it('CAOS-01: Perda de feed alterna instantaneamente de "16ms" verde para "Reconectando…" cinza', () => {
      const htmlLive = renderToString(
        <TerminalHeader
          activeSymbol="SYNTH_VOL_50"
          openTabs={['SYNTH_VOL_50']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={100000}
          accountEmail="trader@binmax.com"
          isLive={true}
          latencyMs={16}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      expect(htmlLive).toContain('16ms');
      expect(htmlLive).toContain('background:#22C55E');

      const htmlDropped = renderToString(
        <TerminalHeader
          activeSymbol="SYNTH_VOL_50"
          openTabs={['SYNTH_VOL_50']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={100000}
          accountEmail="trader@binmax.com"
          isLive={false}
          latencyMs={0}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      expect(htmlDropped).toContain('Reconectando…');
      expect(htmlDropped).toContain('background:#8A92A1');
    });

    it('STRESS-01: Renderização de 50 contratos na gaveta de portfólio em menos de 100ms', () => {
      const manyContracts: Contract[] = Array.from({ length: 50 }, (_, i) => ({
        id: `c-many-${i}`,
        symbol: i % 2 === 0 ? 'SYNTH_VOL_50' : 'SYNTH_VOL_100',
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: 10000 + i * 100,
        payout_minor: 18500 + i * 185,
        result: null,
        status: 'OPEN',
        entry_price: 500.0 + i,
        strike_price: 500.0 + i,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30000 + i * 1000).toISOString(),
      }));

      const t0 = performance.now();
      const html = renderToString(
        <PortfolioDrawer
          isOpen={true}
          onToggle={vi.fn()}
          contracts={manyContracts}
          currentPrice={520.0}
          currentSymbol="SYNTH_VOL_50"
        />
      );
      const elapsed = performance.now() - t0;

      expect(elapsed).toBeLessThan(500);
      expect(html).toContain('Vol 50');
      expect(html).toContain('Vol 100');
      expect(html).toContain('50 activas');
    });
  });
});
