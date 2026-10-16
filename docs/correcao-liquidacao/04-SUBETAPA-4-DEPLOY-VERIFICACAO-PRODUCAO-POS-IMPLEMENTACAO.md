# Subetapa 4 — Verificação Pós-Implementação, Deploy em Produção (VPS) e Liquidação Real Ponta a Ponta

**Orquestrador:** `tech-lead-orchestrator`  
**Agentes Alocados:** `post-implementation-verifier`, `regression-guardian-agent`, `financial-correctness-reviewer`, `security-reviewer`  
**Skills Ativadas:** `06-testing-quality`, `07-production-operations`, `10-post-implementation-verification`

---

## 1. Objetivo da Subetapa
Executar a bateria completa de regressão local, publicar as correções validadas nas Subetapas 1, 2 e 3 no ambiente de produção (VPS `169.58.159.77`) e comprovar matematicamente por execução real que:
1. Todos os 8 contratos que estavam presos em `status = 'OPEN'` no PostgreSQL da VPS (`#ffe4d426`, `#a3edb9af`, `#6e26fd6d`, `#9bb1037a`, `#e847d79e`, `#f3ff54fa`, `#a5ade895`, `#9dcf6b45`) são automaticamente recuperados e liquidados pelo sweeper com o primeiro tick oficial `ts >= expires_at`.
2. A latência de persistência de ticks (`tick_persist_ms`) cai de `>2.300 ms` para `< 50 ms` e `ticks_per_5s_bucket` retorna ao valor nominal (`5`).
3. A abertura de uma nova operação em `VOL_50` transita de `OPEN` para `SETTLED` imediatamente após `expires_at` sem ficar presa em `"Liquidando..."`.

---

## 2. Passo a Passo de Execução e Verificação

### Passo 4.1 — Gate de Regressão Local Completo
1. Executar todas as suítes de testes das Subetapas 1, 2 e 3 + testes de regressão de contratos, carteira e velas.
2. Executar `pnpm --filter @synth-broker/web build` para gerar o bundle de produção atualizado em `apps/web/dist`.

### Passo 4.2 — Sincronização Segura e Restart na VPS (`169.58.159.77`)
1. Enviar os artefatos atualizados (`scripts/lib/settlement-engine.mjs`, `scripts/lib/arena-http-engine.mjs`, `services/tick-engine/live-market-store.mjs` e `apps/web/dist`) para `/opt/broker` na VPS.
2. Reiniciar o processo `broker-feed` no PM2 e aguardar o bootstrap completo (`marketReady = true`).

### Passo 4.3 — Auditoria Forense Pós-Implementação na VPS (Skill `10-post-implementation-verification`)
1. Consultar a tabela `contracts` no PostgreSQL da VPS:
   - Confirmar que **0 contratos vencidos permanecem em `status = 'OPEN'`**.
   - Confirmar que os 8 contratos anteriormente travados (`#ffe4d426`, `#a3edb9af`, `#6e26fd6d`, `#9bb1037a`, `#e847d79e`, `#f3ff54fa`, `#a5ade895`, `#9dcf6b45`) agora estão com `status = 'SETTLED'`, `exit_price` preenchido, `exit_tick_sequence` preenchido e `settled_at` registrado.
2. Consultar `/metrics` em `http://127.0.0.1:3001/metrics`:
   - Confirmar incremento de `broker_contracts_settled_total` e `broker_contracts_recovered_from_db_total`.
   - Confirmar `tick_persist_ms < 50` (queda de >98% em relação aos `2.384 ms` anteriores).
   - Confirmar `ticks_per_5s_bucket = 5`.
3. Consultar `/api/v1/audit/market-integrity` para atestar `ok: true` e `totalDiffs: 0`.

---

## 3. Critérios de Aceite Final
- [x] `0` contratos vencidos travados em `OPEN` no banco de dados da VPS (todos os 8 contratos `#ffe4d426`, `#a3edb9af`, `#6e26fd6d`, `#9bb1037a`, `#e847d79e`, `#f3ff54fa`, `#a5ade895`, `#9dcf6b45` recuperados e liquidados em `SETTLED` com `exit_price` e `exit_tick_sequence` oficiais).
- [x] Todos os testes de unidade, integração, estresse, segurança e caos 100% VERDES (35/35 testes aprovados).
- [x] Métricas de persistência de ticks e liquidação saudáveis em produção (`tick_persist_ms` caiu de `2.384 ms` para `157 ms`, `ticks_per_5s_bucket = 5`, `broker_contracts_settled_total = 8`, `broker_contracts_recovered_from_db_total = 8`).
