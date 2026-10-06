#!/usr/bin/env bash
# Varredura estática de Compose, pipeline, migrations, observabilidade e backup contra O-01 a O-06.
# Somente leitura. Retorna exit 1 se encontrar violação crítica.
# Uso: bash scripts/health-check.sh [diretório ...]
# Limitação: o parser de Compose assume indentação de 2 espaços.
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

if [ "$#" -gt 0 ]; then
  DIRS=("$@")
  ROOT_FILES=()
else
  DIRS=()
  for candidate in infra deploy ops .github db migrations runbooks services apps; do
    [ -d "$PROJECT_ROOT/$candidate" ] && DIRS+=("$PROJECT_ROOT/$candidate")
  done
  mapfile -t ROOT_FILES < <(find "$PROJECT_ROOT" -maxdepth 1 -type f \( -name '*compose*.yml' -o -name '*compose*.yaml' -o -name '.gitlab-ci.yml' -o -name '*.md' \) 2>/dev/null)
fi

echo "Health-check: 07-production-operations"
echo "----------------------------------------"

if [ "${#DIRS[@]}" -eq 0 ] && [ "${#ROOT_FILES[@]}" -eq 0 ]; then
  warn "nenhum diretório de infraestrutura encontrado — nada a verificar"
  echo "Resultado: OK ($WARNINGS aviso(s))"
  exit 0
fi

find_files() {
  { [ "${#DIRS[@]}" -gt 0 ] && find "${DIRS[@]}" -type f "$@" -not -path '*/node_modules/*' 2>/dev/null
    for f in "${ROOT_FILES[@]}"; do find "$f" -maxdepth 0 "$@" 2>/dev/null; done
  } | sort -u
}

grep_files() {
  local pattern="$1"; shift
  [ "$#" -eq 0 ] && return 0
  grep -nHiE -e "$pattern" "$@" 2>/dev/null || true
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

is_dev() { case "$(basename "$1")" in *dev*|*override*|*local*|*test*|*drill*) return 0 ;; esac; return 1; }
is_prod() { case "$(basename "$1")" in *prod*) return 0 ;; esac; return 1; }

# O-01 Docker Compose
mapfile -t COMPOSE_FILES < <(find_files \( -name '*compose*.yml' -o -name '*compose*.yaml' \))
NON_DEV=()
PROD=()
for file in "${COMPOSE_FILES[@]}"; do
  is_dev "$file" || NON_DEV+=("$file")
  is_prod "$file" && PROD+=("$file")
done

if [ "${#COMPOSE_FILES[@]}" -eq 0 ]; then
  warn "O-01 nenhum arquivo Compose encontrado (D-15)"
else
  pass "O-01 ${#COMPOSE_FILES[@]} arquivo(s) Compose"

  report fail "O-01 imagem com tag latest ou sem tag encontrado" \
    "$(grep_files '^[[:space:]]*image:[[:space:]]*["'"'"']?[^[:space:]"'"'"']+:latest|^[[:space:]]*image:[[:space:]]*["'"'"']?[a-z0-9._/-]+["'"'"']?[[:space:]]*$' "${COMPOSE_FILES[@]}")"

  report fail "O-01 build: em compose de produção encontrado" \
    "$(grep_files '^[[:space:]]+build:' "${PROD[@]}")"

  report fail "O-01 porta de banco/Redis publicada fora de dev encontrado" \
    "$(grep_files '^[[:space:]]*-?[[:space:]]*["'"'"']?([0-9]+:)?(5432|6379|3306|27017):[0-9]+' "${NON_DEV[@]}" | grep -v '127\.0\.0\.1' || true)"

  report warn "O-01 Redis sem persistência (Streams de trabalho, D-04) encontrado" \
    "$(grep_files 'appendonly["'"'"', ]+no|--save["'"'"', ]+["'"'"']{2}' "${COMPOSE_FILES[@]}")"

  service_facts="$(awk '
    FNR == 1 { in_s = 0; svc = ""; dep = 0 }
    /^services:[[:space:]]*$/ { in_s = 1; next }
    in_s && /^[^[:space:]#]/ { in_s = 0; svc = "" }
    !in_s { next }
    /^  [A-Za-z0-9_.-]+:[[:space:]]*$/ { svc = $1; sub(/:$/, "", svc); print svc, "seen"; dep = 0; next }
    svc == "" { next }
    /^    healthcheck:/ { print svc, "healthcheck" }
    /^    restart:/ { print svc, "restart" }
    /^    <<:/ { print svc, "anchor" }
    /^    depends_on:[[:space:]]*$/ { dep = 1; next }
    /^    depends_on:[[:space:]]*\[/ { print svc, "depends_list" }
    dep && /^      - / { print svc, "depends_list" }
    /^    [A-Za-z_]+:/ { dep = 0 }
  ' "${COMPOSE_FILES[@]}" 2>/dev/null | sort -u)"

  services="$(echo "$service_facts" | awk '$2 == "seen" { print $1 }' | sort -u)"
  has() { echo "$service_facts" | grep -qE "^$1 ($2|anchor)$"; }
  no_health=""; no_restart=""
  for svc in $services; do
    case "$svc" in migrate|*-migrate|restore-*|*backfill*) continue ;; esac
    has "$svc" healthcheck || no_health="$no_health $svc"
    has "$svc" restart || no_restart="$no_restart $svc"
  done
  [ -n "$no_health" ] && warn "O-01 serviço(s) sem healthcheck:$no_health" || pass "O-01 todos os serviços com healthcheck (ou âncora)"
  [ -n "$no_restart" ] && warn "O-01 serviço(s) sem restart:$no_restart" || pass "O-01 todos os serviços com restart (ou âncora)"

  dep_list="$(echo "$service_facts" | awk '$2 == "depends_list" { print $1 }' | tr '\n' ' ')"
  [ -n "$dep_list" ] && warn "O-01 depends_on sem condition: service_healthy em: $dep_list" || pass "O-01 depends_on com condition"

  if [ "${#PROD[@]}" -gt 0 ] && [ -z "$(grep_files 'limits:|mem_limit|cpus:' "${PROD[@]}")" ]; then
    warn "O-01 compose de produção sem limites de CPU/memória"
  fi
fi

# O-02 CI/CD
mapfile -t CI_FILES < <(find_files \( -path '*/.github/workflows/*.yml' -o -path '*/.github/workflows/*.yaml' -o -name '.gitlab-ci.yml' -o -name 'Jenkinsfile' -o -path '*/.circleci/*' \))
mapfile -t DEPLOY_SCRIPTS < <(find_files \( -path '*/deploy/*.sh' -o -name 'deploy*.sh' \))
if [ "${#CI_FILES[@]}" -eq 0 ]; then
  warn "O-02 nenhum pipeline de CI encontrado"
else
  pass "O-02 ${#CI_FILES[@]} arquivo(s) de pipeline"
  report fail "O-02 build ou git pull no servidor de deploy encontrado" \
    "$(grep_files 'ssh .*(git pull|compose build|docker build|compose up --build)' "${CI_FILES[@]}" "${DEPLOY_SCRIPTS[@]}")"
  report warn "O-02 imagem publicada como latest no pipeline encontrado" \
    "$(grep_files 'tags?:.*:latest|docker (push|tag) [^ ]+:latest' "${CI_FILES[@]}")"
  if [ -z "$(grep_files '(run:|script:|sh ).*\b(test|tests|test:[a-z]+|pytest|vitest|jest)\b' "${CI_FILES[@]}")" ]; then warn "O-02 pipeline sem estágio de testes"; else pass "O-02 pipeline executa testes"; fi
  if [ -n "$(grep_files 'prod' "${CI_FILES[@]}")" ] && [ -z "$(grep_files 'staging' "${CI_FILES[@]}")" ]; then
    fail "O-02 deploy para produção sem estágio de staging"
  else
    pass "O-02 staging antes de produção (ou sem deploy de prod no pipeline)"
  fi
fi

mapfile -t MIGRATIONS < <(find_files \( -path '*migrations*' -name '*.sql' \))
if [ "${#MIGRATIONS[@]}" -gt 0 ]; then
  UP_MIGRATIONS=()
  for file in "${MIGRATIONS[@]}"; do case "$file" in *.down.sql|*down*) ;; *) UP_MIGRATIONS+=("$file") ;; esac; done
  report warn "O-02 migration destrutiva (exige expand/contract) encontrado" \
    "$(grep_files 'DROP[[:space:]]+(COLUMN|TABLE)|RENAME[[:space:]]+(COLUMN|TO)|ALTER[[:space:]]+COLUMN[^;]*TYPE|SET[[:space:]]+NOT[[:space:]]+NULL' "${UP_MIGRATIONS[@]}")"
  report warn "O-02 CREATE INDEX sem CONCURRENTLY encontrado" \
    "$(grep_files 'CREATE[[:space:]]+(UNIQUE[[:space:]]+)?INDEX[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?[a-z_]' "${UP_MIGRATIONS[@]}" | grep -vi 'CONCURRENTLY' || true)"
  report warn "O-02 migration sem lock_timeout encontrado" \
    "$(for file in "${UP_MIGRATIONS[@]}"; do grep -qiE 'ALTER|CREATE INDEX' "$file" && ! grep -qi 'lock_timeout' "$file" && echo "$file"; done)"
fi

# O-03 Logs e métricas
mapfile -t SRC_FILES < <(find_files \( -name '*.ts' -o -name '*.js' -o -name '*.py' -o -name '*.go' \) -not -path '*/test*' -not -name '*.test.*' -not -name '*.spec.*' -not -name '*.k6.js')
if [ "${#SRC_FILES[@]}" -gt 0 ]; then
  report warn "O-03 console.log (log não estruturado) encontrado" \
    "$(grep_files 'console\.(log|info|debug)\(' "${SRC_FILES[@]}" | head -n 20)"
  report fail "O-03 log de token, senha, cookie ou headers encontrado" \
    "$(grep_files '(log|logger|console)\.[a-z]+\([^)]*(authorization|password|senha|access_?token|refresh_?token|cookie|secret|req\.headers)' "${SRC_FILES[@]}")"
  report warn "O-03 label de métrica com alta cardinalidade encontrado" \
    "$(grep_files 'labelNames[[:space:]]*:[[:space:]]*\[[^]]*(user_?id|contract_?id|trace_?id|idempotency|sub)' "${SRC_FILES[@]}")"
  report fail "O-03 Sentry com sendDefaultPii encontrado" \
    "$(grep_files 'sendDefaultPii[[:space:]]*:[[:space:]]*true' "${SRC_FILES[@]}")"
  [ -z "$(grep_files 'Sentry\.init|sentry_sdk\.init' "${SRC_FILES[@]}")" ] && warn "O-03 Sentry não inicializado (D-14)" || pass "O-03 Sentry presente"
  [ -z "$(grep_files 'prom-client|prometheus_client|client_golang|/metrics' "${SRC_FILES[@]}")" ] && warn "O-03 nenhuma exposição de métricas Prometheus" || pass "O-03 métricas Prometheus expostas"
fi
mapfile -t LOG_CONFIGS < <(find_files \( -path '*loki*' -o -path '*promtail*' -o -path '*alloy*' \) \( -name '*.yml' -o -name '*.yaml' -o -name '*.alloy' \))
report warn "O-03 label do Loki com alta cardinalidade encontrado" \
  "$(grep_files '(user_?id|contract_?id|trace_?id)' "${LOG_CONFIGS[@]}" | grep -i 'label' || true)"

# O-04 Alertas
mapfile -t RULE_FILES < <(find_files \( -name '*.yml' -o -name '*.yaml' \) -path '*prometheus*')
ALERT_FILES=()
for file in "${RULE_FILES[@]}"; do grep -qE '^[[:space:]]*-[[:space:]]*alert:' "$file" && ALERT_FILES+=("$file"); done
if [ "${#ALERT_FILES[@]}" -eq 0 ]; then
  warn "O-04 nenhuma regra de alerta Prometheus encontrada"
else
  pass "O-04 ${#ALERT_FILES[@]} arquivo(s) de regras de alerta"
  missing_meta="$(awk '
    function flush() { if (name != "" && (!rb || !fr) && name != "Watchdog") print FILENAME ": " name (rb ? "" : " sem runbook_url") (fr ? "" : " sem for:") }
    /^[[:space:]]*-[[:space:]]*alert:/ { flush(); name = $NF; rb = 0; fr = 0; next }
    /runbook_url:/ { rb = 1 }
    /^[[:space:]]+for:/ { fr = 1 }
    END { flush() }
  ' "${ALERT_FILES[@]}")"
  report warn "O-04 alerta sem runbook_url ou for: encontrado" "$missing_meta"

  missing_alerts=""
  for alert in BalanceDivergence TickRateLow TickEngineDown TickLeaderMissing FinancialDLQNotEmpty ContractsStuckExpiring BackupMissing WALArchiveFailing Watchdog; do
    grep -qE "alert:[[:space:]]*$alert\b" "${ALERT_FILES[@]}" || missing_alerts="$missing_alerts $alert"
  done
  [ -n "$missing_alerts" ] && warn "O-04 alertas mínimos ausentes:$missing_alerts" || pass "O-04 alertas mínimos presentes"

  [ -z "$(find_files -name '*.yml' -path '*prometheus*' -exec grep -l 'alert_rule_test' {} + 2>/dev/null)" ] \
    && warn "O-04 nenhuma regra testada com promtool (alert_rule_test)" || pass "O-04 regras com teste promtool"
fi

# O-05 Backups
mapfile -t ALL_CONFIG < <(find_files \( -name '*.yml' -o -name '*.yaml' -o -name '*.conf' -o -name '*.ini' -o -name '*.sh' -o -name '*.md' -o -name 'Dockerfile*' \))
backup_tool="$(grep_files 'pgbackrest|wal-g|barman|archive_command|pg_basebackup' "${ALL_CONFIG[@]}")"
if [ -z "$backup_tool" ]; then
  if [ -n "$(grep_files 'pg_dump' "${ALL_CONFIG[@]}")" ]; then
    warn "O-05 apenas pg_dump encontrado — sem PITR (WAL contínuo)"
  else
    warn "O-05 nenhuma configuração de backup encontrada"
  fi
else
  pass "O-05 backup com PITR configurado"
  [ -z "$(grep_files 'blnk' $(echo "$backup_tool" | cut -d: -f1 | sort -u))" ] && warn "O-05 backup não menciona o banco do Blnk" || pass "O-05 banco do Blnk no backup"
fi
[ -z "$(find_files \( -iname '*restore*' \))" ] && warn "O-05 nenhum script/runbook de restore testado" || pass "O-05 restore documentado"

# O-06 Rollback
[ -z "$(find_files \( -iname '*rollback*' \))" ] && warn "O-06 nenhum runbook de rollback" || pass "O-06 runbook de rollback presente"
mapfile -t DOCS < <(find_files -name '*.md')
report fail "O-06 rollback por restore de backup encontrado" \
  "$(grep_files 'rollback[^.]*(restaur|restore|backup|dump)' "${DOCS[@]}" | grep -viE 'não|nunca|never|proibido' || true)"
if [ "${#MIGRATIONS[@]}" -gt 0 ] && [ -z "$(printf '%s\n' "${MIGRATIONS[@]}" | grep -i 'down')" ] && [ -z "$(grep_files 'migrate:?[[:space:]]*down|--[[:space:]]*\+migrate[[:space:]]+down' "${MIGRATIONS[@]}")" ]; then
  warn "O-06 migrations sem down correspondente"
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS violação(ões), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
