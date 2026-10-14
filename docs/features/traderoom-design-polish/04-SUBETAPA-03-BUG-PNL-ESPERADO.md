# Subetapa 03 — Bug: preço congelado nas posições com símbolo legado

**Agentes:** bug-fix-agent (implementa) · financial-correctness-reviewer · compliance-risk-reviewer
**Skills:** 02-financial-invariants, 09-ai-failure-map, 06-testing-quality
**Tipo:** lógica, não visual

## Diagnóstico corrigido (13/10, captura das 17:55)

O plano original dizia que a telemetria "GANANCIA ESPERADA −$600.00" estava errada. **Estava certa.**

- Os 6 contratos SUBE têm strike 519.6277 e 519.4019; o preço atual era 517.29. Os 6 estavam perdendo: 6 × −$100 = −$600.
- O número errado era o da **gaveta do Portafolio**, que mostrava 4 posições "+$85.00".

## Causa raiz

1. O contrato guarda o símbolo legado `SYNTH_VOL_50`; o feed envia os ticks com o canônico `VOL_50` (`dev-live-feed.mjs` normaliza a inscrição e transmite `symbol: VOL_50`).
2. `MultiSymbolPriceTracker` (`feed/use-multi-symbol-price-feed.ts`) inscrevia só o símbolo literal. A chave `SYNTH_VOL_50` recebia um único valor no momento da inscrição e nunca mais era atualizada.
3. A gaveta lê `currentPrices[c.symbol]` → preço congelado no valor da abertura → posições "ganhando" que já estavam perdendo.

## Correção

O tracker inscreve o símbolo pedido **e** o canônico (`normalizeSymbol`), grava sempre na chave pedida e remove as duas inscrições no `destroy`/`setSymbols`. Um arquivo, sem tocar em valores financeiros e sem depender da chave `TRADEROOM_POLISH` (é correção de bug, vale para todos).

## Arquivos (lista fechada)
`feed/use-multi-symbol-price-feed.ts`, `feed/subetapa-polish-03-canonical-price.unit.test.ts` (novo)

## Testes
| Tipo | Caso |
|---|---|
| Reprodução do bug | `SYNTH_VOL_50` semeado a 519.6277 recebe tick `VOL_50` 517.2891 → chave legada = 517.2891 (vermelho antes, verde depois) |
| Unidade | semeio prefere o preço canônico mais recente; tick legado continua funcionando |
| Isolamento | tick de outro ativo não contamina a chave |
| Caos | ticks `NaN`/`invalid` não sobrescrevem o último preço válido |
| Vazamento | `destroy` e remoção da lista zeram as inscrições legada e canônica |
| Estresse | 36 ativos × 200 ticks canônicos < 500 ms |
| Regressão | `use-multi-symbol-price-feed.unit.test.ts` (9 casos) continua verde |

## Fica para a Subetapa 06 (gaveta)
A gaveta calcula o ganho como `Math.round(stake * 0.85)` em vez de usar o payout do contrato. Isso viola a regra "nunca `* 0.85` no cliente" (AGENTS.md §2) e será tratado junto com o visual da gaveta, com parecer do financial-correctness-reviewer.
