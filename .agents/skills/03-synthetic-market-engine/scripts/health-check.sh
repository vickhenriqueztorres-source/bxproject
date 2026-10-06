#!/usr/bin/env bash
# Varredura estática do código em busca de violações das invariantes M-01 a M-06.
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

echo "Health-check: 03-synthetic-market-engine"
echo "----------------------------------------"

if [ "${#CODE_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório de código encontrado (services/ ou apps/) — nada a verificar"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.py' --include='*.sql' --include='*.go')
MARKET_PATHS='(tick|price|market|generator|candle|chart|ws-gateway|websocket)'

scan() {
  grep -rniE -e "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' || true
}

scan_market() {
  scan "$1" | grep -iE "^[^:]*$MARKET_PATHS" || true
}

market_files() {
  grep -rliE "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -iE "$MARKET_PATHS" || true
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

# M-01 CSPRNG
report fail "M-01 PRNG não criptográfico (Math.random / seedrandom / random.random) encontrado" \
  "$(scan_market 'Math\.random\(|seedrandom|random\.random\(|math/rand')"

if [ -z "$(scan_market 'randomBytes|randomInt|getRandomValues|secrets\.|crypto/rand')" ]; then
  warn "M-01 nenhuma fonte CSPRNG encontrada no código de mercado"
else
  pass "M-01 fonte CSPRNG presente"
fi

# M-02 Tick sequence
if [ -z "$(scan_market 'sequence')" ]; then
  warn "M-02 campo sequence não encontrado no código de mercado"
else
  pass "M-02 sequence presente"
fi

if [ -z "$(scan 'PRIMARY KEY[[:space:]]*\([[:space:]]*symbol[[:space:]]*,[[:space:]]*sequence|UNIQUE[[:space:]]*\([[:space:]]*symbol[[:space:]]*,[[:space:]]*sequence')" ]; then
  warn "M-02 constraint única (symbol, sequence) não encontrada"
else
  pass "M-02 constraint única (symbol, sequence) presente"
fi

if [ -z "$(scan_market 'lease:tick-engine|lease_epoch')" ]; then
  warn "M-02 leader lease não encontrado"
else
  pass "M-02 leader lease presente"
fi

# M-03 Persistir antes de publicar: arquivos do Tick Engine que publicam diretamente
direct_publish=""
for file in $(grep -rliE '\.publish\(|xadd|ws\.send|PUBLISH' "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -iE 'tick[-_]?engine' || true); do
  direct_publish="$direct_publish$file"$'\n'
done
report fail "M-03 publicação direta no Tick Engine (sem passar pelo outbox) encontrado" "${direct_publish%$'\n'}"

if [ -z "$(scan_market 'outbox')" ]; then
  warn "M-03 outbox não encontrado no fluxo de ticks"
else
  pass "M-03 outbox presente"
fi

# M-04 Hash encadeado
if [ -z "$(scan_market "sha256|sha-256")" ] || [ -z "$(scan_market 'prev_hash|prevHash')" ]; then
  warn "M-04 hash encadeado (sha256 + prev_hash) não encontrado"
else
  pass "M-04 hash encadeado presente"
fi

report warn "M-04 hash sobre JSON.stringify (serialização instável) encontrado" \
  "$(scan_market 'update\(JSON\.stringify')"

# M-05 Candle OHLCV
report fail "M-05 volume incremental não idempotente (volume += 1 / volume++) encontrado" \
  "$(scan_market 'volume[[:space:]]*(\+=|\+\+)')"

candle_pubsub=""
for file in $(grep -rliE 'subscribe\(' "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -iE 'candle' || true); do
  if grep -qE ':live' "$file"; then candle_pubsub="$candle_pubsub$file"$'\n'; fi
done
report fail "M-05 Candle Worker consumindo Pub/Sub (viola D-04) encontrado" "${candle_pubsub%$'\n'}"

# M-06 WebSocket feed
if [ -n "$(market_files 'WebSocket|ws\.on|socket')" ]; then
  if [ -z "$(scan_market 'xrange|XRANGE')" ] || [ -z "$(scan_market 'lastSequence')" ]; then
    warn "M-06 catch-up por lastSequence (XRANGE) não encontrado no feed"
  else
    pass "M-06 catch-up por lastSequence presente"
  fi
fi

report fail "M-06 token no query string do WebSocket encontrado (ver 04-security-iam)" \
  "$(scan_market "searchParams\.get\(['\"](token|access_token)['\"]\)|\?(token|access_token)=")"

report warn "preço em ponto flutuante (parseFloat/Number) encontrado" \
  "$(scan_market '(parseFloat|Number)\([^)]*price')"

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
