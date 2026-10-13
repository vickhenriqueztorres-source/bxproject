# Subetapa 05: Build de Produção, Reinicialização do Dev Server e Homologação Final

**Responsável:** `tech-lead-orchestrator` + `qa-resilience-agent`  
**Status:** PRONTO PARA EXECUÇÃO  

---

## 1. Objetivo Técnico e Operacional

Garantir que todo o código compilado com `tsc && vite build` atinja zero erros de tipagem e empacotamento, reiniciar o servidor de desenvolvimento na porta 5173 para os novos assets serem servidos sem cache residual, e emitir o relatório de homologação final.

---

## 2. Passo a Passo

1. **Build de Produção:**
   - Executar `pnpm --filter @broker/web build`.
   - Comprovar código de saída 0.
2. **Reinício do Dev Server:**
   - Encerrar o processo Vite anterior.
   - Subir um novo servidor dev em background: `pnpm --filter @broker/web dev`.
   - Verificar logs confirmando `ready in XXX ms` e disponibilidade em `http://localhost:5173/`.
3. **Emissão de Relatório:**
   - Gerar `docs/features/auth-background-grid-motion/RELATORIO-ENCAIXE-ESTETICO-FINAL.md`.
