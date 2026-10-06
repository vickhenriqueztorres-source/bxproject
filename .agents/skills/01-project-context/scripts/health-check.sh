#!/usr/bin/env bash
# Verifica se o projeto está alinhado com o contexto declarado na skill
# (stack, arquitetura e decisões). Não altera nada.
# Uso: bash scripts/health-check.sh [--live]
#   --live  também consulta "docker compose ps" para ver serviços em execução
set -uo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../.." && pwd)"
LIVE="${1:-}"
ERRORS=0
WARNINGS=0

pass() { echo "[OK]   $1"; }
warn() { echo "[WARN] $1"; WARNINGS=$((WARNINGS + 1)); }
fail() { echo "[FAIL] $1"; ERRORS=$((ERRORS + 1)); }

echo "Health-check: 01-project-context"
echo "Projeto: $PROJECT_ROOT"
echo "----------------------------------------"

# 1. Orquestrador referencia a skill
if [ -f "$PROJECT_ROOT/ORCHESTRATOR.md" ]; then
  if grep -q "01-project-context" "$PROJECT_ROOT/ORCHESTRATOR.md"; then
    pass "ORCHESTRATOR.md referencia 01-project-context"
  else
    fail "ORCHESTRATOR.md não referencia 01-project-context"
  fi
else
  fail "ORCHESTRATOR.md não encontrado"
fi

# 2. Serviços da arquitetura declarados no docker-compose
EXPECTED_SERVICES="postgres redis keycloak blnk api tick-engine candle-worker settlement-worker websocket-gateway frontend prometheus grafana loki"
COMPOSE_FILE=""
for candidate in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
  if [ -f "$PROJECT_ROOT/$candidate" ]; then
    COMPOSE_FILE="$PROJECT_ROOT/$candidate"
    break
  fi
done

if [ -z "$COMPOSE_FILE" ]; then
  warn "docker-compose ainda não existe (esperado: D-15)"
else
  pass "compose encontrado: $(basename "$COMPOSE_FILE")"
  for service in $EXPECTED_SERVICES; do
    if grep -qE "^[[:space:]]{2}$service:[[:space:]]*$" "$COMPOSE_FILE"; then
      pass "serviço declarado: $service"
    else
      warn "serviço ausente no compose: $service"
    fi
  done
fi

# 3. Serviços construídos internamente (D-06)
for built in tick-engine candle-worker settlement-worker websocket-gateway api; do
  if [ -d "$PROJECT_ROOT/services/$built" ]; then
    pass "serviço próprio presente: services/$built"
  else
    warn "serviço próprio ainda não criado: services/$built"
  fi
done

# 4. Decisões que não podem ser contornadas
if [ -d "$PROJECT_ROOT/services" ] || [ -d "$PROJECT_ROOT/apps" ]; then
  SEARCH_DIRS=""
  [ -d "$PROJECT_ROOT/services" ] && SEARCH_DIRS="$SEARCH_DIRS $PROJECT_ROOT/services"
  [ -d "$PROJECT_ROOT/apps" ] && SEARCH_DIRS="$SEARCH_DIRS $PROJECT_ROOT/apps"

  # D-07: CSPRNG — Math.random / random.random não podem gerar preço
  # shellcheck disable=SC2086
  weak_rng="$(grep -rnE 'Math\.random\(|random\.random\(' $SEARCH_DIRS \
    --include='*.ts' --include='*.js' --include='*.py' 2>/dev/null | grep -v node_modules || true)"
  if [ -n "$weak_rng" ]; then
    fail "gerador não criptográfico encontrado (viola D-07):"
    echo "$weak_rng" | sed 's/^/       /'
  else
    pass "nenhum Math.random / random.random (D-07)"
  fi

  # D-04: Kafka/RabbitMQ não fazem parte da stack
  # shellcheck disable=SC2086
  other_broker="$(grep -rlnE 'kafkajs|amqplib|confluent_kafka|pika' $SEARCH_DIRS 2>/dev/null | grep -v node_modules || true)"
  if [ -n "$other_broker" ]; then
    fail "broker fora da stack encontrado (viola D-04):"
    echo "$other_broker" | sed 's/^/       /'
  else
    pass "nenhum broker fora da stack (D-04)"
  fi
else
  warn "services/ e apps/ ainda não existem — verificação de código ignorada"
fi

# 5. Opcional: serviços em execução
if [ "$LIVE" = "--live" ]; then
  if command -v docker >/dev/null 2>&1 && [ -n "$COMPOSE_FILE" ]; then
    running="$(docker compose -f "$COMPOSE_FILE" ps --services --filter status=running 2>/dev/null || true)"
    for service in $EXPECTED_SERVICES; do
      if printf '%s\n' "$running" | grep -qx "$service"; then
        pass "em execução: $service"
      else
        warn "parado: $service"
      fi
    done
  else
    warn "--live ignorado: docker ou compose indisponível"
  fi
fi

echo "----------------------------------------"
if [ "$ERRORS" -gt 0 ]; then
  echo "Resultado: FALHOU ($ERRORS erro(s), $WARNINGS aviso(s))"
  exit 1
fi
echo "Resultado: OK ($WARNINGS aviso(s))"
