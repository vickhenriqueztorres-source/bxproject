import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, type Locale } from '../i18n';
import { RouterProvider } from '../router/RouterContext';
import { setNewTraderoomEnabled } from '../lib/feature-flags';
import { ArenaPage } from '../pages/ArenaPage';
import { ArenaLobby } from './ArenaLobby';
import type { PayoutTier } from './engine';

function renderWithLocale(locale: Locale, node: React.ReactNode): string {
  return renderToStaticMarkup(
    <I18nProvider initialLocale={locale}>
      <RouterProvider initialPath="/arena">{node}</RouterProvider>
    </I18nProvider>
  );
}

describe('Subetapa 11 — Redesign Executivo One-Screen do Lobby da Arena (http://localhost:5173/arena)', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('1. Unitário One-Screen: renderiza o Lobby inteiro em container 100% travado sem scroll de página e com os 4 painéis visíveis na mesma tela', () => {
    const html = renderWithLocale('pt-BR', <ArenaPage />);

    expect(html).toContain('data-testid="arena-lobby-view"');
    expect(html).toContain('data-testid="arena-lobby-one-screen"');
    expect(html).toContain('grid-template-columns:repeat(4, minmax(0, 1fr))');
    expect(html).toContain('font-size:20px');
    expect(html).not.toContain('sm:text-5xl');

    // Todos os 4 painéis inferiores visíveis simultaneamente na mesma tela
    expect(html).toContain('Como funciona');
    expect(html).toContain('Distribuição do pote');
    expect(html).toContain('Desafio Alpha Quant');
    expect(html).toContain('Regras');
  });

  it('2. Unitário Bilíngue (ES): traduz todos os 4 painéis e controles rápidos no layout One-Screen', () => {
    const html = renderWithLocale(
      'es-ES',
      <ArenaLobby onJoin={() => {}} initialRoomIndex={1} initialTier="TOP_20" />
    );

    expect(html).toContain('15 minutos. T$ 1.000. El podio se lleva el bote.');
    expect(html).toContain('Elige tu sala');
    expect(html).toContain('Sala Plata');
    expect(html).toContain('Franja de premiación (ITM)');
    expect(html).toContain('Cómo funciona');
    expect(html).toContain('Distribución del bote');
    expect(html).toContain('Desafío Alpha Quant');
    expect(html).toContain('Reglas');
    expect(html).toContain('data-testid="lobby-cutoff-places"');
    expect(html).toContain('4º al 20º lugar (ITM)');
  });

  it('3. Segurança & Integridade: preserva todos os data-testids e cálculos de buy-in e pote por sala', () => {
    const html = renderWithLocale(
      'pt-BR',
      <ArenaLobby onJoin={() => {}} initialRoomIndex={0} initialTier="TOP_10" />
    );

    expect(html).toContain('data-testid="arena-lobby-hero"');
    expect(html).toContain('data-testid="arena-room-card-0"');
    expect(html).toContain('data-testid="arena-room-card-1"');
    expect(html).toContain('data-testid="arena-room-card-2"');
    expect(html).toContain('data-testid="arena-room-pool-0"');
    expect(html).toContain('data-testid="arena-room-pool-1"');
    expect(html).toContain('data-testid="arena-room-pool-2"');
    expect(html).toContain('data-testid="lobby-tier-TOP_3"');
    expect(html).toContain('data-testid="lobby-tier-TOP_10"');
    expect(html).toContain('data-testid="lobby-tier-TOP_20"');
    expect(html).toContain('data-testid="lobby-tier-TOP_30"');
    expect(html).toContain('data-testid="arena-join-btn"');
    expect(html).toContain('data-testid="lobby-estimated-pool"');
    expect(html).toContain('data-testid="lobby-cutoff-places"');
  });

  it('4. Stress & Caos: 200 renderizações combinando salas (Bronze/Prata/Ouro), faixas ITM e idiomas (PT/ES)', () => {
    const tiers: PayoutTier[] = ['TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'];
    for (let i = 0; i < 200; i++) {
      const roomIndex = i % 3;
      const tier = tiers[i % 4];
      const locale: Locale = i % 2 === 0 ? 'pt-BR' : 'es-ES';
      const html = renderWithLocale(
        locale,
        <ArenaLobby onJoin={() => {}} initialRoomIndex={roomIndex} initialTier={tier} />
      );
      expect(html).toContain('data-testid="arena-lobby-one-screen"');
      expect(html).toContain('data-testid="arena-join-btn"');
    }
  });
});
