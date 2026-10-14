import React from 'react';
import { ARENA, formatClock, formatUsd } from './engine';
import type { ArenaApi, LedgerEvent } from './use-arena';
import { useUiLanguage } from '../i18n';

const LABEL_PT: Record<LedgerEvent['type'], string> = {
  BUY_IN: 'Entrada',
  REBUY: 'Rebuy',
  PRIZE_PAYOUT: 'Prêmio creditado',
  BONUS_PAYOUT: 'Bônus liberado',
};

const LABEL_ES: Record<LedgerEvent['type'], string> = {
  BUY_IN: 'Entrada',
  REBUY: 'Rebuy',
  PRIZE_PAYOUT: 'Premio acreditado',
  BONUS_PAYOUT: 'Bono liberado',
};

export const ARENA_RULES = [
  { label: 'Saldo inicial', value: 'T$ 1.000 de moeda de torneio, separada do seu saldo real.' },
  { label: 'Limite por ordem', value: 'Até 20% do saldo T$ atual. Mínimo de T$ 10.' },
  { label: 'Rebuy', value: 'US$ 3,00 por T$ 1.000. Até 3 por torneio, só com saldo zerado e nenhuma ordem aberta.' },
  { label: 'Freeze', value: 'Rebuy encerra aos 12:00. Novas ordens bloqueiam no último minuto.' },
  { label: 'Prêmio', value: '70% de cada entrada e rebuy forma o pote. Top 3 / 10 / 20 / 30 dividem 100% do prêmio.' },
  { label: 'Desempate', value: 'Com pontuação igual, fica à frente quem chegou nela primeiro.' },
  { label: 'Fair play', value: '1 participante por dispositivo e por rede. Operações opostas coordenadas desclassificam.' },
];

export const ARENA_RULES_ES = [
  { label: 'Saldo inicial', value: 'T$ 1.000 de moneda de torneo, separada de tu saldo real.' },
  { label: 'Límite por orden', value: 'Hasta 20% del saldo T$ actual. Mínimo de T$ 10.' },
  { label: 'Rebuy', value: 'US$ 3,00 por T$ 1.000. Hasta 3 por torneo, solo con saldo en cero y ninguna orden abierta.' },
  { label: 'Freeze', value: 'Rebuy cierra a los 12:00. Nuevas órdenes se bloquean en el último minuto.' },
  { label: 'Premio', value: '70% de cada entrada y rebuy forma el bote. Top 3 / 10 / 20 / 30 dividen 100% del premio.' },
  { label: 'Desempate', value: 'Con puntuación igual, queda adelante quien llegó primero.' },
  { label: 'Fair play', value: '1 participante por dispositivo y por red. Operaciones opuestas coordinadas descalifican.' },
];

export function getArenaRules(lang: 'pt' | 'es') {
  return lang === 'es' ? ARENA_RULES_ES : ARENA_RULES;
}

export function ArenaLedger({ arena }: { arena: ArenaApi }) {
  const uiLang = useUiLanguage('pt');
  const isEs = uiLang === 'es';
  const { ledger, rebuys } = arena.s;
  const spent = ledger
    .filter((e) => e.type === 'BUY_IN' || e.type === 'REBUY')
    .reduce((a, e) => a + e.amountCents, 0);
  const labelMap = isEs ? LABEL_ES : LABEL_PT;
  const rules = getArenaRules(uiLang);

  return (
    <div className="flex flex-col gap-5" data-testid="arena-ledger">
      <section aria-labelledby="ledger-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 id="ledger-title" className="text-sm font-semibold">
            {isEs ? 'Tu extracto en esta Arena' : 'Seu extrato nesta Arena'}
          </h3>
          <span className="text-[11px] text-muted-foreground">
            Rebuys {rebuys}/{ARENA.maxRebuys}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {ledger.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="flex flex-col">
                <span className="font-medium">{labelMap[e.type]}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {formatClock(e.at)}
                  {e.poolCents > 0 &&
                    (isEs
                      ? ` · ${formatUsd(e.poolCents)} para el premio`
                      : ` · ${formatUsd(e.poolCents)} para o prêmio`)}
                </span>
              </span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  e.type === 'PRIZE_PAYOUT' || e.type === 'BONUS_PAYOUT' ? 'text-primary' : ''
                }`}
              >
                {e.type === 'PRIZE_PAYOUT' || e.type === 'BONUS_PAYOUT' ? '+' : '−'}
                {formatUsd(e.amountCents)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground">
          {isEs
            ? `Total invertido: ${formatUsd(spent)} del saldo real.`
            : `Total investido: ${formatUsd(spent)} do saldo real.`}
        </p>
      </section>

      <section aria-labelledby="rules-title" className="flex flex-col gap-3">
        <h3 id="rules-title" className="text-sm font-semibold">
          {isEs ? 'Reglas de la Arena' : 'Regras da Arena'}
        </h3>
        <dl className="flex flex-col divide-y divide-border rounded-xl border border-border text-xs">
          {rules.map((r) => (
            <div key={r.label} className="grid grid-cols-[92px_1fr] gap-3 px-3 py-2.5">
              <dt className="font-medium">{r.label}</dt>
              <dd className="leading-relaxed text-muted-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
