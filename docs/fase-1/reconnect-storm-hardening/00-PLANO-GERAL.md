# Plano Geral de Engenharia: Blindagem Definitiva contra Reconnect Storm (Perigo 3)

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Arquiteto de Trading:** `broker-architect-agent`  
**Engenheiro Backend & Gateway:** `backend-implementation-agent`  
**Engenheiro Frontend:** `frontend-realtime-agent`  
**Engenheiro de QA & Resiliência:** `qa-resilience-agent`  
**Verificador Independente:** `post-implementation-verifier`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`, `10-post-implementation-verification`  
**Invariantes:** V-01 a V-13 | R-02 (Retry Backoff Full Jitter) | R-03 (Timeout) | R-04 (Circuit Breaker)

---

## 1. Diagnóstico e Análise do Perigo: "Reconnect Storm — Todos os Feeds Morrem Juntos"

### 1.1 O Que Acontece sem Blindagem?
Quando uma conexão cai (deploy, reinício de gateway, partição de rede temporária ou oscilação de link upstream), se o sistema tentar reconectar todos os ativos ou clientes imediatamente:
- **Tempestade de Handshakes:** 1.000 conexões e 36 feeds disparam simultaneamente `new WebSocket()` e `HTTP GET /snapshot` no mesmo milissegundo.
- **Colapso de Recursos:** O gateway exaure descritores de arquivo, a CPU sobe para 100%, gerando erros `429 Too Many Requests`, timeouts em cascata e recusas de conexão (`ECONNREFUSED`).
- **Pico Sincronizado Contínuo:** Se o retry usar backoff exponencial ingênuo **sem jitter**, todas as conexões falham juntas e tentam de novo juntas aos 2s, aos 4s, aos 8s, perpetuando o pico sincronizado.
- **Plataforma Travada no Pior Momento:** A tempestade ocorre exatamente quando o mercado está volátil ou sofrendo reinício, impedindo traders de acompanhar preços ou encerrar contratos.

---

## 2. A Arquitetura Definitiva: As 4 Técnicas Combinadas da Indústria

Conforme os padrões canônicos da AWS e de sistemas de alta resiliência, nenhuma técnica isolada resolve a tempestade por completo. A blindagem definitiva exige **4 camadas ativas em conjunto**:

```text
               [Queda de Conexão / Reinício de Serviço]
                                   │
             ┌─────────────────────┴─────────────────────┐
             ▼                                           ▼
      [Novo Arranque / Deploy]                 [Queda Durante Execução]
             │                                           │
  ┌───────────────────────┐                    ┌───────────────────────┐
  │ Técnica 4: Staggered  │                    │ Técnica 2: Circuit    │
  │ Startup               │                    │ Breaker por Feed      │
  │ delay = rand(0, 10s)  │                    │ 3 falhas -> 30s OPEN  │
  └──────────┬────────────┘                    └──────────┬────────────┘
             │                                           │
             └─────────────────────┬─────────────────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ Técnica 3: Token       │
                      │ Bucket Rate Limiter    │
                      │ 10 tokens, 1 token/s   │
                      └────────────┬───────────┘
                                   │
                                   ▼
                      ┌────────────────────────┐
                      │ Técnica 1: Exponential │
                      │ Backoff + Full Jitter  │
                      │ rand(0, min(cap,b*2^a))│
                      └────────────┬───────────┘
                                   │
                                   ▼
                      [Handshake Seguro & Suave]
```

### Detalhamento das 4 Técnicas:
1. **Técnica 1 — Exponential Backoff com Full Jitter (Fórmula Canônica AWS):**
   $$\text{delay} = \text{random}(0, \min(\text{cap}, \text{base} \times 2^{\text{attempt}}))$$
   - `base = 1000ms` (1s), `cap = 60000ms` (60s).
   - O Full Jitter de-correlaciona completamente os tempos de retry, transformando uma rajada de pico em um fluxo plano e contínuo.
2. **Técnica 2 — Circuit Breaker por Feed (CLOSED $\rightarrow$ OPEN $\rightarrow$ HALF-OPEN):**
   - Se um feed falhar 3 vezes consecutivas, o circuito abre por 30 segundos.
   - Durante o estado `OPEN`, nenhuma requisição atinge o upstream ou o gateway.
   - Após 30 segundos, entra em `HALF-OPEN`, permitindo 1 handshake de teste.
   - Sucesso fecha o circuito (`CLOSED`); nova falha reabre por mais 30s.
3. **Técnica 3 — Token Bucket Rate Limiter:**
   - Capacidade fixa: 10 tokens.
   - Reposição contínua: 1 token por segundo.
   - Cada reconexão consome 1 token; se o balde estiver vazio, a tentativa aguarda disponibilidade.
   - Garante teto rígido de vazão de reconexão (máximo 10 handshakes/s).
4. **Técnica 4 — Staggered Startup:**
   - No deploy, reinicialização ou abertura de tela, os feeds não conectam simultaneamente no instante $t=0$.
   - Cada feed ou conexão recebe um retardo inicial aleatório no intervalo $[0, 10\text{s}]$.

---

## 3. Matriz de Subetapas e Critérios de Execução

O plano está estritamente decomposto em 7 subetapas. Nenhuma subetapa avança sem que a anterior esteja 100% implementada e testada:

| Subetapa | Título & Foco | Artefatos Criados / Alterados | Suite de Testes Obrigatória |
|---|---|---|---|
| **Subetapa 1** | Exponential Backoff com Full Jitter | `apps/web/src/feed/backoff.ts`<br/>`services/api/src/services/backoff.ts` | `tests/test-subetapa-1-full-jitter.mjs` (Validação estatística AWS, cap 60s, uniformidade de jitter) |
| **Subetapa 2** | Circuit Breaker por Feed | `apps/web/src/feed/circuit-breaker.ts`<br/>`services/api/src/services/circuit-breaker.ts` | `tests/test-subetapa-2-circuit-breaker.mjs` (Transições CLOSED/OPEN/HALF-OPEN, isolamento entre feeds) |
| **Subetapa 3** | Token Bucket Rate Limiter | `apps/web/src/feed/token-bucket.ts`<br/>`services/websocket-gateway/src/token-bucket.ts` | `tests/test-subetapa-3-token-bucket.mjs` (Rajada de 50 requests, teto rígido de 10/s, espera assíncrona) |
| **Subetapa 4** | Staggered Startup | `apps/web/src/feed/staggered-startup.ts`<br/>`TradingFeedManager.ts` | `tests/test-subetapa-4-staggered-startup.mjs` (Simulação de 100 clientes, dispersão temporal no intervalo [0, 10s]) |
| **Subetapa 5** | Integração Completa no TradingFeedManager & UI | `TradingFeedManager.ts`<br/>`MultiChartGrid.tsx`<br/>`StalenessOverlay.tsx` | `tests/test-subetapa-5-reconnect-manager-ui.mjs` (Integração das 4 técnicas no ciclo de vida WS e feedback visual) |
| **Subetapa 6** | Métricas Prometheus Industriais & Telemetria | `scripts/dev-live-feed.mjs`<br/>`services/websocket-gateway/src/index.ts` | `tests/test-subetapa-6-reconnect-metrics.mjs` (Métricas de storm, backoff, circuit breaker e alertas) |
| **Subetapa 7** | Bateria de Caos C-08 a C-11, Estresse & Certificação | Scripts de teste e certificação final | `tests/test-subetapa-7-reconnect-storm-caos.mjs` (Morte em massa 36 feeds, 1000 reconexões, V-01 a V-13) |

---

## 4. Compromissos e Invariantes Invioláveis

1. **Zero Mocks:** Todos os testes de gate devem ser scripts executáveis reais em ambiente Node.js.
2. **Preservação Financeira:** O saldo demo no Blnk Ledger e os preços oficiais de settlement permanecem inviolados.
3. **Zero Regressão:** As 14 subetapas anteriores (7 de Feed Staleness + 7 de Cross-Asset Sync) devem permanecer 100% verdes após cada alteração.
