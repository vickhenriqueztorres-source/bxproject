#!/usr/bin/env bash
# Varredura estática do código em busca de violações das invariantes I-01 a I-06.
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

echo "Health-check: 02-financial-invariants"
echo "----------------------------------------"

if [ "${#CODE_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório de código encontrado (services/ ou apps/) — nada a verificar"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

INCLUDES=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.py' --include='*.sql' --include='*.go')

scan() {
  grep -rniE "$1" "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | grep -v '/tests\?/' || true
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

# I-01 Append-only
report fail "I-01 UPDATE/DELETE em tabela de transação encontrado" \
  "$(scan '(UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+(ledger|ledger_entries|transactions|wallet_transactions)\b')"

report fail "I-01 saldo mutável (balance = balance +/-) encontrado" \
  "$(scan 'balance[[:space:]]*=[[:space:]]*balance[[:space:]]*[-+]')"

# I-02 Double-entry: transação Blnk sem source/destination no mesmo arquivo
blnk_files="$(grep -rlE 'transactions|createTransaction' "${CODE_DIRS[@]}" "${INCLUDES[@]}" 2>/dev/null | grep -v node_modules | xargs -r grep -lE 'reference' 2>/dev/null || true)"
missing_entry=""
for file in $blnk_files; do
  if ! grep -q 'source' "$file" || ! grep -q 'destination' "$file"; then
    missing_entry="$missing_entry$file"$'\n'
  fi
done
report fail "I-02 transação sem source/destination encontrado" "${missing_entry%$'\n'}"

# I-03 Idempotência
report fail "I-03 reference aleatória (uuid/randomUUID) encontrado" \
  "$(scan 'reference[\"'\'']?[[:space:]]*[:=][[:space:]]*(crypto\.)?(randomUUID|uuid(v4)?)\(')"

if [ -z "$(scan 'Idempotency-Key')" ]; then
  warn "I-03 header Idempotency-Key não encontrado no código (POST /contracts)"
else
  pass "I-03 Idempotency-Key presente"
fi

for key in 'settlement:' 'credit:' 'reserve:'; do
  if [ -z "$(scan "$key")" ]; then
    warn "I-03 chave '$key{contract_id}' não encontrada"
  else
    pass "I-03 chave '$key' presente"
  fi
done

# I-04 ACID
if [ -z "$(scan 'FOR[[:space:]]+UPDATE')" ]; then
  warn "I-04 SELECT ... FOR UPDATE não encontrado (settlement)"
else
  pass "I-04 SELECT ... FOR UPDATE presente"
fi

if [ -z "$(scan 'outbox')" ]; then
  warn "I-04 tabela/evento outbox não encontrado"
else
  pass "I-04 outbox presente"
fi

# Valores monetários em ponto flutuante
report warn "valor monetário em ponto flutuante (parseFloat/toFixed) encontrado" \
  "$(scan '(parseFloat|toFixed)\(.*(amount|stake|payout|balance)|(amount|stake|payout|balance).*(parseFloat|toFixed)\(')"

# I-06 Correção por reversão
if [ -z "$(scan 'reversal:')" ]; then
  warn "I-06 fluxo de reversão (reversal:) não encontrado"
else
  pass "I-06 fluxo de reversão presente"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
