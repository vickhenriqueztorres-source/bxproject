#!/usr/bin/env bash
# Varredura estática dos testes do projeto contra as regras Q-01 a Q-05.
# Somente leitura. Retorna exit 1 se encontrar violação crítica.
# Uso: bash scripts/health-check.sh [diretório ...]
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
  for candidate in services apps tests; do
    [ -d "$PROJECT_ROOT/$candidate" ] && CODE_DIRS+=("$PROJECT_ROOT/$candidate")
  done
fi

echo "Health-check: 06-testing-quality"
echo "----------------------------------------"

if [ "${#CODE_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório encontrado (services/, apps/ ou tests/) — nada a verificar"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

mapfile -t TEST_FILES < <(find "${CODE_DIRS[@]}" -type f \
  \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.test.js' -o -name '*.spec.js' -o -name '*_test.go' -o -name 'test_*.py' \) \
  -not -path '*/node_modules/*' 2>/dev/null | sort)

if [ "${#TEST_FILES[@]}" -eq 0 ]; then
  fail "nenhum arquivo de teste encontrado"
  echo "----------------------------------------"
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
pass "${#TEST_FILES[@]} arquivo(s) de teste encontrado(s)"

is_integration() { case "$1" in *.int.test.*|*/integration/*) return 0 ;; esac; return 1; }
is_chaos() { case "$1" in */chaos/*) return 0 ;; esac; return 1; }

UNIT_FILES=()
INTEGRATION_FILES=()
CHAOS_FILES=()
for file in "${TEST_FILES[@]}"; do
  if is_chaos "$file"; then CHAOS_FILES+=("$file")
  elif is_integration "$file"; then INTEGRATION_FILES+=("$file")
  else UNIT_FILES+=("$file")
  fi
done

grep_files() {
  local pattern="$1"; shift
  [ "$#" -eq 0 ] && return 0
  grep -nHE -e "$pattern" "$@" 2>/dev/null || true
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

# Higiene geral
report fail "teste focado (.only / fit / fdescribe) encontrado" \
  "$(grep_files '\b(it|test|describe)\.only\(|\b(fit|fdescribe)\(' "${TEST_FILES[@]}")"

report warn "teste desligado sem issue vinculada encontrado" \
  "$(grep_files '\b(it|test|describe)\.skip\(|\b(xit|xdescribe)\(' "${TEST_FILES[@]}" | grep -viE '#[0-9]+|issue' || true)"

retry_hits="$(grep_files 'retry[[:space:]]*:[[:space:]]*[1-9]|\.retry\([1-9]' "${TEST_FILES[@]}")"
for config in $(find "${CODE_DIRS[@]}" "$PROJECT_ROOT" -maxdepth 3 -type f \( -name 'vitest.config.*' -o -name 'jest.config.*' \) -not -path '*/node_modules/*' 2>/dev/null | sort -u); do
  retry_hits="$retry_hits$(grep -nHE 'retry[[:space:]]*:[[:space:]]*[1-9]' "$config" 2>/dev/null || true)"
done
report warn "retry automático de teste encontrado" "$retry_hits"

# Q-01 Unit tests
report warn "Q-01 Math.random em teste unitário/integração encontrado" \
  "$(grep_files 'Math\.random\(' "${UNIT_FILES[@]}" "${INTEGRATION_FILES[@]}")"

clock_hits=""
for file in "${UNIT_FILES[@]}"; do
  if grep -qE 'Date\.now\(\)|new Date\(\)' "$file" && ! grep -qiE 'useFakeTimers|FakeClock|setSystemTime|clock' "$file"; then
    clock_hits="$clock_hits$(grep -nHE 'Date\.now\(\)|new Date\(\)' "$file")"$'\n'
  fi
done
report warn "Q-01 relógio real em teste unitário encontrado" "${clock_hits%$'\n'}"

report warn "Q-01 espera longa com tempo real em teste unitário/integração encontrado" \
  "$(grep_files 'setTimeout\([^,]+,[[:space:]]*[0-9_]{5,}|sleep\([[:space:]]*[0-9_]{4,}' "${UNIT_FILES[@]}" "${INTEGRATION_FILES[@]}")"

report warn "Q-01 asserção fraca (toBeTruthy/toBeDefined) encontrado" \
  "$(grep_files '\.toBeTruthy\(\)|\.toBeDefined\(\)' "${TEST_FILES[@]}")"

if [ -z "$(grep_files 'fast-check|from .fc.|hypothesis|gopter|rapid\.' "${UNIT_FILES[@]}")" ]; then
  warn "Q-01 nenhum teste property-based (invariantes I-02, M-05)"
else
  pass "Q-01 testes property-based presentes"
fi

# Q-02 Integration tests
if [ "${#INTEGRATION_FILES[@]}" -eq 0 ]; then
  warn "Q-02 nenhum teste de integração (*.int.test.* ou */integration/*)"
else
  pass "Q-02 ${#INTEGRATION_FILES[@]} arquivo(s) de integração"
fi

mocked_infra=""
for file in "${TEST_FILES[@]}"; do
  if grep -qE "(vi|jest)\.mock\([[:space:]]*['\"][^'\"]*(db|database|pg|postgres|redis|blnk|ledger|repository|repo)[^'\"]*['\"]" "$file"; then
    if is_integration "$file" || grep -qiE 'idempot|ledger|settle|reserva|reserve|BOLA|404' "$file"; then
      mocked_infra="$mocked_infra$(grep -nHE "(vi|jest)\.mock\(" "$file")"$'\n'
    fi
  fi
done
report fail "Q-02 banco/ledger/fila mockado em teste de integração ou de invariante encontrado" "${mocked_infra%$'\n'}"

for topic in "Idempotency-Key|idempot:idempotência (I-03 / D-12)" "404:BOLA (S-04)" "Promise\.all:concorrência (I-03 / I-04)"; do
  pattern="${topic%%:*}"; label="${topic#*:}"
  if [ -z "$(grep_files "$pattern" "${INTEGRATION_FILES[@]}")" ]; then
    warn "Q-02 nenhum teste de integração cobre $label"
  else
    pass "Q-02 teste de integração cobre $label"
  fi
done

# Q-03 Chaos tests
if [ "${#CHAOS_FILES[@]}" -eq 0 ]; then
  warn "Q-03 nenhum teste de chaos (*/chaos/*)"
else
  pass "Q-03 ${#CHAOS_FILES[@]} arquivo(s) de chaos"
  report warn "Q-03 teste de chaos sem pós-condições (reconciliação/ledger) encontrado" \
    "$(for file in "${CHAOS_FILES[@]}"; do grep -qiE 'assertPostConditions|reconcil|ledgerSum' "$file" || echo "$file"; done)"
fi

# Q-04 Load tests
mapfile -t LOAD_FILES < <(find "${CODE_DIRS[@]}" -type f \( -name '*.k6.js' -o -name '*.k6.ts' -o -path '*/load/*.js' -o -path '*/load/*.ts' \) -not -path '*/node_modules/*' 2>/dev/null | sort -u)
if [ "${#LOAD_FILES[@]}" -eq 0 ]; then
  warn "Q-04 nenhum script de carga (*.k6.js ou */load/*)"
else
  pass "Q-04 ${#LOAD_FILES[@]} script(s) de carga"
  report warn "Q-04 script de carga sem thresholds encontrado" \
    "$(for file in "${LOAD_FILES[@]}"; do grep -q 'thresholds' "$file" || echo "$file"; done)"
  report fail "Q-04 Idempotency-Key fixa em script de carga encontrado" \
    "$(grep_files "Idempotency-Key['\"]?[[:space:]]*:[[:space:]]*['\"]" "${LOAD_FILES[@]}")"
fi

# Q-05 Acceptance criteria
acceptance="$(find "${CODE_DIRS[@]}" "$PROJECT_ROOT/docs" -type f \( -name 'AC-*.md' -o -name '*.feature' -o -path '*/acceptance/*' \) 2>/dev/null | head -n 1)"
if [ -z "$acceptance" ]; then
  warn "Q-05 nenhum arquivo de critérios de aceite (AC-*.md, *.feature, */acceptance/*)"
else
  pass "Q-05 critérios de aceite presentes"
fi

missing_ids=()
for prefix in I M S R; do
  for n in 1 2 3 4 5 6; do
    id="$prefix-0$n"
    if [ -z "$(grep_files "\[$id\]" "${TEST_FILES[@]}")" ]; then missing_ids+=("$id"); fi
  done
done
if [ "${#missing_ids[@]}" -gt 0 ]; then
  warn "Q-05 regras sem teste rastreável ([ID] no título): ${missing_ids[*]}"
else
  pass "Q-05 todas as regras I/M/S/R têm teste rastreável"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
