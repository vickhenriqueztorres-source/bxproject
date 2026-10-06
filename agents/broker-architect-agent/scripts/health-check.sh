#!/usr/bin/env bash
# Health Check do broker-architect-agent
set -euo pipefail

echo "[HEALTH-CHECK] Verificando skills associadas ao broker-architect-agent..."
test -d skills/01-project-context
test -d skills/02-financial-invariants
test -d skills/03-synthetic-market-engine
test -d skills/04-security-iam
test -d skills/05-resilience-patterns
test -d skills/06-testing-quality
test -d skills/07-production-operations
test -d skills/08-database-foundation
test -d skills/09-ai-failure-map
echo "[HEALTH-CHECK] Todas as 9 skills requeridas estão ativas e acessíveis!"
