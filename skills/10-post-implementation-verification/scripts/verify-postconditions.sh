#!/usr/bin/env bash
# Roda as pós-condições V-02 a V-10 no banco (e o Stream de V-05 no Redis) e imprime PASS/FAIL por garantia.
# Só lê. Usa a role auditor_ro. Recusa ambiente que não seja descartável.
#
# Uso:
#   ENVIRONMENT=ephemeral \
#   AUDITOR_DATABASE_URL=postgres://auditor_ro@host/synth \
#   WINDOW_START=2026-06-10T14:02:00Z WINDOW_END=2026-06-10T14:10:00Z \
#   [CHECKS="V-02 V-03 V-04"] [REDIS_URL=redis://host:6379] [PRECISION_KEY=precision] \
#   [CANDLE_INTERVALS="1m"] [FAILOVER_START=... FAILOVER_END=...] \
#   bash scripts/verify-postconditions.sh
set -uo pipefail

: "${ENVIRONMENT:?defina ENVIRONMENT=ephemeral ou ci}"
: "${AUDITOR_DATABASE_URL:?defina AUDITOR_DATABASE_URL (role auditor_ro)}"
: "${WINDOW_START:?defina WINDOW_START (ISO 8601 UTC)}"
: "${WINDOW_END:?defina WINDOW_END (ISO 8601 UTC)}"

case "$ENVIRONMENT" in
  ephemeral|ci) ;;
  *) echo "[INVÁLIDO] ENVIRONMENT='$ENVIRONMENT' — só ephemeral ou ci"; exit 2 ;;
esac
case "$AUDITOR_DATABASE_URL" in
  *prod*|*production*|*staging*) echo "[INVÁLIDO] URL do banco parece produção ou staging compartilhado"; exit 2 ;;
esac

CHECKS="${CHECKS:-V-02 V-03 V-04 V-05 V-06 V-07 V-08 V-09 V-10}"
PRECISION_KEY="${PRECISION_KEY:-precision}"
CANDLE_INTERVALS="${CANDLE_INTERVALS:-1m}"
FAILED=0
INCONCLUSIVE=0

command -v psql >/dev/null || { echo "[INCONCLUSIVO] psql não encontrado"; exit 3; }

# psql não interpola variáveis (:'window_start') em -c; por isso o SQL entra pelo stdin.
psql_q() {
  printf '%s\n' "$1" | psql "$AUDITOR_DATABASE_URL" -X -q -A -t -v ON_ERROR_STOP=1 \
    -v window_start="$WINDOW_START" -v window_end="$WINDOW_END" \
    -v precision_key="$PRECISION_KEY" -f -
}

run_check() {
  local id="$1" label="$2" sql="$3"
  local out rc rows
  out="$(psql_q "$sql" 2>&1)"; rc=$?
  if [ $rc -ne 0 ]; then
    echo "$id $label : INCONCLUSIVO — erro na consulta: $(printf '%s' "$out" | head -n 2 | tr '\n' ' ')"
    INCONCLUSIVE=$((INCONCLUSIVE + 1)); return
  fi
  rows="$(printf '%s' "$out" | grep -c . || true)"
  if [ "$rows" -eq 0 ]; then
    echo "$id $label : PASS — 0 linhas"
  else
    echo "$id $label : FAIL — $rows linha(s); primeiras:"
    printf '%s\n' "$out" | head -n 5 | sed 's/^/    /'
    FAILED=$((FAILED + 1))
  fi
}

want() { case " $CHECKS " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

echo "VERIFY-POSTCONDITIONS  commit=$(git rev-parse --short HEAD 2>/dev/null || echo '?')  janela=$WINDOW_START → $WINDOW_END"
echo "----------------------------------------"

want V-02 && run_check V-02 "Sequence    " "
SELECT t.symbol, min(t.sequence), max(t.sequence), count(*), s.last_sequence
FROM ticks t JOIN index_state s USING (symbol)
GROUP BY t.symbol, s.last_sequence
HAVING min(t.sequence) <> 1 OR max(t.sequence) - min(t.sequence) + 1 <> count(*) OR max(t.sequence) <> s.last_sequence;"

if want V-03; then
  failover_filter=""
  if [ -n "${FAILOVER_START:-}" ] && [ -n "${FAILOVER_END:-}" ]; then
    failover_filter="AND NOT (ts BETWEEN '$FAILOVER_START' AND '$FAILOVER_END')"
  fi
  run_check V-03 "Cadência    " "
WITH w AS (
  SELECT symbol, ts, ts - lag(ts) OVER (PARTITION BY symbol ORDER BY sequence) AS gap
  FROM ticks WHERE ts BETWEEN :'window_start' AND :'window_end'
)
SELECT symbol,
       round(count(*) / extract(epoch FROM (:'window_end'::timestamptz - :'window_start'::timestamptz)), 3) AS rate,
       max(gap) FILTER (WHERE true $failover_filter) AS max_gap
FROM w GROUP BY symbol
HAVING count(*) / extract(epoch FROM (:'window_end'::timestamptz - :'window_start'::timestamptz)) < 0.9
    OR max(gap) FILTER (WHERE true $failover_filter) > interval '3 seconds';"
fi

want V-04 && run_check V-04 "Hash        " "
WITH c AS (
  SELECT t.*, (i.params->>:'precision_key')::int AS prec,
         lag(t.hash) OVER (PARTITION BY t.symbol ORDER BY t.sequence) AS prev_row_hash
  FROM ticks t JOIN indices i USING (symbol)
)
SELECT symbol, sequence, 'link' FROM c
WHERE prev_hash <> coalesce(prev_row_hash, encode(sha256(convert_to('genesis|' || symbol, 'UTF8')), 'hex'))
UNION ALL
SELECT symbol, sequence, 'hash' FROM c
WHERE hash <> encode(sha256(convert_to(
  prev_hash || '|' || symbol || '|' || sequence || '|' ||
  to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') || '|' ||
  round(price, prec)::text, 'UTF8')), 'hex');"

if want V-05; then
  run_check V-05 "Outbox      " "
SELECT id, topic, aggregate_id FROM outbox
WHERE created_at BETWEEN :'window_start' AND :'window_end'
  AND ((published_at IS NULL AND created_at < now() - interval '5 seconds')
       OR published_at - created_at > interval '5 seconds');"
  if [ -n "${REDIS_URL:-}" ] && command -v redis-cli >/dev/null; then
    lagging=0
    while IFS='|' read -r symbol last_seq; do
      [ -z "$symbol" ] && continue
      stream_id="$(redis-cli -u "$REDIS_URL" --raw XREVRANGE "ticks:$symbol" + - COUNT 1 2>/dev/null | head -n1)"
      stream_seq="${stream_id%-*}"
      if [ -z "$stream_seq" ] || [ $((last_seq - stream_seq)) -gt 2 ]; then
        echo "    stream atrasado: ticks:$symbol stream=${stream_seq:-vazio} postgres=$last_seq"
        lagging=$((lagging + 1))
      fi
    done < <(psql_q "SELECT symbol, last_sequence FROM index_state;")
    if [ "$lagging" -eq 0 ]; then echo "V-05 Stream       : PASS — todos os streams em dia"; else echo "V-05 Stream       : FAIL — $lagging ativo(s) atrasados"; FAILED=$((FAILED + 1)); fi
  else
    echo "V-05 Stream       : INCONCLUSIVO — REDIS_URL ou redis-cli ausente"
    INCONCLUSIVE=$((INCONCLUSIVE + 1))
  fi
fi

if want V-06; then
  for label in $CANDLE_INTERVALS; do
    case "$label" in
      *s) iv="${label%s} seconds" ;; *m) iv="${label%m} minutes" ;; *h) iv="${label%h} hours" ;;
      *) echo "V-06 Candles $label : INCONCLUSIVO — intervalo desconhecido"; INCONCLUSIVE=$((INCONCLUSIVE + 1)); continue ;;
    esac
    run_check V-06 "Candles $label" "
WITH r AS (
  SELECT symbol, date_bin('$iv'::interval, ts, timestamptz '2000-01-01') AS bucket_start,
         (array_agg(price ORDER BY sequence))[1] AS open, max(price) AS high, min(price) AS low,
         (array_agg(price ORDER BY sequence DESC))[1] AS close, count(*) AS volume,
         min(sequence) AS first_seq, max(sequence) AS last_seq
  FROM ticks
  WHERE ts >= date_bin('$iv'::interval, :'window_start'::timestamptz, timestamptz '2000-01-01') + '$iv'::interval
    AND ts <  date_bin('$iv'::interval, :'window_end'::timestamptz,   timestamptz '2000-01-01')
  GROUP BY 1, 2
)
SELECT r.symbol, r.bucket_start FROM r
LEFT JOIN candles c ON c.symbol = r.symbol AND c.interval = '$label' AND c.bucket_start = r.bucket_start
WHERE c.symbol IS NULL
   OR (c.open, c.high, c.low, c.close, c.volume, c.first_seq, c.last_seq)
      IS DISTINCT FROM (r.open, r.high, r.low, r.close, r.volume::int, r.first_seq, r.last_seq);"
  done
fi

want V-07 && run_check V-07 "Anti-cross  " "
SELECT c.id, c.symbol, c.entry_sequence, c.exit_sequence, c.result
FROM contracts c
LEFT JOIN ticks te ON te.symbol = c.symbol AND te.sequence = c.entry_sequence
LEFT JOIN ticks tx ON tx.symbol = c.symbol AND tx.sequence = c.exit_sequence
WHERE c.status = 'SETTLED' AND c.settled_at BETWEEN :'window_start' AND :'window_end'
  AND ( te.price IS DISTINCT FROM c.entry_price OR tx.price IS DISTINCT FROM c.exit_price
     OR tx.ts < c.expires_at
     OR EXISTS (SELECT 1 FROM ticks t2 WHERE t2.symbol = c.symbol AND t2.ts >= c.expires_at AND t2.sequence < c.exit_sequence)
     OR c.result IS DISTINCT FROM CASE WHEN tx.price = te.price THEN 'DRAW'
                                       WHEN (c.direction = 'UP') = (tx.price > te.price) THEN 'WIN'
                                       ELSE 'LOSS' END );"

want V-08 && run_check V-08 "Prazo       " "
SELECT id, symbol, status, expires_at, settled_at FROM contracts
WHERE expires_at BETWEEN :'window_start' AND :'window_end'
  AND ((status = 'SETTLED' AND settled_at - expires_at > interval '10 seconds')
    OR (status IN ('CREATED','PENDING_RESERVE','OPEN','EXPIRING','FAILED_RETRYABLE')
        AND expires_at < now() - interval '10 seconds'));"

if want V-09; then
  recon="$(psql_q "SELECT status || '|' || divergence_minor FROM reconciliation_runs
                      WHERE started_at >= :'window_end' ORDER BY started_at DESC LIMIT 1;" 2>&1)"
  case "$recon" in
    "OK|0") echo "V-09 Reconciliação : PASS — OK, divergência 0" ;;
    "") echo "V-09 Reconciliação : INCONCLUSIVO — nenhuma execução depois do fim da janela"; INCONCLUSIVE=$((INCONCLUSIVE + 1)) ;;
    *) echo "V-09 Reconciliação : FAIL — $recon"; FAILED=$((FAILED + 1)) ;;
  esac
  run_check V-09 "Payout L/D  " "
SELECT id, result, stake_minor, payout_minor FROM contracts
WHERE status = 'SETTLED' AND settled_at BETWEEN :'window_start' AND :'window_end'
  AND ((result = 'LOSS' AND payout_minor <> 0) OR (result = 'DRAW' AND payout_minor <> stake_minor));"
  echo "V-09 Payout WIN   : PENDENTE — D-19 (arredondamento) não decidida"
  psql_q "SELECT symbol || ' DRAW=' || round(100.0 * count(*) FILTER (WHERE result = 'DRAW') / count(*), 2) || '%'
             FROM contracts WHERE status = 'SETTLED' AND settled_at BETWEEN :'window_start' AND :'window_end'
             GROUP BY symbol HAVING 100.0 * count(*) FILTER (WHERE result = 'DRAW') / count(*) > 3;" 2>/dev/null \
    | sed 's/^/    alerta (não reprova): /'
fi

want V-10 && run_check V-10 "Pausado     " "
SELECT c.id, c.symbol, c.created_at, i.updated_at FROM contracts c JOIN indices i USING (symbol)
WHERE i.status = 'PAUSED' AND c.created_at > i.updated_at;"

echo "----------------------------------------"
if [ "$FAILED" -gt 0 ]; then
  echo "Resultado: REPROVADO ($FAILED FAIL, $INCONCLUSIVE INCONCLUSIVO)"; exit 1
elif [ "$INCONCLUSIVE" -gt 0 ]; then
  echo "Resultado: REPROVADO ($INCONCLUSIVE INCONCLUSIVO — falta evidência)"; exit 1
fi
echo "Resultado: APROVADO (pendências declaradas acima)"
