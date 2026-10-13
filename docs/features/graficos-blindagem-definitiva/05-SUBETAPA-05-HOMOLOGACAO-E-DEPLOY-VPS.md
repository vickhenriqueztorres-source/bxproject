# Subetapa 05: Homologação e Deploy com Restart na VPS

## 1. Escopo de Execução
Após a validação de 100% dos testes locais:
1. Execução de build do frontend (`apps/web`): `pnpm -C apps/web build`.
2. Empacotamento em `web-dist.zip`.
3. Execução do script `scripts/deploy-to-vps.mjs`:
   - Conexão SSH à VPS (`169.58.159.77`).
   - Upload do bundle `web-dist.zip`.
   - Upload dos scripts backend atualizados (`scripts/dev-live-feed.mjs`).
   - Descompactação em `/root/app/apps/web/dist`.
   - Recarga do Nginx (`nginx -t && systemctl reload nginx`).
   - Reinicialização do processo PM2 (`pm2 restart broker-feed`).
   - Execução dos 4 smoke tests remotos:
     - Smoke Test 1: Frontend Bundle index JS ativo.
     - Smoke Test 2: Endpoint `/api/candles` respondendo.
     - Smoke Test 3: Endpoint de resampling respondendo.
     - Smoke Test 4: Endpoint de `/health` respondendo 200 OK.
4. Verificação de status via `scripts/check-vps-status.mjs`.

## 2. Critérios de Sucesso
- Saída do script reportando: `🎉 Deploy para VPS concluído com 100% de sucesso!`.
- Status do Nginx: Active (running).
- Status do PM2: `broker-feed` online.
