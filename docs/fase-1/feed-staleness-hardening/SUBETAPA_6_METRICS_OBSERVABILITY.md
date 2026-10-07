# Subetapa 6: Métricas Industriais & Observabilidade de Feed em Tempo Real

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Frontend:** `frontend-realtime-agent`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `07-production-operations`, `08-database-foundation`  
**Invariantes Protegidas:** O-01 a O-03 (Observabilidade, métricas e telemetria)

---

## 1. Escopo e Objetivos da Subetapa
Fornecer visibilidade industrial definitiva sobre a integridade, latência e idade dos dados em cada um dos 36 ativos (seguindo os padrões Corvil, Pico e FIA). Nenhuma anomalia de mercado deve depender da reclamação de um usuário: o sistema deve exportar métricas em formato Prometheus com resolução de segundo, permitindo alertas instantâneos antes que qualquer operação financeira seja afetada.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 6.1: Exportação da Métrica `tick_age_seconds{symbol}`
- **Ação:** No backend e no gateway, calcular e expor continuamente a idade do tick mais recente por ativo:
  $$\text{tick\_age\_seconds} = \frac{\text{now}() - \text{last\_tick\_ts}}{1000}$$
- **Critério de Aceite:** Métrica atualizada em tempo real para cada um dos 36 símbolos.

### Passo 6.2: Exportação da Métrica de Gaps `feed_gap_count_total{symbol}`
- **Ação:** Contador acumulado monotônico incremental que avança toda vez que um salto de sequência (`incoming > lastSequence + 1`) é detectado no gateway ou no cliente.
- **Critério de Aceite:** Permite correlacionar perdas de pacotes com provedores de rede e instâncias.

### Passo 6.3: Exportação da Métrica de Alerta `staleness_alert{symbol}`
- **Ação:** Gauge binário (0 = Saudável, 1 = Em Alerta de Staleness) por ativo.
  * Quando $\text{tick\_age\_seconds} > 4.0$, o valor vai para 1.
  * Quando os ticks voltam, o valor retorna para 0.
- **Critério de Aceite:** Gatilho imediato para dashboards Grafana e alertas PagerDuty.

### Passo 6.4: Medição de Latência de Ponta a Ponta `feed_latency_ms{symbol}`
- **Ação:** Diferença entre o timestamp de geração do tick no PostgreSQL/motor e o timestamp de recebimento no gateway e no navegador.
- **Critério de Aceite:** Média $\le 50\text{ ms}$; P99 $\le 150\text{ ms}$ em ambiente de produção local/nuvem.

### Passo 6.5: Métrica de Reconexões `ws_reconnect_count_total`
- **Ação:** Contador de reconexões do WebSocket Gateway no cliente para identificar instabilidades de conexão do usuário ou do servidor.
- **Critério de Aceite:** Rastreabilidade de instabilidade no cliente.

### Passo 6.6: Endpoint Oficial de Telemetria `/metrics`
- **Ação:** No [`scripts/dev-live-feed.mjs`](file:///D:/brokerproject/scripts/dev-live-feed.mjs) e nos serviços backend Fastify, expor o endpoint HTTP:
  `GET /metrics`
  Compatível com scrape do Prometheus contendo as métricas de todos os 36 ativos.
- **Critério de Aceite:** Formato texto plano padrão OpenMetrics / Prometheus.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Validação de Scraping Prometheus
* Executar requisição HTTP `GET /metrics`.
* Verificar que os 36 ativos possuem séries temporais de `tick_age_seconds` e `feed_gap_count_total`.

### 3.2 Teste de Disparo do Gauge sob Silêncio
* Pausar geração de ticks de um ativo.
* Confirmar que `staleness_alert{symbol}` muda de 0 para 1 em menos de 5 segundos.

### 3.3 Teste de Resolução de Alerta
* Retomar o ativo e verificar que `staleness_alert{symbol}` volta imediatamente para 0.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. Endpoint `/metrics` respondendo em $< 10\text{ ms}$ com todos os 36 ativos cobertos.
2. Formato 100% aderente ao padrão Prometheus.
3. Homologado pelo `qa-resilience-agent`.
