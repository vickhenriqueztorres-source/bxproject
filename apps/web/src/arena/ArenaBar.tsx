import React, { useState } from 'react';
import { FastForward, FlaskConical, Gem, LogOut, Target, Trophy, Wifi } from 'lucide-react';
import {
  ARENA,
  formatCountdown,
  formatPoints,
  formatUsd,
  tierCutoffCount,
  tierLabel,
  type PayoutTier,
} from './engine';
import { cn } from './arena-ui';
import type { ArenaApi } from './use-arena';
import { useUiLanguage } from '../i18n';

export function arenaClock(arena: ArenaApi, now = Date.now()) {
  const { s } = arena;
  const elapsed =
    s.stage === 'running'
      ? now - s.startsAt
      : s.stage === 'countdown'
      ? 0
      : ARENA.durationMs;
  return {
    elapsed,
    remainingSec: Math.max(0, (ARENA.durationMs - elapsed) / 1000),
    rebuyFrozen: elapsed >= ARENA.rebuyFreezeMs,
    tradesFrozen: elapsed >= ARENA.tradeFreezeMs,
    countdownSec: Math.max(0, (s.countdownEndsAt - now) / 1000),
  };
}

export function PhaseChip({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const clock = arenaClock(arena);
  const { stage } = arena.s;
  const chip =
    stage === 'countdown'
      ? {
          label: isEs
            ? `Comienza en ${Math.ceil(clock.countdownSec)}s`
            : `Começa em ${Math.ceil(clock.countdownSec)}s`,
          tone: 'arena',
        }
      : stage === 'settling'
      ? { label: isEs ? 'Calculando resultado' : 'Apurando resultado', tone: 'arena' }
      : stage === 'ended'
      ? { label: isEs ? 'Finalizado' : 'Encerrado', tone: 'muted' }
      : clock.tradesFrozen
      ? { label: isEs ? 'Órdenes bloqueadas' : 'Ordens bloqueadas', tone: 'alert' }
      : clock.rebuyFrozen
      ? { label: isEs ? 'Rebuy cerrado' : 'Rebuy encerrado', tone: 'bonus' }
      : { label: isEs ? 'En vivo' : 'Ao vivo', tone: 'live' };

  return (
    <span
      data-testid="arena-phase-chip"
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-bold tracking-wide uppercase ring-1',
        chip.tone === 'live' && 'bg-primary/15 text-primary ring-primary/30',
        chip.tone === 'arena' && 'bg-arena-surface text-arena ring-arena-border',
        chip.tone === 'bonus' && 'bg-bonus/10 text-bonus ring-bonus/30',
        chip.tone === 'alert' && 'bg-alert/10 text-alert ring-alert/40',
        chip.tone === 'muted' && 'bg-raised text-muted-foreground ring-border'
      )}
    >
      {chip.tone === 'live' && (
        <span className="size-1.5 animate-pulse rounded-full bg-primary" aria-hidden="true" />
      )}
      {chip.label}
    </span>
  );
}

export function PreviewMenu({
  arena,
  defaultOpen = false,
}: {
  arena: ArenaApi;
  defaultOpen?: boolean;
}) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const [open, setOpen] = useState(defaultOpen);
  const running = arena.s.stage === 'running';
  const cutoff = tierCutoffCount(arena.s.tier);
  const item =
    'flex w-full items-center gap-2 rounded-md bg-transparent px-2.5 py-2 text-left text-sm outline-none hover:bg-raised focus-visible:bg-raised disabled:pointer-events-none disabled:opacity-40';
  const itemStyle: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: 'var(--foreground, #f2f4f7)',
    border: 'none',
  };
  const run = (fn: () => void) => () => {
    fn();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        data-testid="arena-simular-btn"
        aria-expanded={open}
        aria-controls="arena-preview-menu"
        onClick={() => setOpen((v) => !v)}
        style={{
          backgroundColor: 'var(--surface, #0f1318)',
          color: 'var(--muted-foreground, #8b95a3)',
          border: '1px dashed var(--border, #1c232c)',
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface px-2.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-arena"
      >
        <FlaskConical className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        Simular
      </button>
      {open && (
        <div
          id="arena-preview-menu"
          data-testid="arena-preview-menu"
          style={{
            backgroundColor: 'var(--surface, #0f1318)',
            borderColor: 'var(--border, #1c232c)',
          }}
          className="platform-rise absolute top-11 right-0 z-30 flex w-64 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
        >
          <p className="px-2.5 pt-1 pb-1.5 text-[11px] leading-relaxed text-muted-foreground">
            {isEs
              ? 'Controles de vista previa de la interfaz.'
              : 'Controles de pré-visualização da interface.'}
          </p>
          <button
            type="button"
            data-testid="preview-skip-1m"
            disabled={!running}
            onClick={run(() => arena.preview.skip(60_000))}
            style={itemStyle}
            className={item}
          >
            <FastForward className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Avanzar 1 minuto' : 'Avançar 1 minuto'}
          </button>
          <button
            type="button"
            data-testid="preview-rebuy-freeze"
            disabled={!running}
            onClick={run(() => arena.preview.jumpTo(ARENA.rebuyFreezeMs - 20_000))}
            style={itemStyle}
            className={item}
          >
            <FastForward className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Ir al freeze de rebuy' : 'Ir para o freeze de rebuy'}
          </button>
          <button
            type="button"
            data-testid="preview-last-minute"
            disabled={!running}
            onClick={run(() => arena.preview.jumpTo(ARENA.durationMs - 55_000))}
            style={itemStyle}
            className={item}
          >
            <FastForward className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Ir al último minuto' : 'Ir para o último minuto'}
          </button>
          <button
            type="button"
            data-testid="preview-bust"
            disabled={!running}
            onClick={run(arena.preview.bust)}
            style={itemStyle}
            className={item}
          >
            <Gem className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Vaciar mi saldo T$' : 'Zerar meu saldo T$'}
          </button>
          <button
            type="button"
            data-testid="preview-end-now"
            disabled={!running}
            onClick={run(() => arena.preview.jumpTo(ARENA.durationMs))}
            style={itemStyle}
            className={item}
          >
            <Trophy className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Finalizar torneo ahora' : 'Encerrar torneio agora'}
          </button>

          <div className="my-1 border-t border-border" />
          <p className="px-2.5 pt-1 pb-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {isEs ? 'Simular Tier Premiado' : 'Simular Tier Premiado'}
          </p>
          <div className="grid grid-cols-4 gap-1 px-2 pb-1">
            {(['TOP_3', 'TOP_10', 'TOP_20', 'TOP_30'] as PayoutTier[]).map((t) => {
              const activeTier = arena.s.tier === t;
              return (
                <button
                  key={t}
                  type="button"
                  data-testid={`preview-tier-${t}`}
                  onClick={run(() => arena.preview.setTier(t))}
                  style={{
                    backgroundColor: activeTier
                      ? 'var(--tournament-purple-surface, #1a0b2e)'
                      : 'transparent',
                    color: activeTier
                      ? 'var(--tournament-purple-glow, #9d4edd)'
                      : 'var(--muted-foreground, #8b95a3)',
                    borderColor: activeTier
                      ? 'var(--tournament-purple-glow, #9d4edd)'
                      : 'var(--border, #1c232c)',
                  }}
                  className={cn(
                    'rounded-md border py-1 font-mono text-[10px] font-semibold',
                    activeTier
                      ? 'border-arena bg-arena-surface text-arena'
                      : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tierLabel(t)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="preview-pos-podium"
            disabled={!running}
            onClick={run(() => arena.preview.simulatePosition(1))}
            style={itemStyle}
            className={item}
          >
            <Trophy className="size-4 text-bonus" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Simular Podio (#1)' : 'Simular Pódio (#1)'}
          </button>
          <button
            type="button"
            data-testid="preview-pos-bubble-itm"
            disabled={!running}
            onClick={run(() => arena.preview.simulatePosition(cutoff))}
            style={itemStyle}
            className={item}
          >
            <Target className="size-4 text-primary" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? `Simular Burbuja ITM (#${cutoff})` : `Simular Bolha ITM (#${cutoff})`}
          </button>
          <button
            type="button"
            data-testid="preview-pos-bubble-out"
            disabled={!running}
            onClick={run(() => arena.preview.simulatePosition(cutoff + 1))}
            style={itemStyle}
            className={item}
          >
            <Target className="size-4 text-arena" strokeWidth={1.8} aria-hidden="true" />
            {isEs
              ? `Simular Fuera de Burbuja (#${cutoff + 1})`
              : `Simular Fora da Bolha (#${cutoff + 1})`}
          </button>

          <div className="my-1 border-t border-border" />
          <button
            type="button"
            data-testid="preview-leave"
            onClick={run(arena.leave)}
            style={itemStyle}
            className={item}
          >
            <LogOut className="size-4 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            {isEs ? 'Volver al lobby' : 'Voltar ao lobby'}
          </button>
        </div>
      )}
    </div>
  );
}

export function TournamentBalance({ points, compact }: { points: number; compact?: boolean }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  return (
    <div
      data-testid="arena-tournament-balance"
      className="diamond-glow flex h-11 items-center gap-2.5 rounded-xl bg-arena-surface pr-3 pl-2.5"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-arena/20">
        <Gem className="size-4 text-arena" strokeWidth={1.8} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-tight">
        {!compact && (
          <span className="text-[10px] font-semibold tracking-[0.14em] text-arena uppercase">
            {isEs ? 'Cuenta torneo' : 'Conta torneio'}
          </span>
        )}
        <span className="font-mono text-base font-semibold text-foreground tabular-nums">
          {formatPoints(points, 2)}
        </span>
      </span>
    </div>
  );
}

export function ArenaBar({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { s, room } = arena;
  const clock = arenaClock(arena);
  const alert = s.stage === 'running' && clock.tradesFrozen;
  const rawRoomLabel: string = room.label;
  const localizedRoomLabel = isEs
    ? rawRoomLabel === 'Sala Bronze'
      ? 'Sala Bronce'
      : rawRoomLabel === 'Sala Prata'
      ? 'Sala Plata'
      : rawRoomLabel === 'Sala Ouro'
      ? 'Sala Oro'
      : rawRoomLabel
    : rawRoomLabel;

  return (
    <header
      data-testid="arena-bar"
      style={{ flexShrink: 0 }}
      className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 border-b border-border bg-background px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <span className="diamond-glow flex size-10 items-center justify-center rounded-xl bg-arena-surface">
          <Trophy className="size-5 text-arena" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight">
              Arena Blitz #{ARENA.number}
            </h1>
            <PhaseChip arena={arena} />
          </div>
          <p className="text-xs text-muted-foreground">
            {localizedRoomLabel} · {arena.asset.short} · {(room.rivals + 2).toLocaleString('pt-BR')}{' '}
            participantes
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground">
            {isEs ? 'Tiempo restante' : 'Tempo restante'}
          </span>
          <span
            role="timer"
            aria-label={isEs ? 'Tiempo restante del torneo' : 'Tempo restante do torneio'}
            className={cn(
              'font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums',
              alert && 'timer-alert text-alert'
            )}
          >
            {formatCountdown(clock.remainingSec)}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Wifi className="size-3" strokeWidth={2} aria-hidden="true" />
            {isEs
              ? `Reloj sincronizado · Δ ${Math.abs(s.clockOffsetMs)} ms`
              : `Relógio sincronizado · Δ ${Math.abs(s.clockOffsetMs)} ms`}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-muted-foreground">
            {isEs ? 'Premio actual' : 'Prêmio atual'}
          </span>
          <span className="font-mono text-2xl leading-none font-semibold tracking-tight tabular-nums">
            {formatUsd(s.poolCents)}
          </span>
          <span className="mt-1 text-[10px] text-muted-foreground">
            {s.tier === 'TOP_3'
              ? isEs
                ? 'Top 3 dividen 50 / 30 / 20%'
                : 'Top 3 dividem 50 / 30 / 20%'
              : isEs
              ? `${tierLabel(s.tier)} dividen 100% del bote`
              : `${tierLabel(s.tier)} dividem 100% do pote`}
          </span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <TournamentBalance points={s.points} />
        <PreviewMenu arena={arena} />
      </div>
    </header>
  );
}
