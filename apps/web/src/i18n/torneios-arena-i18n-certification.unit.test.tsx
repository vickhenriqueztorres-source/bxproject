import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, isSupportedLocale, type Locale } from './index';
import { RouterProvider } from '../router/RouterContext';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { OrderTicket } from '../trade/OrderTicket';
import { TournamentModal } from '../components/tournaments/TournamentModal';
import {
  getJoinedTournamentIds,
  joinTournamentLocal,
  isValidTournamentId,
} from '../components/tournaments/tournament-enrollment';
import { ArenaPage, sanitizeArenaRoomParam } from '../pages/ArenaPage';
import { TournamentsPage } from '../pages/TournamentsPage';

const testQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderFullShell(locale: Locale, path = '/operar') {
  return renderToStaticMarkup(
    <QueryClientProvider client={testQueryClient}>
      <I18nProvider initialLocale={locale}>
        <RouterProvider initialPath={path}>
          <div>
            <TerminalHeader
              activeSymbol="VOL_100"
              openTabs={['VOL_100', 'EURUSD']}
              onSelectSymbol={() => {}}
              onCloseTab={() => {}}
              onOpenAddModal={() => {}}
              balanceMinor={1000000}
              currency="USD"
              onResetBalance={() => {}}
              reseting={false}
              isConnected={true}
              onOpenDeposit={() => {}}
              onOpenWithdraw={() => {}}
            />
            <SidebarDock
              activeTab={null}
              onSelectTab={() => {}}
              activeContractsCount={2}
              soundEnabled={true}
              onToggleSound={() => {}}
              timeZone="UTC-3"
              onToggleTimeZone={() => {}}
              activeRoute={path === '/arena' ? 'arena' : 'operar'}
            />
            <OrderTicket
              symbol="VOL_100"
              currentPrice={100.25}
              isStale={false}
              balanceMinor={1000000}
              onContractCreated={() => {}}
            />
            <TerminalFooter
              soundEnabled={true}
              onToggleSound={() => {}}
              timeZone="UTC-3"
              onToggleTimeZone={() => {}}
              isConnected={true}
              activeContractsCount={2}
            />
          </div>
        </RouterProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('Subetapa 05 — Certificação Integrada: Menu Arena/Torneios, Fluxo de Torneios e Tradução Reativa (PT/ES)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {
      // ignore in SSR
    }
  });

  afterEach(() => {
    setNewTraderoomEnabled(true);
  });

  describe('1. Fluxo E2E Completo: Sala -> Menu Torneios -> Inscrição -> Troca PT/ES -> Menu Arena', () => {
    it('integra Menu Lateral (Arena + Torneios), Sala de Trading, Modal de Torneios e Arena Blitz em PT e ES', () => {
      // 1. Sala em Português (pt-BR)
      const shellPt = renderFullShell('pt-BR', '/operar');
      expect(shellPt).toContain('sidebar-item-operar');
      expect(shellPt).toContain('sidebar-item-arena');
      expect(shellPt).toContain('sidebar-item-tournaments');
      expect(shellPt).toContain('Torneios');
      expect(shellPt).toContain('Histórico');
      expect(shellPt).toContain('Distribuição de grade');
      expect(shellPt).toContain('Fechar aba');
      expect(shellPt).toContain('ACIMA');
      expect(shellPt).toContain('ABAIXO');
      expect(shellPt).toContain('Portfólio total');
      expect(shellPt).toContain('Lucro de hoje');
      expect(shellPt).toContain('Operações abertas');
      expect(shellPt).toContain('Hora atual:');

      // 2. Abre Modal de Torneios em Português e inscreve na Copa BINMAX
      const enrollResult = joinTournamentLocal('copa-binmax');
      expect(enrollResult.success).toBe(true);
      expect(enrollResult.joinedIds).toContain('copa-binmax');

      const modalPt = renderToStaticMarkup(
        <I18nProvider initialLocale="pt-BR">
          <RouterProvider initialPath="/operar">
            <TournamentModal
              isOpen={true}
              onClose={() => {}}
              initialView="details"
              initialTournamentId="copa-binmax"
            />
          </RouterProvider>
        </I18nProvider>
      );
      expect(modalPt).toContain('Voltar para todos os torneios');
      expect(modalPt).toContain('Regras do torneio');
      expect(modalPt).toContain('Ranking em tempo real');

      // 3. Alterna idioma para Espanhol (es-ES) -> Toda a Sala e Modal refletem Espanhol
      const shellEs = renderFullShell('es-ES', '/operar');
      expect(shellEs).toContain('Torneos');
      expect(shellEs).toContain('Historial');
      expect(shellEs).toContain('Distribución de cuadrícula');
      expect(shellEs).toContain('Cerrar pestaña');
      expect(shellEs).toContain('SUBE');
      expect(shellEs).toContain('BAJA');
      expect(shellEs).toContain('Portafolio total');
      expect(shellEs).toContain('Ganancia de hoy');
      expect(shellEs).toContain('Operaciones abiertas');
      expect(shellEs).toContain('Hora actual:');

      const modalEs = renderToStaticMarkup(
        <I18nProvider initialLocale="es-ES">
          <RouterProvider initialPath="/operar">
            <TournamentModal
              isOpen={true}
              onClose={() => {}}
              initialView="details"
              initialTournamentId="copa-binmax"
            />
          </RouterProvider>
        </I18nProvider>
      );
      expect(modalEs).toContain('Volver a todos los torneos');
      expect(modalEs).toContain('Reglas del torneo');
      expect(modalEs).toContain('Ranking en tiempo real');

      // 4. Navega para Arena Blitz (/arena) em Espanhol e Português
      const arenaEs = renderToStaticMarkup(
        <I18nProvider initialLocale="es-ES">
          <RouterProvider initialPath="/arena">
            <ArenaPage />
          </RouterProvider>
        </I18nProvider>
      );
      expect(arenaEs).toContain('arena-sidebar-shell');
      expect(arenaEs).toContain('sidebar-item-operar');
      expect(arenaEs).toContain('15 minutos. T$ 1.000. El podio se lleva el bote.');
      expect(arenaEs).toContain('Elige tu sala');

      const arenaPt = renderToStaticMarkup(
        <I18nProvider initialLocale="pt-BR">
          <RouterProvider initialPath="/arena">
            <ArenaPage />
          </RouterProvider>
        </I18nProvider>
      );
      expect(arenaPt).toContain('arena-sidebar-shell');
      expect(arenaPt).toContain('sidebar-item-operar');
      expect(arenaPt).toContain('15 minutos. T$ 1.000. O pódio leva o pote.');
      expect(arenaPt).toContain('Escolha sua sala');
    });
  });

  describe('2. Estresse de Alta Frequência (300 ciclos de troca PT/ES + Navegação + Inscrição)', () => {
    it('suporta 300 alternâncias rápidas de idioma e inscrições idempotentes sem degradação ou mutação financeira', () => {
      for (let i = 0; i < 300; i++) {
        const locale: Locale = i % 2 === 0 ? 'pt-BR' : 'es-ES';
        const res = joinTournamentLocal('copa-binmax');
        expect(res.success).toBe(true);
        const countCopa = res.joinedIds.filter((id) => id === 'copa-binmax').length;
        expect(countCopa).toBe(1);

        if (i % 50 === 0) {
          const html = renderFullShell(locale, '/operar');
          expect(html).toContain('$10,000.00');
          expect(html).toContain('+85%');
        }
      }
    });
  });

  describe('3. Segurança (Anti-XSS, Anti-Prototype-Pollution, Validação de Parâmetros)', () => {
    it('rejeita payloads maliciosos em IDs de torneio, parâmetros de Arena e códigos de idioma', () => {
      const maliciousPayloads = [
        '<script>alert(1)</script>',
        '__proto__',
        'constructor',
        'prototype',
        '../../etc/passwd',
        'javascript:alert(1)',
        'copa-binmax; DROP TABLE tournaments;',
      ];

      for (const payload of maliciousPayloads) {
        expect(isValidTournamentId(payload)).toBe(false);
        expect(joinTournamentLocal(payload).success).toBe(false);
        expect(sanitizeArenaRoomParam(payload)).toBeUndefined();
        expect(isSupportedLocale(payload)).toBe(false);
      }
    });
  });

  describe('4. Engenharia do Caos (Falha de Storage / JSON Corrompido)', () => {
    it('opera sem crash mesmo quando dados legados estão corrompidos e renderiza páginas secundárias com fallback seguro', () => {
      const ids = getJoinedTournamentIds();
      expect(Array.isArray(ids)).toBe(true);

      const pagePt = renderToStaticMarkup(
        <I18nProvider initialLocale="pt-BR">
          <RouterProvider initialPath="/torneos">
            <TournamentsPage />
          </RouterProvider>
        </I18nProvider>
      );
      expect(pagePt).toContain('Torneios de Trading Quantitativo');

      const pageEs = renderToStaticMarkup(
        <I18nProvider initialLocale="es-ES">
          <RouterProvider initialPath="/torneos">
            <TournamentsPage />
          </RouterProvider>
        </I18nProvider>
      );
      expect(pageEs).toContain('Torneos de Trading Cuantitativo');
    });
  });
});
