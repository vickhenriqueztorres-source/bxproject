#!/usr/bin/env bash
# Validação do broker-architect-agent
set -euo pipefail

echo "[VALIDATE] Validando integridade da documentação do broker-architect-agent..."
test -f agents/broker-architect-agent/AGENT.md
test -f agents/broker-architect-agent/references/architecture-playbook.md
test -f agents/broker-architect-agent/references/adrs-and-invariants.md
test -f agents/broker-architect-agent/examples/architecture-review-example.md
test -f agents/broker-architect-agent/examples/adrs-template.md
echo "[VALIDATE] broker-architect-agent está 100% íntegro e documentado!"
