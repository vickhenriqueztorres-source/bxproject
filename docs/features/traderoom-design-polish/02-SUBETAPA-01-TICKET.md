# Subetapa 01 — Ticket (Monto, Expiración, Ganancia, SUBE/BAJA)

**Agentes:** surgical-frontend-agent · chief-visual-director · compliance-risk-reviewer · binmax-brand-agent
**Skills:** 21-designer-senior-binmax, 12-tokens-binmax, 13-textos-es, 17-mudanca-cirurgica
**Problemas:** P5, P6 (ticket)

## Objetivo
Ticket igual ao alvo (`alvo-binmax-principal.png`, coluna direita) e a `dashboard-ux.md` §D.

## Arquivos (lista fechada)
- `apps/web/src/trade/OrderTicket.tsx` (só o ramo binmax, nunca o legado de :902)
- `apps/web/src/styles.css` (bloco `.theme-binmax` do ticket)
- `apps/web/src/trade/subetapa-polish-01-ticket.unit.test.tsx` (novo)

## O que muda (só com a chave ligada)
1. Cada bloco (Monto, Expiración, Ganancia) vira um cartão `--bg-2` com raio 10px, padding 12px; rótulo 12px Geist, Aço, com ⓘ.
2. **Remover os chips 10/50/100/500** (proibidos na spec). O valor continua editável e com +/−.
3. Campos de Monto e Expiración: caixa `--bg-3`, valor 16px Geist Mono tabular, +/− com área ≥ 24px (D10).
4. Ganancia: "+85" com 40px peso 600 e "%" a 24px; "+$85.00" 18px — tudo Verde Ganancia.
5. SUBE/BAJA quase quadrados (altura ≥ 76px, mesma largura/altura), ícone 20px em cima, texto 15px 700. Verde `--profit` e vermelho `--loss` sólidos, sem gradiente, sem glow. Hover escurece 6%, active afunda 1px (100ms).
6. Estado desabilitado (compra travada / conexão caída): opacidade 0.45 + `cursor:not-allowed`, mesmo para os dois.

## O que NÃO muda
Handlers de clique, `Idempotency-Key`, cálculo e origem do payout, limites de valor, testids, textos.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | chave ligada: sem `stake-presets`; `ganancia-pct` contém "85" e "%"; `btn-sube` e `btn-baja` têm a mesma altura/largura declarada; cores = `var(--profit)` / `var(--loss)` |
| Unidade | chave desligada: HTML idêntico ao atual (snapshot gerado antes da mudança) |
| Compliance | SUBE e BAJA simétricos (mesmo tamanho, peso, raio); nenhum valor financeiro calculado diferente do backend |
| Segurança | Monto aceita só dígitos; colar `-5`, `1e9`, `<img>` → rejeitado/limitado como hoje |
| Estresse | 500 renderizações < 1500 ms; 200 cliques rápidos em + não ultrapassam o limite |
| Caos | payout ausente/`null` → mostra "—" sem quebrar; conexão caída → botões desabilitados |
| Regressão | suíte = linha de base; testes antigos que pedem os chips são atualizados com justificativa (spec §D) |
| Visual | prints 1920×1000 e 1366×768, chave on/off |

## Critério de pronto
Gate do plano geral + parecer do compliance.
