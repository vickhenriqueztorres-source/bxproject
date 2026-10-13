# SUBETAPA 05 — CERTIFICAÇÃO INTEGRADA, SUÍTE DE CAOS E REGRESSÃO TOTAL
## Validação Holística de Todas as 7 Causas e 12 Itens com 100% de Aprovação

**Data:** 09/10/2026  
**Responsáveis:** `guardiao-regressao`, `qa-resilience-agent`, `compliance-risk-reviewer`, `tech-lead-orchestrator`  
**Escopo de Arquivos Autorizados:**
- `apps/web/src/**/*.unit.test.ts`
- `apps/web/src/**/*.unit.test.tsx`
- `docs/features/acabamento-sala/RELATORIO_FINAL_REFINAMENTO_18.md`

---

## 1. Objetivos da Certificação

1. **Garantia de Regressão Zero:**
   - Executar todos os 425 testes legados existentes em `apps/web/src` e comprovar 100% de aprovação.
2. **Matriz de Conformidade do Diagnóstico 18:**
   - Validar que cada uma das 7 causas e dos 12 itens de refinamento possui testes dedicados aprovados.
3. **Bateria de Estresse e Caos:**
   - Teste de fluxo contínuo de 200 ticks por segundo.
   - Teste de alta densidade de contratos simultâneos.
   - Teste de desconexão e recuperação de feed com alternância de status.
   - Teste de troca rápida de abas, timeframes e layouts multi-chart.
4. **Emissão de Relatório Forense Final:**
   - Documento assinado pelos revisores atestando conformidade visual e integridade da corretora.

---

## 2. Passo a Passo de Execução

- **Passo 5.1:** Criar e executar a suíte de testes integrada `apps/web/src/trade/subetapa-18-05-certificacao-final.unit.test.tsx`.
- **Passo 5.2:** Executar a suíte completa de testes do projeto via `vitest`.
- **Passo 5.3:** Compilar e validar a ausência de erros de TypeScript e linter (`tsc` e `vite build`).
- **Passo 5.4:** Consolidar evidências e gerar o relatório final de homologação.

---

## 3. Critérios de Aceite para Entrega Final

- [ ] 100% dos testes unitários, de estresse e de caos aprovados.
- [ ] Build de produção sem nenhum erro de tipagem.
- [ ] Acabamento fino impecável, profissional e institucional conforme a análise 18.
- [ ] Nenhuma alteração fora do escopo estrito de front-end.
