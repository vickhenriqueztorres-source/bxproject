# API guide — 03-synthetic-market-engine

Referência carregada sob demanda. Nomes de tabelas, chaves e canais abaixo são os oficiais da skill — não criar variações.
`SYNTH_1` é um símbolo ilustrativo; o nome oficial é `<não definido no contexto>`.

## Etapa × invariante

| Etapa | Componente | Invariantes |
|-------|------------|-------------|
| Geração | Tick Engine | M-01, M-02, M-04 |
| Persistência | Tick Engine (transação) | M-02, M-03, M-04 |
| Publicação | Outbox Relay | M-03 |
| Agregação | Candle Worker | M-05 |
| Feed | WebSocket Gateway, Chart API | M-06 |

## Schema PostgreSQL / TimescaleDB

```sql
CREATE TABLE index_state (
  symbol         text        PRIMARY KEY,
  last_sequence  bigint      NOT NULL,
  last_price     numeric     NOT NULL,
  last_hash      char(64)    NOT NULL,
  last_ts        timestamptz NOT NULL,
  lease_epoch    bigint      NOT NULL DEFAULT 0
);

CREATE TABLE ticks (
  symbol     text        NOT NULL,
  sequence   bigint      NOT NULL,
  ts         timestamptz NOT NULL,
  price      numeric     NOT NULL CHECK (price > 0),
  prev_hash  char(64)    NOT NULL,
  hash       char(64)    NOT NULL,
  PRIMARY KEY (symbol, sequence)
);
-- TimescaleDB (opcional): SELECT create_hypertable('ticks', 'ts', ...);
-- Append-only: role da aplicação sem UPDATE/DELETE em ticks.

CREATE TABLE candles (
  symbol        text        NOT NULL,
  interval      text        NOT NULL,          -- '1m', ...
  bucket_start  timestamptz NOT NULL,
  open          numeric     NOT NULL,
  high          numeric     NOT NULL,
  low           numeric     NOT NULL,
  close         numeric     NOT NULL,
  volume        integer     NOT NULL,          -- quantidade de ticks
  first_seq     bigint      NOT NULL,
  last_seq      bigint      NOT NULL,
  PRIMARY KEY (symbol, interval, bucket_start)
);

CREATE TABLE outbox (
  id            bigserial   PRIMARY KEY,
  topic         text        NOT NULL,          -- 'tick'
  aggregate_id  text        NOT NULL,          -- symbol
  sequence      bigint      NOT NULL,
  payload       jsonb       NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  published_at  timestamptz
);
```

## Hash encadeado (serialização canônica)

```text
input  = prev_hash + "|" + symbol + "|" + sequence + "|" + ts_iso_utc_ms + "|" + price_string
hash   = hex(SHA-256(input))
gênese = hex(SHA-256("genesis|" + symbol))

ts_iso_utc_ms : 2026-03-10T12:00:01.000Z
price_string  : decimal canônico, sem expoente, sem zeros à direita além da precisão
```

## Redis

| Chave / canal | Tipo | Uso |
|---------------|------|-----|
| `lease:tick-engine:{symbol}` | String com TTL | `SET ... NX PX 3000`; renovar a cada tick |
| `lease:epoch:{symbol}` | Contador | `INCR` ao assumir a liderança; fencing token gravado em `index_state.lease_epoch` |
| `lease:relay:{symbol}` | String com TTL | Garante um único relay de ticks por símbolo (ordem — ver `05-resilience-patterns`) |
| `ticks:{symbol}` | Stream | ID `{sequence}-0`; fonte de catch-up e consumer groups |
| `ticks:{symbol}:live` | Pub/Sub | Fan-out visual para o WebSocket Gateway |
| `tick:last:{symbol}` | String | Cache do último tick (snapshot) |
| `candles:hot:{symbol}:{interval}` | String/Hash | Cache dos candles recentes |

Consumer groups em `ticks:{symbol}`: `candle-workers`, `settlement-workers`.
Retenção (`MAXLEN ~`): `<não definido no contexto>` — deve cobrir no mínimo a janela de catch-up do feed.

## Protocolo WebSocket

Cliente → servidor:

```json
{ "type": "subscribe", "symbol": "SYNTH_1", "lastSequence": 1234 }
{ "type": "unsubscribe", "symbol": "SYNTH_1" }
{ "type": "pong" }
```

Servidor → cliente:

```json
{ "type": "snapshot", "symbol": "SYNTH_1", "sequence": 1240, "ts": "2026-03-10T12:00:40.000Z", "price": "1003.27" }
{ "type": "tick", "symbol": "SYNTH_1", "sequence": 1241, "ts": "2026-03-10T12:00:41.000Z", "price": "1003.31", "hash": "9f2c…" }
{ "type": "candle", "symbol": "SYNTH_1", "interval": "1m", "bucketStart": "2026-03-10T12:00:00.000Z", "open": "1001.10", "high": "1003.90", "low": "1000.85", "close": "1003.31", "volume": 41 }
{ "type": "resync_required", "symbol": "SYNTH_1", "reason": "lastSequence_out_of_retention" }
{ "type": "ping" }
{ "type": "error", "code": "SYMBOL_LIMIT", "message": "..." }
```

Fluxo de assinatura:

```text
1. Handshake autenticado (04-security-iam)
2. subscribe com lastSequence?
   ├── sem lastSequence        → snapshot + ao vivo
   ├── dentro da retenção      → XRANGE ticks:{symbol} ({lastSequence}+1)-0 + → ao vivo
   └── fora da retenção        → resync_required
3. Ao vivo: Pub/Sub ticks:{symbol}:live, descartar sequence <= última enviada
4. Cliente detecta gap (sequence != última + 1) → reenviar subscribe com lastSequence
```

Limites (de `01-project-context`): 5 conexões por usuário, 10 símbolos por conexão, ping a cada 15 s, desconexão após 45 s sem pong.

## Chart API

```http
GET /candles?symbol=SYNTH_1&interval=1m&from=2026-03-10T11:00:00Z&to=2026-03-10T12:00:00Z
→ 200 [{ "bucketStart": "...", "open": "...", "high": "...", "low": "...", "close": "...", "volume": 60 }]
```

Credencial de banco somente leitura (`04-security-iam`).

## Métricas

| Métrica | Tipo | Alerta sugerido |
|---------|------|-----------------|
| `ticks_generated_total{symbol}` | Counter | taxa < 0,8/s por 30 s |
| `tick_gap_seconds{symbol}` | Gauge | > 3 |
| `tick_publish_lag_seconds` | Histogram | p99 > 1 |
| `hash_chain_verification_failures_total` | Counter | > 0 (crítico) |
| `leader_changes_total{symbol}` | Counter | > 3 em 10 min |
| `candle_lag_seconds{interval}` | Gauge | > 5 |
| `ws_connections` / `ws_resync_total` | Gauge / Counter | resync > 5% das assinaturas |
