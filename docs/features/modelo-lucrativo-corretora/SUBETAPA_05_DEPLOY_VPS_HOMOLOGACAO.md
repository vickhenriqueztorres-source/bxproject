# SUBETAPA 05 — Deploy & Homologação na VPS

---

## 1. Objetivo Técnico
Compilar o frontend em modo de produção (`apps/web/dist`), empacotar os arquivos atualizados, enviar via SSH para a VPS (`169.58.159.77`), recarregar os processos Nginx e PM2 e validar a saúde completa dos serviços remotos.

---

## 2. Roteiro de Execução
1. Executar `pnpm --filter @broker/web build` (validação de TypeScript e bundling com Vite).
2. Rodar script de deploy automatizado `node scripts/deploy-to-vps.mjs`.
3. Executar smoke tests remotos:
   - Endpoint HTTP da Sala de Operações (`http://169.58.159.77/`).
   - Endpoint HTTP de Login (`http://169.58.159.77/login`).
   - Endpoint HTTP de Registro (`http://169.58.159.77/registro`).
   - Feed e Candles do Dev Feed (`http://169.58.159.77:3001/health`).
4. Apresentação do relatório executivo final ao usuário.
