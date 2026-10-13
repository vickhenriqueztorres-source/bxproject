# Subetapa 00 — Fundação: Chave, Tokens Únicos e Harness

**Agentes:** surgical-frontend-agent (implementa) · binmax-brand-agent · regression-guardian-agent
**Skills:** 12-tokens-binmax, 17-mudanca-cirurgica, 06-testing-quality
**Problemas:** P1 (base para todos)

## Objetivo
Criar a infraestrutura que permite mudar a sala sem risco: chave `TRADEROOM_POLISH`, uma fonte única de cores para o código TS e scripts de regressão e de prints. **Nenhuma mudança visual nesta subetapa.**

## Arquivos (lista fechada)
- `apps/web/src/lib/feature-flags.ts` — adicionar `isTraderoomPolishEnabled()` / `setTraderoomPolishEnabled()`
- `apps/web/src/lib/design-tokens.ts` — adicionar `BM_COLOR` (profit, loss, prata, aço, superfícies) apontando para os valores do manual
- `apps/web/src/lib/traderoom-polish.unit.test.ts` (novo)
- `scratch/design-audit/compare-baseline.sh`, `scratch/design-audit/shot.cjs`

## Passo a passo
1. Escrever o teste (vermelho):
   - padrão ligado; `?polish=0` desliga; `?polish=1` liga; `localStorage.TRADEROOM_POLISH='false'` desliga; URL vence `localStorage`; override de memória vence tudo.
   - `localStorage` que lança exceção → não quebra, devolve padrão.
   - valores estranhos (`?polish=<script>`, `?polish=2`) → ignorados, padrão.
   - `BM_COLOR.profit === '#22C47A'`, `BM_COLOR.loss === '#F2545B'`, iguais aos de `tokens-precision.css` (lido do disco).
   - a chave é independente de `NEW_TRADEROOM`.
2. Implementar.
3. Script `compare-baseline.sh`: roda vitest, extrai `FAIL`, compara com `baseline-failing.txt`, sai ≠ 0 se houver falha nova.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | 8 casos de leitura da chave acima |
| Segurança | parâmetros maliciosos ignorados; nada é escrito no DOM a partir da URL |
| Caos | `localStorage` indisponível / lançando; `window` indefinido (SSR `renderToString`) |
| Estresse | 10.000 leituras da chave < 50 ms |
| Regressão | suíte completa = linha de base |

## Critério de pronto
Testes novos verdes, zero falha nova, `tsc` e `vite build` OK, print idêntico ao anterior.

## Desfazer
`git revert <commit>`.
