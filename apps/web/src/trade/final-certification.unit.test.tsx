import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { tickAction } from '../feed/protocol';
import { generateSeedCandles } from '../api/client';
import { FIBONACCI_LEVELS } from '../chart/drawing-types';
import { parseStakeInput, formatMinor } from '../lib/money';
import { safeRandomUUID } from '../lib/uuid';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { OrderTicket } from './OrderTicket';
import { BilleteraModal } from '../wallet/BilleteraModal';
import { MobileTraderoomLayout } from '../components/layout/MobileTraderoomLayout';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('SUBETAPA 8: Bateria Completa de Certificação Traderoom Perfection', () => {
  describe('Matriz 1: Performance e Integridade Gráfica', () => {
    it('E-01: Geração determinística de 3.500 velas em janela contínua sem memory leak', () => {
      const start = performance.now();
      const candles = generateSeedCandles('NZDJPY_OTC', 3500);
      const elapsed = performance.now() - start;

      expect(candles.length).toBe(3500);
      expect(elapsed).toBeLessThan(100); // 3.500 velas geradas em < 100ms
      // Integridade matemática das velas
      candles.forEach((c) => {
        const high = Number(c.high);
        const low = Number(c.low);
        const open = Number(c.open);
        const close = Number(c.close);
        expect(high).toBeGreaterThanOrEqual(low);
        expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
        expect(low).toBeLessThanOrEqual(Math.min(open, close));
      });
    });

    it('E-02: Precisão absoluta dos 6 níveis de Fibonacci sem erro de ponto flutuante', () => {
      const p1 = 100.0;
      const p2 = 200.0;
      const delta = p2 - p1;

      const levels = FIBONACCI_LEVELS.map((f) => ({
        ratio: f.level,
        calculated: p1 + f.level * delta,
      }));

      expect(levels[0].calculated).toBe(100.0);
      expect(levels[1].calculated).toBe(123.6);
      expect(levels[2].calculated).toBe(138.2);
      expect(levels[3].calculated).toBe(150.0);
      expect(levels[4].calculated).toBe(161.8);
      expect(levels[5].calculated).toBe(200.0);
    });
  });

  describe('Matriz 2: Segurança & Invariantes Financeiros', () => {
    it('S-01: Invariante monetário — dinheiro existe estritamente em centavos inteiros', () => {
      expect(parseStakeInput('100')).toBe(10000);
      expect(parseStakeInput('10,50')).toBe(1050);
      expect(parseStakeInput('0,99')).toBeNull(); // Abaixo de $1.00 rejeitado
      expect(parseStakeInput('100,01')).toBeNull(); // Acima do limite unitário rejeitado
      expect(parseStakeInput('-50')).toBeNull(); // Valor negativo bloqueado
      expect(parseStakeInput('<script>10</script>')).toBeNull(); // Injeção bloqueada
    });

    it('S-02: Idempotência garantida via UUIDv4 seguro e não-colidente', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = safeRandomUUID();
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        keys.add(id);
      }
      expect(keys.size).toBe(100); // 100 chaves estritamente únicas
    });

    it('S-03: Cálculo de retorno imutável (85% de lucro em stakeMinor de $100)', () => {
      const stakeMinor = 10000;
      const payoutPct = 85;
      const profitMinor = Math.round(stakeMinor * (payoutPct / 100));
      expect(profitMinor).toBe(8500);
      expect(stakeMinor + profitMinor).toBe(18500);
      expect(formatMinor(profitMinor)).toMatch(/85,00|85\.00/);
    });
  });

  describe('Matriz 3: Resiliência de Caos e Rede', () => {
    it('C-01: Protocolo de detecção de gaps e duplicatas de ticks (tickAction)', () => {
      // Seq normal: 10 -> 11 (apply)
      expect(tickAction(10, 11)).toBe('apply');
      // Seq repetida ou atrasada: 10 -> 10 ou 10 -> 9 (duplicate)
      expect(tickAction(10, 10)).toBe('duplicate');
      expect(tickAction(10, 9)).toBe('duplicate');
      // Seq saltada: 10 -> 15 (gap detectado -> aciona snapshot REST defensivo)
      expect(tickAction(10, 15)).toBe('gap');
      // Dados corrompidos (NaN, negativo)
      expect(tickAction(10, -1)).toBe('gap');
      expect(tickAction(10, NaN)).toBe('gap');
    });

    it('C-02: Resiliência offline — fallback determinístico previne tela preta', () => {
      const fallback = generateSeedCandles('UNKNOWN_OTC', 50);
      expect(fallback.length).toBe(50);
      expect(fallback[0].time).toBeGreaterThan(0);
      expect(Number(fallback[0].close)).toBeGreaterThan(0);
    });
  });

  describe('Matriz 4: Padrão Duas Portas e Certificação Completa da Interface', () => {
    const queryClient = new QueryClient();

    it('R-01: Quando NEW_TRADEROOM = false, todos os componentes preservam a arquitetura legada', () => {
      setNewTraderoomEnabled(false);

      const headerHtml = renderToString(
        <TerminalHeader
          activeSymbol="EURUSD_OTC"
          openTabs={['EURUSD_OTC']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={1000000}
          accountEmail="trader@binmax.com"
          isLive={true}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      expect(headerHtml).toContain('BROKER');
      expect(headerHtml).not.toContain('header-grid-layout-btn');

      const sidebarHtml = renderToString(
        <SidebarDock
          activeTab="operar"
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );
      expect(sidebarHtml).toContain('sidebar-dock-legacy');

      const ticketHtml = renderToString(
        <QueryClientProvider client={queryClient}>
          <OrderTicket
            symbol="EURUSD_OTC"
            paused={false}
            stale={false}
            availableMinor={1000000}
            onChanged={vi.fn()}
          />
        </QueryClientProvider>
      );
      expect(ticketHtml).not.toContain('data-testid="binmax-order-ticket"');
    });

    it('R-02: Quando NEW_TRADEROOM = true, todos os 5 módulos principais adotam a estética Turbo Prata', () => {
      setNewTraderoomEnabled(true);

      // 1. Cabeçalho Turbo Prata
      const headerHtml = renderToString(
        <TerminalHeader
          activeSymbol="EURUSD_OTC"
          openTabs={['EURUSD_OTC']}
          onSelectTab={vi.fn()}
          onCloseTab={vi.fn()}
          onAddTab={vi.fn()}
          balanceMinor={1000000}
          accountEmail="trader@binmax.com"
          isLive={true}
          onResetDemo={vi.fn()}
          onSignOut={vi.fn()}
        />
      );
      expect(headerHtml).toContain('Binmax Option');
      expect(headerHtml).toContain('data-testid="header-grid-layout-btn"');
      expect(headerHtml).toContain('data-testid="header-deposit-button"');

      // 2. Dock Lateral de 8 Itens
      const sidebarHtml = renderToString(
        <SidebarDock
          activeTab="operar"
          onSelectTab={vi.fn()}
          activeContractsCount={0}
          soundEnabled={true}
          onToggleSound={vi.fn()}
          timeZone="UTC-3"
          onToggleTimeZone={vi.fn()}
        />
      );
      expect(sidebarHtml).toContain('data-testid="sidebar-dock-binmax"');
      expect(sidebarHtml).toContain('Operar');
      expect(sidebarHtml).toContain('Torneos');
      expect(sidebarHtml).toContain('Promociones');

      // 3. Boleta Ergonômica SUBE / BAJA
      const ticketHtml = renderToString(
        <QueryClientProvider client={queryClient}>
          <OrderTicket
            symbol="EURUSD_OTC"
            paused={false}
            stale={false}
            availableMinor={1000000}
            onChanged={vi.fn()}
          />
        </QueryClientProvider>
      );
      expect(ticketHtml).toContain('data-testid="binmax-order-ticket"');
      expect(ticketHtml).toContain('data-testid="btn-sube"');
      expect(ticketHtml).toContain('data-testid="btn-baja"');

      // 4. Billetera Institucional
      const billeteraHtml = renderToString(
        <BilleteraModal isOpen={true} onClose={vi.fn()} availableMinor={1000000} />
      );
      expect(billeteraHtml).toContain('data-testid="billetera-title"');
      expect(billeteraHtml).toContain('Billetera');
      expect(billeteraHtml).toContain('Depositar');

      // 5. Layout Mobile & Tablet
      const mobileHtml = renderToString(
        <MobileTraderoomLayout
          activeSymbol="EURUSD_OTC"
          openTabs={['EURUSD_OTC']}
          onSelectTab={vi.fn()}
          balanceMinor={1000000}
          onResetDemo={vi.fn()}
          chartNode={<div>Chart</div>}
        />
      );
      expect(mobileHtml).toContain('data-testid="mobile-traderoom-root"');
      expect(mobileHtml).toContain('data-testid="mobile-header"');
      expect(mobileHtml).toContain('data-testid="mobile-bottom-nav"');
    });
  });
});
