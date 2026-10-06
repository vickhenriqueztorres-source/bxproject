#!/usr/bin/env bash
# Varredura estática do código e da configuração em busca de violações dos controles S-01 a S-06.
# Somente leitura. Nunca imprime o valor de segredos encontrados.
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
  for candidate in services apps infra; do
    [ -d "$PROJECT_ROOT/$candidate" ] && CODE_DIRS+=("$PROJECT_ROOT/$candidate")
  done
  for file in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
    [ -f "$PROJECT_ROOT/$file" ] && CODE_DIRS+=("$PROJECT_ROOT/$file")
  done
fi

echo "Health-check: 04-security-iam"
echo "----------------------------------------"

INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.py' --include='*.go' --include='*.json' --include='*.yml' --include='*.yaml' --include='*.env')

scan() {
  grep -rniE -e "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' | grep -v '\.example' || true
}

scan_case() {
  grep -rnE -e "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' | grep -v '\.example' || true
}

redact() {
  sed -E 's/(:[0-9]+:).*/\1 <conteúdo omitido>/'
}

report() {
  local level="$1" label="$2" matches="$3" mode="${4:-show}"
  if [ -n "$matches" ]; then
    "$level" "$label"
    if [ "$mode" = "redact" ]; then
      echo "$matches" | redact | sed 's/^/       /'
    else
      echo "$matches" | sed 's/^/       /'
    fi
  else
    pass "${label/encontrado/ausente}"
  fi
}

# Segredos versionados (independe de CODE_DIRS)
if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked_env="$(git -C "$PROJECT_ROOT" ls-files | grep -E '(^|/)\.env($|\.)' | grep -vE '\.example$|\.sample$' || true)"
  report fail "S-06 arquivo .env versionado no Git encontrado" "$tracked_env"
fi

if [ -f "$PROJECT_ROOT/.gitignore" ] && grep -qE '^\.env' "$PROJECT_ROOT/.gitignore"; then
  pass "S-06 .env presente no .gitignore"
else
  warn "S-06 .env não encontrado no .gitignore"
fi

if [ "${#CODE_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório de código encontrado (services/, apps/, infra/) — nada mais a verificar"
  echo "----------------------------------------"
  [ "$ERRORS" -gt 0 ] && { echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"; exit 1; }
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

# S-01 Keycloak / OIDC
report fail "S-01 implicit flow (response_type token / implicitFlowEnabled) encontrado" \
  "$(scan "response_type['\"]?[[:space:]]*[:=][[:space:]]*['\"](id_token token|token)['\"]|\"implicitFlowEnabled\"[[:space:]]*:[[:space:]]*true")"

report fail "S-01 Direct Access Grants (password grant) habilitado encontrado" \
  "$(scan "\"directAccessGrantsEnabled\"[[:space:]]*:[[:space:]]*true|grant_type['\"]?[[:space:]]*[:=][[:space:]]*['\"]password['\"]")"

report fail "S-01 redirectUris/webOrigins curinga encontrado" \
  "$(scan "\"(redirectUris|webOrigins)\"[[:space:]]*:[[:space:]]*\[[^]]*\"\*\"")"

report fail "S-01 token em localStorage encontrado" \
  "$(scan "localStorage\.setItem\([^)]*token|store:[[:space:]]*(window\.)?localStorage")"

report warn "S-01 token em sessionStorage encontrado" \
  "$(scan "sessionStorage\.setItem\([^)]*token|store:[[:space:]]*(window\.)?sessionStorage")"

# S-02 JWT validation
decode_only=""
for file in $(grep -rlE 'jwt\.decode\(|decodeJwt\(|jwt_decode\(|jwtDecode\(' "${CODE_DIRS[@]}" --include='*.ts' --include='*.js' --include='*.py' --include='*.go' 2>/dev/null | grep -v node_modules | grep -v '/apps/web/' || true); do
  if ! grep -qE 'jwtVerify|jwt\.verify|verifyAccessToken' "$file"; then
    decode_only="$decode_only$file"$'\n'
  fi
done
report fail "S-02 JWT decodificado sem verificação de assinatura no backend encontrado" "${decode_only%$'\n'}"

report fail "S-02 alg none / HS* na allowlist encontrado" \
  "$(scan "algorithms['\"]?[[:space:]]*:[[:space:]]*\[[^]]*(none|HS256|HS384|HS512)")"

report fail "S-02 ignoreExpiration habilitado encontrado" \
  "$(scan 'ignoreExpiration[[:space:]]*:[[:space:]]*true|verify_exp["'\'']?[[:space:]]*:[[:space:]]*False')"

if [ -z "$(scan 'jwtVerify|jwt\.verify|verifyAccessToken')" ]; then
  warn "S-02 nenhuma verificação de JWT encontrada no backend"
else
  pass "S-02 verificação de JWT presente"
fi

report fail "S-02 token no query string do WebSocket encontrado" \
  "$(scan "searchParams\.get\(['\"](token|access_token)['\"]\)|\?(token|access_token)=")"

# S-03 RBAC
report fail "S-03 autorização baseada em dado do cliente (isAdmin/role no body/query) encontrado" \
  "$(scan '(req|request)\.(body|query|params)\.(isAdmin|is_admin|role|roles|admin)\b')"

if [ -z "$(scan 'requireRole|realm_access')" ]; then
  warn "S-03 checagem de role (requireRole / realm_access) não encontrada"
else
  pass "S-03 checagem de role presente"
fi

# S-04 BOLA / IDOR
idor="$(scan 'FROM[[:space:]]+(contracts|wallets|wallet_transactions|transactions)\b[^;]*WHERE[[:space:]]+id[[:space:]]*=' | grep -viE 'user_id|userId' || true)"
report fail "S-04 query por id sem filtro de user_id encontrado" "$idor"

report fail "S-04 user_id lido do cliente encontrado" \
  "$(scan '(req|request)\.(body|query|params|headers)\.(user_?id|userId)\b')"

# S-05 Mass assignment
report fail "S-05 req.body repassado inteiro (spread / Object.assign / create(req.body)) encontrado" \
  "$(scan '\.\.\.(req|request)\.body|Object\.assign\([^,]+,[[:space:]]*(req|request)\.body|\.(create|insert|update|save)\([[:space:]]*(req|request)\.body[[:space:]]*\)')"

report fail "S-05 campo de servidor lido do body encontrado" \
  "$(scan '(req|request)\.body\.(entry_price|entryPrice|exit_price|price|payout|payout_rate|result|status|balance|expires_at)\b')"

if [ -z "$(scan '\.strict\(\)|additionalProperties["'\'']?[[:space:]]*:[[:space:]]*false|forbidNonWhitelisted|extra=.forbid')" ]; then
  warn "S-05 nenhum DTO estrito (.strict / additionalProperties false) encontrado"
else
  pass "S-05 DTO estrito presente"
fi

# S-06 Secrets
literal_in_code="$(scan "(password|passwd|secret|api_?key|client_secret)['\"]?[[:space:]]*[:=][[:space:]]*['\"][^'\"\$<{[:space:]]{6,}['\"]" | grep -viE 'process\.env|import\.meta\.env|os\.environ|getenv|placeholder' || true)"
literal_in_env="$(scan_case '(PASSWORD|SECRET|API_KEY|CLIENT_SECRET|TOKEN)[A-Z_]*[[:space:]]*[:=][[:space:]]*[^$<{[:space:]]{6,}' | grep -vE '_FILE[[:space:]]*[:=]' || true)"
credential_in_url="$(scan '://[^:/@[:space:]]+:[^@$<{[:space:]]{3,}@' || true)"
report fail "S-06 segredo literal no código/config encontrado" \
  "$(printf '%s\n%s\n%s' "$literal_in_code" "$literal_in_env" "$credential_in_url" | sed '/^$/d' | sort -u)" redact

report fail "S-06 chave privada embutida encontrado" \
  "$(scan '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----')" redact

report fail "S-06 segredo exposto ao bundle do front-end (VITE_*SECRET/KEY/PASSWORD) encontrado" \
  "$(scan 'VITE_[A-Z_]*(SECRET|API_KEY|PASSWORD|PRIVATE)')" redact

report fail "S-06 conexão com superusuário postgres encontrado" \
  "$(scan 'postgres(ql)?://postgres:')" redact

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
