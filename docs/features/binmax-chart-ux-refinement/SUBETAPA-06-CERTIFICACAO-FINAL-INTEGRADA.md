# SUBETAPA 06: CERTIFICAÇÃO FINAL INTEGRADA E REGRESSÃO ZERO

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Subetapa:** 06 de 06  
**Responsável:** `qa-resilience-agent` / `regression-guardian-agent`  
**Revisores:** `tech-lead-orchestrator`, `broker-architect-agent`, `financial-correctness-reviewer`

---

## 1. Escopo e Garantias de Homologação

1. **Execução Completa da Suíte de Testes (485+ testes)**:
   - Garantir que todos os testes pré-existentes e os novos testes das Subetapas 01 a 05 estejam 100% aprovados.
2. **Checagem Estrita de Tipagem TypeScript (`tsc --noEmit`)**:
   - Zero erros em todos os módulos e pacotes.
3. **Auditoria de Resiliência e Caos**:
   - Verificação de ausência de leaks de memória em canvas, overlays e MutationObservers.
   - Padrão Duas Portas intacto (`NEW_TRADEROOM=false` preservando modo legado).
4. **Relatório Consolidado**:
   - Emissão de `docs/features/binmax-chart-ux-refinement/relatorios/03-CERTIFICACAO-FINAL-INTEGRADA.md`.

---

## 2. Bateria de Comandos de Homologação

```powershell
# 1. Checagem estrita de tipos
pnpm --filter @broker/web exec tsc --noEmit

# 2. Execução da suíte completa de testes
$env:NODE_OPTIONS="--max-old-space-size=4096"
pnpm exec vitest run
```
