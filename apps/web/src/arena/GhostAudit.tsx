import React from 'react';
import { ArrowDownRight, ArrowUpRight, Bot, Hourglass } from 'lucide-react';
import { ARENA, BOT, formatClock, formatCountdown, formatPoints, formatPrice } from './engine';
import { cn } from './arena-ui';
import type { ArenaApi } from './use-arena';
import { useUiLanguage } from '../i18n';

export function GhostAudit({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { bot } = arena.s;
  const closed = bot.trades.filter((t) => t.result);
  const wins = closed.filter((t) => t.result === 'win').length;
  const digits = arena.asset.digits;
  const change = bot.points - ARENA.initialPoints;

  return (
    <div className="flex flex-col gap-4" data-testid="arena-ghost-audit">
      <div className="flex flex-col gap-3 rounded-xl border border-bonus/25 bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-bonus/15">
            <Bot className="size-5 text-bonus" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <div className="flex flex-1 flex-col">
            <h3 className="text-sm font-semibold">{BOT.name} · Alpha Quant Index</h3>
            <p className="text-xs text-muted-foreground">
              {isEs
                ? 'Mismo feed y misma liquidación que tú. Sin ticks anticipados.'
                : 'Mesmo feed e mesma liquidação que você. Sem ticks antecipados.'}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted-foreground">
              {isEs ? 'Puntos' : 'Pontos'}
            </dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {formatPoints(bot.points)}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted-foreground">Resultado</dt>
            <dd
              className={cn(
                'font-mono text-sm font-semibold tabular-nums',
                change >= 0 ? 'text-primary' : 'text-destructive'
              )}
            >
              {change >= 0 ? '+' : '−'}
              {formatPoints(Math.abs(change))}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] text-muted-foreground">
              {isEs ? 'Aciertos' : 'Acertos'}
            </dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {wins}/{closed.length}
            </dd>
          </div>
        </dl>
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <li>
            <span className="text-foreground">{isEs ? 'Señal:' : 'Sinal:'}</span> EMA 9 × EMA 21 + momentum
          </li>
          <li>
            <span className="text-foreground">{isEs ? 'Riesgo:' : 'Risco:'}</span>{' '}
            {isEs ? '3% fijo por orden' : '3% fixo por ordem'}
          </li>
          <li>
            <span className="text-foreground">{isEs ? 'Gestión:' : 'Gestão:'}</span>{' '}
            {isEs ? 'Soros nivel 2' : 'Soros nível 2'}
          </li>
          <li>
            <span className="text-foreground">Ritmo:</span>{' '}
            {isEs ? '1 orden cada 45–75 s' : '1 ordem a cada 45–75 s'}
          </li>
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {isEs ? 'Historial de órdenes' : 'Histórico de ordens'}
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {isEs
            ? `${bot.skipped} verificaciones sin señal`
            : `${bot.skipped} verificações sem sinal`}
        </span>
      </div>

      {bot.trades.length === 0 ? (
        <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          <Hourglass className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {isEs
            ? 'El bot está esperando una señal válida para la primera orden.'
            : 'O robô está aguardando um sinal válido para a primeira ordem.'}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {bot.trades.map((t) => (
            <li key={t.id} className="flex flex-col gap-1.5 px-3 py-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'flex items-center gap-1.5 font-semibold',
                    t.direction === 'up' ? 'text-primary' : 'text-destructive'
                  )}
                >
                  {t.direction === 'up' ? (
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowDownRight className="size-3.5" aria-hidden="true" />
                  )}
                  {t.direction === 'up'
                    ? isEs ? 'Sube' : 'Acima'
                    : isEs ? 'Baja' : 'Abaixo'}{' '}
                  · {formatPoints(t.stake)}
                  {t.sorosLevel > 0 && (
                    <span className="rounded bg-bonus/10 px-1 text-[10px] text-bonus">
                      Soros {t.sorosLevel}
                    </span>
                  )}
                </span>
                {t.result ? (
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      t.result === 'win'
                        ? 'text-primary'
                        : t.result === 'loss'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    {t.result === 'win' ? '+' : t.result === 'loss' ? '−' : ''}
                    {formatPoints(Math.abs(t.profit ?? 0), 2)}
                  </span>
                ) : (
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {formatCountdown((t.expiresAt - Date.now()) / 1000)}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground tabular-nums">
                <span>
                  {formatClock(t.openedAt)} · {formatPrice(t.openPrice, digits)}
                  {t.closePrice !== undefined && ` → ${formatPrice(t.closePrice, digits)}`}
                </span>
                <span>
                  EMA9 {formatPrice(t.ema9, digits)} / EMA21 {formatPrice(t.ema21, digits)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
