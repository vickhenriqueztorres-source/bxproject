#!/usr/bin/env bash
# Quality Gate Automation - Plataforma de Índices Sintéticos (Fase 1 MVP Demo)
set -euo pipefail

echo "=========================================================="
echo " [QUALITY GATE] INICIANDO BATERIA DE VALIDAÇÃO FASE 1"
echo "=========================================================="

echo -e "\n[GATE 1/4] Compilando workspaces com TypeScript..."
pnpm --filter @broker/shared run build
pnpm --filter @broker/tick-engine run build
pnpm --filter @broker/outbox-relay run build
pnpm --filter @broker/candle-worker run build
pnpm --filter @broker/wallet-adapter run build
pnpm --filter @broker/settlement-worker run build
pnpm --filter @broker/websocket-gateway run build
pnpm --filter @broker/api run build
pnpm --filter @broker/web run build
pnpm --filter @broker/admin run build

echo -e "\n[GATE 2/4] Executando testes do Tick Engine e Outbox..."
npx tsx --test services/tick-engine/test/ou-generator.unit.test.ts services/tick-engine/test/hash-chain.unit.test.ts

echo -e "\n[GATE 3/4] Executando testes de Velas, API, Risco e Liquidação..."
npx tsx --test services/candle-worker/test/aggregator.unit.test.ts
npx tsx --test services/api/test/chart-api.unit.test.ts services/api/test/contracts.unit.test.ts
npx tsx --test services/wallet-adapter/test/blnk-client.unit.test.ts
npx tsx --test services/settlement-worker/test/payout-calculator.unit.test.ts services/settlement-worker/test/settler.unit.test.ts services/settlement-worker/test/reconciler.unit.test.ts
npx tsx --test services/websocket-gateway/test/catchup-handler.unit.test.ts

echo -e "\n[GATE 4/4] Executando baterias estatísticas, caos e estresse..."
npx tsx --test tests/math/nist-entropy.test.ts tests/math/monte-carlo-ou.test.ts tests/math/arithmetic-precision.test.ts
npx tsx --test tests/integration/flashmob-risk-cap.test.ts tests/integration/blnk-accounting-audit.test.ts
npx tsx --test tests/chaos/chaos-scenarios.test.ts

echo -e "\n=========================================================="
echo " [VEREDITO FINAL]: ALL GATES PASSED (100% SUCESSO)"
echo "=========================================================="
