# Test case 2 — Critérios de aceite do Settlement Worker

- **Skill:** `06-testing-quality`
- **Tipo:** modo critérios
- **Agente que envia:** `tech-lead-orchestrator`

## Entrada (prompt)

```text
Issue #42 — Settlement Worker liquida contratos vencidos.
Escrever os critérios de aceite e o plano de testes antes da implementação.
```

## Contexto fornecido

- Contrato com expiração de 60 s e payout de 85% (`D-10`).
- Estados `CREATED → OPEN → EXPIRING → SETTLED`; `EXPIRING → FAILED_RETRYABLE` (`02-financial-invariants`).
- Settlement consome `contracts:expiring` via consumer group `settlement-workers` (`05-resilience-patterns`).
- Fluxos do ledger WIN / LOSS / DRAW com `reference` `settlement:{contract_id}` e `credit:{contract_id}:WIN`.

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "critérios de aceite", "plano de testes") | Obrigatório |
| 2 | Critérios no formato `AC-42-n` com Dado / Quando / Então / E | Obrigatório |
| 3 | Cobre WIN (UP e DOWN), LOSS e DRAW com valores exatos (stake 50,00 → lucro 42,50) | Obrigatório |
| 4 | Cobre mensagem duplicada e liquidação concorrente → efeito único | Obrigatório |
| 5 | Cobre ausência de tick de saída → NACK, nunca DRAW | Obrigatório |
| 6 | Cobre Blnk indisponível → breaker, sem DLQ, liquida após volta | Obrigatório |
| 7 | Cobre worker morto no meio do lote (`C-08`) | Obrigatório |
| 8 | Cada critério tem regras, nível e nome de teste com `[AC-42-n]` | Obrigatório |
| 9 | Pós-condição de reconciliação e soma do ledger | Obrigatório |
| 10 | Arredondamento do payout e regra do tick de saída como `<não definido no contexto>` | Obrigatório |
| 11 | Nenhum critério vago ("funciona", "rápido") | Obrigatório |
