#!/usr/bin/env bash
# Varredura estática do banco: migrations, IaC, Compose e strings de conexão.
# Uso: bash scripts/health-check.sh [raiz-do-projeto] [--base <git-ref>]
#   --base: compara com o ref para detectar migration já aplicada que foi editada (DB-11).
set -uo pipefail

ROOT="."
BASE_REF=""
while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE_REF="${2:-}"; shift 2 ;;
    *) ROOT="$1"; shift ;;
  esac
done

ERRORS=0
WARNINGS=0
pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

# Mascara qualquer senha em URL antes de imprimir.
mask() { sed -E 's#(://[^:/@[:space:]]+):[^@[:space:]]+@#\1:***@#g'; }

# grep -n em vários arquivos; imprime "arquivo:linha: conteúdo" mascarado.
scan() {
  local pattern="$1"; shift
  [ $# -eq 0 ] && return 1
  grep -HnEi -- "$pattern" "$@" 2>/dev/null | mask
}

report() {
  local level="$1" rule="$2" message="$3" hits="$4"
  if [ -n "$hits" ]; then
    "$level" "$rule — $message"
    printf '%s\n' "$hits" | sed 's/^/         /' | head -n 10
  fi
}

echo "Health-check do banco em: $ROOT"
echo "----------------------------------------"

# ---------- coleta de arquivos ----------
mapfile -t MIGRATIONS < <(find "$ROOT" -path '*/node_modules' -prune -o \
  -type f -path '*/db/migrations/*.sql' -print 2>/dev/null | sort)
mapfile -t BOOTSTRAP < <(find "$ROOT" -path '*/node_modules' -prune -o \
  -type f -path '*/db/bootstrap/*.sql' -print 2>/dev/null | sort)
mapfile -t TERRAFORM < <(find "$ROOT" -path '*/node_modules' -prune -o -path '*/.terraform' -prune -o \
  -type f \( -name '*.tf' -o -name '*.tfvars' \) -print 2>/dev/null | sort)
mapfile -t CONFIGS < <(find "$ROOT" -path '*/node_modules' -prune -o -path '*/.git' -prune -o \
  -type f \( -name '.env' -o -name '.env.*' -o -name '*.env' -o -name 'compose*.yml' -o -name 'docker-compose*.yml' \
  -o -name '*.yaml' -o -name '*.yml' -o -name '*.ts' -o -name '*.js' -o -name '*.json' \) \
  ! -name '*.example' ! -name 'package-lock.json' ! -name 'pnpm-lock.yaml' -print 2>/dev/null | sort)

SQL_ALL=("${MIGRATIONS[@]}" "${BOOTSTRAP[@]}")
UP_MIGRATIONS=()
for file in "${MIGRATIONS[@]}"; do
  case "$file" in *.down.sql) ;; *) UP_MIGRATIONS+=("$file") ;; esac
done

if [ ${#MIGRATIONS[@]} -eq 0 ]; then
  warn "nenhuma migration em db/migrations/ — checagens de SQL ignoradas"
else
  pass "${#MIGRATIONS[@]} arquivo(s) de migration encontrados"

  # ---------- DB-02 Tipos ----------
  hits="$(scan '\b(real|double precision|float4|float8|money)\b' "${UP_MIGRATIONS[@]}")"
  report fail "DB-02" "tipo de ponto flutuante ou money" "$hits"
  hits="$(scan '\btimestamp\b([[:space:]]*(\(|,|\)|NOT|NULL|DEFAULT|$))' "${UP_MIGRATIONS[@]}" | grep -viE 'timestamptz|with time zone')"
  report fail "DB-02" "timestamp sem fuso (usar timestamptz)" "$hits"
  hits="$(scan '\b(price|_price)[a-z_]*[[:space:]]+numeric[[:space:]]*(,|NOT|$|CHECK)' "${UP_MIGRATIONS[@]}")"
  report fail "DB-02" "preço em numeric sem escala (usar numeric(18,6))" "$hits"
  hits="$(scan '\b(bigserial|serial)\b' "${UP_MIGRATIONS[@]}")"
  report warn "DB-02" "serial/bigserial (preferir GENERATED ALWAYS AS IDENTITY)" "$hits"

  # ---------- DB-03 Integridade: tabela sem PK ----------
  nopk="$(awk '
    BEGIN { IGNORECASE = 1 }
    /CREATE[[:space:]]+TABLE/ { inside = 1; haspk = 0; start = FNR; name = $0; file = FILENAME }
    inside && /PRIMARY[[:space:]]+KEY/ { haspk = 1 }
    inside && /^\)/ { if (!haspk) printf "%s:%d: %s\n", file, start, name; inside = 0 }
  ' "${UP_MIGRATIONS[@]}" 2>/dev/null)"
  report fail "DB-03" "CREATE TABLE sem PRIMARY KEY" "$nopk"

  # ---------- Catálogo: o que não entra ----------
  hits="$(scan 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?(ledger|ledger_entries|journal|postings|balances|wallets)\b' "${UP_MIGRATIONS[@]}")"
  report fail "D-02" "tabela de ledger/saldo no synth (o ledger é o Blnk)" "$hits"
  hits="$(scan '\b(balance|balance_minor|available_minor)[[:space:]]+(bigint|numeric|integer|double)' "${UP_MIGRATIONS[@]}")"
  report fail "D-02" "coluna de saldo no synth" "$hits"
  hits="$(scan '\b(password|password_hash|refresh_token|access_token|secret)[a-z_]*[[:space:]]+(text|varchar|char|bytea)' "${UP_MIGRATIONS[@]}")"
  report fail "DB-10" "coluna de senha, token ou segredo (identidade é do Keycloak)" "$hits"

  # ---------- DB-04 / DB-05 Privilégios ----------
  hits="$(scan 'GRANT[^;]*\b(DELETE|TRUNCATE|ALL)\b[^;]*\bTO\b[^;]*\b(app_[a-z_]+|auditor_ro|PUBLIC)\b' "${SQL_ALL[@]}")"
  report fail "DB-05" "DELETE/TRUNCATE/ALL para role de aplicação ou PUBLIC" "$hits"
  hits="$(scan 'GRANT[^;]*\b(UPDATE|INSERT)\b[^;]*\bON[[:space:]]+(TABLE[[:space:]]+)?(ticks|audit_logs|wallet_accounts)\b' "${SQL_ALL[@]}" | grep -iE '\bUPDATE\b')"
  report fail "DB-04" "UPDATE em tabela append-only" "$hits"
  hits="$(scan 'GRANT[^;(]*\bUPDATE\b[[:space:]]*(,[^;(]*)?\bON[[:space:]]+(TABLE[[:space:]]+)?contracts\b' "${SQL_ALL[@]}")"
  report fail "DB-05" "UPDATE em contracts sem lista de colunas" "$hits"
  hits="$(scan 'ON[[:space:]]+ALL[[:space:]]+TABLES' "${SQL_ALL[@]}")"
  report warn "DB-05" "GRANT ON ALL TABLES (não cobre tabelas futuras; usar lista explícita)" "$hits"
  hits="$(scan '\b(SUPERUSER|BYPASSRLS|CREATEROLE|CREATEDB|REPLICATION)\b' "${SQL_ALL[@]}" | grep -viE '\bNO(SUPERUSER|BYPASSRLS|CREATEROLE|CREATEDB|REPLICATION)\b')"
  report fail "DB-05" "atributo de role privilegiado" "$hits"
  hits="$(scan 'GRANT[[:space:]]+rds_superuser' "${SQL_ALL[@]}")"
  report fail "DB-05" "rds_superuser concedido" "$hits"
  hits="$(scan 'CREATE[[:space:]]+EXTENSION[^;]*\b(dblink|postgres_fdw|file_fdw|plpythonu?|plperlu|adminpack)\b' "${SQL_ALL[@]}")"
  report fail "DB-05" "extensão que atravessa databases ou acessa o sistema" "$hits"

  # SECURITY DEFINER precisa de search_path fixo e de REVOKE de PUBLIC
  for file in "${UP_MIGRATIONS[@]}"; do
    if grep -qi 'SECURITY[[:space:]]\+DEFINER' "$file"; then
      grep -qiE 'SET[[:space:]]+search_path' "$file" \
        || fail "DB-05 — SECURITY DEFINER sem SET search_path: $file"
      grep -qiE 'REVOKE[^;]*ON[[:space:]]+FUNCTION[^;]*FROM[[:space:]]+PUBLIC' "$file" \
        || warn "DB-05 — SECURITY DEFINER sem REVOKE EXECUTE FROM PUBLIC: $file"
    fi
  done

  hits="$(scan '(DISABLE[[:space:]]+TRIGGER|session_replication_role)' "${UP_MIGRATIONS[@]}")"
  report fail "DB-04" "desliga triggers (append-only e máquina de estados)" "$hits"
  hits="$(scan '^[[:space:]]*(UPDATE|DELETE[[:space:]]+FROM)[[:space:]]+(ticks|audit_logs|wallet_accounts)\b' "${UP_MIGRATIONS[@]}")"
  report fail "DB-04" "mutação de tabela append-only em migration" "$hits"
  hits="$(scan 'DELETE[[:space:]]+FROM[[:space:]]+(public\.)?outbox' "${UP_MIGRATIONS[@]}" | grep -viE 'published_at[[:space:]]+IS[[:space:]]+NOT[[:space:]]+NULL')"
  report fail "DB-14" "DELETE na outbox sem exigir published_at IS NOT NULL" "$hits"

  # ---------- DB-06 RLS ----------
  if grep -qiE 'CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?contracts\b' "${UP_MIGRATIONS[@]}" 2>/dev/null; then
    if grep -qiE 'ALTER[[:space:]]+TABLE[[:space:]]+contracts[[:space:]]+ENABLE[[:space:]]+ROW[[:space:]]+LEVEL[[:space:]]+SECURITY' "${SQL_ALL[@]}" 2>/dev/null; then
      pass "DB-06 — RLS habilitada em contracts"
    else
      fail "DB-06 — contracts sem ROW LEVEL SECURITY"
    fi
  fi
  hits="$(scan "set_config\([^)]*app\.user_id[^)]*,[[:space:]]*false[[:space:]]*\)|^[[:space:]]*SET[[:space:]]+(SESSION[[:space:]]+)?app\.user_id" "${CONFIGS[@]}" "${SQL_ALL[@]}")"
  report fail "DB-06" "app.user_id com escopo de sessão (vaza entre requisições atrás do pooler)" "$hits"

  # ---------- DB-11 Migrations ----------
  for up in "${UP_MIGRATIONS[@]}"; do
    case "$up" in
      *.up.sql)
        down="${up%.up.sql}.down.sql"
        [ -f "$down" ] || fail "DB-11 — .down.sql ausente para $(basename "$up")"
        ;;
      *) warn "DB-11 — nome fora do padrão NNNN_descricao.up.sql: $(basename "$up")" ;;
    esac
    grep -qiE 'SET[[:space:]]+lock_timeout' "$up" || warn "DB-11 — sem SET lock_timeout: $(basename "$up")"
  done
  hits="$(scan 'CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?[a-z_]+[[:space:]]+ON' "${UP_MIGRATIONS[@]}" | grep -viE 'CONCURRENTLY|/0001_')"
  report warn "DB-11" "CREATE INDEX sem CONCURRENTLY fora da migration inicial" "$hits"
  hits="$(scan 'ALTER[[:space:]]+(TABLE|COLUMN)[^;]*\bTYPE\b' "${UP_MIGRATIONS[@]}" | grep -v '/0001_')"
  report warn "DB-11" "ALTER COLUMN TYPE pode reescrever a tabela inteira" "$hits"
  hits="$(scan '\b(RENAME[[:space:]]+COLUMN|DROP[[:space:]]+COLUMN)\b' "${UP_MIGRATIONS[@]}")"
  report warn "DB-11" "RENAME/DROP COLUMN — conferir que é a fase contract (N-1 não usa)" "$hits"
  hits="$(scan 'ADD[[:space:]]+(CONSTRAINT[[:space:]]+[a-z_]+[[:space:]]+)?(CHECK|FOREIGN[[:space:]]+KEY)' "${UP_MIGRATIONS[@]}" | grep -viE 'NOT[[:space:]]+VALID')"
  report warn "DB-11" "constraint nova sem NOT VALID (valida a tabela inteira sob lock)" "$hits"

  if [ -n "$BASE_REF" ] && command -v git >/dev/null 2>&1; then
    changed="$(git -C "$ROOT" diff --name-status "$BASE_REF" -- '*db/migrations/*.sql' 2>/dev/null | awk '$1 ~ /^(M|D|R)/ {print $0}')"
    report fail "DB-11" "migration já existente no $BASE_REF foi alterada, removida ou renomeada" "$changed"
  fi
fi

# ---------- DB-09 / DB-10 Strings de conexão ----------
if [ ${#CONFIGS[@]} -gt 0 ]; then
  hits="$(scan 'sslmode=(disable|allow|prefer)\b' "${CONFIGS[@]}")"
  report fail "DB-09" "conexão sem TLS obrigatório" "$hits"
  hits="$(scan 'sslmode=(require|verify-ca)\b' "${CONFIGS[@]}" | grep -v 'compose.dev')"
  report warn "DB-09" "TLS sem validação completa do servidor (usar verify-full)" "$hits"
  hits="$(scan 'postgres(ql)?://(postgres|rdsadmin|root|admin|synth_owner|synth_migrator)[:@]' "${CONFIGS[@]}")"
  report fail "DB-05" "serviço conectando como superusuário, owner ou migrator" "$hits"
  hits="$(scan 'postgres(ql)?://[^:/@[:space:]]+:[^@[:space:]$]{4,}@' "${CONFIGS[@]}" | grep -viE '\$\{|<|change_me|example')"
  report fail "DB-10" "senha literal em string de conexão versionada" "$hits"
  hits="$(scan '["'"'"']?[0-9.]*:?5432:5432' "${CONFIGS[@]}" | grep -v '127\.0\.0\.1')"
  report fail "DB-01" "porta do PostgreSQL publicada fora de 127.0.0.1" "$hits"
fi

# ---------- DB-01 / DB-10 / DB-12 IaC ----------
if [ ${#TERRAFORM[@]} -eq 0 ]; then
  warn "nenhum arquivo .tf/.tfvars — checagens de infraestrutura ignoradas"
else
  pass "${#TERRAFORM[@]} arquivo(s) de IaC encontrados"
  hits="$(scan 'publicly_accessible[[:space:]]*=[[:space:]]*true' "${TERRAFORM[@]}")"
  report fail "DB-01" "RDS com IP público" "$hits"
  hits="$(scan 'storage_encrypted[[:space:]]*=[[:space:]]*false' "${TERRAFORM[@]}")"
  report fail "DB-10" "storage sem criptografia" "$hits"
  hits="$(scan 'deletion_protection[[:space:]]*=[[:space:]]*false' "${TERRAFORM[@]}" | grep -viE '/dev/|dev\.tfvars')"
  report fail "DB-12" "deletion_protection desligada fora de dev" "$hits"
  hits="$(scan 'backup_retention_period[[:space:]]*=[[:space:]]*[0-6]\b' "${TERRAFORM[@]}" | grep -viE '/dev/|dev\.tfvars')"
  report fail "DB-12" "retenção de backup < 7 dias fora de dev" "$hits"
  hits="$(scan 'skip_final_snapshot[[:space:]]*=[[:space:]]*true' "${TERRAFORM[@]}" | grep -viE '/dev/|dev\.tfvars')"
  report fail "DB-12" "skip_final_snapshot = true fora de dev" "$hits"
  hits="$(scan 'multi_az[[:space:]]*=[[:space:]]*false' "${TERRAFORM[@]}" | grep -iE 'prod')"
  report fail "DB-01" "prod sem Multi-AZ" "$hits"
  hits="$(scan 'rds\.force_ssl[^0-9]*0\b' "${TERRAFORM[@]}")"
  report fail "DB-10" "rds.force_ssl = 0" "$hits"
  hits="$(scan 'log_statement[^a-z]*all' "${TERRAFORM[@]}")"
  report fail "DB-13" "log_statement = all (grava dados de todos os databases)" "$hits"
  for file in "${TERRAFORM[@]}"; do
    if grep -q '5432' "$file" && grep -q '0\.0\.0\.0/0' "$file"; then
      fail "DB-01 — porta 5432 e 0.0.0.0/0 no mesmo arquivo: $file (conferir o security group)"
    fi
    if grep -qE 'instance_class[[:space:]]*=[[:space:]]*"db\.t[0-9]' "$file" && printf '%s' "$file" | grep -qi 'prod'; then
      warn "DB-09 — classe burstable (db.t*) em prod: $file"
    fi
  done
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: REPROVADO ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: APROVADO ($WARNINGS aviso(s))"
