import React, { useState } from 'react';
import { Bot, Gem, Medal, Radar, Target } from 'lucide-react';
import {
  ARENA,
  BOT,
  formatPoints,
  formatUsd,
  podiumPrizes,
  prizePlaces,
  tierCutoffCount,
  tierLabel,
  tierPrizes,
  type PayoutTier,
  type Standing,
} from './engine';
import { cn } from './arena-ui';
import type { ArenaApi } from './use-arena';
import { useUiLanguage } from '../i18n';

const MEDAL = ['text-bonus', 'text-foreground', 'text-bonus/60'];
const VIEW_FILTERS = [
  { limit: 5, label: 'Top 5', tier: null },
  { limit: 10, label: 'Top 10', tier: 'TOP_10' as PayoutTier },
  { limit: 20, label: 'Top 20', tier: 'TOP_20' as PayoutTier },
  { limit: 30, label: 'Top 30', tier: 'TOP_30' as PayoutTier },
] as const;

function Row({
  s,
  rank,
  prize,
  isCutoffRow,
  isEs,
}: {
  s: Standing;
  rank: number;
  prize: number | null;
  isCutoffRow?: boolean;
  isEs: boolean;
}) {
  const you = s.kind === 'you';
  return (
    <tr
      data-testid={`leaderboard-row-${s.id}`}
      className={cn(
        'border-t border-border',
        you && 'bg-arena-surface',
        isCutoffRow && 'border-b-2 border-b-arena/60'
      )}
    >
      <td
        className={cn(
          'py-1.5 pl-3',
          you && 'shadow-[inset_2px_0_0_var(--tournament-purple-glow)]'
        )}
      >
        {rank <= 3 ? (
          <Medal
            className={cn('size-4', MEDAL[rank - 1])}
            strokeWidth={1.8}
            aria-label={`${rank}º lugar`}
          />
        ) : (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{rank}</span>
        )}
      </td>
      <td className="py-1.5">
        <span className="flex min-w-0 items-center gap-2">
          {s.kind === 'bot' ? (
            <span className="flex size-5 items-center justify-center rounded bg-bonus/15">
              <Bot className="size-3.5 text-bonus" strokeWidth={1.8} aria-hidden="true" />
            </span>
          ) : you ? (
            <span className="flex size-5 items-center justify-center rounded bg-arena/25">
              <Gem className="size-3 text-arena" strokeWidth={2} aria-hidden="true" />
            </span>
          ) : (
            <span className="rounded bg-raised px-1 py-0.5 font-mono text-[10px] text-muted-foreground">
              {s.country}
            </span>
          )}
          <span className={cn('truncate', you && 'font-semibold')}>
            {you ? (isEs ? 'Tú' : 'Você') : s.name}
          </span>
          {s.kind === 'bot' && (
            <span className="rounded bg-bonus/10 px-1 text-[10px] font-semibold text-bonus">
              {isEs ? 'BOT' : 'ROBÔ'}
            </span>
          )}
        </span>
      </td>
      <td
        style={{ whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '10px' }}
        className="py-1.5 px-2.5 text-right font-mono font-semibold whitespace-nowrap tabular-nums"
      >
        {formatPoints(s.points)}
      </td>
      <td
        data-testid={`leaderboard-prize-${s.id}`}
        style={{ whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '12px' }}
        className="py-1.5 pl-2.5 pr-3 text-right font-mono text-muted-foreground whitespace-nowrap tabular-nums"
      >
        {prize !== null ? <span className="text-foreground">{formatUsd(prize)}</span> : '—'}
      </td>
    </tr>
  );
}

export function Leaderboard({
  arena,
  initialLimit,
}: {
  arena: ArenaApi;
  initialLimit?: 5 | 10 | 20 | 30;
}) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const [viewLimit, setViewLimit] = useState<5 | 10 | 20 | 30>(initialLimit ?? 5);
  const list = arena.standings();
  const places = prizePlaces(list);
  const cutoff = tierCutoffCount(arena.s.tier);
  const { prizes } =
    arena.s.tier === 'TOP_3'
      ? podiumPrizes(arena.s.poolCents)
      : tierPrizes(arena.s.poolCents, arena.s.tier);

  const youIndex = list.findIndex((x) => x.kind === 'you');
  const top = list.slice(0, viewLimit);
  const bot = list.find((x) => x.kind === 'bot') ?? list[0];
  const you = list[youIndex] ?? list[0];
  const ahead = you.points > bot.points;
  const gap = Math.max(0, bot.points - you.points);

  const prizeOf = (st: Standing) => {
    const p = places.get(st.id);
    return p !== undefined && p < cutoff ? (prizes[p] ?? null) : null;
  };

  // Cálculo do Radar de Bolha ITM
  const humanList = list.filter((x) => x.kind !== 'bot');
  const youHumanRank = (places.get('you') ?? humanList.length) + 1;
  const inTheMoney = youHumanRank <= cutoff;
  const cutoffHuman = humanList[Math.min(cutoff - 1, humanList.length - 1)] ?? you;
  const outsideHuman = humanList[Math.min(cutoff, humanList.length - 1)] ?? you;
  const cutoffPrize = prizes[cutoff - 1] ?? prizes[prizes.length - 1] ?? 0;
  const gapToItm = inTheMoney
    ? Math.max(0, Math.round(you.points - outsideHuman.points))
    : Math.max(1, Math.ceil(cutoffHuman.points - you.points + 1));
  const progressPct = inTheMoney
    ? 100
    : Math.min(99, Math.max(10, Math.round((you.points / Math.max(1, cutoffHuman.points)) * 100)));

  return (
    <div className="flex flex-col gap-2.5" data-testid="arena-leaderboard">
      <div className="flex items-center justify-between gap-2">
        <span
          style={{ whiteSpace: 'nowrap' }}
          className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
        >
          Premiados: <strong className="text-foreground">{tierLabel(arena.s.tier)}</strong>
        </span>
        <div
          role="group"
          aria-label={isEs ? 'Filtro de posiciones del ranking' : 'Filtro de posições do ranking'}
          style={{
            backgroundColor: 'var(--surface, #0f1318)',
            borderColor: 'var(--border, #1c232c)',
          }}
          className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5"
        >
          {VIEW_FILTERS.map((f) => {
            const active = viewLimit === f.limit;
            return (
              <button
                key={f.limit}
                type="button"
                data-testid={`leaderboard-filter-top-${f.limit}`}
                onClick={() => {
                  setViewLimit(f.limit);
                  if (f.tier) {
                    arena.preview.setTier(f.tier);
                  }
                }}
                style={{
                  whiteSpace: 'nowrap',
                  backgroundColor: active
                    ? 'var(--tournament-purple-surface, #1a0b2e)'
                    : 'transparent',
                  color: active
                    ? 'var(--tournament-purple-glow, #9d4edd)'
                    : 'var(--muted-foreground, #8b95a3)',
                  border: active
                    ? '1px solid var(--tournament-purple-border, #5a189a)'
                    : '1px solid transparent',
                }}
                className={cn(
                  'rounded-md px-2 py-1 font-mono text-[11px] font-medium whitespace-nowrap outline-none transition-colors',
                  active
                    ? 'bg-arena-surface text-arena ring-1 ring-arena-border'
                    : 'bg-transparent text-muted-foreground hover:bg-raised hover:text-foreground'
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div
          data-testid="leaderboard-table-scroll"
          className="thin-scroll"
          style={{
            maxHeight: '235px',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          <table className="w-full text-sm">
            <caption className="sr-only">
              {isEs
                ? `Ranking en vivo: top ${viewLimit} y tu posición`
                : `Ranking ao vivo: top ${viewLimit} e sua posição`}
            </caption>
            <thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                backgroundColor: 'var(--surface, #0f1318)',
              }}
              className="sticky top-0 bg-surface text-left text-[11px] tracking-wide text-muted-foreground uppercase"
            >
              <tr>
                <th scope="col" className="w-10 py-1.5 pl-3 font-medium whitespace-nowrap">
                  #
                </th>
                <th scope="col" className="py-1.5 font-medium whitespace-nowrap">
                  Trader
                </th>
                <th
                  scope="col"
                  style={{ whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '10px' }}
                  className="py-1.5 px-2.5 text-right font-medium whitespace-nowrap"
                >
                  {isEs ? 'Puntos' : 'Pontos'}
                </th>
                <th
                  scope="col"
                  style={{ whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '12px' }}
                  className="py-1.5 pl-2.5 pr-3 text-right font-medium whitespace-nowrap"
                >
                  {isEs ? 'Premio' : 'Prêmio'}
                </th>
              </tr>
            </thead>
            <tbody>
              {top.map((st, i) => {
                const hPlace = places.get(st.id);
                const isCutoffRow = hPlace !== undefined && hPlace === cutoff - 1;
                return (
                  <Row
                    key={st.id}
                    s={st}
                    rank={i + 1}
                    prize={prizeOf(st)}
                    isCutoffRow={isCutoffRow}
                    isEs={isEs}
                  />
                );
              })}
              {youIndex >= viewLimit && (
                <>
                  <tr aria-hidden="true">
                    <td
                      colSpan={4}
                      className="border-t border-dashed border-border py-0.5 text-center text-xs leading-none text-muted-foreground"
                    >
                      ···
                    </td>
                  </tr>
                  <Row s={you} rank={youIndex + 1} prize={prizeOf(you)} isEs={isEs} />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Radar de Corte / Bolha ITM */}
      <div
        data-testid="leaderboard-bubble-radar"
        className={cn(
          'flex flex-col gap-1.5 rounded-xl border p-2.5',
          inTheMoney
            ? 'border-primary/30 bg-primary/5'
            : 'border-arena-border bg-arena-surface/70'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Radar
              className={cn('size-4', inTheMoney ? 'text-primary' : 'text-arena')}
              strokeWidth={1.8}
              aria-hidden="true"
            />
            Radar de Corte · {tierLabel(arena.s.tier)}
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums">
            {isEs ? 'Tú' : 'Você'}: #{youHumanRank} ({formatPoints(you.points)})
          </span>
        </div>
        {inTheMoney ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isEs
              ? `En zona de premiación (${formatUsd(prizeOf(you) ?? cutoffPrize)}). Ventaja sobre el corte (#${cutoff + 1}): `
              : `Na zona de premiação (${formatUsd(prizeOf(you) ?? cutoffPrize)}). Vantagem sobre o corte (#${cutoff + 1}): `}
            <strong className="font-mono text-primary">+{formatPoints(gapToItm)}</strong>.
          </p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isEs
              ? `Objetivo de corte (#${cutoff} ${cutoffHuman.name}): faltan `
              : `Alvo de corte (#${cutoff} ${cutoffHuman.name}): faltam `}
            <strong className="font-mono text-arena">{`+${formatPoints(gapToItm)}`}</strong>
            {isEs ? ' para entrar al premio de ' : ' para entrar no prêmio de '}
            <strong className="font-mono text-foreground">{formatUsd(cutoffPrize)}</strong>.
          </p>
        )}
        <div className="h-1.5 overflow-hidden rounded-full bg-raised">
          <div
            className={cn('h-full rounded-full', inTheMoney ? 'bg-primary' : 'bg-arena')}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Card Meta: supere Alpha_Quant */}
      <div
        data-testid="leaderboard-bot-challenge"
        className={cn(
          'flex gap-2.5 rounded-xl border p-2.5',
          !ahead ? 'border-bonus/30 bg-bonus/5' : 'border-primary/30 bg-primary/5'
        )}
      >
        <Target
          className={cn('mt-0.5 size-5 shrink-0', !ahead ? 'text-bonus' : 'text-primary')}
          strokeWidth={1.7}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          {!ahead ? (
            <p className="text-sm leading-snug font-semibold text-pretty">
              {isEs ? `Meta: supera a ${BOT.name} ` : `Meta: supere ${BOT.name} `}
              <span className="font-mono text-bonus">(+{formatPoints(gap + 1)})</span>
            </p>
          ) : (
            <p className="text-sm leading-snug font-semibold text-pretty">
              {isEs ? `Estás por delante de ${BOT.name}.` : `Você está à frente do ${BOT.name}.`}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
            {isEs ? (
              <>
                Termina por encima del bot{' '}
                <strong className="font-semibold text-foreground">y</strong> con más de{' '}
                {formatPoints(ARENA.initialPoints)} para ganar{' '}
                <strong className="font-semibold text-bonus">50% de bono</strong> en la cuenta
                real.
              </>
            ) : (
              <>
                Termine acima do robô{' '}
                <strong className="font-semibold text-foreground">e</strong> com mais de{' '}
                {formatPoints(ARENA.initialPoints)} para ganhar{' '}
                <strong className="font-semibold text-bonus">50% de bônus</strong> na conta real.
              </>
            )}
          </p>
          <div className="mt-1 flex gap-3 text-[11px]">
            <span
              className={cn(
                'flex items-center gap-1',
                you.points > bot.points ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  you.points > bot.points ? 'bg-primary' : 'bg-border'
                )}
                aria-hidden="true"
              />
              {isEs ? 'Por encima del bot' : 'Acima do robô'}
            </span>
            <span
              className={cn(
                'flex items-center gap-1',
                you.points > ARENA.initialPoints ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  you.points > ARENA.initialPoints ? 'bg-primary' : 'bg-border'
                )}
                aria-hidden="true"
              />
              {isEs ? 'Ganancia real' : 'Lucro real'}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {isEs
          ? 'Ranking actualizado cada 250 ms. En caso de empate, queda adelante quien alcanzó la puntuación primero. El bot es referencia y no ocupa posición premiada.'
          : 'Ranking atualizado a cada 250 ms. Em caso de empate, fica à frente quem atingiu a pontuação primeiro. O robô é referência e não ocupa posição premiada.'}
      </p>
    </div>
  );
}
