# SUBETAPA 7: MONITORAMENTO PROMETHEUS, MÉTRICAS E ALERTAS REGIONAIS

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agentes Executores:** `backend-implementation-agent`, `qa-resilience-agent`  
**Agentes Revisores e Auditores:** `security-reviewer`, `broker-architect-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-07`

---

## 1. Objetivo e Escopo

Instrumentar telemetria avançada e observabilidade operacional da Fase 2 nos serviços de backend (`services/api`, `services/websocket-gateway`, `services/tick-engine`), englobando:
1. **Métricas Prometheus Segmentadas por País**:
   - `broker_http_requests_total{country, path, status}`: Volume de requisições por país.
   - `broker_geoblock_rejections_total{country, reason}`: Contagem de bloqueios de geoblocking e países de origem.
   - `broker_feature_flag_status{country, flag_key}`: Gauge (1 para habilitado, 0 para desabilitado).
   - `broker_contracts_created_total{country, symbol, direction}`: Ordens criadas por país de origem.
   - `broker_otc_real_feed_status{symbol, state}`: Estado do circuito dos feeds reais (0 = Closed/Saudável, 1 = Open/Fallback, 2 = Half-Open).
   - `broker_otc_real_feed_latency_ms{symbol}`: Latência de ingestão dos dados de mercado real.
2. **Regras de Alerta do Alertmanager (`infra/prometheus/phase2_alerts.yml`)**:
   - `GeoblockSpikeAlert`: Dispara se requisições bloqueadas excederem 100/min de um país específico.
   - `OtcFeedFallbackAlert`: Dispara se um feed de mercado real permanecer em fallback estocástico por mais de 30 segundos.
   - `CountryFlapAlert`: Dispara se feature flags de um país alternarem mais de 5 vezes em 1 minuto.

---

## 2. Invariantes e Padrão de Observabilidade (Skill 07)

- **Sanitização de Labels**: Valores de país recebidos de fora devem ser normalizados e limitados a 2 caracteres alfanuméricos ou `UNKNOWN` para evitar Cardinality Explosion no Prometheus.
- **Isolamento de Performance**: A coleta e raspagem do endpoint `/metrics` não pode impactar o tempo de resposta das rotas de trading (< 0.2ms de overhead).

---

## 3. Especificação das Regras de Alerta

```yaml
groups:
  - name: phase2_alerts
    rules:
      - alert: OtcFeedFallbackActive
        expr: broker_otc_real_feed_status{state="OPEN"} == 1
        for: 30s
        labels:
          severity: warning
        annotations:
          summary: "Feed de mercado real em fallback estocástico para {{ $labels.symbol }}"
          description: "O conector externo falhou e o mercado está sendo sustentado pelo gerador estocástico."

      - alert: HighGeoblockRate
        expr: rate(broker_geoblock_rejections_total[1m]) > 10
        for: 1m
        labels:
          severity: info
        annotations:
          summary: "Pico de conexões bloqueadas por geoblocking"
          description: "Detectadas tentativas de acesso de regiões não permitidas (origem: {{ $labels.country }})."
```

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-prometheus-metrics-phase2.test.ts`)
- Validação da instrumentação de cada métrica com labels de país.
- Validação de proteção contra explosão de cardinalidade (países inválidos rotulados como `INVALID_GEO`).

### 4.2 Testes de Integração (`tests/integration/test-prometheus-scraping.test.ts`)
- Raspagem real do endpoint `/metrics` em `services/api` e `services/tick-engine`.
- Asserção da presença dos contadores de geoblocking e status de feature flags.

### 4.3 Testes de Caos
- Forçar falha no feed de `BTCUSD_OTC` e verificar a mudança do gauge `broker_otc_real_feed_status` para `1` (OPEN), confirmando a ativação da métrica de alerta.

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-07`)
A Subetapa 7 é considerada HOMOLOGADA exclusivamente se:
1. O endpoint `/metrics` exporta as séries temporais segmentadas por país e por feed OTC real.
2. Os alertas de fallback e anomalias de geoblocking disparam confiavelmente.
3. Testes unitários e de integração passam com 100% de sucesso.
4. O `post-implementation-verifier` homologa o gate.
