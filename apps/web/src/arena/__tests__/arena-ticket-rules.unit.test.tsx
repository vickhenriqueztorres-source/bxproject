import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { ArenaTicket } from '../ArenaTicket';
import { ARENA, maxStake } from '../engine';
import { useArena, type ArenaApi } from '../use-arena';

describe('Suite 03 — Regras da Boleta ArenaTicket (Trava 20%, Botões Rápidos, Expiração e Freeze)', () => {
  function setupRunningArena(initialPoints = 1000): ArenaApi {
    let instance: ArenaApi | null = null;
    function Harness() {
      instance = useArena({ initialStage: 'running', initialPoints });
      return null;
    }
    renderToString(<Harness />);
    return instance!;
  }

  it('3.1 Renderiza a boleta com trava de máx. 20%, botões rápidos 5% / 10% / 20% e expirações 00:30 / 01:00 / 02:00', () => {
    const arena = setupRunningArena(1000);
    const html = renderToString(<ArenaTicket arena={arena} />);

    expect(html).toContain('data-testid="arena-ticket"');
    expect(html).toContain('máx. T$ 200 · 20%');
    expect(html).toContain('data-testid="arena-quick-pct-5"');
    expect(html).toContain('data-testid="arena-quick-pct-10"');
    expect(html).toContain('data-testid="arena-quick-pct-20"');
    expect(html).toContain('data-testid="arena-expiry-30"');
    expect(html).toContain('data-testid="arena-expiry-60"');
    expect(html).toContain('data-testid="arena-expiry-120"');
    expect(html).toContain('data-testid="arena-btn-up"');
    expect(html).toContain('data-testid="arena-btn-down"');
  });

  it('3.2 Bloqueia ordens acima de 20% da banca T$ ou abaixo do mínimo de T$ 10', () => {
    const arena = setupRunningArena(1000);
    expect(maxStake(1000)).toBe(200);

    // Tenta abrir ordem de T$ 250 (> 20% de 1000)
    const overCap = arena.place('up', 250, 60);
    expect(overCap.ok).toBe(false);
    if (!overCap.ok) {
      expect(overCap.error).toContain('no máximo 20% do saldo');
    }

    // Tenta abrir ordem de T$ 5 (< mínimo T$ 10)
    const underMin = arena.place('down', 5, 60);
    expect(underMin.ok).toBe(false);
    if (!underMin.ok) {
      expect(underMin.error).toContain('O valor mínimo por ordem é T$ 10');
    }

    // Ordem válida de T$ 200 (exatamente 20%)
    const valid = arena.place('up', 200, 60);
    expect(valid.ok).toBe(true);
    expect(arena.s.points).toBe(800);
    // Novo teto passa a ser 20% de 800 = T$ 160
    expect(maxStake(arena.s.points)).toBe(160);
  });

  it('3.3 Bloqueia expiração que ultrapassa o fim do torneio e bloqueia novas ordens no último minuto (tradeFreezeMs)', () => {
    const arena = setupRunningArena(1000);

    // Faltam 90 segundos para acabar o torneio (antes do último minuto, mas 120s passa do fim)
    arena.preview.jumpTo(ARENA.durationMs - 90_000);
    const tooLong = arena.place('up', 100, 120);
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) {
      expect(tooLong.error).toContain('Essa expiração passa do fim do torneio');
    }

    // Mas expiração de 30s ainda é aceita
    const fitsInTime = arena.place('down', 100, 30);
    expect(fitsInTime.ok).toBe(true);

    // Avança para o último minuto (elapsed >= 14 min)
    arena.preview.jumpTo(ARENA.tradeFreezeMs + 5_000);
    const frozenOrder = arena.place('up', 50, 30);
    expect(frozenOrder.ok).toBe(false);
    if (!frozenOrder.ok) {
      expect(frozenOrder.error).toContain('Ordens bloqueadas no último minuto');
    }

    const htmlFrozen = renderToString(<ArenaTicket arena={arena} />);
    expect(htmlFrozen).toContain('data-testid="arena-trades-frozen-notice"');
    expect(htmlFrozen).toContain('Último minuto: novas ordens bloqueadas');
  });

  it('3.4 Exibe indicador de Momentum Streak 3x quando o jogador atinge 3 vitórias seguidas', () => {
    const arena = setupRunningArena(1200);
    arena.preview.triggerMomentumStreak();

    const html = renderToString(<ArenaTicket arena={arena} />);
    expect(html).toContain('data-testid="arena-momentum-streak"');
    expect(html).toContain('Momentum Streak 3x Ativo (+15% bônus T$)');
  });
});
