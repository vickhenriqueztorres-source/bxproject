#!/usr/bin/env bash
# Triagem estática do código financeiro contra I-01 a I-06 e FC-08 a FC-11.
# Somente leitura: não grava nada no repositório. Cada linha apontada precisa ser lida no contexto;
# o script não decide o veredito.
#
# Uso:
#   bash scripts/health-check.sh [raiz]                          triagem
#   bash scripts/health-check.sh --snapshot ARQ [raiz]            grava estado do worktree em ARQ (fora do repo)
#   bash scripts/health-check.sh --verify-untouched ARQ [raiz]    prova que o revisor não alterou nada (FC-01)
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
    echo "[OK]   FC-01 nenhum arquivo alterado durante a revisão"; exit 0
  fi
  echo "[FAIL] FC-01 o worktree mudou durante a revisão:"
  comm -3 <(printf '%s\n' "$current" | sort) <(sort "$SNAPSHOT_FILE") | head -n 20 | sed 's/^[[:space:]]*/       /'
  exit 1
fi

report() {
  local level="$1" label="$2" matches="$3"
  if [ -n "$matches" ]; then
    "$level" "$label"
    echo "$matches" | head -n 10 | sed 's/^/       /'
  else
    pass "${label/encontrado/ausente}"
  fi
}

echo "Health-check: financial-correctness-reviewer (triagem)"
echo "Raiz: $ROOT"
echo "----------------------------------------"

SRC_DIRS=()
for dir in services db; do
  [ -d "$ROOT/$dir" ] && SRC_DIRS+=("$ROOT/$dir")
done
if [ "${#SRC_DIRS[@]}" -eq 0 ]; then
  warn "nenhum diretório services/ ou db/ encontrado — nada a revisar"
  echo "----------------------------------------"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

scan() {
  grep -rnE "${@:2}" -e "$1" "${SRC_DIRS[@]}" \
    --include='*.ts' --include='*.js' --include='*.sql' 2>/dev/null \
    | grep -vE '/(node_modules|dist|build)/' \
    | grep -vE '\.(unit\.|int\.)?test\.[tj]s:' || true
}
files_with() { scan "$@" | cut -d: -f1 | sort -u; }

# I-01 append-only / D-02
report fail "I-01 UPDATE de saldo encontrado" "$(scan 'UPDATE[[:space:]]+[a-z_]*(wallet|balance|account)[a-z_]*[[:space:]]+SET|SET[[:space:]]+balance' -i)"
report fail "I-01 DELETE/UPDATE em transações do ledger encontrado" "$(scan '(DELETE[[:space:]]+FROM|UPDATE)[[:space:]]+[a-z_]*(ledger|transaction)' -i)"
report fail "I-01/FC-12 tabela ledger_* ou wallet_accounts própria encontrado" "$(scan 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(ledger_|wallet_accounts)' -i)"

# I-03 idempotência
report fail "I-03 reference aleatória ou temporal encontrado" \
  "$(scan 'reference[[:space:]]*:[^,]*(uuid|randomUUID|nanoid|Date\.now|Math\.random|attempt)' -i)"
if [ -n "$(scan 'blnk' -i)" ]; then
  for key in 'reserve:' 'settlement:' 'credit:'; do
    [ -n "$(scan "$key")" ] && pass "I-03 chave oficial '$key' em uso" || warn "I-03 chave oficial '$key' não encontrada (conferir se a subtask a usa)"
  done
fi
if [ -n "$(scan "post\([[:space:]]*['\"]/contracts['\"]" -i)" ]; then
  [ -n "$(scan 'idempotency' -i)" ] && pass "I-03 POST /contracts menciona Idempotency-Key" || fail "I-03 POST /contracts sem Idempotency-Key"
fi

# I-04 atomicidade e máquina de estados
for f in $(files_with "UPDATE[[:space:]]+contracts" -i); do
  if ! grep -qiE 'FOR[[:space:]]+UPDATE' "$f"; then
    fail "I-04 UPDATE contracts sem FOR UPDATE no mesmo arquivo: ${f#$ROOT/}"
  fi
done
for f in $(files_with '(\.tx\(|transaction\(|BEGIN)' -i); do
  if grep -qE 'blnk\.' "$f"; then
    warn "I-04 Blnk e transação de banco no mesmo arquivo — conferir se a chamada está fora do BEGIN/COMMIT: ${f#$ROOT/}"
  fi
done
report warn "FC-07 status fora da máquina de estados encontrado" \
  "$(scan "status[[:space:]]*=[[:space:]]*['\"][A-Z_]+['\"]" | grep -vE "'(CREATED|OPEN|EXPIRING|SETTLED|CANCELLED|FAILED_COMPENSATION|FAILED_RETRYABLE)'|\"(CREATED|OPEN|EXPIRING|SETTLED|CANCELLED|FAILED_COMPENSATION|FAILED_RETRYABLE)\"" || true)"

# FC-08 dinheiro inteiro
report fail "FC-08 aritmética de ponto flutuante sobre dinheiro encontrado" \
  "$(scan '(\*[[:space:]]*0?\.85\b|parseFloat\(|(stake|payout|amount|price|balance)\w*[^;]*\.toFixed\(|Number\([^)]*(stake|payout|amount|price))' -i)"

# FC-09 tick de saída e DRAW
settlement_dirs="$(find "$ROOT/services" -maxdepth 1 -type d -iname '*settle*' 2>/dev/null)"
if [ -n "$settlement_dirs" ]; then
  report fail "FC-09 settlement lendo preço do cache/Pub/Sub encontrado" \
    "$(grep -rnE 'tick:last|\.subscribe\(|psubscribe' $settlement_dirs --include='*.ts' --include='*.js' 2>/dev/null | grep -vE '\.test\.' || true)"
fi
report fail "FC-09 DRAW como valor padrão encontrado" "$(scan "(\?\?|\|\|)[[:space:]]*['\"]DRAW['\"]")"

# FC-10 / R-06 XACK
for f in $(files_with 'xack' -i); do
  first_ack="$(grep -niE 'xack' "$f" | head -n1 | cut -d: -f1)"
  first_commit="$(grep -niE 'commit|\.tx\(|transaction\(' "$f" | head -n1 | cut -d: -f1)"
  if [ -n "$first_commit" ] && [ "$first_ack" -lt "$first_commit" ]; then
    fail "R-06 XACK aparece antes do COMMIT/transação em ${f#$ROOT/}:$first_ack"
  fi
done

# FC-11 regra não decidida
report warn "FC-11 regra de arredondamento do lucro fixada encontrado" \
  "$(scan '(payout|profit|lucro)\w*[^;]*(Math\.(floor|round|ceil)|/[[:space:]]*100n?\b)' -i)"

# I-05 reconciliação
recon="$(find "${SRC_DIRS[@]}" -iname '*reconcil*' -not -path '*/node_modules/*' 2>/dev/null | head -n1)"
if [ -z "$recon" ]; then
  warn "I-05 reconciliador não encontrado (T11)"
else
  [ -n "$(scan 'ledger_reconciliation_errors_total')" ] && pass "I-05 métrica ledger_reconciliation_errors_total presente" \
    || fail "I-05 métrica ledger_reconciliation_errors_total ausente"
fi

# I-06 correção por reversão
report fail "I-06 edição de saldo pelo admin encontrado" "$(scan "/admin/[^'\"\`]*(balance|saldo)|(adjust|edit|set)Balance" -i)"
[ -n "$(scan 'reversal:')" ] && pass "I-06 chave reversal: presente" || warn "I-06 fluxo de reversão (reversal:) não encontrado"

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: $ERRORS ponto(s) para leitura obrigatória, $WARNINGS aviso(s)"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
