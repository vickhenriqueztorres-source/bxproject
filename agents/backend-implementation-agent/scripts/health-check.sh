#!/usr/bin/env bash
# Varredura estática do código backend contra as regras B-01 a B-17 do backend-implementation-agent.
# Somente leitura. Complementa (não substitui) os health-checks das skills 02 a 05.
# Uso: bash scripts/health-check.sh [raiz-do-projeto]
set -uo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${1:-$(cd "$AGENT_DIR/../.." && pwd)}"
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

report() {
  local level="$1" label="$2" matches="$3"
  if [ -n "$matches" ]; then
    "$level" "$label"
    echo "$matches" | head -n 10 | sed 's/^/       /'
  else
    pass "${label/encontrado/ausente}"
  fi
}

echo "Health-check: backend-implementation-agent"
echo "Raiz: $ROOT"
echo "----------------------------------------"

SRC_DIRS=()
for dir in services db/migrations; do
  [ -d "$ROOT/$dir" ] && SRC_DIRS+=("$ROOT/$dir")
done

if [ "${#SRC_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório services/ ou db/migrations/ encontrado — nada a verificar"
  echo "----------------------------------------"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

INCLUDES=(--include='*.ts' --include='*.js' --include='*.mjs' --include='*.sql')

scan() {
  grep -rnE "${@:2}" -e "$1" "${SRC_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null \
    | grep -v node_modules | grep -vE '\.(unit\.)?test\.[tj]s:' | grep -vE '/(tests?|__tests__)/' || true
}

scan_dir() {
  local dir="$1" pattern="$2"
  [ -d "$ROOT/$dir" ] || return 0
  grep -rnE -e "$pattern" "$ROOT/$dir" --include='*.ts' --include='*.js' 2>/dev/null \
    | grep -v node_modules | grep -vE '\.(unit\.)?test\.[tj]s:' || true
}

# Fronteira de escrita
front_files=""
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  front_files="$(git -C "$ROOT" diff --name-only HEAD 2>/dev/null | grep -E '^apps/(web|admin)/|^tests/(integration|chaos|load)/' || true)"
fi
report fail "fronteira: arquivo de front ou de QA alterado encontrado" "$front_files"

# B-01 valores sensíveis vindos do corpo
report fail "B-01 preço/resultado/payout/saldo/user_id lido do corpo encontrado" \
  "$(scan '(req|request|ctx\.request)\.body\??\.(entry_?price|exit_?price|price|result|payout\w*|balance\w*|user_?id|userId)\b' -i)"

# B-02 dinheiro em ponto flutuante
report fail "B-02 aritmética de ponto flutuante sobre dinheiro encontrado" \
  "$(scan '(\*[[:space:]]*0?\.85\b|parseFloat\([^)]*(stake|payout|amount|minor)|(stake|payout|amount)\w*[^;]*\.toFixed\(|Math\.(round|floor|ceil)\([^)]*(stake|payout|amount|minor))' -i)"

# B-03 saldo fora do Blnk
report fail "B-03 UPDATE de saldo encontrado" "$(scan 'UPDATE[[:space:]]+[a-z_]+[[:space:]]+SET[[:space:]]+[a-z_]*balance' -i)"
report fail "B-03 tabela de ledger própria encontrado" \
  "$(scan 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(ledger_|wallet_accounts|balances\b)' -i)"

# B-04 chave Blnk não determinística
report fail "B-04 reference do Blnk com valor aleatório encontrado" \
  "$(scan '(reference|idempotency_?key)[[:space:]]*:[[:space:]]*(crypto\.)?(randomUUID|uuid(v4)?)\(' -i)"

# B-05 Idempotency-Key
if [ -n "$(scan 'post\(.?/contracts.?' -i)" ]; then
  if [ -n "$(scan 'idempotency-key' -i)" ]; then
    pass "B-05 rota de contratos lê o header Idempotency-Key"
  else
    fail "B-05 POST /contracts sem leitura do header Idempotency-Key"
  fi
fi

# B-06 aleatoriedade
report fail "B-06 Math.random em services/ encontrado" "$(scan 'Math\.random\(')"

# B-07 Tick Engine não publica
report fail "B-07 Tick Engine publicando direto (XADD/PUBLISH) encontrado" \
  "$(scan_dir services/tick-engine '\.(xadd|publish)\(|["'"'"'](XADD|PUBLISH)["'"'"']')"
report warn "B-07 setInterval no Tick Engine encontrado (preferir agendamento alinhado ao relógio)" \
  "$(scan_dir services/tick-engine 'setInterval\(')"

# B-08 settlement lê o tick do Postgres
report fail "B-08 settlement lendo tick do Redis encontrado" \
  "$(scan_dir services/settlement-worker 'tick:last:|\.subscribe\(|ticks:[^"'"'"'`]*:live')"
if [ -d "$ROOT/services/settlement-worker" ]; then
  if [ -n "$(scan_dir services/settlement-worker 'FOR[[:space:]]+UPDATE')" ]; then
    pass "B-08 settlement usa SELECT ... FOR UPDATE"
  else
    fail "B-08 settlement sem SELECT ... FOR UPDATE"
  fi
fi

# B-09 chamadas externas com timeout
fetch_without_timeout="$(scan '\bfetch\(' | grep -vE 'signal|timeout' || true)"
report warn "B-09 fetch sem signal/timeout na mesma linha encontrado (conferir manualmente)" "$fetch_without_timeout"

# B-10 JWT
report fail "B-10 jwt.decode usado como validação encontrado" "$(scan 'jwt\.decode\(|jwtDecode\(')"
report fail "B-10 algoritmo 'none' ou HS256 aceito encontrado" "$(scan "algorithms[[:space:]]*:[[:space:]]*\[[^]]*['\"](none|HS256)['\"]" -i)"

# B-11 SQL parametrizado
report fail "B-11 interpolação de string em SQL encontrado" \
  "$(scan '(query|execute|one|oneOrNone|many|any|none)\([[:space:]]*`[^`]*(SELECT|INSERT|UPDATE|DELETE)[^`]*\$\{' -i)"

# B-12 logs
report fail "B-12 token/senha/segredo em log encontrado" \
  "$(scan '(console|log(ger)?)\.(log|info|warn|error|debug)\([^)]*(authorization|password|senha|access_?token|refresh_?token|secret|req\.headers)' -i)"
if [ -n "$(scan 'console\.log\(')" ]; then
  warn "B-12 console.log em services/ (usar logger estruturado)"
fi

# B-13 rate limit
if [ -d "$ROOT/services/api" ]; then
  if [ -n "$(scan_dir services/api 'rate.?limit|ratelimit:')" ]; then
    pass "B-13 rate limit presente na API"
  else
    fail "B-13 rate limit ausente em services/api"
  fi
fi

# B-14 admin não altera saldo
report fail "B-14 rota admin de saldo encontrado" "$(scan '/admin/[^"'"'"'`]*(balance|saldo|credit|debit|adjust)' -i)"

# B-15 Blnk só pela allowlist de 02-financial-invariants
blnk_calls="$(scan '(blnk|ledgerClient)\w*\.(get|post|put|patch|delete|request)\([[:space:]]*['"'"'"`]/|\$\{[[:space:]]*(BLNK|blnk)\w*[[:space:]]*\}/' -i)"
blnk_off_list="$(printf '%s\n' "$blnk_calls" | grep -vE '/(ledgers|balances|transactions)['"'"'"`?]|/balances/\$\{[^}]*\}['"'"'"`?]' | grep -v '^$' || true)"
report fail "B-15 endpoint do Blnk fora da allowlist encontrado (conferir doc oficial da versão fixada)" "$blnk_off_list"
report fail "B-15 PUT/PATCH/DELETE no Blnk encontrado (ledger é append-only)" \
  "$(scan '(blnk|ledgerClient)\w*\.(put|patch|delete)\(' -i)"

# B-16 limites do WebSocket Gateway no servidor
WS_DIR="services/websocket-gateway"
require_ws() {
  if [ -n "$(scan_dir "$WS_DIR" "$1")" ]; then pass "$2"; else fail "$3"; fi
}
if [ -d "$ROOT/$WS_DIR" ]; then
  require_ws '\bping\b' "B-16 gateway envia ping" "B-16 gateway sem ping (conexão zumbi nunca fecha)"
  require_ws '\bpong\b' "B-16 gateway trata pong" "B-16 gateway sem tratamento de pong (fechar após 45 s)"
  require_ws 'MAX_CONNECTIONS|CONNECTIONS_PER_USER|connectionsPerUser|connectionsByUser|maxConnections' \
    "B-16 limite de conexões por usuário presente" "B-16 sem limite de conexões por usuário (máx. 5)"
  require_ws 'MAX_SYMBOLS|maxSymbols|symbolsPerConnection' \
    "B-16 limite de símbolos por conexão presente" "B-16 sem limite de símbolos por conexão (máx. 10)"
  require_ws '[Rr]ate.?[Ll]imit|[Tt]oken.?[Bb]ucket|MAX_MESSAGES|messagesPer' \
    "B-16 rate limit de mensagens presente" "B-16 sem rate limit de mensagens por conexão"
  require_ws '[Aa]uth.?[Tt]imeout|AUTH_TIMEOUT' \
    "B-16 prazo de autenticação presente" "B-16 sem prazo para a mensagem auth (5 s)"
  require_ws 'removeListener|removeAllListeners|\.off\(|unsubscribe\(|clearInterval\(|clearTimeout\(' \
    "B-16 limpeza no close presente" "B-16 sem limpeza de listeners/timers no close (vazamento de memória)"
  report fail "B-16 token na URL do WebSocket encontrado" \
    "$(scan_dir "$WS_DIR" 'searchParams\.get\(['"'"'"]token|query\.token|[?&]token=')"
fi

# B-17 trabalho crítico só por Streams com consumer group
pubsub_work="$(scan '(redis|sub|subscriber|pubsub|client)\w*\.p?subscribe\(' -i | grep -v '/services/websocket-gateway/' || true)"
report fail "B-17 Pub/Sub consumido fora do WebSocket Gateway encontrado (trabalho crítico exige Stream)" "$pubsub_work"
report fail "B-17 XREAD sem consumer group encontrado" "$(scan '\bxread\(|['"'"'"]XREAD['"'"'"]' -i)"
report fail "B-17 XAUTOCLAIM com min-idle-time 0 encontrado" \
  "$(scan 'xautoclaim['"'"'"]?[[:space:]]*[(,]([^,()]+,){3}[[:space:]]*['"'"'"]?0['"'"'"]?[[:space:]]*[,)]' -i)"

# Migrations reversíveis
if [ -d "$ROOT/db/migrations" ]; then
  missing_down=""
  for up in "$ROOT"/db/migrations/*.up.sql; do
    [ -e "$up" ] || continue
    down="${up%.up.sql}.down.sql"
    [ -f "$down" ] || missing_down+="${up#$ROOT/}"$'\n'
  done
  report fail "migration sem .down.sql correspondente encontrado" "${missing_down%$'\n'}"
  loose="$(find "$ROOT/db/migrations" -maxdepth 1 -name '*.sql' ! -name '*.up.sql' ! -name '*.down.sql' 2>/dev/null | sed "s#^$ROOT/##")"
  report warn "migration fora do padrão NNNN_nome.up.sql/.down.sql encontrado" "$loose"
fi

# Testes unitários ao lado do código
if [ -d "$ROOT/services" ]; then
  unit_count="$(find "$ROOT/services" -name '*.unit.test.ts' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')"
  if [ "$unit_count" -gt 0 ]; then
    pass "$unit_count arquivo(s) *.unit.test.ts em services/"
  else
    warn "nenhum *.unit.test.ts em services/"
  fi
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
