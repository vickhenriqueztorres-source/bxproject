# API guide — 05-resilience-patterns

Referência carregada sob demanda. Valores marcados **PROPOSTO** são ponto de partida e devem ser confirmados com métricas; não constam em `01-project-context`.

## Parâmetros por dependência

| Dependência | Timeout | Tentativas | Backoff | Breaker |
|-------------|---------|------------|---------|---------|
| Blnk (worker de `wallet:commands`) | 2 s por chamada — PROPOSTO | 8 entregas — PROPOSTO | base 200 ms, cap 30 s, full jitter — PROPOSTO | abre com ≥ 50% de falha em 20 chamadas; meia-abertura após 30 s — PROPOSTO |
| Keycloak JWKS | 2 s | cache cobre a indisponibilidade | cooldown 30 s | — |
| PostgreSQL (API) | `statement_timeout` 2 s, `lock_timeout` 1 s — PROPOSTO | 3 em `40001`/`40P01` | base 50 ms, cap 500 ms | — |
| PostgreSQL (workers) | `statement_timeout` 5 s, `lock_timeout` 2 s — PROPOSTO | 3 em `40001`/`40P01` | base 50 ms, cap 1 s | — |
| PostgreSQL (todas) | `idle_in_transaction_session_timeout` 10 s — PROPOSTO | — | — | — |
| Redis | `commandTimeout` 500 ms, `connectTimeout` 2 s — PROPOSTO | 3 | base 50 ms, cap 1 s | — |
| Request HTTP da API | deadline 5 s — PROPOSTO | ≤ 1 retry interno | — | — |
| `XREADGROUP` | `BLOCK 5000` | — | — | — |
| `XAUTOCLAIM` | `min-idle` 30 s — PROPOSTO, varredura a cada 10 s | — | — | — |
| Graceful shutdown | 20 s — PROPOSTO | — | — | — |

## Erros repetíveis

| Erro | Repetir? | Observação |
|------|----------|------------|
| Timeout / `AbortError` | Sim | Resultado desconhecido → mesma chave de idempotência |
| `ECONNRESET`, `ECONNREFUSED`, `EPIPE` | Sim | |
| HTTP `502`, `503`, `504` | Sim | |
| HTTP `429` | Sim | Respeitar `Retry-After` |
| HTTP `500` | Sim, com limite | Pode ser bug determinístico → DLQ ao esgotar |
| HTTP `409` "reference já existe" (Blnk) | Não — **sucesso** | Ler a transação existente (`02-financial-invariants`) |
| HTTP `400`, `401`, `403`, `404`, `422` | Não | Direto para a DLQ como `non_retryable` |
| Postgres `40001` serialization_failure, `40P01` deadlock | Sim | Repetir a transação inteira |
| Postgres `23505` unique_violation | Não | Em fluxo idempotente = já processado |
| Erro de validação/parsing da mensagem | Não | DLQ como `poison` |

## Full jitter

```ts
export function backoffDelay(attempt: number, baseMs: number, capMs: number) {
  const ceiling = Math.min(capMs, baseMs * 2 ** attempt)
  return Math.floor(Math.random() * ceiling)
}
```

`Math.random` é aceitável **somente** para jitter; preço usa CSPRNG (`03-synthetic-market-engine`, M-01).

## Outbox

```sql
CREATE INDEX outbox_unpublished ON outbox (id) WHERE published_at IS NULL;

-- Relay (lote)
BEGIN;
SELECT id, topic, aggregate_id, sequence, payload
  FROM outbox
 WHERE published_at IS NULL
   AND topic = $1
 ORDER BY id
 LIMIT 100
 FOR UPDATE SKIP LOCKED;
-- publicar cada evento no Stream do tópico
UPDATE outbox SET published_at = now() WHERE id = ANY($2);
COMMIT;
```

| Tópico do outbox | Stream de destino | ID no Stream | Relay |
|------------------|-------------------|--------------|-------|
| `tick` | `ticks:{symbol}` | `{sequence}-0` | Um por símbolo (`lease:relay:{symbol}`) |
| `wallet.command` | `wallet:commands` | automático (`*`) | Vários (ordem por contrato garantida pela máquina de estados) |
| `contract.expiring` | `contracts:expiring` | automático (`*`) | Vários |

Limpeza de linhas publicadas: job de manutenção com role própria; retenção `<não definido no contexto>`.

## Streams e consumer groups

| Stream | Grupo | Consumidor | Efeito |
|--------|-------|------------|--------|
| `ticks:{symbol}` | `candle-workers` | Candle Worker | Upsert de candle |
| `ticks:{symbol}` | `settlement-workers` | Settlement Worker | Descobre tick de saída |
| `contracts:expiring` | `settlement-workers` | Settlement Worker | Liquida contrato |
| `wallet:commands` | `wallet-adapter` | Wallet Adapter | Chama o Blnk com `reference` fixa |

```text
Criar grupo (idempotente):  XGROUP CREATE <stream> <grupo> 0 MKSTREAM   (ignorar BUSYGROUP)
Nome do consumidor:          <serviço>-<hostname>-<pid>
Ler:                         XREADGROUP GROUP <grupo> <consumidor> COUNT 10 BLOCK 5000 STREAMS <stream> >
Confirmar:                   XACK <stream> <grupo> <id>           (somente após COMMIT)
Envenenadas:                 XPENDING <stream> <grupo> IDLE 30000 - + 100   → entregas >= máx → DLQ
Recuperar órfãs:             XAUTOCLAIM <stream> <grupo> <consumidor> 30000 0-0 COUNT 50
Remover consumidor morto:    XGROUP DELCONSUMER ... somente com pendentes = 0
```

## DLQ

Stream `dlq:{stream_original}`, sem `MAXLEN`.

| Campo | Conteúdo |
|-------|----------|
| `original_stream` | Ex.: `wallet:commands` |
| `original_id` | ID da mensagem original |
| `group` | Grupo que falhou |
| `payload` | Payload original, intacto |
| `error_class` | `retryable_exhausted` \| `non_retryable` \| `poison` \| `trimmed` |
| `error_message` | Mensagem sanitizada (sem tokens/segredos) |
| `deliveries` | Contagem de entregas |
| `first_failed_at` / `last_failed_at` | Timestamps |
| `trace_id` | Correlação com logs e traces |

Replay manual (admin, auditado): `XADD <original_stream> * <payload>` e `XACK`/`XDEL` na DLQ após confirmação. Idempotência do consumidor garante efeito único.

## Métricas

| Métrica | Tipo | Alerta sugerido |
|---------|------|-----------------|
| `outbox_unpublished` / `outbox_lag_seconds{topic}` | Gauge | lag > 5 s |
| `stream_pending_messages{stream,group}` | Gauge | crescendo por 5 min |
| `stream_oldest_pending_seconds{stream,group}` | Gauge | > 60 s |
| `dlq_messages{stream}` | Gauge | > 0 em `dlq:wallet:commands` ou `dlq:contracts:expiring` (crítico) |
| `retry_attempts_total{dependency,outcome}` | Counter | taxa anormal |
| `circuit_breaker_state{dependency}` | Gauge (0/1/2) | `OPEN` por > 1 min |
| `dependency_timeout_total{dependency}` | Counter | taxa anormal |
| `dependency_latency_seconds{dependency}` | Histogram | p99 > 80% do timeout |
