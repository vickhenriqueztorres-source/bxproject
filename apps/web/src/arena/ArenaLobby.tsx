import React, { useState } from 'react';
import { ArrowRight, Bot, Fingerprint, Gem, Users } from 'lucide-react';
import {
  ARENA,
  BOT,
  BUY_INS,
  formatUsd,
  podiumPrizes,
  splitEntry,
  tierCutoffCount,
  tierLabel,
  tierPrizes,
  type PayoutTier,
} from './engine';
import { cn, PageShell, Panel } from './arena-ui';
import { ARENA_RULES, getArenaRules } from './ArenaLedger';
import { useUiLanguage } from '../i18n';

const STEPS_PT = [
  {
    title: 'Escolha a sala',
    text: 'Pague a entrada com o saldo real e receba T$ 1.000 de moeda de torneio.',
  },
  {
    title: 'Opere por 15 minutos',
    text: 'Cada ordem usa até 20% do saldo T$. Zerou? Até 3 rebuys de US$ 3,00.',
  },
  {
    title: 'Suba no ranking',
    text: 'A pontuação é o seu saldo T$, atualizado ao vivo a cada liquidação.',
  },
  {
    title: 'Receba no saldo real',
    text: 'Os melhores colocados dividem o pote em dólar, creditado na hora do encerramento.',
  },
];

const STEPS_ES = [
  {
    title: 'Elige la sala',
    text: 'Paga la entrada con saldo real y recibe T$ 1.000 de moneda de torneo.',
  },
  {
    title: 'Opera por 15 minutos',
    text: 'Cada orden usa hasta 20% del saldo T$. ¿Cero? Hasta 3 rebuys de US$ 3,00.',
  },
  {
    title: 'Sube en el ranking',
    text: 'La puntuación es tu saldo T$, actualizado en vivo en cada liquidación.',
  },
  {
    title: 'Recibe en saldo real',
    text: 'Los mejores clasificados dividen el bote en dólares, acreditado al finalizar.',
  },
];

const TIERS: { id: PayoutTier; label: string }[] = [
  { id: 'TOP_3', label: 'Top 3' },
  { id: 'TOP_10', label: 'Top 10' },
  { id: 'TOP_20', label: 'Top 20' },
  { id: 'TOP_30', label: 'Top 30' },
];

export interface ArenaLobbyProps {
  onJoin: (roomIndex: number, tier?: PayoutTier) => void;
  initialRoomIndex?: number;
  initialTier?: PayoutTier;
}

function localizeRoomLabel(label: string, isEs: boolean): string {
  if (!isEs) return label;
  if (label === 'Sala Bronze') return 'Sala Bronce';
  if (label === 'Sala Prata') return 'Sala Plata';
  if (label === 'Sala Ouro') return 'Sala Oro';
  return label;
}

export function ArenaLobby({
  onJoin,
  initialRoomIndex = 0,
  initialTier = 'TOP_3',
}: ArenaLobbyProps) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const [room, setRoom] = useState(initialRoomIndex);
  const [tier, setTier] = useState<PayoutTier>(initialTier);
  const selected = BUY_INS[room] ?? BUY_INS[0];
  const pool = (selected.rivals + 1) * splitEntry(selected.cents).pool;
  const { prizes } = tier === 'TOP_3' ? podiumPrizes(pool) : tierPrizes(pool, tier);
  const cutoff = tierCutoffCount(tier);
  const steps = isEs ? STEPS_ES : STEPS_PT;
  const rules = getArenaRules ? getArenaRules(uiLang) : ARENA_RULES;

  return (
    <PageShell>
      <section
        aria-labelledby="arena-title"
        data-testid="arena-lobby-hero"
        className="platform-rise diamond-glow relative overflow-hidden rounded-2xl bg-arena-surface"
      >
        <img
          src="/images/arena-diamond.png"
          alt=""
          loading="eager"
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-70"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-arena-surface via-arena-surface/90 to-transparent" />
        <div className="relative z-10 flex flex-col gap-8 p-6 sm:p-10 lg:max-w-[66%]">
          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-md bg-background/50 px-2 py-1 font-mono text-[11px] font-semibold tracking-[0.2em] text-arena uppercase">
              <Gem className="size-3.5" strokeWidth={2} aria-hidden="true" />
              Binmax Arena · Blitz #{ARENA.number}
            </span>
            <h1
              id="arena-title"
              className="text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl"
            >
              {isEs
                ? '15 minutos. T$ 1.000. El podio se lleva el bote.'
                : '15 minutos. T$ 1.000. O pódio leva o pote.'}
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-pretty text-muted-foreground">
              {isEs
                ? `Disputa contra traders reales y contra ${BOT.name}, un bot auditable que opera el mismo feed que tú. Los mejores clasificados (${tierLabel(tier)}) dividen el premio en dólares.`
                : `Dispute contra traders reais e contra o ${BOT.name}, um robô auditável que opera o mesmo feed que você. Os melhores colocados (${tierLabel(tier)}) dividem o prêmio em dólar.`}
            </p>
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-semibold">
              {isEs ? 'Elige tu sala' : 'Escolha sua sala'}
            </legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {BUY_INS.map((r, i) => {
                const rPool = (r.rivals + 1) * splitEntry(r.cents).pool;
                const active = room === i;
                return (
                  <label
                    key={r.cents}
                    data-testid={`arena-room-card-${i}`}
                    onClick={() => setRoom(i)}
                    className={cn(
                      'flex cursor-pointer flex-col gap-3 rounded-xl border bg-background/75 p-4 backdrop-blur transition-colors duration-150 has-focus-visible:ring-2 has-focus-visible:ring-arena',
                      active ? 'border-arena' : 'border-arena-border hover:border-arena/60'
                    )}
                  >
                    <input
                      type="radio"
                      name="arena-room"
                      value={i}
                      checked={active}
                      onChange={() => setRoom(i)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold whitespace-nowrap">
                        {localizeRoomLabel(r.label, isEs)}
                      </span>
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-arena' : 'border-muted-foreground'
                        )}
                        aria-hidden="true"
                      >
                        {active && <span className="size-2 rounded-full bg-arena" />}
                      </span>
                    </span>
                    <span className="flex items-end justify-between gap-3">
                      <span className="flex flex-col">
                        <span className="text-[11px] text-muted-foreground">Entrada</span>
                        <span className="font-mono text-xl font-semibold whitespace-nowrap tabular-nums">
                          {formatUsd(r.cents)}
                        </span>
                      </span>
                      <span className="flex flex-col items-end">
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {isEs ? 'Bote actual' : 'Pote atual'}
                        </span>
                        <span
                          data-testid={`arena-room-pool-${i}`}
                          className="font-mono text-sm font-semibold text-bonus whitespace-nowrap tabular-nums"
                        >
                          {formatUsd(rPool)}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                      {isEs
                        ? `${r.rivals} inscritos · inscripciones abiertas`
                        : `${r.rivals} inscritos · inscrições abertas`}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {isEs ? 'Franja de premiación (ITM)' : 'Faixa de premiação (ITM)'}
            </span>
            <div
              role="radiogroup"
              aria-label={isEs ? 'Franja de premiación' : 'Faixa de premiação'}
              className="flex flex-wrap gap-2"
            >
              {TIERS.map((t) => {
                const active = tier === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`lobby-tier-${t.id}`}
                    onClick={() => setTier(t.id)}
                    style={{
                      backgroundColor: active
                        ? 'var(--tournament-purple-surface, #1a0b2e)'
                        : 'rgba(7, 9, 12, 0.6)',
                      color: active
                        ? 'var(--tournament-purple-glow, #9d4edd)'
                        : 'var(--muted-foreground, #8b95a3)',
                      borderColor: active
                        ? 'var(--tournament-purple-glow, #9d4edd)'
                        : 'var(--tournament-purple-border, #5a189a)',
                    }}
                    className={cn(
                      'h-9 rounded-lg border px-3 font-mono text-xs font-semibold outline-none transition-colors',
                      active
                        ? 'border-arena bg-arena-surface text-arena'
                        : 'border-arena-border bg-background/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              data-testid="arena-join-btn"
              onClick={() => onJoin(room, tier)}
              style={{
                backgroundColor: 'var(--tournament-purple-glow, #9d4edd)',
                color: 'var(--foreground, #f2f4f7)',
                border: 'none',
              }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-arena px-6 text-sm font-bold text-foreground outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-foreground"
            >
              Entrar por {formatUsd(selected.cents)}
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
              {isEs
                ? `Debitado del saldo real. ${formatUsd(splitEntry(selected.cents).pool)} van directo al premio.`
                : `Debitado do saldo real. ${formatUsd(splitEntry(selected.cents).pool)} vão direto para o prêmio.`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={isEs ? 'Cómo funciona' : 'Como funciona'} style={{ animationDelay: '80ms' }}>
          <ol className="flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-arena-surface font-mono text-xs font-semibold text-arena ring-1 ring-arena-border">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {step.text}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={isEs ? 'Distribución del bote' : 'Distribuição do pote'} style={{ animationDelay: '120ms' }}>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {isEs ? 'Bote estimado de la ' : 'Pote estimado da '}
            {localizeRoomLabel(selected.label, isEs)} ({tierLabel(tier)}):{' '}
            <span data-testid="lobby-estimated-pool" className="font-mono font-semibold text-foreground">
              {formatUsd(pool)}
            </span>
            {isEs
              ? '. Crece con cada nueva entrada y rebuy.'
              : '. Cresce a cada nova entrada e rebuy.'}
          </p>
          <ul className="flex flex-col gap-3">
            {ARENA.podium.map((w, i) => (
              <li key={w} className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between text-sm">
                  <span className="font-medium">{i + 1}º lugar</span>
                  <span className="font-mono font-semibold tabular-nums">
                    {formatUsd(prizes[i] ?? 0)}
                  </span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-raised">
                  <span
                    className={cn(
                      'block h-full rounded-full',
                      i === 0 ? 'bg-bonus' : 'bg-arena'
                    )}
                    style={{ width: `${w * 100 * 2}%` }}
                  />
                </span>
              </li>
            ))}
            {cutoff > 3 && (
              <li
                data-testid="lobby-cutoff-places"
                className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground"
              >
                <span>
                  {isEs ? `4º al ${cutoff}º lugar (ITM)` : `4º ao ${cutoff}º lugar (ITM)`}
                </span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {isEs ? 'hasta ' : 'até '}
                  {formatUsd(prizes[3] ?? 0)} / pos.
                </span>
              </li>
            )}
          </ul>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {isEs
              ? 'Centavos residuales de la división retornan a la casa para cerrar el bote en cero.'
              : 'Centavos residuais da divisão retornam à casa para fechar o pote em zero.'}
          </p>
        </Panel>

        <Panel title={isEs ? 'Desafío Alpha Quant' : 'Desafio Alpha Quant'} style={{ animationDelay: '160ms' }}>
          <div className="flex items-start gap-3 rounded-xl border border-bonus/30 bg-bonus/5 p-3.5">
            <Bot className="mt-0.5 size-5 shrink-0 text-bonus" strokeWidth={1.7} aria-hidden="true" />
            <p className="text-sm leading-relaxed text-pretty">
              {isEs ? (
                <>
                  Termina <strong className="font-semibold">por encima del bot</strong> y con{' '}
                  <strong className="font-semibold">más de T$ 1.000</strong> y gana{' '}
                  <strong className="font-semibold text-bonus">50% de bono</strong> en la cuenta real.
                </>
              ) : (
                <>
                  Termine <strong className="font-semibold">acima do robô</strong> e com{' '}
                  <strong className="font-semibold">mais de T$ 1.000</strong> e ganhe{' '}
                  <strong className="font-semibold text-bonus">50% de bônus</strong> na conta real.
                </>
              )}
            </p>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>
              {isEs
                ? 'Estrategia pública: cruce EMA 9 / EMA 21 con momentum.'
                : 'Estratégia pública: cruzamento EMA 9 / EMA 21 com momentum.'}
            </li>
            <li>
              {isEs
                ? '3% de riesgo fijo por orden con Soros nivel 2.'
                : '3% de risco fixo por ordem com Soros nível 2.'}
            </li>
            <li>
              {isEs
                ? 'Historial completo visible en la pestaña Bot durante la partida.'
                : 'Histórico completo visível na aba Robô durante a partida.'}
            </li>
          </ul>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {isEs
              ? `Bono con rollover de ${ARENA.rolloverX}x antes del retiro.`
              : `Bônus com rollover de ${ARENA.rolloverX}x antes do saque.`}
          </p>
        </Panel>
      </div>

      <Panel title={isEs ? 'Reglas' : 'Regras'} style={{ animationDelay: '200ms' }}>
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          {rules.map((r) => (
            <div key={r.label} className="flex flex-col gap-0.5 border-t border-border pt-3">
              <dt className="font-medium">{r.label}</dt>
              <dd className="leading-relaxed text-muted-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Fingerprint className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {isEs
            ? 'Para mantener la disputa justa, cada sala acepta un participante por dispositivo y por red.'
            : 'Para manter a disputa justa, cada sala aceita um participante por dispositivo e por rede.'}
        </p>
      </Panel>
    </PageShell>
  );
}
