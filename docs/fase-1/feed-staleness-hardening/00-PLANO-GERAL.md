# Plano Geral de Blindagem: Eliminação Definitiva de Feed Stale & Proteção Multi-Ativos

**Orquestrador:** `tech-lead-orchestrator`  
**Arquiteto Chefe de Trading:** `broker-architect-agent`  
**Agentes Envolvidos:** `backend-implementation-agent`, `frontend-realtime-agent`, `financial-correctness-reviewer`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `09-ai-failure-map`, `10-post-implementation-verification`  
**Referência Industrial:** Protocolo FIX, RFC 6455, Normas FIA (Futures Industry Association), Padrões HFT (Cancel-on-Disconnect, Snapshot Rebuild).

---

## 1. Visão Executiva e Análise FMEA do Perigo

### 1.1 O Perigo Crítico: "Feed Stale Parecendo Vivo"
Em plataformas de trading e opções OTC multi-ativos, o pior cenário não é uma queda visível do sistema (onde a tela fica preta e o usuário não clica), mas sim o **silêncio mascarado**:
* O WebSocket ou gerador de um ativo específico congela silenciosamente (ex: `BTCUSD_OTC` para de atualizar por morte de processo ou desconexão).
* O canvas do gráfico retém a última vela desenhada e o relógio local do navegador continua rodando.
* O usuário visualiza uma cotação estática e decide abrir uma ordem UP ou DOWN acreditando que o mercado está calmo ou em consolidação.
* O backend lê a última cotação gravada no banco (que tem 1 ou 5 minutos de atraso), abre o contrato com um preço defasado e liquida contra ticks futuros com divergência violenta, destruindo o risco da corretora ou lesando o usuário.

### 1.2 Por que a Abordagem Probabilística Falha
Sistemas ingênuos usam verificadores globais de conexão (ex: "se o socket está aberto, o feed está vivo"). Em uma grade de múltiplos ativos (18 Forex, 8 Cripto, 4 Metais, 6 Sintéticos), **um ativo pode estar completamente morto enquanto outros 35 continuam recebendo ticks**. Conflar a saúde da conexão com a saúde do dado gera um ponto cego fatal.

---

## 2. A Arquitetura das 4 Camadas Separadas (Padrão HFT / FIA)

Para erradicar o perigo de forma mecânica e determinística, o sistema implementa 4 camadas ortogonais e desacopladas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITETURA DE 4 CAMADAS                          │
├───────────────────────┬─────────────────────────────────────────────────────┤
│ 1. Connection Link    │ Protocol Ping/Pong RFC 6455 + App Heartbeat (30s/5s)│
│    (Link Vivo?)       │ Ação se falhar: Reconectar socket                   │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 2. Sequence Continuity│ Validação monotônica estrita: seq_n == seq_{n-1} + 1│
│    (Dado Íntegro?)    │ Ação se falhar: Suspender deltas, buscar snapshot   │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 3. Staleness Timer    │ Timer individual por símbolo: now - last_ts < t_max │
│    (Dado Fresco?)     │ Ação se falhar: Trava ordem + Banner visual         │
├───────────────────────┼─────────────────────────────────────────────────────┤
│ 4. Kill Switch / COD  │ Cancel-on-disconnect / cancel-on-stale imediato     │
│    (Risco Controlado?)│ Ação se falhar: Abortar resting orders              │
└───────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 3. Matriz de Subetapas de Implementação

| Subetapa | Escopo Principal | Responsáveis | Critério de Aceite Primário |
| :--- | :--- | :--- | :--- |
| **Subetapa 1** | **Backend Staleness Gate** | `backend-implementation-agent`<br>`financial-correctness-reviewer` | `POST /contracts` rejeita com `FEED_STALE` se `now - last_ts > 5000ms`. Prova em teste de integração. |
| **Subetapa 2** | **Heartbeat & Link Reliability** | `backend-implementation-agent`<br>`qa-resilience-agent` | Heartbeat a cada 30s com timeout estrito de 5s no gateway e cliente. Reconexão comprovada após corte. |
| **Subetapa 3** | **Frontend Per-Symbol Staleness & Banner** | `frontend-realtime-agent`<br>`security-reviewer` | Timers independentes por símbolo. Banner "Feed Desatualizado" e botões travados exclusivamente no par afetado. |
| **Subetapa 4** | **Gap Detection & Snapshot Rebuild** | `backend-implementation-agent`<br>`frontend-realtime-agent` | Endpoint `/api/v1/snapshot`. Ao detectar gap, estado local é limpo e reconstruído sem adivinhar ticks. |
| **Subetapa 5** | **Kill Switch & Cancel-on-Disconnect** | `backend-implementation-agent`<br>`qa-resilience-agent` | Se feed fica stale ou cliente desconecta, ordens em voo são bloqueadas ou canceladas conforme política. |
| **Subetapa 6** | **Métricas Industriais & Observabilidade** | `backend-implementation-agent`<br>`qa-resilience-agent` | Métricas Prometheus `tick_age_seconds{symbol}`, `feed_gap_count{symbol}`, `staleness_alert{symbol}` expostas. |
| **Subetapa 7** | **Bateria de Caos, Carga & Certificação Final** | `qa-resilience-agent`<br>`post-implementation-verifier` | Testes de caos com injeção de silêncio seletivo em 1 dos 36 pares e aprovação formal V-01 a V-13. |

---

## 4. Governança de Transição

Cada subetapa é acompanhada por seu arquivo executável com no mínimo 6 passos detalhados. A subetapa seguinte só é iniciada após 100% de aprovação e execução verde dos testes da subetapa anterior.
