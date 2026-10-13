# SUBETAPA 05: Mock Dev Live Feed (Porta 3001) & Admin Risk Limits

> **Status:** HOMOLOGADO E APROVADO (GATE 5 PASS)  
> **Responsáveis:** `backend-implementation-agent`, `qa-resilience-agent`  
> **Skills Chave:** `03-synthetic-market-engine`, `05-resilience-patterns`  

---

## 1. Escopo Técnico e Invariantes

1. **Atualização do `scripts/dev-live-feed.mjs`**:
   - Matriz `ASSETS_CONFIG` atualizada com os 6 índices canônicos (`VOL_10`, `VOL_25`, `VOL_50`, `VOL_75`, `VOL_100`, `CRASH_BOOM_100`) e nomes atraentes.
   - Geração determinística de velas e histórico UDF TradingView (`/api/v1/chart/history`).
   - Tabela de aliases bidirecionais (`SYMBOL_ALIASES` e `resolveSymbol`) para compatibilidade legado/canônico em REST e WebSocket.
   - Abertura de contratos (`POST /api/contracts`) resolvendo automaticamente aliases para símbolos canônicos.
   - Streaming WebSocket (`/ticks`) com inscrição tanto por símbolo canônico quanto legado.
2. **Atualização do Painel Administrativo (`apps/admin/`)**:
   - Verificado que o painel admin não possui símbolos hardcoded de índices sintéticos.

---

## 2. Passo a Passo de Implementação

1. [x] Atualizar `scripts/dev-live-feed.mjs` com os novos símbolos e aliases.
2. [x] Atualizar rotas REST (`/candles`, `/api/v1/chart/history`, `/api/v1/snapshot`, `/api/indices/:symbol`, `/api/contracts`) e WebSocket (`subscribe`/`unsubscribe`).
3. [x] Reiniciar o processo do `dev-live-feed` (porta 3001).
4. [x] Executar suíte de validação `tests/test-subetapa-5-dev-feed-admin.mjs` com 100% de sucesso.

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite | Resultado |
|---|---|---|---|---|
| **T-MOCK-01** | **Disponibilidade e Latência do Feed** | Requisitar `/candles?symbol=VOL_50` e `/api/v1/snapshot?symbol=CRASH_BOOM_100` | HTTP 200 em todas, tempo de resposta < 10ms. | ✅ APROVADO |
| **T-MOCK-02** | **Redirecionamento de Alias Legado** | Requisitar `/candles?symbol=SYNTH_VOL_50`, `/api/v1/chart/history?symbol=SYNTH_VOL_10` | HTTP 200 com histórico sincronizado (zero 404 para clientes em cache). | ✅ APROVADO |
| **T-MOCK-03** | **Streaming WebSocket Dual-Alias** | Assinar `VOL_25` e `SYNTH_VOL_100` simultaneamente via WS | Recebe snapshot imediato e streaming de ticks com canônico resolvido. | ✅ APROVADO |
| **T-MOCK-04** | **Abertura de Contratos Dual-Alias** | POST `/api/contracts` com `VOL_50` e `SYNTH_VOL_75` | Contratos criados com sucesso (HTTP 201) gravando símbolo canônico. | ✅ APROVADO |

---

## 4. Gate de Homologação da Subetapa 05

- [x] Feed mock na porta 3001 respondendo 36 ativos com os novos 6 índices sintéticos.
- [x] Zero regressão para clientes legados (fallbacks transparentes funcionando).
- [x] Teste automatizado `tests/test-subetapa-5-dev-feed-admin.mjs` executado e aprovado com código 0.
- [x] **Subetapa 05 HOMOLOGADA com sucesso.**

A Subetapa 05 é considerada **HOMOLOGADA** somente quando:
1. `scripts/dev-live-feed.mjs` servir perfeitamente os novos índices sintéticos e aceitar os legados via alias.
2. O Painel Admin exibir os limites de risco dos novos ativos de forma íntegra.
