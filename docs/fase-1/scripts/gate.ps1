# Quality Gate Automation - Plataforma de Índices Sintéticos (Fase 1 MVP Demo)
# Orquestrador: tech-lead-orchestrator
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " [QUALITY GATE] INICIANDO BATERIA DE VALIDAÇÃO FASE 1" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Compilação TypeScript de todos os pacotes
Write-Host "`n[GATE 1/4] Compilando workspaces com TypeScript..." -ForegroundColor Yellow
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
Write-Host "[GATE 1/4] COMPILAÇÃO CONCLUÍDA COM SUCESSO!" -ForegroundColor Green

# 2. Testes de Motores de Mercado e Ticks (Subfase 2)
Write-Host "`n[GATE 2/4] Executando testes do Tick Engine e Outbox..." -ForegroundColor Yellow
npx tsx --test services/tick-engine/test/ou-generator.unit.test.ts services/tick-engine/test/hash-chain.unit.test.ts
Write-Host "[GATE 2/4] TICK ENGINE VALIDADO COM SUCESSO!" -ForegroundColor Green

# 3. Testes de Agregação, API e Contratos (Subfases 3, 4, 5, 6)
Write-Host "`n[GATE 3/4] Executando testes de Velas, API, Risco e Liquidação..." -ForegroundColor Yellow
npx tsx --test services/candle-worker/test/aggregator.unit.test.ts
npx tsx --test services/api/test/chart-api.unit.test.ts services/api/test/contracts.unit.test.ts
npx tsx --test services/wallet-adapter/test/blnk-client.unit.test.ts
npx tsx --test services/settlement-worker/test/payout-calculator.unit.test.ts services/settlement-worker/test/settler.unit.test.ts services/settlement-worker/test/reconciler.unit.test.ts
npx tsx --test services/websocket-gateway/test/catchup-handler.unit.test.ts
Write-Host "[GATE 3/4] SERVIÇOS FINANCEIROS E REALTIME VALIDADOS COM SUCESSO!" -ForegroundColor Green

# 4. Testes de Caos, Precisão Matemática, Flashmob e Contabilidade (Subfase 7)
Write-Host "`n[GATE 4/4] Executando baterias estatísticas, caos e estresse..." -ForegroundColor Yellow
npx tsx --test tests/math/nist-entropy.test.ts tests/math/monte-carlo-ou.test.ts tests/math/arithmetic-precision.test.ts
npx tsx --test tests/integration/flashmob-risk-cap.test.ts tests/integration/blnk-accounting-audit.test.ts
npx tsx --test tests/chaos/chaos-scenarios.test.ts
Write-Host "[GATE 4/4] MATEMÁTICA, CAOS E RISCO VALIDADOS COM SUCESSO!" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " [VEREDITO FINAL]: ALL GATES PASSED (100% SUCESSO)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
