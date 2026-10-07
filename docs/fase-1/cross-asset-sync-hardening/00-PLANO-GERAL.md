# Plano Geral: Blindagem contra Dessincronização entre Ativos ("Latency Tax")

**Orquestrador:** `tech-lead-orchestrator`  
**Arquiteto Chefe:** `broker-architect-agent`  
**Agentes Envolvidos:** `backend-implementation-agent`, `frontend-realtime-agent`, `financial-correctness-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Skills Ativadas:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `08-database-foundation`, `10-post-implementation-verification`  
**Invariantes Protegidas:** M-02 (Tick sequence e timing), M-06 (Feeds e latência), I-01 (Preservação financeira), V-02 (Sequência e integridade temporal), O-01 a O-03 (Observabilidade)

---

## 1. Contexto e Análise Forense do Problema (Latency Tax)

Em plataformas de trading e corretoras de derivativos multi-gráficos, cada ativo pode ter frequências e latências de rede distintas (ex: BTC atualiza a 1s, ETH atualiza a 3s ou sofre lag de rota). 

### Riscos Fatais de Ignorar a Dessincronização:
1. **Preços Distorcidos no Mesmo Instante Visual:** O usuário olha dois gráficos lado a lado e assume que as cotações correspondem ao mesmo instante $T$, quando na verdade uma é de $T$ e outra de $T - 3000\text{ms}$.
2. **Arbitragem Tóxica de Latência (Latency Arbitrage):** Bots que monitoram feeds externos exploram o atraso de cotação de ativos mais lentos na plataforma, abrindo ordens com resultado matematicamente previsível contra a casa.
3. **Settlement Incorreto em Contratos com Correlação ou Cestas:** Caso haja comparação de ativos ou spreads, calcular o resultado sobre cotações descompassadas gera divergência financeira irreversível.
4. **Clock Skew entre Servidores:** Sem sincronização de relógio monotônico e NTP, flutuações de wall-clock criam "latências fantasmas" ou timestamps no futuro.

---

## 2. A Arquitetura Definitiva das 4 Técnicas Combinadas

Nenhuma técnica isolada resolve a dessincronização; a solução exige o sistema completo de 4 camadas:

```text
[Provedores / Gerador OTC]
         │
         ├── [1. Event Time + Monotonic Clock]
         │       ├── event_time: Timestamp de geração real do dado
         │       ├── arrival_time: Timestamp monotônico de chegada no nó
         │       └── latency_ms = max(0, arrival_time - event_time)
         │
         ├── [2. Watermark Stream Engine]
         │       ├── watermark = max(event_time visto) - bounded_skew (ex: 2000ms)
         │       └── Rejeição / Flag para dados tardios (late data)
         │
         ├── [3. Janela de Tempo & Validação de Skew]
         │       ├── Skew entre pares: |event_time(A) - event_time(B)| <= max_skew (2000ms)
         │       └── Se skew > 2000ms: bloqueio de comparação e aviso de dessincronização
         │
         └── [4. NTP & Monitoramento de Clock Offset]
                 ├── Sincronização upstream com 3+ servidores NTP
                 ├── Medição de offset contínua
                 └── Alerta crítico se offset > 100ms
```

---

## 3. Matriz de Subetapas de Implementação

| Subetapa | Nome | Responsáveis | Entregas Chave | Quality Gate |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Event Time & Monotonic Clock** | Backend / Front | `event_time`, `arrival_time`, `latency_ms` via `performance.now()`. | Teste de precisão temporal e cálculo estrito de latência monotônica. |
| **2** | **Watermark Stream Engine** | Backend / QA | Algoritmo de watermark bounded out-of-orderness e descarte/marcação de ticks tardios. | Teste de retenção de watermark e rejeição de ticks pré-watermark. |
| **3** | **Janela de Tempo & Cross-Asset Validation** | Backend / FinRev | Validador `validateCrossAssetSync(symA, symB)` com tolerância máxima de 2s. | Teste de bloqueio de contratos/comparações dessincronizadas (> 2s). |
| **4** | **NTP & Clock Offset Monitor** | Infra / Backend | Checker de offset NTP no servidor e exportação de drift. | Teste de detecção de skew artificial > 100ms e disparo de alerta. |
| **5** | **Frontend Cross-Asset Sync UI** | Front / UX | Indicador de alinhamento temporal na grade multi-gráficos e crosshair sincronizado. | Teste de renderização de delta de tempo e alerta visual de descompasso. |
| **6** | **Métricas Prometheus & Telemetria** | Backend / QA | `cross_asset_skew_ms`, `watermark_lag_seconds`, `clock_offset_ms`. | Scraping Prometheus em $< 10\text{ms}$ cobrindo todos os pares. |
| **7** | **Bateria de Caos, Carga & Certificação** | QA / Verifier | Caos C-05, C-06, Estresse E-06 e auditoria formal V-01 a V-13. | 100% dos testes verdes e certificação assinada. |

---

## 4. Regras Invioláveis do Processo

1. **Test-Driven Rigoroso:** Nenhum código vai para produção sem teste unitário/integração prévio que comprove sua eficácia.
2. **Zero Regressão:** Todas as 7 subetapas anteriores de Feed Staleness Hardening devem permanecer 100% verdes em todas as iterações.
3. **Sequencialidade Estrita:** Só avançamos para a Subetapa $N+1$ quando a Subetapa $N$ estiver 100% aprovada e comprovada.
