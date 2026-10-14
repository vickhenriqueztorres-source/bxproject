import React, { useState } from 'react';
import { Bot, Crown, Gem, Loader2, RotateCcw, Sparkles, TicketPercent } from 'lucide-react';
import {
  ARENA,
  BOT,
  formatCountdown,
  formatPoints,
  formatUsd,
  splitEntry,
} from './engine';
import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from './arena-ui';
import { arenaClock } from './ArenaBar';
import type { ArenaApi } from './use-arena';
import { useRouter } from '../router/RouterContext';
import { useUiLanguage } from '../i18n';
import { BinmaxDepositModal } from '../wallet/BinmaxDepositModal';
import { BinmaxWithdrawModal } from '../wallet/BinmaxWithdrawModal';

export function RebuyDialog({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { s } = arena;
  const [error, setError] = useState<string | null>(null);
  const open = arena.rebuyEligible && !s.rebuyDismissed;
  const clock = arenaClock(arena);
  const leftSec = Math.max(0, (ARENA.rebuyFreezeMs - clock.elapsed) / 1000);

  const confirm = async () => {
    setError(null);
    const res = await arena.rebuy();
    if (!res.ok) setError(res.error);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && arena.dismissRebuy()}>
      <DialogContent
        data-testid="arena-rebuy-dialog"
        className="gap-5 border border-arena-border bg-arena-surface p-6 sm:max-w-md"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="diamond-glow flex size-14 items-center justify-center rounded-2xl bg-background">
            <Gem className="size-7 text-arena" strokeWidth={1.5} aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-xl font-semibold tracking-tight text-balance">
              {isEs ? 'Vuelve a la disputa con T$ 1.000' : 'Volte para a disputa com T$ 1.000'}
            </DialogTitle>
            <DialogDescription className="leading-relaxed text-pretty">
              {isEs
                ? 'Tu saldo de torneo llegó a cero y no hay órdenes abiertas. Haz un rebuy y sigue disputando el bote de '
                : 'Seu saldo de torneio zerou e não há ordens abertas. Faça um rebuy e continue disputando o pote de '}
              <span className="font-semibold text-foreground">{formatUsd(s.poolCents)}</span>.
            </DialogDescription>
          </div>
        </div>

        <dl className="grid grid-cols-3 divide-x divide-arena-border rounded-xl border border-arena-border bg-background/60 text-center">
          <div className="flex flex-col gap-0.5 px-2 py-3">
            <dt className="text-[11px] text-muted-foreground">{isEs ? 'Costo' : 'Custo'}</dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {formatUsd(ARENA.rebuyPriceCents)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 px-2 py-3">
            <dt className="text-[11px] text-muted-foreground">Rebuys</dt>
            <dd
              data-testid="rebuy-dialog-counter"
              className="font-mono text-sm font-semibold tabular-nums"
            >
              {`${s.rebuys}/${ARENA.maxRebuys}`}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 px-2 py-3">
            <dt className="text-[11px] text-muted-foreground">
              {isEs ? 'Disponible por' : 'Disponível por'}
            </dt>
            <dd className="font-mono text-sm font-semibold tabular-nums">
              {formatCountdown(leftSec)}
            </dd>
          </div>
        </dl>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs"
          >
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            data-testid="rebuy-confirm-btn"
            onClick={confirm}
            disabled={s.rebuyPending}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-arena text-sm font-bold text-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground disabled:opacity-60"
          >
            {s.rebuyPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            {s.rebuyPending
              ? isEs ? 'Procesando…' : 'Processando…'
              : isEs
              ? `Hacer rebuy · ${formatUsd(ARENA.rebuyPriceCents)}`
              : `Fazer rebuy · ${formatUsd(ARENA.rebuyPriceCents)}`}
          </button>
          <button
            type="button"
            data-testid="rebuy-dismiss-btn"
            onClick={arena.dismissRebuy}
            className="h-10 rounded-xl text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-arena"
          >
            {isEs ? 'Ahora no' : 'Agora não'}
          </button>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          {isEs
            ? `${formatUsd(splitEntry(ARENA.rebuyPriceCents).pool)} de este rebuy entran directo al premio de la Arena.`
            : `${formatUsd(splitEntry(ARENA.rebuyPriceCents).pool)} deste rebuy entram direto no prêmio da Arena.`}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function BonusBadge({ eligible, isEs }: { eligible: boolean; isEs: boolean }) {
  if (!eligible) return null;
  return (
    <div
      data-testid="result-bonus-badge"
      className="flex items-start gap-3 rounded-xl border border-bonus/40 bg-bonus/10 p-3.5 text-left"
    >
      <Bot className="mt-0.5 size-5 shrink-0 text-bonus" strokeWidth={1.7} aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-bonus">
          {isEs ? `¡Superaste a ${BOT.name}!` : `Você superou o ${BOT.name}!`}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isEs
            ? `50% de bono liberado en la cuenta real. El saldo de bono queda disponible para retiro tras operar ${ARENA.rolloverX}x el monto.`
            : `50% de bônus liberado na conta real. O saldo de bônus fica disponível para saque após movimentar ${ARENA.rolloverX}x o valor.`}
        </p>
      </div>
    </div>
  );
}

type FinalKey = string | null;

export function ResultDialog({ arena }: { arena: ArenaApi }) {
  const { navigate } = useRouter();
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const result = arena.s.result;
  const [closed, setClosed] = useState<FinalKey>(null);
  const [cashierModal, setCashierModal] = useState<'deposit' | 'withdraw' | null>(null);

  const key = result ? `${arena.s.startsAt}` : null;
  const open = arena.s.stage === 'ended' && result !== null && closed !== key;

  if (!result && !cashierModal) return null;

  const podium = (result?.prizeCents ?? 0) > 0;
  const pct = result ? Math.round(result.percentile * 100) : 0;
  const close = () => setClosed(key);

  return (
    <>
      {result && (
        <Dialog open={open} onOpenChange={(o) => !o && close()}>
          <DialogContent
            data-testid="arena-result-dialog"
            className={cn(
              'gap-5 border p-6 sm:max-w-md',
              podium
                ? 'border-bonus/40 bg-surface'
                : 'border-arena-border bg-arena-surface'
            )}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <span
                className={cn(
                  'flex size-16 items-center justify-center rounded-2xl',
                  podium ? 'bg-bonus/15' : 'diamond-glow bg-background'
                )}
              >
                {podium ? (
                  <Crown className="size-8 text-bonus" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Sparkles className="size-8 text-arena" strokeWidth={1.5} aria-hidden="true" />
                )}
              </span>
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                  Arena Blitz #{ARENA.number} · {result.rank}º de {result.total}
                </span>
                <DialogTitle className="text-2xl font-semibold tracking-tight text-balance">
                  {podium
                    ? isEs
                      ? '¡Conquistaste el podio!'
                      : 'Você conquistou o pódio!'
                    : isEs
                    ? '¡Faltó muy poco!'
                    : 'Faltou muito pouco!'}
                </DialogTitle>
                <DialogDescription className="leading-relaxed text-pretty">
                  {podium ? (
                    isEs ? (
                      <>
                        {result.humanRank}º lugar con {formatPoints(result.points)}.{' '}
                        <span className="font-semibold text-foreground">
                          {formatUsd(result.prizeCents)}
                        </span>{' '}
                        ya fueron acreditados en tu saldo real.
                      </>
                    ) : (
                      <>
                        {result.humanRank}º lugar com {formatPoints(result.points)}.{' '}
                        <span className="font-semibold text-foreground">
                          {formatUsd(result.prizeCents)}
                        </span>{' '}
                        já foram creditados no seu saldo real.
                      </>
                    )
                  ) : isEs ? (
                    <>
                      Superaste al{' '}
                      <span className="font-semibold text-foreground">
                        {pct}% de los participantes
                      </span>{' '}
                      y terminaste con {formatPoints(result.points)}. Tu próximo podio puede
                      comenzar ahora.
                    </>
                  ) : (
                    <>
                      Você superou{' '}
                      <span className="font-semibold text-foreground">
                        {pct}% dos participantes
                      </span>{' '}
                      e terminou com {formatPoints(result.points)}. Seu próximo pódio pode
                      começar agora.
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            <BonusBadge eligible={result.bonusEligible} isEs={isEs} />

            {!podium && (
              <div
                data-testid="result-coupon-box"
                className="flex items-center gap-3 rounded-xl border border-dashed border-arena-border bg-background/60 p-3.5"
              >
                <TicketPercent
                  className="size-6 shrink-0 text-arena"
                  strokeWidth={1.6}
                  aria-hidden="true"
                />
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-arena uppercase">
                    {isEs ? 'Cupón exclusivo liberado' : 'Cupom exclusivo liberado'}
                  </span>
                  <span className="text-sm font-semibold">
                    {isEs
                      ? '100% de bono en el 1er depósito en cuenta real'
                      : '100% de bônus no 1º depósito na conta real'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {podium ? (
                <>
                  <button
                    type="button"
                    data-testid="result-real-account-btn"
                    onClick={() => {
                      close();
                      navigate('/operar');
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    {isEs ? 'Operar en cuenta real' : 'Operar na conta real'}
                  </button>
                  <button
                    type="button"
                    data-testid="result-withdraw-btn"
                    onClick={() => {
                      close();
                      setCashierModal('withdraw');
                    }}
                    className="h-11 rounded-xl border border-border text-sm font-medium outline-none hover:bg-raised focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {isEs ? 'Solicitar retiro' : 'Solicitar saque'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    data-testid="result-deposit-bonus-btn"
                    onClick={() => {
                      close();
                      setCashierModal('deposit');
                    }}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-arena text-sm font-bold text-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground"
                  >
                    {isEs ? 'Depositar con bono' : 'Depositar com bônus'}
                  </button>
                  <button
                    type="button"
                    data-testid="result-next-arena-btn"
                    onClick={arena.leave}
                    className="h-11 rounded-xl border border-arena-border text-sm font-medium outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-arena"
                  >
                    {isEs ? 'Entrar en la próxima Arena' : 'Entrar na próxima Arena'}
                  </button>
                </>
              )}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              {isEs
                ? `${BOT.name} terminó con ${formatPoints(result.botPoints)}.`
                : `${BOT.name} terminou com ${formatPoints(result.botPoints)}.`}
            </p>
          </DialogContent>
        </Dialog>
      )}

      {cashierModal === 'deposit' && (
        <BinmaxDepositModal
          isOpen={true}
          onClose={() => setCashierModal(null)}
        />
      )}
      {cashierModal === 'withdraw' && (
        <BinmaxWithdrawModal
          isOpen={true}
          onClose={() => setCashierModal(null)}
        />
      )}
    </>
  );
}
