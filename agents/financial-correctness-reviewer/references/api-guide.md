# API guide — financial-correctness-reviewer

Referência carregada sob demanda durante a revisão. As regras de origem estão na skill
`02-financial-invariants` (I-01 a I-06, fluxos do ledger, máquina de estados) e na
`05-resilience-patterns` (R-01 a R-06). Este guia diz **onde olhar** e **como classificar**.

## Escopo por subtask

| Subtask | Invariantes prioritárias | O que ler | Pergunta-chave |
|---------|--------------------------|-----------|----------------|
| T04 Wallet Adapter + Blnk | I-01, I-02, I-03 | Provisionamento de balances, crédito demo, cliente Blnk | O segundo login credita de novo? |
| T05 Tick Engine | I-05 (checagem 6) | Persistência do tick, `UNIQUE (symbol, sequence)` | Um tick que o settlement vai usar pode sumir ou duplicar? |
| T06 Outbox relay | I-03, I-04, R-01 | Relay, `published_at`, republicação | Um evento financeiro pode ser publicado 0× ou 2× com efeito? |
| T07 Candle Worker | I-05 (checagem 7) | Agregação a partir de ticks gravados | O candle diverge dos ticks oficiais? |
| T09 Contract Service | I-03, I-04, I-01 | `POST /contracts`, Idempotency-Key, outbox `RESERVE_STAKE` | Duplo clique gera 2 reservas? |
| T10 Scheduler + Settlement | I-03, I-04, I-02 | Worker, escolha do tick de saída, crédito de payout | Crash no meio liquida 0× ou 2×? |
| T11 Reconciliação | I-05, I-06 | Job de 1 min, 7 checagens, métrica | Divergência plantada é detectada em ≤ 1 min? |
| T17 Caos | I-02, I-03, I-05 | Cenários `C-02`, `C-03`, `C-04`, `C-08` e suas pós-condições | O teste prova efeito 1× e ledger fechado? |

## Linhas do tempo de falha

Para cada fluxo, perguntar entre **cada** passo: morrer aqui, rodar 2×, chegar fora de ordem.

### Abertura de contrato (T09)

| # | Passo | Se morrer depois deste passo | Proteção esperada |
|---|-------|------------------------------|-------------------|
| 1 | Validar DTO e `Idempotency-Key` | Nada gravado; cliente repete | — |
| 2 | `BEGIN`; inserir contrato `CREATED` + outbox `RESERVE_STAKE` | Rollback: nada existe | I-04 |
| 3 | `COMMIT` | Contrato `CREATED` sem reserva; relay publica depois | R-01 |
| 4 | Relay publica evento | Republicação possível | R-01 idempotente |
| 5 | Wallet Adapter chama Blnk `reserve:{id}` | Blnk pode ter gravado sem resposta | Mesma `reference` no retry (I-03) |
| 6 | Atualiza contrato para `OPEN` + `XACK` | Reentrega via `XAUTOCLAIM` | `XACK` só após `COMMIT` (R-06) |

Repetição com a mesma chave em qualquer ponto → mesmo contrato, mesma reserva.

### Settlement (T10)

| # | Passo | Se morrer depois deste passo | Proteção esperada |
|---|-------|------------------------------|-------------------|
| 1 | Ler mensagem de `stream:contracts:expiry` | Reentrega | R-06 |
| 2 | `BEGIN`; `SELECT ... FOR UPDATE` do contrato | Lock liberado | I-04 |
| 3 | Já `SETTLED`? → só `XACK` | — | I-03 |
| 4 | Buscar primeiro tick com `ts >= expires_at` **no Postgres** | Sem tick → NACK, nunca DRAW | B-08, FC-09 |
| 5 | Calcular resultado (inteiro) | — | B-02 |
| 6 | Gravar `EXPIRING`/`SETTLED` + outbox na mesma transação | Rollback total | I-04 |
| 7 | Chamada Blnk `settlement:{id}` e `credit:{id}:WIN` | Gravado sem resposta | Mesma `reference` (I-03) |
| 8 | `COMMIT` → `XACK` | Reentrega; passo 3 encerra | R-06 |

## Sinais de violação por invariante

| Invariante | Sinal de `FAIL` no código | Severidade típica |
|------------|---------------------------|-------------------|
| I-01 | `UPDATE ... balance`, `DELETE` em transações, tabela `ledger_*`/`wallet_accounts` própria | CRÍTICO |
| I-02 | Crédito sem `source`; conta da casa ausente; valor diferente nas pernas | CRÍTICO |
| I-03 | `reference` com `uuid`/`randomUUID`/`Date.now`/contador de tentativa; `Idempotency-Key` sem `UNIQUE` escopado por `user_id` | CRÍTICO |
| I-04 | Blnk chamado dentro de `BEGIN/COMMIT`; outbox fora da transação; sem `FOR UPDATE`; transição fora da tabela | CRÍTICO / ALTO |
| I-05 | Job inexistente, intervalo > 1 min, checagem ausente, sem métrica `ledger_reconciliation_errors_total` | MÉDIO |
| I-06 | Rota admin que edita saldo; correção por `UPDATE`; reversão sem `reversal:{reference}` | CRÍTICO / ALTO |

Sinais transversais:

| Sinal | Classificação |
|-------|---------------|
| `parseFloat`, `toFixed`, `* 0.85`, `Number(...)` sobre dinheiro | CRÍTICO (FC-08) |
| Preço de saída de `tick:last:*`, Pub/Sub ou memória | CRÍTICO (FC-09) |
| `?? 'DRAW'` ou DRAW quando não há tick | CRÍTICO (FC-09) |
| `XACK` antes do `COMMIT` | CRÍTICO (R-06) |
| `Math.floor`/`round` no lucro sem decisão registrada | ALTO (FC-11) |
| Retry infinito ou sem backoff no caminho de dinheiro | ALTO (R-02) |

## Severidade e veredito

| Severidade | Definição (skill 02) | Exemplo | Efeito no veredito |
|------------|----------------------|---------|--------------------|
| CRÍTICO | Perda ou duplicação de saldo | Crédito duplicado em retry | REPROVADO |
| ALTO | Inconsistência recuperável | Contrato preso em `EXPIRING` sem caminho de saída | REPROVADO |
| MÉDIO | Falta de detecção | Reconciliação sem a checagem 3 | Aprovação possível, achado registrado |
| BAIXO | Melhoria | Nome de métrica fora do padrão | Aprovação possível |

## Template do relatório

```yaml
review:
  scope: [services/settlement-worker/src/settle.ts, db/migrations/0004_contracts.up.sql]
  invariants:
    I-01: { result: PASS, evidence: "nenhum UPDATE de saldo; saldo só no Blnk" }
    I-02: { result: PASS, evidence: "settle.ts:61 source/destination iguais à tabela" }
    I-03: { result: FAIL, evidence: "settle.ts:42 reference aleatória" }
    I-04: { result: PASS, evidence: "settle.ts:18 FOR UPDATE" }
    I-05: { result: N/A, evidence: "T10 não implementa reconciliação (T11)" }
    I-06: { result: N/A, evidence: "subtask não tem fluxo de correção" }
  findings:
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:42
      problem: reference do crédito muda a cada tentativa
      scenario: Blnk grava, resposta se perde no timeout, retry grava segundo crédito
      violates: [I-03, FC-10]
  verdict: REPROVADO
```

## Pendências conhecidas

| Item | Status | Tratamento na revisão |
|------|--------|-----------------------|
| Arredondamento do lucro | `<não definido no contexto>` | `pending`; código que fixa regra = ALTO |
| Origem do crédito demo | `<não definido no contexto>` | `pending`; I-02 avaliado só para o resto |
| Cancelamento `OPEN → CANCELLED` | `<não definido no contexto>` | `pending`; rota de cancelamento existente = ALTO |
| Ações automáticas da reconciliação | §14 do orquestrador | Revisar só detecção, não correção automática |
