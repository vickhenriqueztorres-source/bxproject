#!/usr/bin/env bash
# Varre o diff de uma correção contra as regras FX-03 a FX-15 do bug-fix-agent.
# Uso: bash scripts/health-check.sh [--base <ref>] [--defect <ID>] [--qa-regression] [raiz-do-repo]
#   --base           ref de comparação (padrão: HEAD). O worktree e os arquivos novos entram no diff.
#   --defect         ID do defeito (ex.: DEF-T09-1). Exige teste adicionado com "[ID]" no título (FX-07).
#   --qa-regression  a regressão é o teste do QA que acusou o defeito; ausência de teste próprio vira aviso.
# Limites PROPOSTOS ajustáveis: MAX_LINES (150) e MAX_FILES (5).
set -uo pipefail

BASE="HEAD"
DEFECT=""
QA_REGRESSION=0
ROOT="."
MAX_LINES="${MAX_LINES:-150}"
MAX_FILES="${MAX_FILES:-5}"

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2 ;;
    --defect) DEFECT="${2:-}"; shift 2 ;;
    --qa-regression) QA_REGRESSION=1; shift ;;
    -h|--help) sed -n '2,7p' "$0"; exit 0 ;;
    *) ROOT="$1"; shift ;;
  esac
done

ERRORS=0
WARNINGS=0
pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

cd "$ROOT" 2>/dev/null || { echo "[FAIL] raiz '$ROOT' não encontrada"; exit 2; }
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "[FAIL] '$ROOT' não é um repositório git"; exit 2; }
git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null || { echo "[FAIL] base '$BASE' não encontrada"; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
: > "$TMP/added"
: > "$TMP/removed"

git diff --name-status --no-renames "$BASE" > "$TMP/status"
git ls-files --others --exclude-standard > "$TMP/untracked"
while IFS= read -r file; do
  [ -z "$file" ] && continue
  printf 'A\t%s\n' "$file" >> "$TMP/status"
  [ -f "$file" ] && awk -v f="$file" '{ print f "\t" $0 }' "$file" >> "$TMP/added"
done < "$TMP/untracked"

git diff -U0 --no-color --no-renames "$BASE" | awk -v added="$TMP/added" -v removed="$TMP/removed" '
  /^--- / { f = substr($0, 5); sub(/^a\//, "", f); next }
  /^\+\+\+ / { p = substr($0, 5); if (p != "/dev/null") { f = p; sub(/^b\//, "", f) }; next }
  /^\+/ { print f "\t" substr($0, 2) >> added; next }
  /^-/ { print f "\t" substr($0, 2) >> removed; next }
'

echo "Health-check do diff (base: $BASE${DEFECT:+, defeito: $DEFECT})"
echo "----------------------------------------"

if [ ! -s "$TMP/status" ]; then
  fail "nenhuma mudança em relação a '$BASE' — nada a verificar"
  echo "----------------------------------------"
  echo "Resultado: REPROVADO ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi

TEST_FILES='(\.(test|spec)\.[cm]?[jt]sx?$|^tests/|/test/|/__tests__/)'
TS_FILES='\.[cm]?tsx?$'
CODE_FILES='\.([cm]?[jt]sx?|sql|ya?ml|json|sh|toml)$'
SKIP_FILES='(\.md$|^agents/|^skills/)'

# hits <arquivo-de-linhas> <regex-de-arquivo> <regex-de-linha> [ci] [excluir-testes]
hits() {
  FRE="$2" LRE="$3" CI="${4:-0}" NOTEST="${5:-0}" SKIP="$SKIP_FILES" TESTS="$TEST_FILES" awk -F'\t' '
    BEGIN { fre = ENVIRON["FRE"]; lre = ENVIRON["LRE"]; ci = ENVIRON["CI"]; notest = ENVIRON["NOTEST"]
            skip = ENVIRON["SKIP"]; tests = ENVIRON["TESTS"] }
    {
      file = $1; line = $0; sub(/^[^\t]*\t/, "", line)
      if (file ~ skip || file !~ fre) next
      if (notest == "1" && file ~ tests) next
      subject = (ci == "1") ? tolower(line) : line
      if (subject ~ lre) print file "\t" line
    }' "$1"
}

# check <regra> <descrição> <arquivo-de-linhas> <regex-de-arquivo> <regex-de-linha> [ci] [excluir-testes] [ocultar]
check() {
  local rule="$1" desc="$2" source="$3" fre="$4" lre="$5" ci="${6:-0}" notest="${7:-0}" hide="${8:-0}"
  local found
  found="$(hits "$source" "$fre" "$lre" "$ci" "$notest")"
  if [ -z "$found" ]; then
    pass "$rule — $desc"
    return
  fi
  fail "$rule — $desc"
  printf '%s\n' "$found" | head -n 5 | while IFS="$(printf '\t')" read -r file line; do
    if [ "$hide" = "1" ]; then
      echo "         $file (valor omitido)"
    else
      line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//' | cut -c1-140)"
      echo "         $file: $line"
    fi
  done
}

# 1. Fronteiras
boundary="$(awk -F'\t' '$2 ~ /^(tests\/(integration|chaos|load|acceptance)\/|services\/[^\/]+\/test\/|skills\/|agents\/|ORCHESTRATOR\.md$)/ || $2 ~ /(^|\/)(vitest|jest|playwright)\.config\.[cm]?[jt]s$/ { print $2 }' "$TMP/status")"
if [ -z "$boundary" ]; then
  pass "Fronteiras — nenhum arquivo do QA, de skills, de agentes, do orquestrador ou de config de teste"
else
  fail "Fronteiras — arquivos fora da área do bug-fix-agent"
  printf '%s\n' "$boundary" | head -n 5 | sed 's/^/         /'
fi

alert_rules="$(awk -F'\t' '$2 ~ /^infra\/.*(alert|rule)[^\/]*\.ya?ml$/ { print $2 }' "$TMP/status")"
if [ -n "$alert_rules" ]; then
  warn "Regra de alerta alterada — threshold e for: são decisão, não correção; justificar no summary"
  printf '%s\n' "$alert_rules" | sed 's/^/         /'
fi

# 2. FX-03 — diff mínimo
files_count="$(awk -F'\t' '$2 !~ /\.md$/' "$TMP/status" | wc -l | tr -d ' ')"
lines_count="$(cat "$TMP/added" "$TMP/removed" | awk -F'\t' '$1 !~ /\.md$/' | wc -l | tr -d ' ')"
if [ "$files_count" -gt "$MAX_FILES" ]; then warn "FX-03 — $files_count arquivos alterados (limite PROPOSTO $MAX_FILES)"; else pass "FX-03 — $files_count arquivo(s) alterado(s)"; fi
if [ "$lines_count" -gt "$MAX_LINES" ]; then warn "FX-03 — $lines_count linhas alteradas (limite PROPOSTO $MAX_LINES): correção ou nova subtask?"; else pass "FX-03 — $lines_count linha(s) alterada(s)"; fi
deps="$(hits "$TMP/added" '(^|/)package\.json$' '"[@a-z0-9./_-]+"[[:space:]]*:[[:space:]]*"(\^|~|[0-9]|workspace:|npm:)')"
if [ -n "$deps" ]; then warn "FX-03 — dependência nova ou alterada em package.json; justificar"; else pass "FX-03 — nenhuma dependência nova"; fi

# 3. FX-04 — não enfraquecer verificação
check "FX-04" "nenhum .skip/.only/.todo/xit/fit adicionado em teste" "$TMP/added" "$TEST_FILES" \
  '(^|[^A-Za-z0-9_])((it|test|describe|suite)\.(skip|only|todo)|xit|xdescribe|fit|fdescribe)[[:space:]]*\('
check "FX-04" "nenhum retry ou timeout adicionado em teste" "$TMP/added" "$TEST_FILES" \
  '((^|[^A-Za-z0-9_])(retry|retries|testTimeout|hookTimeout|timeout)[[:space:]]*:|\.retries?[[:space:]]*\()'
check "FX-04" "nenhuma asserção removida de teste existente" "$TMP/removed" "$TEST_FILES" \
  '(expect[[:space:]]*\(|assert[.(])'
check "FX-04" "nenhum @ts-ignore, @ts-expect-error, @ts-nocheck ou eslint-disable" "$TMP/added" "$CODE_FILES" \
  '(@ts-(ignore|expect-error|nocheck)|eslint-disable)'
check "FX-04" "nenhum 'any' adicionado em TypeScript" "$TMP/added" "$TS_FILES" \
  '((^|[^A-Za-z0-9_])as[[:space:]]+any|:[[:space:]]*any)([^A-Za-z0-9_]|$)'

# 4. FX-08 — flaky não se resolve com espera
check "FX-08" "nenhum sleep/setTimeout/delay em teste" "$TMP/added" "$TEST_FILES" \
  '(^|[^A-Za-z0-9_.])(sleep|setTimeout|delay)[[:space:]]*\('

# 5. FX-05 — não silenciar erro
check "FX-05" "nenhum catch vazio ou .catch(() => {})" "$TMP/added" '\.[cm]?[jt]sx?$' \
  '(catch[[:space:]]*(\([^)]*\))?[[:space:]]*\{[[:space:]]*\}|\.catch\([[:space:]]*(\([^)]*\)|[A-Za-z_]+)?[[:space:]]*=>[[:space:]]*(\{[[:space:]]*\}|undefined|null|void 0)[[:space:]]*\))'
check "FX-05" "nenhum default silencioso (?? 0 / || 0) em campo _minor" "$TMP/added" '\.[cm]?[jt]sx?$' \
  '_minor[A-Za-z0-9_]*[[:space:]]*(\?\?|\|\|)[[:space:]]*0'

# 6. FX-06 — dado financeiro não se edita
check "FX-06" "nenhum UPDATE em saldo, carteira, ledger ou transações" "$TMP/added" "$CODE_FILES" \
  'update[[:space:]]+[a-z_."]*(balance|balances|wallet|wallets|ledger[a-z_]*|transactions)([^a-z0-9_]|$)' 1
check "FX-06" "nenhum DELETE/TRUNCATE em tabela financeira ou de mercado" "$TMP/added" "$CODE_FILES" \
  '(delete[[:space:]]+from|truncate([[:space:]]+table)?)[[:space:]]+[a-z_."]*(contracts|transactions|ledger[a-z_]*|balances?|wallets?|audit_logs|ticks|outbox[a-z_]*|candles)([^a-z0-9_]|$)' 1
check "FX-06" "nenhuma coluna de saldo criada (B-03)" "$TMP/added" '\.sql$' \
  'add[[:space:]]+column[[:space:]]+[a-z_"]*balance' 1
repair_sql="$(awk -F'\t' '$1 ~ /^[AM]/ && $2 ~ /\.sql$/ && $2 !~ /^db\/migrations\// { print $2 }' "$TMP/status")"
if [ -z "$repair_sql" ]; then
  pass "FX-06 — nenhum script SQL fora de db/migrations/"
else
  fail "FX-06 — SQL fora de db/migrations/ (reparo de dados é por reversão, com aprovação humana)"
  printf '%s\n' "$repair_sql" | sed 's/^/         /'
fi

# 7. FX-07 — regressão com o ID do defeito
if [ -n "$DEFECT" ]; then
  tagged="$(FRE="$TEST_FILES" TAG="[$DEFECT]" awk -F'\t' 'BEGIN { fre = ENVIRON["FRE"]; tag = ENVIRON["TAG"] } $1 ~ fre && index($0, tag) { print $1; exit }' "$TMP/added")"
  if [ -n "$tagged" ]; then
    pass "FX-07 — teste de regressão com [$DEFECT] em $tagged"
  elif [ "$QA_REGRESSION" -eq 1 ]; then
    warn "FX-07 — sem teste próprio com [$DEFECT]; regressão declarada como o teste do QA (confidence ≤ 0.85)"
  else
    fail "FX-07 — nenhum teste adicionado com [$DEFECT] no título (use --qa-regression se o teste do QA é a regressão)"
  fi
else
  warn "FX-07 — --defect não informado; teste de regressão não verificado"
fi

# 8. FX-13 — migration aplicada é imutável
edited_migrations="$(awk -F'\t' '$1 ~ /^[MD]/ && $2 ~ /^db\/migrations\// { print $1 " " $2 }' "$TMP/status")"
if [ -z "$edited_migrations" ]; then
  pass "FX-13 — nenhuma migration existente editada ou apagada"
else
  fail "FX-13 — migration existente editada ou apagada (crie uma migration nova)"
  printf '%s\n' "$edited_migrations" | sed 's/^/         /'
fi
missing_down=""
while IFS="$(printf '\t')" read -r st file; do
  case "$st" in A*) ;; *) continue ;; esac
  case "$file" in db/migrations/*.down.sql) continue ;; db/migrations/*.sql) ;; *) continue ;; esac
  [ -f "${file%.sql}.down.sql" ] || missing_down="$missing_down $file"
done < "$TMP/status"
if [ -z "$missing_down" ]; then pass "FX-13 — toda migration nova tem .down.sql"; else fail "FX-13 — migration nova sem .down.sql:$missing_down"; fi

# 9. FX-14 — sem atalho no pipeline
check "FX-14" "nenhum --no-verify adicionado" "$TMP/added" "$CODE_FILES" '--no-verify'

# 10. FX-15 — regras dos implementadores
check "FX-15/B-06" "nenhum Math.random em services/" "$TMP/added" '^services/.*\.[cm]?[jt]sx?$' 'Math\.random[[:space:]]*\(' 0 1
check "FX-15/B-02" "nenhum '* 0.85' sobre dinheiro" "$TMP/added" '^(services|apps)/.*\.[cm]?[jt]sx?$' '\*[[:space:]]*0?\.85([^0-9]|$)' 0 1
check "FX-15/B-02" "nenhum parseFloat/toFixed em services/ ou apps/" "$TMP/added" '^(services|apps)/.*\.[cm]?[jt]sx?$' '(parseFloat|\.toFixed)[[:space:]]*\(' 0 1
check "FX-15/B-08" "settlement não lê tick:last do Redis" "$TMP/added" '^services/settlement' 'tick:last:' 0 1
check "FX-15/B-10" "nenhum jwt.decode/jwtDecode em services/" "$TMP/added" '^services/.*\.[cm]?[jt]sx?$' '(jwt\.decode|jwtDecode)[[:space:]]*\(' 0 1
check "FX-15/B-11" "nenhum SQL com interpolação \${...}" "$TMP/added" '\.[cm]?[jt]sx?$' \
  '(select[[:space:]].*[[:space:]]from|insert[[:space:]]+into|update[[:space:]]+[a-z_."]+[[:space:]]+set|delete[[:space:]]+from)[^`]*\$\{' 1 1
check "FX-15/F-12" "nenhum dangerouslySetInnerHTML em apps/" "$TMP/added" '^apps/' 'dangerouslySetInnerHTML' 0 1
check "FX-15/F-04" "nenhum token em localStorage/sessionStorage" "$TMP/added" '^apps/' '(localstorage|sessionstorage)\.(setitem|getitem)\([^)]*token' 1 1
check "FX-15/S-06" "nenhum segredo literal" "$TMP/added" "$CODE_FILES" \
  '((password|passwd|secret|client_secret|api[_-]?key|token)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'$]{12,}["'"'"']|-----begin [a-z ]*private key-----)' 1 1 1

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: REPROVADO ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: APROVADO ($WARNINGS aviso(s))"
