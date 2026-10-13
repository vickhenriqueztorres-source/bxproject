# Subetapa 06 — Certificação Integrada, Build de Produção & Deploy VPS

## 1. Objetivo Técnico
Fechar o ciclo de entrega da feature executando a certificação ponta a ponta:
1. **Verificação de Regressão Global**:
   - Execução completa do Vitest abrangendo todos os 99 arquivos de teste do projeto.
   - 100% de testes aprovados (507+ testes).
2. **Checagem Estática de Tipagem**:
   - `tsc --noEmit` em todo o monorepo sem nenhum erro.
3. **Build de Produção**:
   - Compilação otimizada do `@broker/web` (`pnpm --filter @broker/web run build`).
4. **Deploy e Reinício de Serviços na VPS**:
   - Empacotamento de `web-dist.zip` e transferência para o servidor `169.58.159.77` via `scripts/deploy-to-vps.mjs`.
   - Recarregamento do Nginx (`systemctl reload nginx`).
   - Reinício do serviço de feed PM2 (`pm2 restart broker-feed`).
   - Smoke tests remotos de sanidade confirmando resposta HTTP 200 e integridade dos feeds.

---

## 2. Entregáveis
- Relatório final de certificação gravado em `docs/features/binmax-portfolio-refinement/relatorios/06-certificacao-final.md`.
- Aplicação ativa e validada no ambiente local e no servidor público.
