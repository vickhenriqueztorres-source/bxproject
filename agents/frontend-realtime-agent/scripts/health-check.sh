#!/usr/bin/env bash
# Varredura estática do front-end contra as regras F-01 a F-14 do frontend-realtime-agent.
# Somente leitura. Complementa (não substitui) o health-check da skill 04-security-iam.
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

echo "Health-check: frontend-realtime-agent"
echo "Raiz: $ROOT"
echo "----------------------------------------"

SRC_DIRS=()
for dir in apps/web apps/admin; do
  [ -d "$ROOT/$dir" ] && SRC_DIRS+=("$ROOT/$dir")
done

if [ "${#SRC_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório apps/web/ ou apps/admin/ encontrado — nada a verificar"
  echo "----------------------------------------"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx')

scan() {
  grep -rnE "${@:2}" -e "$1" "${SRC_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null \
    | grep -vE '/(node_modules|dist|build)/' \
    | grep -vE '\.(unit\.)?test\.[tj]sx?:' || true
}

# Fronteira de escrita
outside=""
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  outside="$(git -C "$ROOT" diff --name-only HEAD 2>/dev/null | grep -E '^(services|db|infra|\.github)/|^tests/(e2e|integration|load|chaos)/' || true)"
fi
report fail "fronteira: arquivo de backend, infra ou QA alterado encontrado" "$outside"

# F-01 corpo do POST /contracts
report fail "F-01 preço/resultado/payout/saldo/user_id enviado pelo front encontrado" \
  "$(scan '(entry_?price|exit_?price|result|payout\w*|balance\w*|user_?id|userId)[[:space:]]*:' -i | grep -iE 'contracts|JSON\.stringify|body' || true)"
report fail "F-01 user_id em query string encontrado" "$(scan '[?&](user_?id|userId)=' -i)"

# F-02 dinheiro
report fail "F-02 aritmética de ponto flutuante sobre dinheiro encontrado" \
  "$(scan '(\*[[:space:]]*0?\.85\b|parseFloat\(|(stake|payout|amount|balance|minor)\w*[^;]*\.toFixed\()' -i)"
money_formatters="$(scan "new Intl\.NumberFormat\([^)]*currency" | grep -v 'lib/money' || true)"
report warn "F-02 formatador de moeda fora de lib/money encontrado (usar formatMinor)" "$money_formatters"

# F-03 saldo local
report fail "F-03 saldo calculado no front encontrado" \
  "$(scan '(balance|available|saldo)\w*[[:space:]]*[-+]=?[[:space:]]*\w*(stake|amount|payout)|set(Balance|Saldo|Available)\(' -i)"

# F-04 tokens e fluxo OIDC
report fail "F-04 token em localStorage/sessionStorage encontrado" \
  "$(scan '(local|session)Storage\.setItem\([^)]*token|store:[[:space:]]*(window\.)?(local|session)Storage' -i)"
report fail "F-04 implicit flow encontrado" "$(scan "response_type:[[:space:]]*['\"][^'\"]*token" -i)"
report fail "F-04 Direct Access Grant (senha enviada pelo front) encontrado" "$(scan 'grant_type=password|grant_type:[[:space:]]*.password' -i)"

# F-05 WebSocket sem token na URL
report fail "F-05 token na URL do WebSocket encontrado" "$(scan 'new WebSocket\([^)]*(token|access_token|jwt|bearer)' -i)"
if [ -n "$(scan 'new WebSocket\(')" ]; then
  if [ -n "$(scan "type:[[:space:]]*['\"]auth['\"]")" ]; then
    pass "F-05 cliente envia mensagem de auth"
  else
    fail "F-05 cliente WebSocket sem mensagem { type: 'auth' }"
  fi
fi

# F-06 / F-07 protocolo do feed
if [ -n "$(scan 'new WebSocket\(')" ]; then
  [ -n "$(scan 'lastSequence')" ] && pass "F-06 cliente usa lastSequence" || fail "F-06 cliente WebSocket sem lastSequence"
  [ -n "$(scan "['\"]pong['\"]")" ] && pass "F-07 cliente responde pong" || fail "F-07 cliente não responde ping com pong"
  [ -n "$(scan 'resync_required')" ] && pass "F-07 cliente trata resync_required" || fail "F-07 cliente não trata resync_required"
fi

# Math.random só no backoff; Idempotency-Key com crypto.randomUUID
random_outside="$(scan 'Math\.random\(' | grep -v '/backoff\.' || true)"
report fail "Math.random fora de backoff.ts encontrado" "$random_outside"
if [ -n "$(scan 'Idempotency-Key' -i)" ]; then
  [ -n "$(scan 'crypto\.randomUUID\(')" ] && pass "F-10 Idempotency-Key gerada com crypto.randomUUID" \
    || fail "F-10 Idempotency-Key sem crypto.randomUUID"
fi

# F-09 resultado decidido no front
report fail "F-09 resultado calculado a partir de preço no front encontrado" \
  "$(scan '(price|close|last\w*)[[:space:]]*[<>]=?[[:space:]]*\w*\.?entry_?price|entry_?price[[:space:]]*[<>]=?[[:space:]]*\w*(price|close)' -i)"

# F-12 XSS e segredos
report fail "F-12 dangerouslySetInnerHTML encontrado" "$(scan 'dangerouslySetInnerHTML')"
report fail "F-12 segredo em variável VITE_ encontrado" "$(scan 'VITE_[A-Z_]*(SECRET|PRIVATE|PASSWORD|API_KEY)' )"
for env_file in "$ROOT"/apps/*/.env "$ROOT"/apps/*/.env.local; do
  [ -f "$env_file" ] && warn "F-12 arquivo ${env_file#$ROOT/} presente (conferir se está no .gitignore)"
done

# F-13 conexões e gráfico
ws_count="$(scan 'new WebSocket\(' | wc -l | tr -d ' ')"
if [ "$ws_count" -gt 1 ]; then
  warn "F-13 $ws_count pontos criam WebSocket (esperado: um provider)"
fi
report warn "F-13 setData chamado dentro de handler de mensagem encontrado (usar update)" \
  "$(scan 'onmessage[^}]*setData\(|onTick[^}]*setData\(')"

# F-14 admin sem edição de saldo
if [ -d "$ROOT/apps/admin" ]; then
  admin_balance="$(grep -rnE -i '(adjust|ajust|credit|debit)\w*(balance|saldo)?|/admin/[^"'"'"'`]*(balance|saldo)' "$ROOT/apps/admin" "${INCLUDES[@]}" 2>/dev/null | grep -vE '/(node_modules|dist)/' || true)"
  report fail "F-14 ajuste de saldo no painel admin encontrado" "$admin_balance"
fi

# Testes unitários
unit_count="$(find "${SRC_DIRS[@]}" -name '*.unit.test.ts*' -not -path '*/node_modules/*' 2>/dev/null | wc -l | tr -d ' ')"
if [ "$unit_count" -gt 0 ]; then
  pass "$unit_count arquivo(s) *.unit.test.ts(x)"
else
  warn "nenhum *.unit.test.ts(x) em apps/"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
