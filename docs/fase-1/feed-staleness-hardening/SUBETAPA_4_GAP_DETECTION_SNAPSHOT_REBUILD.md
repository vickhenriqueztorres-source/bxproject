# Subetapa 4: Detecção de Gap de Sequência & Rebuild Limpo via Snapshot REST

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Frontend:** `frontend-realtime-agent`  
**Agente Revisor de Integridade:** `financial-correctness-reviewer`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes Protegidas:** M-02 (Tick sequence), M-06 (WebSocket Feed / Catch-up), V-02 (Sequence contínua)

---

## 1. Escopo e Objetivos da Subetapa
Garantir que mensagens perdidas não causem descontinuidade oculta nem corrompam os gráficos. Se a sequência numérica de um ativo saltar (ex: de 15 para 17), o cliente nunca deve tentar "adivinhar" o que foi perdido ou interpolar cotações. Ele deve suspender imediatamente a aplicação de deltas, buscar um **snapshot REST atômico e documentado** (`GET /api/v1/snapshot?symbol=...`), substituir seu estado local e retomar a aplicação de deltas a partir do ponto documentado.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 4.1: Endpoint REST Oficial de Snapshot Atômico
- **Ação:** No backend API e no `dev-live-feed.mjs`, criar o endpoint:
  `GET /api/v1/snapshot?symbol={symbol}`
  Retorna:
  ```json
  {
    "symbol": "EURUSD_OTC",
    "sequence": 1042,
    "price": "1.08542",
    "ts": "2026-10-06T19:00:00.000Z",
    "hash": "a1b2c3d4...",
    "status": "ACTIVE"
  }
  ```
- **Critério de Aceite:** Snapshot lê atomicamente do `index_state` com tempo de resposta $\le 10\text{ ms}$.

### Passo 4.2: Aprimoramento da Máquina de Estados de Sequência no Frontend
- **Ação:** No [`TradingFeedManager.ts`](file:///D:/brokerproject/apps/web/src/feed/TradingFeedManager.ts):
  * Rastrear `lastSequence` por símbolo com tipagem estrita `bigint` / inteiro seguro.
  * Se `incoming.sequence > lastSequence + 1`: classificar como `gap`.
  * Se `incoming.sequence <= lastSequence`: descartar silenciosamente como `duplicate`.
  * Se `incoming.sequence === lastSequence + 1`: aplicar normalmente.
- **Critério de Aceite:** Zero mensagens fora de ordem aplicadas ao gráfico.

### Passo 4.3: Suspensão de Deltas e Limpeza Local de Estado no Gap
- **Ação:** Ao detectar `gap`, o `TradingFeedManager`:
  1. Entra no estado `RESYNCING` para aquele símbolo.
  2. Pausa a aplicação de novos ticks nos callbacks do gráfico.
  3. Enfileira ticks que chegam durante o resync em um buffer temporário de ordenação.
- **Critério de Aceite:** Nenhuma vela desenhada com dados parciais durante a recuperação.

### Passo 4.4: Busca de Snapshot e Reconstrução Limpa (Rebuild)
- **Ação:** Disparar requisição `fetch('/api/v1/snapshot?symbol=' + symbol)`.
  * Atualizar `lastSequence = snapshot.sequence`.
  * Atualizar `lastPrice = snapshot.price`.
  * Despachar snapshot aos gráficos para realinhamento.
  * Drenar o buffer aplicando apenas os ticks cuja sequência for $> \text{snapshot.sequence}$.
- **Critério de Aceite:** O estado do gráfico é 100% restabelecido e alinhado com o servidor.

### Passo 4.5: Fallback via WebSocket Catch-Up
- **Ação:** Se o gap for de poucos ticks ($\le 10$), o WebSocket Gateway também responde a mensagens `{ type: "subscribe", symbol, lastSequence }` enviando os ticks ausentes armazenados no Redis Stream com `{ type: "catchup_ticks" }`.
- **Critério de Aceite:** Catch-up ultra-rápido para pequenas oscilações de conexão sem overhead de HTTP.

### Passo 4.6: Sinalização `resync_required` para Gaps Graves
- **Ação:** Se o gap exceder a retenção do buffer do Redis Stream, o gateway emite `{ type: "resync_required", symbol }`, forçando o cliente a recarregar as velas históricas e o snapshot fresh via REST.
- **Critério de Aceite:** Eliminação completa de corrupção silenciosa de histórico.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Simulação de Perda de Pacotes (Gap de 1 Tick)
* Enviar ticks com sequence 1, 2, 3, 5 (simulando perda do tick 4).
* Verificar que o cliente detecta o gap imediatamente no tick 5, busca o snapshot e normaliza a sequência sem congelar.

### 3.2 Teste de Descarte de Duplicatas
* Enviar ticks com sequence 10, 11, 11, 10, 12.
* Verificar que os ticks duplicados são descartados sem disparar renders ou alterar o volume da vela.

### 3.3 Teste de Carga de Gaps Concorrentes
* Simular 100 clientes sofrendo pequenos gaps simultâneos.
* Verificar que o endpoint de snapshot atende a demanda em $< 25\text{ ms}$ com zero degradação de CPU.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. Sequência numérica estritamente contínua comprovada em 100% dos testes.
2. Recuperação de gap executada de forma atômica e documentada.
3. Aprovado pelo `financial-correctness-reviewer` e `qa-resilience-agent`.
