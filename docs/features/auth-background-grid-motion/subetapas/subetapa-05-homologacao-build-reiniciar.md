# Subetapa 05 — Homologação Final, Build de Produção e Reinício do Dev Server

> **Objetivo:** Realizar a verificação estrita de TypeScript (`tsc && vite build`), rodar toda a suíte de testes de não-regressão, emitir o relatório de homologação final e reiniciar o servidor Vite dev server.

---

## 1. Escopo de Verificação
- `pnpm --filter @broker/web build`
- `pnpm vitest run apps/web/src/pages/`
- Reinicialização do Dev Server e verificação da porta 5173.

---

## 2. Critérios de Aceite
- Build concluído sem erros.
- Todas as suítes de testes 100% verdes.
- Dev server ativo e respondendo na porta 5173.
