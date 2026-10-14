import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider, isSupportedLocale, useUiLanguage } from './index';
import { RouterProvider } from '../router/RouterContext';
import { SidebarDock } from '../components/sidebar/SidebarDock';
import { AccountSelectorDropdown } from '../components/header/AccountSelectorDropdown';
import { TerminalHeader } from '../components/header/TerminalHeader';
import { TerminalFooter } from '../components/footer/TerminalFooter';
import { PortfolioDrawer } from '../components/drawer/PortfolioDrawer';
import { OrderTicket } from '../trade/OrderTicket';
import { SecondaryLayout } from '../components/layout/SecondaryLayout';
import { setNewTraderoomEnabled } from '../lib/feature-flags';

const sharedQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderShellWithLocale(locale: 'pt-BR' | 'es-ES' | 'es-MX', ui: React.ReactElement) {
  return renderToStaticMarkup(
    <QueryClientProvider client={sharedQueryClient}>
      <I18nProvider initialLocale={locale}>
        <RouterProvider>
          {ui}
        </RouterProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe('Subetapa 03 — Tradução Reativa i18n da Sala (Sidebar, Header, AccountSelector, Footer, PortfolioDrawer, OrderTicket, SecondaryLayout)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('[Unit] SidebarDock alterna rótulos e cabeçalhos de gaveta entre Português (pt-BR) e Espanhol (es-ES)', () => {
    const ptHtml = renderShellWithLocale(
      'pt-BR',
      <SidebarDock
        activeTab="news"
        onSelectTab={() => {}}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );
    expect(ptHtml).toContain('Portfólio');
    expect(ptHtml).toContain('Histórico');
    expect(ptHtml).toContain('Torneios');
    expect(ptHtml).toContain('Análises');
    expect(ptHtml).toContain('Promoções');
    expect(ptHtml).toContain('Tutoriais');
    expect(ptHtml).toContain('Ajustes da plataforma');
    expect(ptHtml).toContain('Análise de mercado');

    const esHtml = renderShellWithLocale(
      'es-ES',
      <SidebarDock
        activeTab="news"
        onSelectTab={() => {}}
        activeContractsCount={0}
        soundEnabled={true}
        onToggleSound={() => {}}
        timeZone="UTC-3"
        onToggleTimeZone={() => {}}
      />
    );
    expect(esHtml).toContain('Portafolio');
    expect(esHtml).toContain('Historial');
    expect(esHtml).toContain('Torneos');
    expect(esHtml).toContain('Análisis');
    expect(esHtml).toContain('Promociones');
    expect(esHtml).toContain('Tutoriales');
    expect(esHtml).toContain('Ajustes de la plataforma');
    expect(esHtml).toContain('Análisis de mercado');
  });

  it('[Unit] AccountSelectorDropdown e TerminalHeader alternam entre Português (pt-BR) e Espanhol (es-ES)', () => {
    const ptDropdown = renderShellWithLocale(
      'pt-BR',
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        initialOpen={true}
        onSignOut={() => {}}
      />
    );
    expect(ptDropdown).toContain('Conta de prática');
    expect(ptDropdown).toContain('Conta real');
    expect(ptDropdown).toContain('Recarregar prática');
    expect(ptDropdown).toContain('Entrar');
    expect(ptDropdown).toContain('Criar conta');
    expect(ptDropdown).toContain('Sair');

    const esDropdown = renderShellWithLocale(
      'es-ES',
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
        initialOpen={true}
        onSignOut={() => {}}
      />
    );
    expect(esDropdown).toContain('Cuenta de práctica');
    expect(esDropdown).toContain('Cuenta real');
    expect(esDropdown).toContain('Recargar práctica');
    expect(esDropdown).toContain('Iniciar sesión');
    expect(esDropdown).toContain('Crear cuenta');
    expect(esDropdown).toContain('Cerrar sesión');

    const ptHeader = renderShellWithLocale(
      'pt-BR',
      <TerminalHeader
        activeSymbol="VOL_100"
        openTabs={['VOL_100', 'EURUSD']}
        onSelectTab={() => {}}
        onCloseTab={() => {}}
        onAddTab={() => {}}
        balanceMinor={1000000}
        accountEmail="trader@binmax.io"
        isLive={true}
        onResetDemo={() => {}}
        onSignOut={() => {}}
      />
    );
    expect(ptHeader).toContain('Distribuição de grade');
    expect(ptHeader).toContain('Fechar aba');
    expect(ptHeader).toContain('Sair');
  });

  it('[Unit] TerminalFooter e PortfolioDrawer alternam métricas e estados vazios entre PT e ES', () => {
    const ptFooter = renderShellWithLocale(
      'pt-BR',
      <TerminalFooter
        soundEnabled={true}
        onToggleSound={() => {}}
        portfolioTotalFormatted="$10,000.00"
        todayProfitFormatted="+$250.00"
        activeContractsCount={2}
      />
    );
    expect(ptFooter).toContain('Portfólio total');
    expect(ptFooter).toContain('Lucro de hoje');
    expect(ptFooter).toContain('Operações abertas');
    expect(ptFooter).toContain('Hora atual:');

    const esFooter = renderShellWithLocale(
      'es-ES',
      <TerminalFooter
        soundEnabled={true}
        onToggleSound={() => {}}
        portfolioTotalFormatted="$10,000.00"
        todayProfitFormatted="+$250.00"
        activeContractsCount={2}
      />
    );
    expect(esFooter).toContain('Portafolio total');
    expect(esFooter).toContain('Ganancia de hoy');
    expect(esFooter).toContain('Operaciones abiertas');
    expect(esFooter).toContain('Hora actual:');

    const ptDrawer = renderShellWithLocale(
      'pt-BR',
      <PortfolioDrawer
        isOpen={true}
        onToggle={() => {}}
        contracts={[]}
        currentPrice={100}
        currentSymbol="VOL_100"
      />
    );
    expect(ptDrawer).toContain('0 ativas');
    expect(ptDrawer).toContain('Terminal em espera');
    expect(ptDrawer).toContain('Mostrar posições');
    expect(ptDrawer).toContain('Sem operações abertas');

    const esDrawer = renderShellWithLocale(
      'es-ES',
      <PortfolioDrawer
        isOpen={true}
        onToggle={() => {}}
        contracts={[]}
        currentPrice={100}
        currentSymbol="VOL_100"
      />
    );
    expect(esDrawer).toContain('0 activas');
    expect(esDrawer).toContain('Terminal en espera');
    expect(esDrawer).toContain('Mostrar posiciones');
    expect(esDrawer).toContain('Sin operaciones abiertas');
  });

  it('[Unit] OrderTicket e SecondaryLayout alternam entre Português (pt-BR) e Espanhol (es-ES)', () => {
    const ptTicket = renderShellWithLocale(
      'pt-BR',
      <OrderTicket
        symbol="VOL_100"
        paused={false}
        stale={false}
        availableMinor={1000000}
        onChanged={() => {}}
      />
    );
    expect(ptTicket).toContain('Valor');
    expect(ptTicket).toContain('Expiração');
    expect(ptTicket).toContain('Lucro');
    expect(ptTicket).toContain('ACIMA');
    expect(ptTicket).toContain('ABAIXO');

    const esTicket = renderShellWithLocale(
      'es-ES',
      <OrderTicket
        symbol="VOL_100"
        paused={false}
        stale={false}
        availableMinor={1000000}
        onChanged={() => {}}
      />
    );
    expect(esTicket).toContain('Monto');
    expect(esTicket).toContain('Expiración');
    expect(esTicket).toContain('Ganancia');
    expect(esTicket).toContain('SUBE');
    expect(esTicket).toContain('BAJA');

    const ptSecondary = renderShellWithLocale(
      'pt-BR',
      <SecondaryLayout activeNav="Torneos">
        <div>Conteúdo</div>
      </SecondaryLayout>
    );
    expect(ptSecondary).toContain('Torneios');
    expect(ptSecondary).toContain('Análises');
    expect(ptSecondary).toContain('Tutoriais');
    expect(ptSecondary).toContain('Promoções');
    expect(ptSecondary).toContain('Aviso de risco:');

    const esSecondary = renderShellWithLocale(
      'es-ES',
      <SecondaryLayout activeNav="Torneos">
        <div>Contenido</div>
      </SecondaryLayout>
    );
    expect(esSecondary).toContain('Torneos');
    expect(esSecondary).toContain('Análisis');
    expect(esSecondary).toContain('Tutoriales');
    expect(esSecondary).toContain('Promociones');
    expect(esSecondary).toContain('Advertencia de riesgo:');
  });

  it('[Stress] 200 alternâncias rápidas de idioma em toda a árvore da sala completam de forma determinística', () => {
    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      const locale = i % 2 === 0 ? 'pt-BR' : 'es-MX';
      const html = renderShellWithLocale(
        locale,
        <div>
          <SidebarDock
            activeTab={null}
            onSelectTab={() => {}}
            activeContractsCount={0}
            soundEnabled={true}
            onToggleSound={() => {}}
            timeZone="UTC-3"
            onToggleTimeZone={() => {}}
          />
          <TerminalFooter soundEnabled={true} onToggleSound={() => {}} />
        </div>
      );
      expect(html).toContain(i % 2 === 0 ? 'Torneios' : 'Torneos');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it('[Security] isSupportedLocale bloqueia payloads maliciosos, XSS e Prototype Pollution', () => {
    expect(isSupportedLocale('pt-BR')).toBe(true);
    expect(isSupportedLocale('es-ES')).toBe(true);
    expect(isSupportedLocale('es-MX')).toBe(true);
    expect(isSupportedLocale('es-AR')).toBe(true);
    expect(isSupportedLocale('es-CO')).toBe(true);

    expect(isSupportedLocale('<script>alert(1)</script>')).toBe(false);
    expect(isSupportedLocale('__proto__')).toBe(false);
    expect(isSupportedLocale('constructor')).toBe(false);
    expect(isSupportedLocale('../../etc/passwd')).toBe(false);
    expect(isSupportedLocale('en-US')).toBe(false);
    expect(isSupportedLocale('')).toBe(false);
    expect(isSupportedLocale(null)).toBe(false);
    expect(isSupportedLocale(undefined)).toBe(false);
  });

  it('[Chaos & Regression] Valores monetários permanecem 100% invariantes entre idiomas e SSR sem provider preserva idioma base', () => {
    const ptHtml = renderShellWithLocale(
      'pt-BR',
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
      />
    );
    const esHtml = renderShellWithLocale(
      'es-ES',
      <AccountSelectorDropdown
        balanceMinor={1000000}
        accountType="DEMO"
        onSelectAccountType={() => {}}
        onResetDemo={() => {}}
      />
    );
    expect(ptHtml).toContain('$10,000.00');
    expect(esHtml).toContain('$10,000.00');

    // Bare SSR without I18nProvider preserves defaultLang
    function Probe({ def }: { def: 'pt' | 'es' }) {
      const lang = useUiLanguage(def);
      return <span data-lang={lang}>{lang}</span>;
    }
    expect(renderToStaticMarkup(<Probe def="es" />)).toContain('data-lang="es"');
    expect(renderToStaticMarkup(<Probe def="pt" />)).toContain('data-lang="pt"');
  });
});
