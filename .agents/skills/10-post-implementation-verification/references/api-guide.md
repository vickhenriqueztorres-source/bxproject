# Guia de referência — 10-post-implementation-verification

Consultas e critérios usados por `scripts/verify-postconditions.sh`. Toda consulta retorna as **linhas
que violam** a garantia: `0 linhas = PASS`. Todas rodam com a role `auditor_ro` (skill 08, `security.md`),
que só tem `SELECT`.

Parâmetros comuns:

| Variável | Significado |
|----------|-------------|
| `:window_start`, `:window_end` | Janela medida (sem a estabilização do degrau) |
| `:symbols` | Ativos sob verificação (`text[]`); vazio = todos os `ACTIVE` e `PAUSED` |
| `:precision_key` | Chave de precisão em `indices.params` (padrão `precision`) |

## Garantias por subetapa

| Subetapa do plano multi-ativos | Garantias obrigatórias |
|--------------------------------|------------------------|
| 1 — Seed de ativos | V-01, V-13 |
| 2 — Tick Engine com N ativos | V-02, V-03, V-04, V-05, V-13 |
| 3 — Candle Worker e `/candles` | V-05, V-06, V-13 |
| 4 — Contratos e settlement | V-07, V-08, V-09, V-10, V-13 |
| 5 — WebSocket único | V-11, V-13 |
| 6 — Grade de gráficos | V-11 (lado cliente), V-13 |
| 7 — E1 / E2 / E3 / E4 | E1: V-02–V-05, V-12 · E2: V-11, V-12 · E3: V-07–V-09, V-12 · E4: todas |

Para `T01`–`T18` da Fase 1 usar a mesma tabela pelo componente tocado (tick → V-02–V-05; candles → V-06;
contratos → V-07–V-09).

## V-01 — Catálogo de ativos

Critério: os símbolos, status e parâmetros gravados são exatamente os do catálogo esperado
(`expected-catalog.json` entregue no handoff). A precisão não muda depois do primeiro tick.

```sql
-- linhas = ativos cuja precisão gravada difere do número de casas dos ticks
SELECT i.symbol, i.params->>:'precision_key' AS precision_param, max(scale(t.price)) AS max_scale_seen
FROM indices i JOIN ticks t USING (symbol)
WHERE t.ts BETWEEN :'window_start' AND :'window_end'
GROUP BY i.symbol, i.params
HAVING max(scale(round(t.price, (i.params->>:'precision_key')::int))) <> (i.params->>:'precision_key')::int;
```

A comparação com o catálogo esperado é feita pelo script (`psql --csv` + `jq`), linha a linha.

## V-02 — Sequence contínua

```sql
SELECT t.symbol, min(t.sequence) AS min_seq, max(t.sequence) AS max_seq, count(*) AS n,
       s.last_sequence
FROM ticks t JOIN index_state s USING (symbol)
GROUP BY t.symbol, s.last_sequence
HAVING min(t.sequence) <> 1
    OR max(t.sequence) - min(t.sequence) + 1 <> count(*)
    OR max(t.sequence) <> s.last_sequence;
```

## V-03 — Cadência

Critério: ≥ 0,9 tick/s por ativo na janela e nenhum intervalo > 3 s entre ticks consecutivos.

```sql
WITH w AS (
  SELECT symbol, ts, ts - lag(ts) OVER (PARTITION BY symbol ORDER BY sequence) AS gap
  FROM ticks WHERE ts BETWEEN :'window_start' AND :'window_end'
)
SELECT symbol,
       count(*) / extract(epoch FROM (:'window_end'::timestamptz - :'window_start'::timestamptz)) AS rate,
       max(gap) AS max_gap
FROM w GROUP BY symbol
HAVING count(*) / extract(epoch FROM (:'window_end'::timestamptz - :'window_start'::timestamptz)) < 0.9
    OR max(gap) > interval '3 seconds';
```

Em caos (C-01), intervalos dentro de `:failover_start`–`:failover_end` são listados à parte.

## V-04 — Cadeia de hash

Serialização canônica (skill 03): `prev_hash|symbol|sequence|ts_iso_utc_ms|price_string`, com
`price_string` na precisão do ativo. Gênese: `SHA-256("genesis|" + symbol)`. `sha256()` é nativo no PostgreSQL 11+.

```sql
WITH c AS (
  SELECT t.*, (i.params->>:'precision_key')::int AS prec,
         lag(t.hash) OVER (PARTITION BY t.symbol ORDER BY t.sequence) AS prev_row_hash
  FROM ticks t JOIN indices i USING (symbol)
)
SELECT symbol, sequence, 'link' AS problem FROM c
WHERE prev_hash <> coalesce(prev_row_hash,
        encode(sha256(convert_to('genesis|' || symbol, 'UTF8')), 'hex'))
UNION ALL
SELECT symbol, sequence, 'hash' FROM c
WHERE hash <> encode(sha256(convert_to(
        prev_hash || '|' || symbol || '|' || sequence || '|' ||
        to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
        round(price, prec)::text, 'UTF8')), 'hex');
```

Se a cadeia quebrar: **não recalcular para consertar** (skill 03). Congelar settlement do ativo e escalar.

## V-05 — Outbox e Stream

```sql
SELECT id, topic, aggregate_id, created_at, published_at
FROM outbox
WHERE created_at BETWEEN :'window_start' AND :'window_end'
  AND (published_at IS NULL AND created_at < now() - interval '5 seconds'
       OR published_at - created_at > interval '5 seconds');
```

Stream: para cada ativo, o ID do último item de `ticks:{symbol}` (`XREVRANGE ticks:{symbol} + - COUNT 1`)
é `{last_sequence}-0`, ou fica no máximo 2 ticks atrás de `index_state.last_sequence`.

## V-06 — Candles recalculados

Só buckets fechados. `1m` sempre; `5s` e `5m` apenas se o Candle Worker os gerar.

```sql
WITH r AS (
  SELECT symbol, date_bin(:'interval'::interval, ts, timestamptz '2000-01-01') AS bucket_start,
         (array_agg(price ORDER BY sequence))[1]      AS open,
         max(price)                                    AS high,
         min(price)                                    AS low,
         (array_agg(price ORDER BY sequence DESC))[1]  AS close,
         count(*)                                      AS volume,
         min(sequence) AS first_seq, max(sequence) AS last_seq
  FROM ticks
  WHERE ts BETWEEN :'window_start' AND :'window_end' - :'interval'::interval
  GROUP BY 1, 2
)
SELECT r.symbol, r.bucket_start, 'mismatch_or_missing' AS problem
FROM r LEFT JOIN candles c
  ON c.symbol = r.symbol AND c.interval = :'interval_label' AND c.bucket_start = r.bucket_start
WHERE c.symbol IS NULL
   OR (c.open, c.high, c.low, c.close, c.volume, c.first_seq, c.last_seq)
      IS DISTINCT FROM (r.open, r.high, r.low, r.close, r.volume::int, r.first_seq, r.last_seq);
```

## V-07 — Anti-cross e resultado recalculado

```sql
SELECT c.id, c.symbol, c.entry_sequence, c.exit_sequence, c.result
FROM contracts c
LEFT JOIN ticks te ON te.symbol = c.symbol AND te.sequence = c.entry_sequence
LEFT JOIN ticks tx ON tx.symbol = c.symbol AND tx.sequence = c.exit_sequence
WHERE c.status = 'SETTLED'
  AND c.settled_at BETWEEN :'window_start' AND :'window_end'
  AND ( te.price IS DISTINCT FROM c.entry_price
     OR tx.price IS DISTINCT FROM c.exit_price
     OR tx.ts < c.expires_at
     OR EXISTS (SELECT 1 FROM ticks t2
                 WHERE t2.symbol = c.symbol AND t2.ts >= c.expires_at
                   AND t2.sequence < c.exit_sequence)
     OR c.result IS DISTINCT FROM CASE
          WHEN tx.price = te.price THEN 'DRAW'
          WHEN (c.direction = 'UP') = (tx.price > te.price) THEN 'WIN'
          ELSE 'LOSS' END );
```

As FKs `(symbol, entry_sequence)`/`(symbol, exit_sequence)` e o trigger `contracts_guard` já impedem a
maioria dos casos. A consulta prova que ninguém desligou essas proteções.

## V-08 — Prazo de liquidação

```sql
SELECT id, symbol, status, expires_at, settled_at
FROM contracts
WHERE expires_at BETWEEN :'window_start' AND :'window_end'
  AND ( (status = 'SETTLED' AND settled_at - expires_at > interval '10 seconds')
     OR (status IN ('CREATED','PENDING_RESERVE','OPEN','EXPIRING','FAILED_RETRYABLE')
         AND expires_at < now() - interval '10 seconds') );
```

## V-09 — Dinheiro fecha

```sql
-- reconciliação depois do fim da janela
SELECT id, status, divergence_minor FROM reconciliation_runs
WHERE started_at >= :'window_end'
ORDER BY started_at DESC LIMIT 1;          -- PASS só se status = 'OK' e divergence_minor = 0

-- payout por resultado (parte verificável hoje)
SELECT id, result, stake_minor, payout_minor FROM contracts
WHERE status = 'SETTLED' AND settled_at BETWEEN :'window_start' AND :'window_end'
  AND ( (result = 'LOSS' AND payout_minor <> 0)
     OR (result = 'DRAW' AND payout_minor <> stake_minor) );
```

WIN: `PENDENTE` enquanto `D-19` (arredondamento) não for decidida. Depois, ativar o `CHECK payout_by_result` comentado no schema.

Taxa de DRAW por ativo (alerta, não reprova): `> 3 %` indica σ baixo para a precisão do ativo.

## V-10 — Ativo pausado

```sql
SELECT c.id, c.symbol, c.created_at, i.updated_at AS paused_at
FROM contracts c JOIN indices i USING (symbol)
WHERE i.status = 'PAUSED' AND c.created_at > i.updated_at;
```

E os contratos abertos antes da pausa aparecem em `V-08` normalmente (os ticks continuam).

## V-11 — WebSocket

Evidência vem da saída do teste (não do banco):

| Verificação | Critério |
|-------------|----------|
| 6ª conexão do mesmo usuário, com 2+ instâncias do gateway | Rejeitada com o código definido |
| 11º ativo na mesma conexão | Rejeitado |
| `kill -9` numa instância | Contadores do usuário liberados em ≤ TTL |
| Mesmo ativo assinado 2× | 1 assinatura no servidor |
| Reconexão | Nenhum buraco de `sequence` por ativo no cliente |

## V-12 — SLOs de carga

Ler `summary.json` do k6 (`--summary-export`). Cada threshold do plano precisa existir **e** estar `ok: true`.
Threshold ausente = `INCONCLUSIVO`.

| Métrica k6 | Critério |
|------------|----------|
| `http_req_duration{name:POST /contracts}` | `p(95)<300`, `p(99)<800` |
| `http_req_failed` | `rate<0.001` |
| `ws_tick_latency` (métrica customizada) | `p(95)<500` |

## V-13 — Integridade da verificação

| Verificação | Como |
|-------------|------|
| Código e testes não mudaram durante a verificação | `scripts/health-check.sh` (`before` / `after`) |
| Testes do commit não foram enfraquecidos | `git diff <base>..<sha> -- tests/` revisado: asserção removida, `.skip`, `.only`, `retry` |
| Comandos rodados = comandos do gate | Saída bruta anexada, com código de saída |

## Modelo de relatório

```text
SKILL: 10-post-implementation-verification
MODO: GATE
COMMIT: 9f2c1ab
AMBIENTE: ephemeral
JANELA: 2026-06-10T14:02:00Z → 2026-06-10T14:10:00Z
ESCOPO: Subetapa 4 — contratos e settlement multi-ativos

V-07 Anti-cross    : PASS — 0 linhas; 18.420 SETTLED na janela
V-08 Prazo         : PASS — 0 linhas; p99(settled_at - expires_at) = 2,1 s
V-09 Dinheiro      : PASS (LOSS/DRAW) · PENDENTE (WIN, D-19) — reconciliation_runs#812 OK, divergência 0
V-10 Pausado       : PASS — 0 linhas; SYNTH_VOL_10 pausado às 14:05:00
V-13 Integridade   : PASS — fingerprint antes = depois (sha256 3e1f…)

FALHAS: nenhuma
PENDÊNCIAS: D-19 (arredondamento do WIN)
VEREDITO: APROVADO
```
