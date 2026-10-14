import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArenaLobby } from '../ArenaLobby';
import { ArenaRoom } from '../ArenaRoom';
import { useArena, type ArenaApi } from '../use-arena';
import { BUY_INS, formatUsd, podiumPrizes, splitEntry, tierPrizes } from '../engine';

describe('Suite 01 — ArenaLobby: Salas (Bronze / Prata / Ouro), Tiers (Top 3/10/20/30), Pote e Entrada', () => {
  it('1.1 Renderiza o Hero do Lobby com arte arena-diamond.png, diamond-glow e os 3 cards de sala', () => {
    const onJoin = vi.fn();
    const html = renderToStaticMarkup(<ArenaLobby onJoin={onJoin} />);

    expect(html).toContain('data-testid="arena-lobby-hero"');
    expect(html).toContain('/images/arena-diamond.png');
    expect(html).toContain('diamond-glow');
    expect(html).toContain('15 minutos. T$ 1.000. O pódio leva o pote.');

    // 3 salas: Bronze ($5), Prata ($10), Ouro ($25)
    expect(html).toContain('Sala Bronze');
    expect(html).toContain('Sala Prata');
    expect(html).toContain('Sala Ouro');
    expect(html).toContain('data-testid="arena-room-card-0"');
    expect(html).toContain('data-testid="arena-room-card-1"');
    expect(html).toContain('data-testid="arena-room-card-2"');
  });

  it('1.2 Calcula exatamente o pote de cada sala (70% pool / 30% rake) e exibe os seletores Top 3 / 10 / 20 / 30', () => {
    const onJoin = vi.fn();
    for (let roomIdx = 0; roomIdx < BUY_INS.length; roomIdx++) {
      const room = BUY_INS[roomIdx];
      const expectedPool = (room.rivals + 1) * splitEntry(room.cents).pool;
      const html = renderToStaticMarkup(
        <ArenaLobby onJoin={onJoin} initialRoomIndex={roomIdx} initialTier={room.defaultTier} />
      );

      expect(html).toContain(formatUsd(room.cents));
      expect(html).toContain(formatUsd(expectedPool));
      expect(html).toContain('data-testid="lobby-tier-TOP_3"');
      expect(html).toContain('data-testid="lobby-tier-TOP_10"');
      expect(html).toContain('data-testid="lobby-tier-TOP_20"');
      expect(html).toContain('data-testid="lobby-tier-TOP_30"');
    }
  });

  it('1.3 Alternar entre Top 3, Top 10, Top 20 e Top 30 atualiza a distribuição do pote e faixa ITM', () => {
    const onJoin = vi.fn();
    const bronzePool = (BUY_INS[0].rivals + 1) * splitEntry(BUY_INS[0].cents).pool;

    const htmlTop3 = renderToStaticMarkup(
      <ArenaLobby onJoin={onJoin} initialRoomIndex={0} initialTier="TOP_3" />
    );
    const { prizes: p3 } = podiumPrizes(bronzePool);
    expect(htmlTop3).toContain(formatUsd(p3[0]));
    expect(htmlTop3).not.toContain('data-testid="lobby-cutoff-places"');

    const htmlTop10 = renderToStaticMarkup(
      <ArenaLobby onJoin={onJoin} initialRoomIndex={0} initialTier="TOP_10" />
    );
    const { prizes: p10 } = tierPrizes(bronzePool, 'TOP_10');
    expect(htmlTop10).toContain(formatUsd(p10[0]));
    expect(htmlTop10).toContain('4º ao 10º lugar (ITM)');

    const htmlTop20 = renderToStaticMarkup(
      <ArenaLobby onJoin={onJoin} initialRoomIndex={1} initialTier="TOP_20" />
    );
    expect(htmlTop20).toContain('4º ao 20º lugar (ITM)');

    const htmlTop30 = renderToStaticMarkup(
      <ArenaLobby onJoin={onJoin} initialRoomIndex={2} initialTier="TOP_30" />
    );
    expect(htmlTop30).toContain('4º ao 30º lugar (ITM)');
  });

  it('1.4 Ao acionar join(roomIndex, tier), inicia countdown com T$ 1.000, rivais e lançamento BUY_IN no ledger', () => {
    let capturedArena: ArenaApi | null = null;
    function Harness() {
      const arena = useArena();
      capturedArena = arena;
      return <ArenaRoom arenaOverride={arena} />;
    }

    const lobbyHtml = renderToStaticMarkup(<Harness />);
    expect(lobbyHtml).toContain('data-testid="arena-lobby-view"');
    expect(capturedArena!.s.stage).toBe('lobby');

    // Simula clique em Entrar na Sala Prata (índice 1) com tier TOP_20
    capturedArena!.join(1, 'TOP_20');
    expect(capturedArena!.s.stage).toBe('countdown');
    expect(capturedArena!.s.roomIndex).toBe(1);
    expect(capturedArena!.s.tier).toBe('TOP_20');
    expect(capturedArena!.s.points).toBe(1000);
    expect(capturedArena!.s.rivals.length).toBe(BUY_INS[1].rivals);
    expect(capturedArena!.s.ledger.length).toBe(1);
    expect(capturedArena!.s.ledger[0].type).toBe('BUY_IN');
    expect(capturedArena!.s.ledger[0].amountCents).toBe(1000);
    expect(capturedArena!.s.ledger[0].poolCents).toBe(700);
  });
});
