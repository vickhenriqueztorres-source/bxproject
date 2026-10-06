#!/usr/bin/env bash
# Varredura estática do código em busca de violações dos padrões R-01 a R-06.
# Somente leitura. Retorna exit 1 se encontrar violação crítica.
# Uso: bash scripts/health-check.sh [diretório-de-código ...]
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

if [ "$#" -gt 0 ]; then
  CODE_DIRS=("$@")
else
  CODE_DIRS=()
  for candidate in services apps; do
    [ -d "$PROJECT_ROOT/$candidate" ] && CODE_DIRS+=("$PROJECT_ROOT/$candidate")
  done
fi

echo "Health-check: 05-resilience-patterns"
echo "----------------------------------------"

if [ "${#CODE_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório de código encontrado (services/ ou apps/) — nada a verificar"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

INCLUDES=(--include='*.ts' --include='*.js' --include='*.py' --include='*.go' --include='*.sql')

scan() {
  grep -rniE -e "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' || true
}

files_with() {
  grep -rliE -e "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' || true
}

report() {
  local level="$1" label="$2" matches="$3"
  if [ -n "$matches" ]; then
    "$level" "$label"
    echo "$matches" | sed 's/^/       /'
  else
    pass "${label/encontrado/ausente}"
  fi
}

# R-01 Outbox
if [ -n "$(scan 'outbox')" ]; then
  if [ -z "$(scan 'SKIP[[:space:]]+LOCKED')" ]; then
    warn "R-01 relay do outbox sem FOR UPDATE SKIP LOCKED"
  else
    pass "R-01 relay com SKIP LOCKED presente"
  fi
  if [ -z "$(scan 'published_at')" ]; then
    warn "R-01 coluna published_at não encontrada"
  else
    pass "R-01 published_at presente"
  fi
else
  warn "R-01 nenhum outbox encontrado"
fi

dual_write=""
for file in $(files_with 'router\.(post|put|patch)|app\.(post|put|patch)'); do
  if grep -qiE 'xadd|\.publish\(' "$file"; then dual_write="$dual_write$file"$'\n'; fi
done
report fail "R-01 publicação em fila dentro de handler HTTP (dual write) encontrado" "${dual_write%$'\n'}"

# R-02 Retry + backoff
report warn "R-02 loop infinito com catch + sleep (retry sem limite?) encontrado" \
  "$(for file in $(files_with 'while[[:space:]]*\([[:space:]]*true[[:space:]]*\)|for[[:space:]]*\([[:space:]]*;[[:space:]]*;[[:space:]]*\)'); do
       if grep -qE 'catch' "$file" && grep -qE 'sleep\(|setTimeout\(' "$file" && ! grep -qiE 'attempt|maxDeliveries|MAX_DELIVERIES|signal\.aborted' "$file"; then echo "$file"; fi
     done)"

report warn "R-02 retry sem jitter encontrado" \
  "$(for file in $(files_with 'retry|backoff'); do
       if ! grep -qiE 'jitter|Math\.random|random\.' "$file"; then echo "$file"; fi
     done)"

# R-03 Timeout
no_timeout=""
for file in $(files_with '\bfetch\('); do
  if ! grep -qE 'signal|AbortSignal|timeout' "$file"; then no_timeout="$no_timeout$file"$'\n'; fi
done
report fail "R-03 fetch sem signal/timeout encontrado" "${no_timeout%$'\n'}"

report warn "R-03 axios sem timeout encontrado" \
  "$(for file in $(files_with 'axios'); do grep -q 'timeout' "$file" || echo "$file"; done)"

report fail "R-03 XREADGROUP com BLOCK 0 (espera infinita) encontrado" \
  "$(scan "BLOCK['\"]?[[:space:]]*,?[[:space:]]*['\"]?0['\"]?[[:space:]]*[,)]|BLOCK[[:space:]]+0[[:space:]]")"

if [ -z "$(scan 'statement_timeout')" ]; then
  warn "R-03 statement_timeout do PostgreSQL não encontrado"
else
  pass "R-03 statement_timeout presente"
fi

# R-04 Circuit breaker
if [ -n "$(scan 'blnk')" ] && [ -z "$(scan 'circuit|breaker|opossum|cockatiel')" ]; then
  warn "R-04 chamadas ao Blnk sem circuit breaker"
else
  pass "R-04 circuit breaker presente ou sem dependência Blnk"
fi

# R-05 DLQ
if [ -n "$(scan 'xreadgroup')" ] && [ -z "$(scan 'dlq:')" ]; then
  warn "R-05 consumidores sem DLQ (dlq:{stream})"
else
  pass "R-05 DLQ presente ou sem consumidores"
fi

report warn "R-05 catch que apenas loga ou ignora o erro encontrado" \
  "$(scan 'catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{[[:space:]]*(console\.(error|log)\([^)]*\);?)?[[:space:]]*\}')"

report fail "R-05 DLQ com MAXLEN (descarte automático) encontrado" \
  "$(scan "xadd\([^)]*dlq[^)]*MAXLEN")"

# R-06 Consumer groups
ack_first="$(for file in $(files_with 'xack'); do
  awk -v f="$file" '
    /for[[:space:]]*\(.*[[:space:]]of[[:space:]]/ { loop = NR; next }
    loop && NR <= loop + 2 && tolower($0) ~ /xack/ { print f ":" NR ": " $0 }
    NF { if (NR > loop + 2) loop = 0 }
  ' "$file"
done)"
report fail "R-06 XACK no início do loop (antes do processamento) encontrado" "$ack_first"

report fail "R-06 nome de consumidor fixo no XREADGROUP encontrado" \
  "$(scan "xreadgroup\([[:space:]]*['\"]GROUP['\"][[:space:]]*,[[:space:]]*['\"][^'\"]+['\"][[:space:]]*,[[:space:]]*['\"][^'\"]+['\"]")"

if [ -n "$(scan 'xreadgroup')" ] && [ -z "$(scan 'xautoclaim|xclaim')" ]; then
  warn "R-06 consumidores sem recuperação de pendentes (XAUTOCLAIM/XCLAIM)"
else
  pass "R-06 recuperação de pendentes presente ou sem consumidores"
fi

pubsub_work=""
for file in $(files_with '\.subscribe\('); do
  case "$file" in
    *ws-gateway*|*websocket*) ;;
    *) pubsub_work="$pubsub_work$file"$'\n' ;;
  esac
done
report warn "R-06 Pub/Sub usado fora do WebSocket Gateway (D-04) encontrado" "${pubsub_work%$'\n'}"

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
