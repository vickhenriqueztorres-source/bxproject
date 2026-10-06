---
name: 05-resilience-patterns
description: >
  Trigger: "outbox", "retry", "backoff", "timeout", "circuit breaker", "DLQ", "consumer group", "XACK". Ativar antes de escrever ou revisar código que chama serviço externo ou consome fila.
version: 1.0.0
---

# 05-resilience-patterns

Padrões de resiliência da **Plataforma de Índices Sintéticos — Fase 1**.
Define **como** cada componente falha, espera, repete, desiste e se recupera sem corromper estado.
Decisões herdadas de `01-project-context`: `D-04` (Stream é fonte de trabalho), `D-05` (PostgreSQL é estado forte), `D-08` (outbox).

## Mentalidade

| Regra | Pergunta mental aplicada à falha |
|-------|----------------------------------|
| Falhar é normal | Se o Blnk, o Redis ou o Postgres sumirem por 2 minutos, o que acontece com cada mensagem em voo? |
| Toda operação pode repetir | Esse retry é seguro? A operação tem chave de idempotência? |
| Nenhuma chamada espera infinito | Qual é o timeout desta linha? E se ele estourar com resultado desconhecido? |
| Se não é observável, não é confiável | Uma mensagem presa há 10 minutos gera alerta? |
| Regra de negócio vem antes de feature | O fallback inventa um resultado financeiro ou só adia? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "outbox", "relay", "publicar evento", "at-least-once", "dual write"
- "retry", "tentar de novo", "backoff", "jitter", "Retry-After"
- "timeout", "deadline", "statement_timeout", "travou", "pendurado"
- "circuit breaker", "fallback", "Blnk fora do ar", "degradação"
- "DLQ", "dead letter", "poison message", "replay"
- "consumer group", "XREADGROUP", "XACK", "XAUTOCLAIM", "pending", "reentrega"
- Revisão de qualquer PR que faça chamada de rede, consuma Stream ou rode worker

**Não ativar quando:**

- Quais transações e `reference` usar no ledger — usar `02-financial-invariants` (esta skill só garante que a chamada é repetida com segurança)
- Formato do tick, sequence e catch-up do feed — usar `03-synthetic-market-engine`
- Validação de JWT e segredos — usar `04-security-iam`
- Escolha de ferramenta (ex.: trocar Redis por Kafka) — `01-project-context` (`CONFLITA COM DECISÃO`)

## Padrões

### R-01 — Outbox

- **Definição:** mudança de estado e evento são gravados na mesma transação; um relay lê `outbox` com `FOR UPDATE SKIP LOCKED`, publica no Stream e marca `published_at`. Entrega **at-least-once** → consumidores idempotentes.
- **Pergunta mental:** se o processo morrer entre o `COMMIT` e o `XADD`, o evento se perde?
- **Como verificar:** nenhum `XADD`/chamada externa no caminho do request; relay com lote limitado; `outbox_lag_seconds` monitorado.
- **Ordem:** eventos com ordem obrigatória (ticks) usam **um relay por símbolo** (lease `lease:relay:{symbol}`); IDs explícitos no Stream tornam republicação idempotente.
- **Violação típica:** `await db.commit(); await redis.xadd(...)` no handler (dual write).

### R-02 — Retry + backoff

- **Definição:** repetir somente erros transitórios de operações idempotentes, com **backoff exponencial + full jitter** e limite de tentativas. Esgotou → DLQ (R-05).
- **Pergunta mental:** se 1.000 workers falharem juntos, eles voltam todos no mesmo milissegundo?
- **Fórmula:** `espera = random(0, min(cap, base × 2^tentativa))`; respeitar `Retry-After`.
- **Classificação:** tabela em `references/api-guide.md`, seção "Erros repetíveis".
- **Dentro de um request HTTP:** no máximo 1 retry e somente se couber no deadline; o retry longo é dos workers.
- **Violação típica:** `while (true) { try ... catch { sleep(1000) } }`; repetir `400`/`422`.

### R-03 — Timeout

- **Definição:** toda chamada de rede, query e espera tem timeout explícito. O request tem um **deadline** propagado para as chamadas internas.
- **Pergunta mental:** qual é o tempo máximo que esta linha pode ficar parada?
- **Como verificar:** `AbortSignal.timeout` em `fetch`; `statement_timeout`, `lock_timeout` e `idle_in_transaction_session_timeout` no Postgres; `commandTimeout` no Redis; `XREADGROUP ... BLOCK 5000` (nunca `BLOCK 0`).
- **Timeout com resultado desconhecido:** tratar como "talvez executou" → repetir com a **mesma** chave de idempotência (`02-financial-invariants`).
- **Violação típica:** `fetch(url)` sem `signal`; worker sem graceful shutdown.

### R-04 — Circuit breaker

- **Definição:** cada dependência externa crítica (Blnk) tem breaker `CLOSED → OPEN → HALF_OPEN`. Aberto: **falhar rápido e adiar**, nunca inventar resultado.
- **Pergunta mental:** com o Blnk fora, os workers continuam martelando e enchendo a DLQ?
- **Comportamento com breaker aberto:**

| Fluxo | Comportamento |
|-------|---------------|
| Consumer de `wallet:commands` | Pausa a leitura; mensagens ficam no Stream; tentativas não contam para DLQ |
| Contrato `CREATED` aguardando reserva | Permanece `CREATED`; reconciliador acompanha (`I-05`) |
| Settlement | Não liquida; contrato fica `EXPIRING`; nunca liquida como `DRAW` por falha |
| `GET /wallet` | `503` + `Retry-After`; exibição de saldo em cache: `<não definido no contexto>` |
| Novos `POST /contracts` | Rejeitar ou aceitar como `CREATED`: `<não definido no contexto>` |

- **Violação típica:** fallback que retorna `{ status: 'SETTLED', result: 'DRAW' }` quando o Blnk falha.

### R-05 — DLQ

- **Definição:** mensagem que esgotou tentativas, ou falhou com erro não repetível, vai para `dlq:{stream}` com metadados completos e é `XACK`ada no original. DLQ **nunca** é apagada automaticamente.
- **Pergunta mental:** se uma mensagem financeira cair na DLQ às 3h, quem fica sabendo e como ela é reprocessada?
- **Como verificar:** campos obrigatórios em `references/api-guide.md`; alerta em qualquer entrada de `dlq:wallet:commands` e `dlq:contracts:expiring`; replay manual idempotente pela mesma chave.
- **Violação típica:** `catch (e) { console.error(e) }` e seguir em frente; DLQ com `MAXLEN`.

### R-06 — Consumer groups

- **Definição:** trabalho é consumido de Redis Streams via `XREADGROUP`, um grupo por finalidade, nome de consumidor único por instância. **`XACK` só depois do `COMMIT`.** Pendentes órfãos são recuperados com `XAUTOCLAIM`.
- **Pergunta mental:** se o worker morrer depois de ler e antes de gravar, outra instância processa a mensagem?
- **Como verificar:** ordem `ler → processar → commit → XACK`; loop de recuperação com `min-idle`; `XPENDING` para contar entregas; consumidores removidos só com pendentes zerados.
- **Violação típica:** `XACK` antes de processar; consumidor `'worker'` fixo em todas as réplicas; ler do Pub/Sub (`D-04`).

## Instruções

**Modo implementação** (`backend-implementation-agent`):

1. Listar toda chamada de rede, query e leitura de fila do código tocado.
2. Para cada uma, definir timeout, se é repetível, limite de tentativas e destino ao esgotar (parâmetros em `references/api-guide.md`).
3. Efeitos colaterais externos saem do request: estado + outbox na transação; relay publica; worker chama a dependência.
4. Consumidor: `XREADGROUP` com `BLOCK` finito → processar → `COMMIT` → `XACK`; loop paralelo de `XAUTOCLAIM`; DLQ ao exceder entregas.
5. Expor as métricas da seção "Métricas" de `references/api-guide.md`.

**Modo revisão** (`qa-resilience-agent`, somente leitura):

1. Para cada padrão R-01 a R-06, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha e descreve o cenário de falha que o expõe.
3. Severidade: `CRÍTICO` (perda ou duplicação de efeito financeiro, mensagem perdida), `ALTO` (travamento, tempestade de retry, DLQ sem alerta), `MÉDIO` (falta de métrica, parâmetro ausente), `BAIXO` (melhoria).
4. Não sugerir código; descrever o problema e o padrão violado.

## Formato de saída

```text
SKILL: 05-resilience-patterns
MODO: IMPLEMENTAÇÃO | REVISÃO
DEPENDÊNCIAS: <Blnk | PostgreSQL | Redis | Keycloak JWKS | ...>
ESCOPO ANALISADO: <arquivos / workers>

R-01 Outbox            : PASS | FAIL | N/A — <evidência>
R-02 Retry + backoff   : PASS | FAIL | N/A — <evidência>
R-03 Timeout           : PASS | FAIL | N/A — <evidência>
R-04 Circuit breaker   : PASS | FAIL | N/A — <evidência>
R-05 DLQ               : PASS | FAIL | N/A — <evidência>
R-06 Consumer groups   : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — cenário: <falha> — viola <R-xx>

PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar o consumer de settlement" — trecho:
  for (const [id, fields] of entries) {
    await redis.xack('contracts:expiring', 'settlement-workers', id)
    await settle(fields)

R-06 Consumer groups : FAIL — settlement/consumer.ts:3 XACK antes de settle()
ACHADOS:
- [CRÍTICO] settlement/consumer.ts:3 — mensagem confirmada antes do processamento —
  cenário: settle() falha e o contrato nunca é liquidado — viola R-06
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Dois relays com `SKIP LOCKED` para ticks:** o relay B publica `seq 11` antes do A publicar `seq 10`; o `XADD 10-0` é rejeitado e o tick some do Stream. Por isso: um relay por símbolo.
- **`XADD` com ID explícito rejeitado:** "ID igual ou menor" com o mesmo `sequence` = já publicado → marcar `published_at`.
- **`MAXLEN ~` remove entrada ainda pendente:** `XAUTOCLAIM` devolve o ID como apagado; registrar na DLQ como `trimmed` e alertar. Retenção dos streams de trabalho deve exceder o pior atraso esperado.
- **Breaker aberto por muito tempo:** mensagens acumulam no Stream, não na DLQ; alerta por `stream_pending_messages` e pela idade da mais antiga.
- **Graceful shutdown:** parar de ler, terminar o lote em voo dentro de um prazo, `XACK` o que concluiu; o resto fica pendente e é recuperado por `XAUTOCLAIM`.
- **Erro de serialização no Postgres (`40001`) ou deadlock (`40P01`):** repetir a transação inteira, não só a última query.
- **Replay da DLQ:** reenvia o payload original com a mesma chave; o efeito acontece uma única vez (`I-03`).

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de outbox, retry, timeout, breaker, DLQ e consumer group |
| Ativação espúria | Fronteiras com `02`, `03`, `04` e `01` em "Não ativar quando" |
| Execução parcial | Saída exige status para os 6 padrões e lista de dependências |
| Deriva de instrução | Parâmetros, nomes de streams e campos de DLQ fixos em `references/` |
| Conflito de tools | Stream = trabalho, Pub/Sub = visual (`D-04`); ledger na `02` |
| Context overflow | Parâmetros em `references/`, código completo em `examples/` |
| Feedback loop negativo | Breaker aberto pausa em vez de queimar tentativas e encher a DLQ |

## Recursos

- Parâmetros, erros repetíveis, streams, DLQ e métricas: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de padrões no código: `scripts/health-check.sh`
