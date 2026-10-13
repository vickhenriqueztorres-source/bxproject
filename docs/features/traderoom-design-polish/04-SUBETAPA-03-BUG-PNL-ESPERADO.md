# Subetapa 03 — Bug: "Ganancia esperada" e P&L da aba

**Agentes:** bug-fix-agent (implementa) · financial-correctness-reviewer · compliance-risk-reviewer
**Skills:** 02-financial-invariants, 09-ai-failure-map, 06-testing-quality
**Problema:** P3 — **lógica, não visual**

## Sintoma (produção, 13/10 17:55)
6 contratos SUBE de $100 abertos; 4 acima do strike, 2 abaixo. A telemetria mostra **"GANANCIA ESPERADA −$600.00"** e a aba mostra **"−$600.00"**. Valor esperado se liquidasse agora: 4 × +$85 − 2 × $100 = **+$140.00**. O mesmo painel inferior diz "Ganancia potencial +$510.00" (soma de payouts máximos), então existem dois conceitos diferentes com nomes parecidos.

## Passo a passo (protocolo do bug-fix-agent)
1. **Reproduzir antes de tocar no código**: teste com os 6 contratos acima e preço atual 517.29 → hoje sai −600 (vermelho).
2. Localizar a causa: `PriceChart.tsx:~1095` (`netPnlMinor`, `isTradeWinning`) e `TerminalHeader.tsx:184-219`. Hipóteses a confirmar: preço de referência errado (ex.: strike vs último tick de outro ativo), comparação de direção invertida, ou soma de stakes como perda quando o preço está ausente.
3. Extrair uma função pura única `computeOpenPnlMinor(contracts, lastPriceBySymbol)` em `apps/web/src/lib/open-pnl.ts` usada pelos dois lugares (hoje são duas implementações).
4. Regras: inteiro em centavos; WIN provisório = `payout_minor − stake_minor` vindo do backend; LOSS provisório = `−stake_minor`; empate = 0; sem preço do ativo → contrato **fora** da soma e indicador "—".
5. Rótulo: "Resultado si cierra ahora" (texto curto ES) para não confundir com "Ganancia potencial".

## Arquivos (lista fechada)
`lib/open-pnl.ts` (novo), `lib/open-pnl.unit.test.ts` (novo), `chart/PriceChart.tsx` (só o cálculo), `components/header/TerminalHeader.tsx` (só o cálculo).

## Testes
| Tipo | Caso |
|---|---|
| Regressão do bug | cenário de produção acima → +14000 minor |
| Unidade | SUBE/BAJA × acima/abaixo/igual; contratos de ativos diferentes usam o preço do próprio ativo |
| Invariantes | só inteiros; nunca `float`; resultado nunca usa payout calculado no cliente (`* 0.85` proibido) |
| Caos | preço `NaN`/`undefined`/0; `stake_minor` como string; contrato sem `payout_minor`; lista vazia |
| Estresse | 10.000 contratos < 20 ms |
| Segurança | contrato de outro `user_id` na lista não é somado (defesa em profundidade) |
| Concordância | header e gráfico mostram o mesmo número para a mesma entrada |

## Critério de pronto
Teste do bug vermelho → verde; parecer do financial-correctness-reviewer.
