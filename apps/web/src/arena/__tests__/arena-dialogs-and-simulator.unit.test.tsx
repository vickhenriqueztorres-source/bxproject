import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PreviewMenu, PhaseChip } from '../ArenaBar';
import { RebuyDialog, ResultDialog } from '../ArenaDialogs';
import { ARENA } from '../engine';
import { useArena, type ArenaApi } from '../use-arena';
import { RouterProvider } from '../../router/RouterContext';

describe('Suite 05 — Modais (RebuyDialog / ResultDialog) e Menu Simular (PreviewMenu)', () => {
  function createRunningArena(): ArenaApi {
    let instance: ArenaApi | null = null;
    function Harness() {
      instance = useArena({ initialStage: 'running', initialRoomIndex: 0, initialTier: 'TOP_10' });
      return null;
    }
    renderToString(<Harness />);
    return instance!;
  }

  it('5.1 Renderiza todos os controles do PreviewMenu (Simular), incluindo Top 3/10/20/30 e simuladores de Pódio/Bolha', () => {
    const arena = createRunningArena();
    const html = renderToString(<PreviewMenu arena={arena} defaultOpen={true} />);

    expect(html).toContain('data-testid="arena-preview-menu"');
    expect(html).toContain('data-testid="preview-skip-1m"');
    expect(html).toContain('data-testid="preview-rebuy-freeze"');
    expect(html).toContain('data-testid="preview-last-minute"');
    expect(html).toContain('data-testid="preview-bust"');
    expect(html).toContain('data-testid="preview-end-now"');
    expect(html).toContain('data-testid="preview-tier-TOP_3"');
    expect(html).toContain('data-testid="preview-tier-TOP_10"');
    expect(html).toContain('data-testid="preview-tier-TOP_20"');
    expect(html).toContain('data-testid="preview-tier-TOP_30"');
    expect(html).toContain('data-testid="preview-pos-podium"');
    expect(html).toContain('data-testid="preview-pos-bubble-itm"');
    expect(html).toContain('data-testid="preview-pos-bubble-out"');
    expect(html).toContain('data-testid="preview-leave"');
  });

  it('5.2 Abre RebuyDialog quando saldo zera (preview.bust) e respeita o limite máximo de 3/3 rebuys e freeze aos 12:00', async () => {
    const arena = createRunningArena();
    expect(arena.rebuyEligible).toBe(false);

    // Zera o saldo T$
    arena.preview.bust();
    expect(arena.s.points).toBe(0);
    expect(arena.rebuyEligible).toBe(true);

    const dialogHtml = renderToString(<RebuyDialog arena={arena} />);
    expect(dialogHtml).toContain('data-testid="arena-rebuy-dialog"');
    expect(dialogHtml).toContain('Volte para a disputa com T$ 1.000');
    expect(dialogHtml).toContain('0/3');

    // Executa os 3 rebuys permitidos
    for (let i = 1; i <= 3; i++) {
      arena.preview.bust();
      const res = await arena.rebuy(0);
      expect(res.ok).toBe(true);
      expect(arena.s.points).toBe(1000);
      expect(arena.s.rebuys).toBe(i);
    }

    // No 4º bust (após 3/3 rebuys), rebuyEligible deve ser falso!
    arena.preview.bust();
    expect(arena.s.rebuys).toBe(3);
    expect(arena.rebuyEligible).toBe(false);
    const closedHtml = renderToString(<RebuyDialog arena={arena} />);
    expect(closedHtml).toBe('');
  });

  it('5.3 PreviewMenu: jumpTo atualiza PhaseChip (Rebuy encerrado aos 12m, Ordens bloqueadas aos 14m)', () => {
    const arena = createRunningArena();
    expect(renderToString(<PhaseChip arena={arena} />)).toContain('Ao vivo');

    arena.preview.jumpTo(ARENA.rebuyFreezeMs + 1_000);
    expect(renderToString(<PhaseChip arena={arena} />)).toContain('Rebuy encerrado');

    arena.preview.jumpTo(ARENA.tradeFreezeMs + 1_000);
    expect(renderToString(<PhaseChip arena={arena} />)).toContain('Ordens bloqueadas');
  });

  it('5.4 ResultDialog exibe modal de Pódio quando premiado (com saque e conta real) e Quase-Vitória com cupom de 100% bônus quando fora da bolha', () => {
    // Caso A: Premiado no Pódio (#1) e acima do Alpha_Quant
    const arenaWin = createRunningArena();
    arenaWin.preview.setTier('TOP_10');
    arenaWin.preview.simulatePosition(1);
    arenaWin.preview.jumpTo(ARENA.durationMs);

    expect(arenaWin.s.stage).toBe('ended');
    expect(arenaWin.s.result?.prizeCents).toBeGreaterThan(0);
    expect(arenaWin.s.result?.bonusEligible).toBe(true);

    const winHtml = renderToString(
      <RouterProvider>
        <ResultDialog arena={arenaWin} />
      </RouterProvider>
    );
    expect(winHtml).toContain('data-testid="arena-result-dialog"');
    expect(winHtml).toContain('Você conquistou o pódio!');
    expect(winHtml).toContain('data-testid="result-bonus-badge"');
    expect(winHtml).toContain('data-testid="result-real-account-btn"');
    expect(winHtml).toContain('data-testid="result-withdraw-btn"');

    // Caso B: Fora da Bolha (#11 no Top 10) -> Quase-Vitória + Cupom 100% bônus
    const arenaNear = createRunningArena();
    arenaNear.preview.setTier('TOP_10');
    arenaNear.preview.simulatePosition(11);
    arenaNear.preview.jumpTo(ARENA.durationMs);

    expect(arenaNear.s.stage).toBe('ended');
    expect(arenaNear.s.result?.prizeCents).toBe(0);

    const nearHtml = renderToString(
      <RouterProvider>
        <ResultDialog arena={arenaNear} />
      </RouterProvider>
    );
    expect(nearHtml).toContain('Faltou muito pouco!');
    expect(nearHtml).toContain('data-testid="result-coupon-box"');
    expect(nearHtml).toContain('100% de bônus no 1º depósito na conta real');
    expect(nearHtml).toContain('data-testid="result-deposit-bonus-btn"');
    expect(nearHtml).toContain('data-testid="result-next-arena-btn"');
  });
});
