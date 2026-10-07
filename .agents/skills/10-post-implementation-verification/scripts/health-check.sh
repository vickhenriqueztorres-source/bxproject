#!/usr/bin/env bash
# Triagem: procura no repositório do produto padrões que fazem o teste ou o gate "passar mentindo".
# Só lê. Cada achado é um ponto para o qa-resilience-agent revisar, não um FAIL automático.
# Uso: bash scripts/health-check.sh [raiz-do-repositório]
set -uo pipefail

ROOT="${1:-.}"
FINDINGS=0

report() {
  local level="$1" message="$2" pattern="$3" paths="$4"
  local hits
  hits="$(cd "$ROOT" && grep -rnE --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' \
    --include='*.sh' --include='*.json' --include='*.yml' --include='*.yaml' \
    --exclude-dir=node_modules --exclude-dir=.git -- "$pattern" $paths 2>/dev/null | head -n 10)"
  if [ -n "$hits" ]; then
    echo "[$level] $message"
    printf '%s\n' "$hits" | sed 's/^/    /'
    FINDINGS=$((FINDINGS + 1))
  fi
}

echo "Triagem de verificação em: $ROOT"
echo "----------------------------------------"

paths_tests="$(cd "$ROOT" && ls -d tests services/*/test services/*/tests apps/*/test apps/*/tests 2>/dev/null | tr '\n' ' ')"
paths_ci="$(cd "$ROOT" && ls -d .github docs/fase-1/scripts scripts 2>/dev/null | tr '\n' ' ')"

if [ -z "$paths_tests" ]; then
  echo "[INFO] nenhuma pasta de testes encontrada — nada a triar"
else
  report WARN "teste focado ou pulado (.only / .skip / it.todo sem pendência declarada)" \
    '\b(it|test|describe)\.(only|skip)\(' "$paths_tests"
  report WARN "retry automático em teste (proibido para invariantes, Q-01/edge cases da skill 06)" \
    '(retry:\s*[1-9]|\.retries\(|jest\.retryTimes)' "$paths_tests"
  report WARN "asserção fraca em teste de dinheiro ou preço" \
    'expect\([^)]*(payout|result|price|balance|settle)[^)]*\)\.(toBeTruthy|toBeDefined)\(' "$paths_tests"
  report WARN "banco ou ledger mockado em teste chamado de integração" \
    "vi\.mock\(['\"][^'\"]*(db|database|pg|blnk|redis)" "$paths_tests"
  report WARN "relógio ou aleatoriedade real em teste (Date.now / Math.random)" \
    '(Date\.now\(\)|Math\.random\(\))' "$paths_tests"
fi

if [ -d "$ROOT/tests/load" ]; then
  for f in "$ROOT"/tests/load/*.js; do
    [ -e "$f" ] || continue
    grep -qE 'thresholds\s*:' "$f" || { echo "[WARN] k6 sem thresholds (V-12 fica INCONCLUSIVO): ${f#"$ROOT"/}"; FINDINGS=$((FINDINGS + 1)); }
  done
  report WARN "k6 com token ou usuário compartilhado entre VUs" \
    '(const|let)\s+(TOKEN|token|ACCESS_TOKEN)\s*=\s*["'"'"'`]' "tests/load"
fi

if [ -n "$paths_ci" ]; then
  report WARN "gate ou CI que ignora falha (|| true / continue-on-error)" \
    '(\|\|\s*true\b|continue-on-error:\s*true)' "$paths_ci"
fi

if [ -d "$ROOT/services" ]; then
  report WARN "consulta do tick de saída sem a coluna symbol (trava anti-cross sempre dispara)" \
    'SELECT\s+price\s*,\s*sequence\s*,\s*ts\s+FROM\s+ticks' "services"
  report WARN "UPSERT de candle com volume incremental (duplica na reentrega)" \
    'volume\s*=\s*(candles\.)?volume\s*\+\s*1' "services"
fi

echo "----------------------------------------"
echo "Resultado: $FINDINGS ponto(s) para revisar"
exit 0
