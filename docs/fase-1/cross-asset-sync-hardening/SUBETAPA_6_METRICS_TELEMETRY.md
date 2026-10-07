# Subetapa 6: Métricas Industriais & Telemetria Prometheus de Sincronização

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `backend-implementation-agent`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `07-production-operations`  
**Invariantes:** O-01 a O-03 (Observabilidade industrial)

---

## 1. Escopo e Objetivos da Subetapa
Exportar séries temporais dedicadas em formato Prometheus no endpoint `GET /metrics`, permitindo monitorar de ponta a ponta: o maior skew entre qualquer par de ativos, o atraso da linha d'água (*watermark lag*), a quantidade de eventos tardios descartados e o desvio de relógio dos servidores.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 6.1: Métrica `cross_asset_max_skew_ms`
- **Ação:** Exportar o maior delta de tempo observado entre todos os ativos ativos no sistema:
  $$\max_{i, j} |event\_time(i) - event\_time(j)|$$
- **Critério de Aceite:** Permite identificar gargalos de rota ou threads lentas no motor de mercado.

### Passo 6.2: Métrica `watermark_lag_seconds`
- **Ação:** Diferença em segundos entre o relógio corrente e a linha d'água global:
  $$\text{watermark\_lag} = \frac{\text{now}() - W_{global}}{1000}$$
- **Critério de Aceite:** Se o lag subir (> 5s), gatilho para alerta imediato de lentidão no pipeline.

### Passo 6.3: Métrica `late_ticks_dropped_total{symbol}`
- **Ação:** Contador acumulado monotônico de ticks recebidos com timestamp anterior ao watermark que foram neutralizados para evitar corrupção de preços.
- **Critério de Aceite:** Rastreabilidade de pacotes obsoletos.

### Passo 6.4: Métrica `feed_event_latency_ms{symbol}`
- **Ação:** Histogram / Gauge de latência calculada via relógio monotônico (`arrival_time - event_time`) por ativo.
- **Critério de Aceite:** Medição de latência verdadeira da rede.

### Passo 6.5: Métrica `cross_asset_sync_alert`
- **Ação:** Gauge binário (0 = sincronizado, 1 = descompasso $> 2000\text{ms}$).
- **Critério de Aceite:** Alerta automatizado em painéis Grafana.

### Passo 6.6: Otimização de Performance do Endpoint `/metrics`
- **Ação:** Garantir geração do payload OpenMetrics em menos de 10ms para os 36 ativos e todas as novas métricas de sincronismo.
- **Critério de Aceite:** Zero degradação de CPU para operações de scraping.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Formato Prometheus:** Validar que o endpoint `/metrics` exporta as novas métricas de sincronismo com comentários `# HELP` e `# TYPE` válidos.
2. **Teste de Disparo de Alerta:** Injetar skew de 2500ms e confirmar `cross_asset_sync_alert = 1`.
3. **Teste de Desempenho:** 50 requisições consecutivas com tempo médio de resposta $< 10\text{ms}$.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- Métricas de sincronismo e watermark 100% integradas ao `/metrics`.
- Testes automatizados executados e 100% aprovados.
