# SUBETAPA 04: CERTIFICAÇÃO INTEGRADA FINAL E REGRESSÃO ZERO

**Feature:** `BMR-LAYOUT-REFINEMENT-2026-10-09`  
**Subetapa:** 04 de 04  
**Agente Responsável:** `qa-resilience-agent` / `regression-guardian-agent`  
**Revisores:** `financial-correctness-reviewer`, `security-reviewer`, `compliance-risk-reviewer`, `tech-lead-orchestrator`

---

## 1. Objetivo e Escopo

Executar a homologação de qualidade total da interface após o refinamento das proporções do Traderoom Binmax:
1. **Regressão Zero nos 469 Testes Pré-existentes**: Todas as suites de teste de trading, ordens, saldo, gráficos, WebSockets, catálogo, drawers e onboarding devem permanecer 100% verdes.
2. **Suíte Completa de Novos Testes de Refinamento**: Garantir aprovação de 100% dos testes unitários criados nas Subetapas 01, 02 e 03.
3. **Checagem Estrita de Tipagem TypeScript**: Validação com `tsc --noEmit` com zero erros ou alertas de compilação.
4. **Resiliência e Ausência de Efeitos Colaterais**:
   - Comportamento em telas Ultra-wide, Desktop (1920x1080, 1440x900) e Laptops (1280x720).
   - Suporte a temas e flags ligada/desligada.

---

## 2. Bateria de Comandos de Homologação

```powershell
# 1. Execução de toda a suíte Vitest com alocação adequada de memória
$env:NODE_OPTIONS="--max-old-space-size=4096"
pnpm exec vitest run

# 2. Verificação estrita de tipagem
pnpm --filter @broker/web exec tsc --noEmit
```

---

## 3. Critérios de Aceite e Gate

- [ ] Todos os testes Vitest do projeto executados e aprovados (0 falhas).
- [ ] TypeScript compila com 0 erros (`tsc --noEmit`).
- [ ] Relatório final de certificação registrado em `docs/features/binmax-layout-refinement/relatorios/02-CERTIFICACAO-FINAL-INTEGRADA.md`.
