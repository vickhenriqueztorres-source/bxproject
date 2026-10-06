#!/usr/bin/env bash
# Triagem estática de segurança contra S-01 a S-06 e SR-07 a SR-11.
# Somente leitura: não grava nada no repositório. Todo trecho que pode conter segredo é mascarado
# antes de ser impresso (SR-06). Cada linha apontada precisa ser lida no contexto.
#
# Uso:
#   bash scripts/health-check.sh [raiz]                          triagem
#   bash scripts/health-check.sh --snapshot ARQ [raiz]            grava estado do worktree em ARQ (fora do repo)
#   bash scripts/health-check.sh --verify-untouched ARQ [raiz]    prova que o revisor não alterou nada (SR-01)
set -uo pipefail

AGENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="scan"
SNAPSHOT_FILE=""
case "${1:-}" in
  --snapshot|--verify-untouched) MODE="${1#--}"; SNAPSHOT_FILE="${2:?arquivo de snapshot obrigatório}"; shift 2 ;;
esac
ROOT="${1:-$(cd "$AGENT_DIR/../.." && pwd)}"
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

worktree_state() {
  git -C "$ROOT" status --porcelain=v1 --untracked-files=all 2>/dev/null
  git -C "$ROOT" diff HEAD 2>/dev/null | sha256sum | cut -d' ' -f1
}

if [ "$MODE" != "scan" ]; then
  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[FAIL] $ROOT não é um repositório git"; exit 1
  fi
  case "$SNAPSHOT_FILE" in "$ROOT"/*) echo "[FAIL] snapshot deve ficar fora do repositório"; exit 1 ;; esac
  if [ "$MODE" = "snapshot" ]; then
    worktree_state > "$SNAPSHOT_FILE"
    echo "[OK]   snapshot gravado em $SNAPSHOT_FILE"; exit 0
  fi
  current="$(worktree_state)"
  if [ "$current" = "$(cat "$SNAPSHOT_FILE")" ]; then
    echo "[OK]   SR-01 nenhum arquivo alterado durante a revisão"; exit 0
  fi
  echo "[FAIL] SR-01 o worktree mudou durante a revisão (lista de arquivos):"
  comm -3 <(printf '%s\n' "$current" | sort) <(sort "$SNAPSHOT_FILE") | grep -E '^[[:space:]]*.. ' | head -n 20 | sed 's/^[[:space:]]*/       /'
  exit 1
fi

# Mascara qualquer valor após chave sensível, tokens Bearer, chaves AWS e blocos PEM.
mask() {
  sed -E \
    -e 's/((PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|CLIENT_SECRET|ACCESS_KEY)[A-Za-z0-9_]*["'"'"']?[[:space:]]*[:=][[:space:]]*)[^[:space:],}]+/\1****/Ig' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._~+\/=-]+/\1****/g' \
    -e 's/AKIA[0-9A-Z]{16}/AKIA****/g' \
    -e 's/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/<jwt ****>/g'
}

report() {
  local level="$1" label="$2" matches="$3"
  if [ -n "$matches" ]; then
    "$level" "$label"
    echo "$matches" | head -n 10 | mask | cut -c1-200 | sed 's/^/       /'
  else
    pass "${label/encontrado/ausente}"
  fi
}

echo "Health-check: security-reviewer (triagem, valores mascarados)"
echo "Raiz: $ROOT"
echo "----------------------------------------"

SRC_DIRS=()
for dir in services apps infra .github; do
  [ -d "$ROOT/$dir" ] && SRC_DIRS+=("$ROOT/$dir")
done
COMPOSE_FILES="$(find "$ROOT" -maxdepth 3 -name 'docker-compose*.y*ml' -not -path '*/node_modules/*' 2>/dev/null)"

if [ "${#SRC_DIRS[@]}" -eq 0 ] && [ -z "$COMPOSE_FILES" ]; then
  warn "nenhum services/, apps/, infra/ ou docker-compose encontrado — nada a revisar"
  echo "----------------------------------------"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

scan() {
  [ "${#SRC_DIRS[@]}" -eq 0 ] && return 0
  grep -rnE "${@:2}" -e "$1" "${SRC_DIRS[@]}" \
    --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
    --include='*.json' --include='*.yml' --include='*.yaml' --include='*.env*' 2>/dev/null \
    | grep -vE '/(node_modules|dist|build)/' \
    | grep -vE '\.(unit\.|int\.)?test\.[tj]sx?:' \
    | grep -vE '\.env\.example:' || true
}

# S-01 Keycloak / OIDC
report fail "S-01 implicit flow habilitado encontrado" "$(scan '"implicitFlowEnabled"[[:space:]]*:[[:space:]]*true')"
report fail "S-01 directAccessGrantsEnabled (password grant) encontrado" "$(scan '"directAccessGrantsEnabled"[[:space:]]*:[[:space:]]*true')"
report fail "S-01 redirectUris/webOrigins curinga encontrado" "$(scan '"(redirectUris|webOrigins)"[[:space:]]*:[[:space:]]*\[[^]]*"(\*|\+)"')"
report fail "S-01 bruteForceProtected desligado encontrado" "$(scan '"bruteForceProtected"[[:space:]]*:[[:space:]]*false')"
if [ -n "$(scan '"clientId"')" ] && [ -z "$(scan 'pkce\.code\.challenge\.method"[[:space:]]*:[[:space:]]*"S256"')" ]; then
  fail "S-01 realm sem pkce.code.challenge.method S256"
fi
report fail "S-01 implicit flow no front encontrado" "$(scan "response_type[\"']?[[:space:]]*:[[:space:]]*['\"][^'\"]*token" -i)"
report fail "S-01 token em localStorage/sessionStorage encontrado" "$(scan '(local|session)Storage\.setItem\([^)]*token|store:[[:space:]]*(window\.)?(local|session)Storage' -i)"

# S-02 JWT
report fail "S-02/SR-08 jwt.decode para decisão de acesso encontrado" "$(scan '(jwt\.decode|jwtDecode|decodeJwt)\(' | grep -v '/apps/' || true)"
report fail "S-02 ignoreExpiration encontrado" "$(scan 'ignoreExpiration[[:space:]]*:[[:space:]]*true')"
report fail "S-02 algoritmo fora da allowlist RS256 encontrado" "$(scan "algorithms[[:space:]]*:[[:space:]]*\[[^]]*['\"](none|HS256|HS384|HS512)['\"]" -i)"
report warn "S-02 tolerância de relógio acima de 30 s encontrado" "$(scan 'clockTolerance[[:space:]]*:[[:space:]]*([3-9][1-9]|[4-9][0-9]|[0-9]{3,})')"
report fail "S-02/SR-10 token em query string encontrado" \
  "$(scan "searchParams\.get\(['\"](token|access_token|jwt)['\"]|[?&](token|access_token)=|new WebSocket\([^)]*(token|access_token)" -i)"

# S-03 RBAC
report fail "S-03 role/admin vindo do body encontrado" "$(scan 'req\.body\.(isAdmin|role|roles)\b')"
report warn "S-03 rota /admin sem requireRole na mesma linha encontrado" \
  "$(scan "\.(get|post|put|patch|delete)\([[:space:]]*['\"\`]/admin" -i | grep -v 'requireRole' || true)"
report fail "S-03/SR-11 AUDITOR em rota de escrita encontrado" \
  "$(scan "\.(post|put|patch|delete)\([^)]*requireRole\([^)]*AUDITOR" -i)"
report fail "SR-11 rota que edita saldo encontrado" "$(scan "/admin/[^'\"\`]*(balance|saldo)|(adjust|edit|set)Balance" -i)"

# S-04 BOLA / IDOR
report fail "S-04 query de recurso por id sem user_id encontrado" \
  "$(scan "FROM[[:space:]]+(contracts|transactions|wallets)[[:space:]]+WHERE[[:space:]]+(id|idempotency_key)[[:space:]]*=[[:space:]]*\\\$1" -i | grep -vi 'user_id' || true)"
report warn "SR-09 403 em rota de recurso do usuário encontrado (deveria ser 404)" \
  "$(scan "user_id[^;]*!==?[^;]*sub[^;]*403|status\(403\)" | grep -iE 'contract|wallet|transaction' || true)"

# S-05 mass assignment
report fail "S-05 req.body espalhado ou atribuído encontrado" "$(scan '\.\.\.req\.body|Object\.assign\([^)]*req\.body|create\([[:space:]]*req\.body')"
for f in $(scan 'z\.object\(' | cut -d: -f1 | sort -u); do
  grep -q '\.strict()' "$f" || warn "S-05 z.object sem .strict() em ${f#$ROOT/}"
done

# S-06 segredos
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked_env="$(git -C "$ROOT" ls-files | grep -E '(^|/)\.env(\.[a-z]+)?$' | grep -vE '\.env\.example$' || true)"
  report fail "S-06 arquivo .env versionado encontrado" "$tracked_env"
  tracked_keys="$(git -C "$ROOT" ls-files | grep -E '\.(pem|key|p12|pfx)$' || true)"
  report fail "S-06 chave/certificado privado versionado encontrado" "$tracked_keys"
fi
report fail "S-06 bloco PEM de chave privada encontrado" "$(scan '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----')"
report fail "S-06 chave de acesso AWS encontrado" "$(scan 'AKIA[0-9A-Z]{16}')"
report fail "S-06 segredo em variável VITE_ encontrado" "$(scan 'VITE_[A-Z_]*(SECRET|PRIVATE|PASSWORD|API_KEY|CLIENT_SECRET)')"
report fail "S-06 header Authorization/token em log encontrado" \
  "$(scan '(log(ger)?|console)\.(info|debug|warn|error|log)\([^)]*(req\.headers|authorization|access_?token|refresh_?token|password)' -i)"
if [ -n "$COMPOSE_FILES" ]; then
  literal="$(grep -nHE '^[[:space:]]*-?[[:space:]]*[A-Z_]*(PASSWORD|SECRET|TOKEN|API_KEY)[A-Z_]*[[:space:]]*[:=][[:space:]]*[^$[:space:]{][^[:space:]]*' $COMPOSE_FILES 2>/dev/null | grep -vE '_FILE[[:space:]]*[:=]' || true)"
  report fail "S-06 senha/segredo literal no Compose encontrado" "$literal"
  exposed="$(grep -nHE -A3 '^[[:space:]]+(postgres|redis|blnk|timescale)[a-z_-]*:[[:space:]]*$' $COMPOSE_FILES 2>/dev/null | grep -E 'ports:|"?[0-9]+:(5432|6379|5001)' || true)"
  report warn "S-06 banco/fila com porta publicada no host encontrado (aceitável só em dev)" "$exposed"
  report warn "S-06 serviço usando o superusuário postgres encontrado" "$(grep -nHE 'POSTGRES_USER[[:space:]]*[:=][[:space:]]*postgres\b|postgres://postgres:' $COMPOSE_FILES 2>/dev/null || true)"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: $ERRORS ponto(s) para leitura obrigatória, $WARNINGS aviso(s)"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
