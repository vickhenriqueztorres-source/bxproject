#!/usr/bin/env bash
# Varredura dos testes contra as regras QA-01 a QA-14 do qa-resilience-agent.
# Somente leitura. Complementa (não substitui) o health-check da skill 06-testing-quality.
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
    echo "$matches" | head -n 10 | sed "s|$ROOT/||; s/^/       /"
  else
    pass "${label/encontrado/ausente}"
  fi
}

echo "Health-check: qa-resilience-agent"
echo "Raiz: $ROOT"
echo "----------------------------------------"

# QA-01 fronteira de escrita
if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  changed="$( { git -C "$ROOT" diff --name-only HEAD; git -C "$ROOT" ls-files --others --exclude-standard; } 2>/dev/null | sort -u)"
  outside="$(printf '%s\n' "$changed" | grep -vE '^$|^services/[^/]+/test/|^tests/' || true)"
  report fail "QA-01 arquivo fora de tests/ ou services/*/test/ alterado encontrado" "$outside"
fi

UNIT_FILES="$(find "$ROOT/services" -path '*/test/unit/*' -name '*.test.[tj]s' -not -path '*/node_modules/*' 2>/dev/null)"
INT_FILES="$(find "$ROOT/services" -path '*/test/integration/*' -name '*.int.test.[tj]s' -not -path '*/node_modules/*' 2>/dev/null)"
CHAOS_FILES="$(find "$ROOT/tests/chaos" -maxdepth 1 -name 'C-0*.test.[tj]s' 2>/dev/null)"
LOAD_FILES="$(find "$ROOT/tests/load" -maxdepth 1 -name '*.k6.js' 2>/dev/null)"
ACCEPT_FILES="$(find "$ROOT/tests/acceptance" -maxdepth 1 -name 'AC-*.md' 2>/dev/null)"
ALL_TESTS="$(printf '%s\n' "$UNIT_FILES" "$INT_FILES" "$CHAOS_FILES" | grep -v '^$' || true)"

if [ -z "$ALL_TESTS$LOAD_FILES$ACCEPT_FILES" ]; then
  warn "nenhum teste encontrado em services/*/test/ ou tests/ — nada a verificar"
  echo "----------------------------------------"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

grep_in() { local pattern="$1"; shift; [ "$#" -eq 0 ] && return 0; grep -nHE -e "$pattern" "$@" 2>/dev/null || true; }
to_array() { printf '%s\n' "$1" | grep -v '^$' || true; }

mapfile -t UNIT < <(to_array "$UNIT_FILES")
mapfile -t INT < <(to_array "$INT_FILES")
mapfile -t CHAOS < <(to_array "$CHAOS_FILES")
mapfile -t LOAD < <(to_array "$LOAD_FILES")
mapfile -t ACCEPT < <(to_array "$ACCEPT_FILES")
mapfile -t ALL < <(to_array "$ALL_TESTS")

# QA-02 nada de atalho para ficar verde
report fail "QA-02 .only encontrado" "$(grep_in '\b(it|test|describe)\.only\(' "${ALL[@]}")"
report fail "QA-02 .skip sem issue vinculada encontrado" "$(grep_in '\b(it|test|describe)\.skip\(' "${ALL[@]}" | grep -vE '#[0-9]+|issue' || true)"
report fail "QA-02 test.fails (asserção invertida) encontrado" "$(grep_in '\b(it|test)\.fails\(' "${ALL[@]}")"
runner_retry="$(grep -nHE '\bretry[[:space:]]*:[[:space:]]*[1-9]|\bretries[[:space:]]*:[[:space:]]*[1-9]' "$ROOT"/vitest*.config.* "$ROOT"/services/*/vitest*.config.* "$ROOT"/playwright.config.* 2>/dev/null || true)"
report fail "QA-02 retry automático no runner encontrado" "$runner_retry"
report fail "QA-02 retry por teste encontrado" "$(grep_in '\{[[:space:]]*retry[[:space:]]*:[[:space:]]*[1-9]' "${ALL[@]}")"

# QA-03 rastreabilidade
untraced="$(grep_in "\b(it|test)(\.todo)?\([[:space:]]*['\"\`]" "${ALL[@]}" | grep -vE "\(['\"\`]\[([A-Z]{1,2}-[0-9]+|AC-[A-Z0-9]+-[0-9]+)\]" || true)"
report warn "QA-03 teste sem ID de regra/critério no título encontrado" "$untraced"

# QA-05 unitários determinísticos
report fail "QA-05 Math.random/Date.now/new Date() em teste unitário encontrado" \
  "$(grep_in 'Math\.random\(|Date\.now\(|new Date\(\)' "${UNIT[@]}" | grep -v '/fakes/' || true)"
report fail "QA-05 espera real (setTimeout/sleep >= 1 s) em teste encontrado" \
  "$(grep_in '(setTimeout\([^,]+,[[:space:]]*|sleep\()[0-9_]{4,}' "${UNIT[@]}" "${INT[@]}")"
report fail "QA-05 aritmética de ponto flutuante sobre dinheiro em teste encontrado" \
  "$(grep_in '(\*[[:space:]]*0?\.85\b|parseFloat\(|\.toFixed\()' "${UNIT[@]}" "${INT[@]}")"
report warn "QA-05 asserção fraca (toBeTruthy/toBeDefined) encontrado" "$(grep_in '\.(toBeTruthy|toBeDefined)\(\)' "${ALL[@]}")"

# QA-06 integração sem mock
report fail "QA-06 mock de banco/fila/ledger/IdP em teste de integração encontrado" \
  "$(grep_in "(vi|jest)\.mock\([^)]*(db|pg|postgres|redis|ioredis|blnk|keycloak|ledger)" "${INT[@]}")"
report fail "QA-06 imagem de container sem tag ou com :latest encontrado" \
  "$(grep_in "GenericContainer\([[:space:]]*['\"][^:'\"]+['\"]|:latest['\"]" "${INT[@]}")"

# QA-07 obrigatórios de integração (só avisa: a subtask pode não tocar o tema)
if [ "${#INT[@]}" -gt 0 ]; then
  for rule in I-03 S-02 S-04 S-05 R-01; do
    [ -n "$(grep_in "\[$rule\]" "${INT[@]}")" ] && pass "QA-07 integração cobre [$rule]" || warn "QA-07 nenhum teste de integração [$rule] (conferir se a subtask toca o tema)"
  done
fi

# QA-08 / QA-10 caos
for f in "${CHAOS[@]}"; do
  [ -z "$f" ] && continue
  rel="${f#$ROOT/}"
  grep -q 'assertNotProduction' "$f" && pass "QA-10 guarda de ambiente em $rel" || fail "QA-10 $rel sem assertNotProduction()"
  grep -qE 'assertPostConditions|ledgerSum|runReconciliation' "$f" && pass "QA-08 pós-condições em $rel" || fail "QA-08 $rel sem pós-condições (ledger, reconciliação, sequence)"
  grep -qiE '\.pid|breaker|latency|toxiproxy|killService|restartService' "$f" && pass "QA-08 prova de injeção em $rel" || fail "QA-08 $rel sem prova de que a falha foi injetada"
done

# QA-09 / QA-10 carga
for f in "${LOAD[@]}"; do
  [ -z "$f" ] && continue
  rel="${f#$ROOT/}"
  grep -q 'assertNotProduction' "$f" && pass "QA-10 guarda de ambiente em $rel" || fail "QA-10 $rel sem assertNotProduction()"
  grep -q 'thresholds' "$f" && pass "QA-09 thresholds em $rel" || fail "QA-09 $rel sem thresholds"
  grep -q 'http_req_failed' "$f" && pass "QA-09 threshold de erro em $rel" || fail "QA-09 $rel sem threshold de http_req_failed"
  if grep -q 'Idempotency-Key' "$f"; then
    grep -qE 'uuidv4\(|randomUUID\(|crypto\.' "$f" && pass "QA-09 Idempotency-Key única em $rel" || fail "QA-09 $rel com Idempotency-Key fixa"
  fi
  grep -qE 'syntheticUsers|createSyntheticUser' "$f" || warn "QA-09 $rel não usa usuários sintéticos (token único?)"
  grep -q 'teardown' "$f" || warn "QA-09 $rel sem checagem de correção no teardown"
  report fail "QA-10 URL de produção em $rel encontrado" "$(grep -nHE 'TARGET_ENV[^a-z]*production|https://api\.synth\.example' "$f" | grep -v assertNotProduction || true)"
done

# QA-11 it.todo com marcador
report warn "QA-11 it.todo sem <não definido no contexto> encontrado" "$(grep_in '\b(it|test)\.todo\(' "${ALL[@]}" | grep -v 'não definido no contexto' || true)"

# QA-12 isolamento
if [ "${#INT[@]}" -gt 0 ]; then
  [ -n "$(grep_in 'uniqueSymbol|streamPrefix|createSyntheticUser' "${INT[@]}")" ] && pass "QA-12 isolamento por teste em uso" \
    || warn "QA-12 integração sem uniqueSymbol/streamPrefix/createSyntheticUser"
fi

# QA-04 critérios de aceite
for f in "${ACCEPT[@]}"; do
  [ -z "$f" ] && continue
  rel="${f#$ROOT/}"
  missing=""
  for word in Dado Quando 'Então' 'Regras:' 'Nível:'; do grep -q "$word" "$f" || missing="$missing $word"; done
  [ -z "$missing" ] && pass "QA-04 $rel no formato Dado/Quando/Então" || fail "QA-04 $rel sem:$missing"
  report fail "QA-04 termo vago sem número em $rel encontrado" "$(grep -iE '\b(funciona|corretamente|rápid[oa]|estável)\b' "$f" | grep -vE '[0-9]' | sed "s|^|$rel: |" || true)"
done

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
