# Plano Geral — Execução Confiável de Ordens e Blindagem de Settlement por Ativo (Perigo 5)

## 1. Visão Geral e Contexto Forense

Ao testar a abertura de contratos no terminal frontend, o usuário se deparou com a seguinte mensagem de erro:
> **"Não foi possível enviar a ordem."**

### 1.1 Causa Raiz Forense Identificada
1. **Ausência de Rota no Feed Dev / Falta de Handler em `api/client.ts`:**
   - O `OrderTicket.tsx` invoca `openContract(symbol, direction, stakeMinor, key)`.
   - Em `apps/web/src/api/client.ts`, enquanto os métodos `getWallet`, `getIndex`, `getContracts` e `getContract` possuíam tratamento completo para o Modo Convidado Demo (`isGuestMode()`), a função `openContract` tentava enviar incondicionalmente um `POST /api/contracts` com cabeçalho de autenticação Keycloak.
   - O servidor `dev-live-feed.mjs` (porta 3001) não possuía rota registrada para `POST /api/contracts` (respondendo HTTP 404 Not Found).
   - O cliente lançava `ApiError(404, 'REQUEST_FAILED')`. Como a tabela de mensagens de erro do `OrderTicket` não mapeava `REQUEST_FAILED`, a interface exibia a mensagem de fallback: `"Não foi possível enviar a ordem."`.

2. **Perigo 5 da Arquitetura OTC — Settlement com Tick Errado por Ativo:**
   - Em ambientes multi-ativos, o maior perigo financeiro é um contrato de um ativo (ex: `BTCUSD_OTC`) ser liquidado contra a cotação de outro ativo (ex: `ETHUSD_OTC`) ou contra um tick velho/stale.
   - Para erradicar 100% desse risco, a indústria de trading institucional (FIX protocol, CME, B3, HFT) prescreve 5 técnicas invioláveis combinadas.

---

## 2. As 5 Técnicas Institucionais Obrigatórias

1. **Técnica 1: Chave Composta Única `(symbol, sequence)`:**
   - Nenhum tick é referenciado apenas por seu número sequencial isolado. A unicidade é estritamente dada pelo par ordenado `(symbol, sequence)`.
2. **Técnica 2: Validação Estrita de Símbolo e Staleness no Settlement:**
   - O motor de liquidação busca exclusivamente ticks onde `tick.symbol === contract.symbol`, `tick.event_time >= contract.expires_at`, e rejeita ticks com idade superior a 5 segundos (`tick_age > 5000ms`).
3. **Técnica 3: Idempotência por `settlement:{contract_id}`:**
   - Todo settlement possui chave de idempotência fixa e constraint de unicidade no banco de dados, tornando impossível a dupla liquidação.
4. **Técnica 4: Máquina de Estados com Guard:**
   - O contrato só pode transicionar de `OPEN` ou `EXPIRING` para `SETTLED` se o tick for autêntico e a liquidação não existir.
5. **Técnica 5: Reconciliação Periódica e Audit Hash Chain:**
   - Verificação contínua a cada minuto comparando contrato vs saldo vs tick oficial com hash encadeado SHA-256.

---

## 3. Divisão em Subetapas de Implementação

| Subetapa | Escopo | Agentes Responsáveis | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **Subetapa 1** | Execução de Ordens no Frontend & Feed Dev | `frontend-realtime-agent`, `backend-implementation-agent` | Ordem enviada gera recibo HTTP 201 e plota no gráfico |
| **Subetapa 2** | Chave Composta `(symbol, sequence)` | `backend-implementation-agent`, `broker-architect-agent` | Ticks identificados de forma única e indexada |
| **Subetapa 3** | Settlement Valida Símbolo e Staleness | `backend-implementation-agent`, `qa-resilience-agent` | Rejeição de ticks de outros ativos ou > 5s |
| **Subetapa 4** | Idempotência e Máquina de Estados | `backend-implementation-agent`, `financial-correctness-reviewer` | Zero dupla liquidação mesmo com N retentativas |
| **Subetapa 5** | Reconciliação e Audit Hash Chain | `backend-implementation-agent`, `post-implementation-verifier` | Hash encadeado validado e integridade comprovada |
| **Subetapa 6** | Auditoria de Gráficos e Certificação Final | `broker-architect-agent`, `qa-resilience-agent` | Gráficos 100% auditados, sem bugs, 60fps |
