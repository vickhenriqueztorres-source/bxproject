# Subetapa 3 — Certificação Final, Testes de Estresse, Caos e Regressão

> **Governança**: `tech-lead-orchestrator`  
> **Workers Especializados**: `qa-resilience-agent`, `financial-correctness-reviewer`, `security-reviewer`, `regression-guardian-agent`  
> **Skills Ativas**: `06-testing-quality`, `05-resilience-patterns`, `19-testes-de-regressao-visual`  
> **Data**: 2026-10-08  
> **Objetivo**: Provar por execução que todas as funcionalidades e invariantes foram preservadas 100%.

---

## 1. Escopo de Validação do Gate

1. **Testes Unitários e de Integração**:
   - Execução de todas as suítes de testes em `apps/web/src/trade/` via `vitest run`.
   - 0 falhas toleradas.

2. **Testes de Caos e Estresse**:
   - Sobrecarga de dados históricos com milhares de velas simuladas.
   - Resiliência contra respostas vazias ou lentas da API.
   - Validação de ausência de memory leaks ou referências soltas em re-renders.

3. **Verificação do Padrão Duas Portas (`NEW_TRADEROOM = false`)**:
   - Garantir que o modo clássico/legado continue operacional e funcional.

4. **Compilação de Produção**:
   - Execução de `pnpm --filter @broker/web build`.
   - Zero erros de TypeScript (`tsc -b`).
   - Bundle de produção gerado com sucesso em `dist/`.
