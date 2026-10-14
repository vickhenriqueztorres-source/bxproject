import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArenaRoom, ChartOverlay } from '../ArenaRoom';
import { mapArenaPositionsToContracts, useArena, type ArenaApi } from '../use-arena';
import { setNewTraderoomEnabled } from '../../lib/feature-flags';

describe('Suite 02 — Espelhamento do <PriceChart /> Principal dentro da ArenaRoom', () => {
  beforeEach(() => {
    setNewTraderoomEnabled(true);
  });

  it('2.1 ArenaRoom no estágio running espelha o <PriceChart /> oficial dentro de <ChartErrorBoundary />', () => {
    const html = renderToStaticMarkup(
      <ArenaRoom initialStage="running" initialRoomIndex={0} initialTier="TOP_10" />
    );

    // Container da sala ao vivo e wrapper do gráfico espelhado
    expect(html).toContain('data-testid="arena-live-room"');
    expect(html).toContain('data-testid="arena-mirrored-chart-wrapper"');

    // Elementos oficiais exclusivos do <PriceChart /> principal da corretora
    expect(html).toContain('data-testid="chart-top-asset-pill"');
    expect(html).toContain('Vol 100');
  });

  it('2.2 Mapeia posições abertas em T$ (arena.s.positions) para o formato Contract[] do <PriceChart />', () => {
    let capturedArena: ArenaApi | null = null;
    function Harness() {
      const arena = useArena({ initialStage: 'running' });
      capturedArena = arena;
      return <ArenaRoom arenaOverride={arena} />;
    }

    renderToStaticMarkup(<Harness />);
    const res = capturedArena!.place('up', 150, 60);
    expect(res.ok).toBe(true);
    expect(capturedArena!.s.positions.length).toBe(1);

    const contracts = capturedArena!.positionsAsContracts;
    expect(contracts.length).toBe(1);
    expect(contracts[0].symbol).toBe('VOL_100');
    expect(contracts[0].direction).toBe('UP');
    expect(contracts[0].stake_minor).toBe(15000); // T$ 150 -> 15000 minor
    expect(contracts[0].status).toBe('OPEN');

    const directMapped = mapArenaPositionsToContracts(capturedArena!.s.positions, 'VOL_100');
    expect(directMapped).toEqual(contracts);

    const liveHtml = renderToStaticMarkup(<ArenaRoom arenaOverride={capturedArena!} />);
    expect(liveHtml).toContain('1 ordem aberta');
  });

  it('2.3 Exibe <ChartOverlay /> de countdown antes da largada e de settling na apuração final', () => {
    let countdownArena: ArenaApi | null = null;
    function CountdownHarness() {
      const arena = useArena({ initialStage: 'countdown' });
      countdownArena = arena;
      return <ChartOverlay arena={arena} />;
    }

    const countdownHtml = renderToStaticMarkup(<CountdownHarness />);
    expect(countdownHtml).toContain('data-testid="arena-chart-overlay-countdown"');
    expect(countdownHtml).toContain('A Arena começa em');
    expect(countdownHtml).toContain('Todos os participantes recebem T$ 1.000 ao mesmo tempo.');

    // Muda para settling
    countdownArena!.s.stage = 'settling';
    const settlingHtml = renderToStaticMarkup(<ChartOverlay arena={countdownArena!} />);
    expect(settlingHtml).toContain('data-testid="arena-chart-overlay-settling"');
    expect(settlingHtml).toContain('Liquidando ordens e apurando o ranking final');
  });
});
