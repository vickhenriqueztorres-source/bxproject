#!/usr/bin/env bash
# Varre o projeto atrás de sinais típicos de código gerado por IA com falha (classes F-xx).
# Uso: bash scripts/health-check.sh [raiz-do-projeto]
# Sai com código 1 se houver algum [FAIL]. [WARN] pede revisão humana, não reprova.
set -uo pipefail

ROOT="${1:-.}"
ROOT="${ROOT%/}"
FAILS=0
WARNS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNS=$((WARNS + 1)); }
fail() { echo "[FAIL] $1"; FAILS=$((FAILS + 1)); }

show() {
  head -n 5 | sed "s|^$ROOT/||; s|^|       |" | cut -c1-200
}

report() {
  local level="$1" label="$2" out="$3"
  if [ -z "$out" ]; then
    pass "$label"
    return
  fi
  local count
  count="$(printf '%s\n' "$out" | wc -l | tr -d ' ')"
  if [ "$level" = FAIL ]; then fail "$label ($count ocorrência(s))"; else warn "$label ($count ocorrência(s))"; fi
  printf '%s\n' "$out" | show
}

check() {
  local level="$1" label="$2" regex="$3"
  shift 3
  if [ "$#" -eq 0 ]; then
    pass "$label (nenhum arquivo aplicável)"
    return
  fi
  report "$level" "$label" "$(grep -nHE -- "$regex" "$@" 2>/dev/null)"
}

# Docs de skills/agentes contêm exemplos propositais de código errado: ficam fora da varredura.
FILES=()
while IFS= read -r -d '' file; do FILES+=("$file"); done < <(
  find "$ROOT" \
    \( -name node_modules -o -name .git -o -name .next -o -name dist -o -name build -o -name coverage \
       -o -name skills -o -name agents -o -name v0_memories -o -name user_read_only_context \) -prune \
    -o -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \
       -o -name '*.yml' -o -name '*.yaml' -o -name 'package.json' -o -name '.env' -o -name '.env.*' \) -print0
)

SRC=() TESTS=() TIME_CRITICAL=() CI=() COMPOSE=() COMPOSE_PROD=() INFRA_YAML=() ENV_FILES=()
TEST_RE='(^|/)(tests?|__tests__|e2e)/|\.(test|spec)\.[cm]?[jt]sx?$'

for file in ${FILES[@]+"${FILES[@]}"}; do
  rel="${file#"$ROOT"/}"
  case "$rel" in
    *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
      if printf '%s' "$rel" | grep -qE "$TEST_RE"; then
        TESTS+=("$file")
      else
        SRC+=("$file")
        printf '%s' "$rel" | grep -qiE 'tick|settle|candle|outbox|relay' && TIME_CRITICAL+=("$file")
      fi
      ;;
    package.json|*/package.json) CI+=("$file") ;;
    .github/workflows/*|.gitlab-ci.yml|*/.gitlab-ci.yml) CI+=("$file"); INFRA_YAML+=("$file") ;;
    *compose*.yml|*compose*.yaml)
      COMPOSE+=("$file"); INFRA_YAML+=("$file")
      printf '%s' "$rel" | grep -qiE 'prod|staging' && COMPOSE_PROD+=("$file")
      ;;
    *.yml|*.yaml) INFRA_YAML+=("$file") ;;
    .env.example|*/.env.example|.env.sample|*/.env.sample) ;;
    .env|*/.env|.env.*|*/.env.*) ENV_FILES+=("$file") ;;
  esac
done

echo "Varredura de sinais de falha de IA em: $ROOT"
echo "Arquivos: ${#SRC[@]} código, ${#TESTS[@]} teste, ${#CI[@]} CI/pacote, ${#COMPOSE[@]} compose"
echo "----------------------------------------"

if [ "${#SRC[@]}" -eq 0 ] && [ "${#TESTS[@]}" -eq 0 ] && [ "${#INFRA_YAML[@]}" -eq 0 ]; then
  echo "[INFO] nenhum código encontrado; nada a verificar."
  exit 0
fi

S=(${SRC[@]+"${SRC[@]}"})

echo "== Código de produção"
check FAIL "F-02 Math.random (usar CSPRNG, D-07)" 'Math\.random\(' ${S[@]+"${S[@]}"}
check FAIL "F-02 dinheiro em ponto flutuante" \
  '(parseFloat|Number)\([^)]*(amount|stake|payout|balance|price)|(amount|stake|payout|balance)[A-Za-z_]*[[:space:]]*\*[[:space:]]*[0-9]+\.[0-9]+' \
  ${S[@]+"${S[@]}"}
check FAIL "F-03 BEGIN via pool.query (transação em conexões diferentes)" "pool\\.query\\([[:space:]]*['\"\`]BEGIN" ${S[@]+"${S[@]}"}
check FAIL "F-10 JWT decodificado sem verificar ou verificação desligada" \
  "jwt\\.decode\\(|ignoreExpiration|algorithms:[[:space:]]*\\[[[:space:]]*['\"]none|verify_signature['\"]?[[:space:]]*:[[:space:]]*false" \
  ${S[@]+"${S[@]}"}
check FAIL "F-10 identidade ou preço lidos do body" \
  '(req|request)\.body\.(user_?[iI]d|entry_?[pP]rice|price|payout)' ${S[@]+"${S[@]}"}
check WARN "F-10 spread do body (mass assignment)" '\.\.\.(req|request)\.body' ${S[@]+"${S[@]}"}
check FAIL "F-10 token em localStorage" \
  'localStorage\.(setItem|getItem)\([^)]*([tT]oken|[jJ][wW][tT])|store:[[:space:]]*window\.localStorage' ${S[@]+"${S[@]}"}
check FAIL "F-10 CORS aberto para qualquer origem" \
  "origin:[[:space:]]*['\"]\\*['\"]|Access-Control-Allow-Origin['\"]?[[:space:]]*[,:][[:space:]]*['\"]\\*" ${S[@]+"${S[@]}"}
check WARN "F-10 token na URL do WebSocket" '[?&](token|access_token|jwt)=' ${S[@]+"${S[@]}"}
check WARN "F-09 saldo/valor fixo de fallback" \
  "(balance|saldo)[A-Za-z_]*['\"]?[[:space:]]*:[[:space:]]*10_?000\\b" ${S[@]+"${S[@]}"}
check WARN "F-09 mock/faker em código de produção" \
  "from ['\"](@faker-js/faker|[^'\"]*/mocks?)['\"/]|\\b(vi|jest)\\.mock\\(" ${S[@]+"${S[@]}"}
check FAIL "F-06 @ts-nocheck" '@ts-nocheck' ${S[@]+"${S[@]}"}
check WARN "F-06 supressões (as any, @ts-ignore, eslint-disable)" '\bas any\b|@ts-ignore|eslint-disable' ${S[@]+"${S[@]}"}
check WARN "F-03 setInterval em módulo de tempo crítico (deriva/sobreposição)" 'setInterval\(' \
  ${TIME_CRITICAL[@]+"${TIME_CRITICAL[@]}"}

if [ "${#S[@]}" -gt 0 ]; then
  empty_catch="$(awk '
    /catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{/ {
      rest = $0; sub(/.*catch[^{]*\{/, "", rest)
      if (rest ~ /^[[:space:]]*(\/\/.*)?\}/) { print FILENAME ":" FNR ": " $0; open = 0; next }
      if (rest ~ /^[[:space:]]*(\/\/.*)?$/) { open = FNR; first = $0; next }
      open = 0; next
    }
    open {
      if ($0 ~ /^[[:space:]]*(\/\/.*)?$/) next
      if ($0 ~ /^[[:space:]]*\}/) print FILENAME ":" open ": " first
      open = 0
    }
  ' "${S[@]}" 2>/dev/null)"
  report FAIL "F-09 catch vazio (erro engolido)" "$empty_catch"
fi

echo "== Testes"
check FAIL "F-07 .only em teste (o resto da suíte não roda)" '\b(it|test|describe)\.only\(' ${TESTS[@]+"${TESTS[@]}"}
check WARN "F-07 testes pulados" '\b(it|test|describe)\.(skip|todo)\(|\bx(it|describe)\(' ${TESTS[@]+"${TESTS[@]}"}
check WARN "F-07 asserção que nunca falha" 'expect\((true|1)\)\.(toBe|toEqual)\((true|1)\)' ${TESTS[@]+"${TESTS[@]}"}

echo "== CI e scripts"
check FAIL "F-06 verificação tolerante a falha (|| true, continue-on-error)" \
  '\|\|[[:space:]]*true|continue-on-error:[[:space:]]*true|allow_failure:[[:space:]]*true' ${CI[@]+"${CI[@]}"}

echo "== Compose e infraestrutura"
check FAIL "F-10 imagem sem versão fixa" \
  'image:[[:space:]]*[^#[:space:]]+:latest\b|image:[[:space:]]*[^:#[:space:]$]+[[:space:]]*$' ${COMPOSE[@]+"${COMPOSE[@]}"}
check FAIL "F-10 Keycloak start-dev em staging/prod" 'start-dev' ${COMPOSE_PROD[@]+"${COMPOSE_PROD[@]}"}
check WARN "F-10 Keycloak start-dev (aceitável só em dev)" 'start-dev' ${COMPOSE[@]+"${COMPOSE[@]}"}
check FAIL "F-10 segredo literal em YAML" \
  "(PASSWORD|SECRET|_KEY|TOKEN)[A-Z_]*['\"]?[[:space:]]*[:=][[:space:]]*['\"]?[^\$[:space:]'\"{][^[:space:]'\"]{3,}" \
  ${INFRA_YAML[@]+"${INFRA_YAML[@]}"}
check WARN "F-01 healthcheck com curl (imagem do Keycloak não traz curl)" 'curl[^#]*health' ${COMPOSE[@]+"${COMPOSE[@]}"}

if [ "${#COMPOSE[@]}" -gt 0 ]; then
  bare_depends="$(awk '
    /^[[:space:]]*depends_on:[[:space:]]*$/ { watch = 1; line = FNR; next }
    watch && /^[[:space:]]*$/ { next }
    watch { if ($0 ~ /^[[:space:]]*-[[:space:]]/) print FILENAME ":" line ": depends_on em lista (sem condition)"; watch = 0 }
  ' "${COMPOSE[@]}" 2>/dev/null)"
  report WARN "F-12 depends_on sem condition: service_healthy" "$bare_depends"
fi

if [ "${#ENV_FILES[@]}" -gt 0 ] && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked=""
  for env_file in "${ENV_FILES[@]}"; do
    git -C "$ROOT" ls-files --error-unmatch "${env_file#"$ROOT"/}" >/dev/null 2>&1 && tracked+="$env_file"$'\n'
  done
  report FAIL "F-10 arquivo .env versionado no git" "${tracked%$'\n'}"
fi

echo "----------------------------------------"
if [ "$FAILS" -gt 0 ]; then
  echo "Resultado: REPROVADO ($FAILS falha(s), $WARNS aviso(s))"
  exit 1
fi
echo "Resultado: APROVADO ($WARNS aviso(s) para revisão humana)"
