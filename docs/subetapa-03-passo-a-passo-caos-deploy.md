# Subetapa 03: Bateria de Caos, Estresse, Build e Deploy Final na VPS

**Responsável:** `qa-resilience-agent` & `regression-guardian-agent`  
**Revisor:** `tech-lead-orchestrator` & `broker-architect-agent`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS — SÓ VAI PRA PRÓXIMA SE ESTIVER 100% VALIDADA"

---

## 1. Escopo Técnico da Subetapa 03

1. **Testes de Caos e Alta Carga**:
   - 6 viewports simultâneos processando 500 ticks/segundo.
   - Mudanças de layout (1x1 -> 2x1 -> 2x2 -> 3x2) sob tráfego sem memory leaks.
   - Preservação total dos 326 testes existentes da suíte.

2. **Compilação e Verificação Estrita de Tipagem**:
   - `tsc && vite build` com zero warnings ou erros.

3. **Deploy e Homologação na VPS**:
   - Empacotamento de `web-dist.zip`, envio SSH/SFTP para `169.58.159.77`.
   - Reload do Nginx e restart do PM2 `broker-feed`.
   - Teste automatizado dos endpoints HTTP e WebSocket ao vivo.

---

## 2. Passo a Passo de Execução

### Passo 1: Execução da Suíte Completa de Testes
- Rodar `npx vitest run apps/web`.

### Passo 2: Build Limpo
- Executar `pnpm --filter @broker/web build`.

### Passo 3: Deploy na VPS
- Executar `node scripts/deploy-to-vps.mjs`.

### Passo 4: Validação dos Endpoints ao Vivo
- Executar `node scripts/verify-live-deployment.mjs`.
