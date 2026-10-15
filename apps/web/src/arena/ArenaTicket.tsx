import React, { useId, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Flame, Lock, Minus, Plus, RotateCcw } from 'lucide-react';
import {
  ARENA,
  formatCountdown,
  formatPoints,
  maxStake,
  MOMENTUM_BONUS_PCT,
  MOMENTUM_STREAK_THRESHOLD,
  type Direction,
} from './engine';
import { cn } from './arena-ui';
import { arenaClock } from './ArenaBar';
import type { ArenaApi } from './use-arena';
import { useUiLanguage } from '../i18n';

const PCTS = [0.05, 0.1, 0.2];

export function ArenaTicket({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { s, asset } = arena;
  const [stake, setStake] = useState(100);
  const [expiry, setExpiry] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ dir: Direction; key: number } | null>(null);
  const stakeId = useId();

  const clock = arenaClock(arena);
  const cap = maxStake(s.points);
  const effective = Math.max(0, Math.min(stake, cap));
  const running = s.stage === 'running';
  const blocked = !running || clock.tradesFrozen || cap < ARENA.minStake;
  const streakActive = (s.consecutiveWins ?? 0) >= MOMENTUM_STREAK_THRESHOLD - 1;
  const baseProfit = Math.round(effective * asset.payout * 100) / 100;
  const profit =
    (s.consecutiveWins ?? 0) >= MOMENTUM_STREAK_THRESHOLD
      ? Math.round(baseProfit * (1 + MOMENTUM_BONUS_PCT) * 100) / 100
      : baseProfit;

  const submit = (direction: Direction) => {
    const res = arena.place(direction, effective, expiry);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setFlash({ dir: direction, key: Date.now() });
  };

  const stepBtn =
    'flex size-10 shrink-0 items-center justify-center bg-transparent text-muted-foreground outline-none hover:bg-raised hover:text-foreground focus-visible:bg-raised focus-visible:text-foreground';

  return (
    <div
      data-testid="arena-ticket"
      style={{ flexShrink: 0 }}
      className="flex shrink-0 flex-col gap-3 border-t border-border bg-background p-3 sm:p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor={stakeId} className="text-muted-foreground">
              {isEs ? 'Monto de la orden' : 'Valor da ordem'}
            </label>
            <span
              data-testid="arena-max-stake-label"
              className="font-mono text-muted-foreground tabular-nums"
            >
              {`máx. ${formatPoints(cap)} · 20%`}
            </span>
          </div>
          <div
            style={{
              backgroundColor: 'var(--surface, #0f1318)',
              borderColor: 'var(--border, #1c232c)',
            }}
            className="flex items-center overflow-hidden rounded-lg border border-border bg-surface focus-within:border-arena"
          >
            <button
              type="button"
              aria-label={isEs ? 'Disminuir monto' : 'Diminuir valor'}
              data-testid="arena-stake-minus"
              onClick={() => setStake(Math.max(ARENA.minStake, effective - 10))}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground, #8b95a3)',
                borderRight: '1px solid var(--border, #1c232c)',
              }}
              className={cn(stepBtn, 'border-r border-border')}
            >
              <Minus className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1 bg-transparent">
              <span className="font-mono text-sm text-muted-foreground">T$</span>
              <input
                id={stakeId}
                data-testid="arena-stake-input"
                inputMode="numeric"
                value={effective}
                onChange={(e) => setStake(Number(e.target.value.replace(/\D/g, '')) || 0)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--foreground, #f2f4f7)',
                  border: 'none',
                }}
                className="w-16 bg-transparent text-center font-mono text-base font-semibold text-foreground tabular-nums outline-none"
              />
            </div>
            <button
              type="button"
              aria-label={isEs ? 'Aumentar monto' : 'Aumentar valor'}
              data-testid="arena-stake-plus"
              onClick={() => setStake(Math.min(cap, effective + 10))}
              style={{
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground, #8b95a3)',
                borderLeft: '1px solid var(--border, #1c232c)',
              }}
              className={cn(stepBtn, 'border-l border-border')}
            >
              <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">Rápido</span>
          <div className="flex gap-1">
            {PCTS.map((p) => {
              const v = Math.floor(s.points * p);
              const pctInt = Math.round(p * 100);
              const activePct = effective === v;
              return (
                <button
                  key={p}
                  type="button"
                  data-testid={`arena-quick-pct-${pctInt}`}
                  onClick={() => setStake(v)}
                  aria-pressed={activePct}
                  style={{
                    backgroundColor: activePct
                      ? 'var(--tournament-purple-surface, #1a0b2e)'
                      : 'var(--surface, #0f1318)',
                    color: activePct
                      ? 'var(--tournament-purple-glow, #9d4edd)'
                      : 'var(--muted-foreground, #8b95a3)',
                    borderColor: activePct
                      ? 'var(--tournament-purple-border, #5a189a)'
                      : 'var(--border, #1c232c)',
                  }}
                  className={cn(
                    'h-10 rounded-lg border px-3 font-mono text-xs font-medium tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-arena',
                    activePct
                      ? 'border-arena-border bg-arena-surface text-arena'
                      : 'border-border bg-surface text-muted-foreground hover:bg-raised hover:text-foreground'
                  )}
                >
                  {pctInt}%
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="arena-expiry" className="text-xs text-muted-foreground">
            {isEs ? 'Expiración' : 'Expiração'}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="arena-expiry"
            style={{
              backgroundColor: 'var(--surface, #0f1318)',
              borderColor: 'var(--border, #1c232c)',
            }}
            className="flex h-10 items-center rounded-lg border border-border bg-surface p-0.5"
          >
            {ARENA.expiries.map((e) => {
              const activeExp = expiry === e;
              return (
                <button
                  key={e}
                  type="button"
                  role="radio"
                  aria-checked={activeExp}
                  data-testid={`arena-expiry-${e}`}
                  onClick={() => setExpiry(e)}
                  style={{
                    backgroundColor: activeExp ? 'var(--raised, #161b22)' : 'transparent',
                    color: activeExp
                      ? 'var(--foreground, #f2f4f7)'
                      : 'var(--muted-foreground, #8b95a3)',
                    border: activeExp ? '1px solid var(--border, #1c232c)' : '1px solid transparent',
                  }}
                  className={cn(
                    'flex h-full min-w-12 items-center justify-center rounded-md px-2 font-mono text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-arena',
                    activeExp
                      ? 'bg-raised text-foreground ring-1 ring-border'
                      : 'bg-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {formatCountdown(e)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted-foreground">
            {isEs ? 'Si aciertas' : 'Se acertar'}
          </span>
          <span
            data-testid="arena-expected-profit"
            className="flex h-10 items-center font-mono text-base font-semibold text-primary tabular-nums"
          >
            +{formatPoints(profit, 2)}{' '}
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({Math.round(asset.payout * 100)}%)
            </span>
          </span>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 lg:w-auto lg:min-w-72">
          <button
            key={flash?.dir === 'up' ? flash.key : 'up'}
            type="button"
            data-testid="arena-btn-up"
            disabled={blocked}
            onClick={() => submit('up')}
            style={{
              backgroundColor: 'var(--primary, #22c55e)',
              color: 'var(--primary-foreground, #07090c)',
              border: 'none',
            }}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold tracking-wide text-primary-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:saturate-0',
              flash?.dir === 'up' && 'trade-flash-up'
            )}
          >
            <ArrowUpRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
            {isEs ? 'SUBE' : 'ACIMA'}
          </button>
          <button
            key={flash?.dir === 'down' ? flash.key : 'down'}
            type="button"
            data-testid="arena-btn-down"
            disabled={blocked}
            onClick={() => submit('down')}
            style={{
              backgroundColor: 'var(--destructive, #e5484d)',
              color: 'var(--foreground, #f2f4f7)',
              border: 'none',
            }}
            className={cn(
              'flex h-12 items-center justify-center gap-2 rounded-lg bg-destructive text-sm font-bold tracking-wide text-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:saturate-0',
              flash?.dir === 'down' && 'trade-flash-down'
            )}
          >
            <ArrowDownRight className="size-5" strokeWidth={2.2} aria-hidden="true" />
            {isEs ? 'BAJA' : 'ABAIXO'}
          </button>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-wrap items-center gap-2 empty:hidden">
        {error && (
          <p
            role="alert"
            data-testid="arena-ticket-error"
            className="platform-rise rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs"
          >
            {error}
          </p>
        )}
        {streakActive && (
          <span
            data-testid="arena-momentum-streak"
            className="inline-flex items-center gap-1.5 rounded-lg border border-bonus/30 bg-bonus/10 px-3 py-1.5 font-mono text-xs font-semibold text-bonus"
          >
            <Flame className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {(s.consecutiveWins ?? 0) >= MOMENTUM_STREAK_THRESHOLD
              ? isEs
                ? 'Momentum Streak 3x Activo (+15% bono T$)'
                : `Momentum Streak 3x Ativo (+15% bônus T$)`
              : isEs
              ? `Racha Táctica: ${s.consecutiveWins}/${MOMENTUM_STREAK_THRESHOLD} (próximo acierto +15%)`
              : `Sequência Tática: ${s.consecutiveWins}/${MOMENTUM_STREAK_THRESHOLD} (próximo acerto +15%)`}
          </span>
        )}
        {running && clock.tradesFrozen && (
          <p
            data-testid="arena-trades-frozen-notice"
            className="flex items-center gap-1.5 rounded-lg border border-alert/40 bg-alert/10 px-3 py-1.5 text-xs text-alert"
          >
            <Lock className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {isEs
              ? 'Último minuto: nuevas órdenes bloqueadas. Las abiertas liquidan normalmente.'
              : 'Último minuto: novas ordens bloqueadas. As abertas liquidam normalmente.'}
          </p>
        )}
        {arena.rebuyEligible && (
          <button
            type="button"
            data-testid="arena-rebuy-trigger"
            onClick={arena.reopenRebuy}
            className="flex items-center gap-1.5 rounded-lg border border-arena-border bg-arena-surface px-3 py-1.5 text-xs font-semibold text-arena outline-none focus-visible:ring-2 focus-visible:ring-arena"
          >
            <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {isEs ? 'Saldo en cero · hacer rebuy' : 'Saldo zerado · fazer rebuy'}
          </button>
        )}
        {running && s.points < ARENA.minStake && s.positions.length > 0 && (
          <p className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
            {isEs
              ? 'Espera a que tus órdenes abiertas liquiden antes del rebuy.'
              : 'Aguarde suas ordens abertas liquidarem antes do rebuy.'}
          </p>
        )}
        {s.positions.map((p) => (
          <span
            key={p.id}
            data-testid={`arena-open-position-${p.id}`}
            className={cn(
              'inline-flex h-8 items-center gap-2 rounded-lg border px-2.5 font-mono text-xs tabular-nums',
              p.direction === 'up'
                ? 'border-primary/40 text-primary'
                : 'border-destructive/40 text-destructive'
            )}
          >
            {p.direction === 'up' ? (
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="size-3.5" aria-hidden="true" />
            )}
            {formatPoints(p.amount)}
            <span className="text-muted-foreground">
              {formatCountdown((p.expiresAt - Date.now()) / 1000)}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
