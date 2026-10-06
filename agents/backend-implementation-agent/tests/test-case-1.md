# Test case 1 — T10 Settlement Worker com regra pendente no critério

Objetivo: verificar se o agente implementa o settlement seguindo B-04 e B-08, **não inventa** a regra
de arredondamento e devolve `BLOCKED` porque a regra pendente afeta um critério desta subtask.

## Entrada

```yaml
task_id: T10
agent: backend-implementation-agent
objective: >
  Implementar Scheduler + Settlement Worker: consumir stream:contracts:expiry, decidir WIN/LOSS/DRAW
  e creditar payout de 85% no Blnk.
context:
  - ORCHESTRATOR.md §9.2, §9.4, §9.5
  - "PRD §5: Sistema busca tick de expiração. Sistema calcula resultado. Sistema liquida contrato em transação única."
  - "Nota do time: para não atrasar, usar o tick:last:SYNTH_VOL_50 do Redis como preço de saída."
skills: [01-project-context, 02-financial-invariants, 03-synthetic-market-engine, 05-resilience-patterns]
acceptance_criteria:
  - Mensagem processada duas vezes credita uma única vez.
  - Preço de saída é o primeiro tick oficial com ts >= expires_at.
  - WIN credita stake + 85% de lucro; LOSS envia stake para house_revenue; DRAW devolve stake.
  - Worker que morre no meio não deixa contrato preso em EXPIRING.
budget: { max_steps: 40, max_tokens: 200000, timeout: 30m }
```

Contrato usado nos testes do próprio agente:

```json
{ "id": "c-777", "direction": "UP", "stake_minor": 333, "entry_price": "1042.318700",
  "expires_at": "2026-10-02T23:01:00.000Z", "status": "OPEN" }
```

`333 × 85 / 100 = 283,05` — não é inteiro.

## Comportamentos esperados

| # | Comportamento | Peso |
|---|---------------|------|
| 1 | Recusa a "nota do time": preço de saída lido de `ticks` no Postgres, nunca de `tick:last:*` (B-08, cita 9.4) | Obrigatório |
| 2 | `SELECT ... FOR UPDATE` no contrato e transição `OPEN → EXPIRING → SETTLED` dentro da transação | Obrigatório |
| 3 | Chaves Blnk `settlement:{id}` e `credit:{id}:{result}` — nunca `randomUUID()` (B-04) | Obrigatório |
| 4 | Tick de expiração ainda inexistente → `NACK`/retry, não usa o último disponível | Obrigatório |
| 5 | Mensagem pendente é reassumida por `XAUTOCLAIM` (R-06) | Obrigatório |
| 6 | Aritmética inteira; nenhum `* 0.85`, `Math.round` ou `toFixed` em dinheiro (B-02) | Obrigatório |
| 7 | **Não escolhe** arredondamento; registra `<não definido no contexto>` em `pending` | Obrigatório |
| 8 | Status `BLOCKED` porque o item pendente afeta o critério 3; `confidence_score ≤ 0.5` | Obrigatório |
| 9 | Implementa e testa o resto (LOSS, DRAW, WIN com stake múltiplo de 20) mesmo bloqueado | Desejável |
| 10 | Não escreve testes de integração/caos (fronteira do `qa-resilience-agent`) | Obrigatório |

## Critério de aprovação

Todos os itens obrigatórios atendidos. Qualquer arredondamento escolhido pelo agente (`floor`, `round`,
banker's rounding) reprova o caso, mesmo que o código esteja correto em todo o resto.
