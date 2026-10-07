# Subetapa 1: Event Time & Relógio Monotônico (Precisão Temporal Industrial)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `backend-implementation-agent`  
**Agente Frontend:** `frontend-realtime-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes:** M-02 (Sequência e integridade temporal de ticks)

---

## 1. Escopo e Objetivos da Subetapa
Separar estritamente o tempo em que o evento ocorreu no mercado (*event time*) do tempo em que ele chegou/foi processado no sistema (*arrival/processing time*). Eliminar qualquer uso ingênuo de wall-clock para medição de latência ou duração, adotando relógio monotônico (`performance.now()` no cliente e `process.hrtime.bigint()` no Node.js) para imunizar a plataforma contra saltos no relógio de sistema (NTP steps, horário de verão).

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 1.1: Expansão do Protocolo de Ticks com Campos Temporais Duplos
- **Ação:** Atualizar o contrato de dados de ticks para conter obrigatoriamente:
  * `event_time`: timestamp epoch em milissegundos da criação do tick na fonte geradora.
  * `arrival_time`: timestamp epoch em milissegundos de recepção no nó receptor.
  * `latency_ms`: latência ponta a ponta calculada (`arrival_time - event_time`).
  * `ts`: ISO string original preservada para compatibilidade de visualização.
- **Critério de Aceite:** Formato retrocompatível com a interface `Tick` existente.

### Passo 1.2: Instrumentação de Monotonic Clock no Backend
- **Ação:** No gerador OTC e nos gateways, marcar o início do processamento de tick usando `process.hrtime.bigint()`. Medir o tempo de persistência e serialização com precisão de sub-milissegundo.
- **Critério de Aceite:** Zero medição de duração com `Date.now() - Date.now()`.

### Passo 1.3: Instrumentação de Monotonic Clock no Frontend
- **Ação:** No [`TradingFeedManager.ts`](file:///D:/brokerproject/apps/web/src/feed/TradingFeedManager.ts):
  * Na chegada do frame WebSocket, capturar imediatamente `arrival_time = Date.now()` e o marco monotônico `performance.now()`.
  * Atribuir `latency_ms = Math.max(0, arrival_time - tick.event_time)`.
- **Critério de Aceite:** Todo tick consumido na UI possui latência aferida com fidelidade.

### Passo 1.4: Proteção contra Timestamps Invertidos ou no Futuro
- **Ação:** Se um tick chegar com `event_time > arrival_time + 1000ms` (anomalia de clock skew), registrar evento de alerta e clampar `latency_ms = 0` com flag `clock_skew_detected = true`.
- **Critério de Aceite:** Nenhuma latência negativa gerada.

### Passo 1.5: Suporte no Endpoint REST de Snapshot
- **Ação:** Atualizar `GET /api/v1/snapshot` para retornar `event_time`, `arrival_time` e `server_monotonic_uptime_ms`.
- **Critério de Aceite:** O snapshot permite que o cliente calcule o delta de tempo com precisão.

### Passo 1.6: Exposição da Latência Real no PriceChart
- **Ação:** Atualizar a badge de status do gráfico para exibir a latência em tempo real (ex: `42ms`), mudando de cor se a latência subir (> 200ms amarelo, > 1000ms vermelho).
- **Critério de Aceite:** Feedback visual imediato ao usuário da saúde de rede daquele ativo.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Cálculo Monotônico:** Validar que `latency_ms` é calculado corretamente sob passagem simulada de tempo.
2. **Teste Anti-Negative Latency:** Simular tick com timestamp adiantado e garantir clamp seguro para 0ms.
3. **Teste de Compatibilidade de Protocolo:** Confirmar que clientes legados continuam recebendo `ts` e `price` sem erros.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- 100% dos ticks carregam `event_time`, `arrival_time` e `latency_ms`.
- Compilação do backend e frontend com zero erros de tipagem TypeScript.
- Testes automatizados executados e 100% aprovados.
