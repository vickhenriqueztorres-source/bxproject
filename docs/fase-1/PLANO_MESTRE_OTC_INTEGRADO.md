# Plano Mestre de Implementação: Arquitetura OTC, TradingView e Teto de Solvência Integrados

**Status:** APROVADO PARA EXECUÇÃO  
**Orquestrador:** `tech-lead-orchestrator`  
**Parecer Arquitetural:** `broker-architect-agent`  
**Data:** 06/10/2026  
**Escopo:** Integração de `docs/otc.md` na Plataforma de Índices Sintéticos (Fase 1 MVP Demo) sem quebrar o projeto existente.

---

## 1. Diagnóstico do Arquiteto: Onde a Proposta Ingênua Quebra

A proposta original de `docs/otc.md` introduz conceitos indispensáveis para uma corretora OTC (reversão à média, visual TradingView, margem da casa de +7.5% com payout de 85%, e teto de risco de float de 3%). No entanto, sua implementação simplificada conteria **7 rupturas fatais** se executada diretamente:

| # | Ponto de Ruptura | Causa Raiz na Proposta Ingênua | Impacto no Sistema | Regra Inviolável |
|---|---|---|---|---|
| **1** | **Exploit de Previsibilidade** | Uso de `Math.random()` no motor OTC | V8 `xorshift128+` é previsível; bots deduzem os próximos 500 ticks e esvaziam o caixa da casa. | **M-01**, **B-06** |
| **2** | **Perda de Velas e Gráfico Quebrado** | Manutenção de OHLCV em memória RAM (`CandleAggregator`) | Crash, OOM ou restart apaga o candle em formação, distorce o `open` e desalinha o TradingView. | **M-03**, **M-05** |
| **3** | **Ticks Fantasmas & Sem ACID** | Atribuir `currentPrice` da RAM da API sem transação no banco | Réplicas da API com preços dessincronizados e ordens fechadas contra cotações inexistentes no banco. | **B-07**, **M-03** |
| **4** | **Race Condition no Float Cap (TOCTOU)** | Checar teto de 3% e gravar em passos separados no Redis | 500 ordens simultâneas leem a mesma exposição defasada e estouram o teto para 15%–20% do caixa. | **05-resilience** |
| **5** | **Desvio do Ledger & Fraude de Saldo** | "Acerto de saldo" direto sem reserva prévia e sem partidas dobradas | Usuário aposta sem saldo em abas simultâneas; sem trilha contábil; crédito duplicado em retentativas. | **B-03**, **I-01**, **I-02** |
| **6** | **Liquidação Duplicada e Zumbis** | Polling no `:00` via relógio sem `FOR UPDATE` | Clock skew apura antes do tick existir; múltiplos workers liquidam a mesma ordem gerando duplo payout. | **B-08**, **I-04** |
| **7** | **Corrupção em Ponto Flutuante** | Uso de `toFixed(5)` e multiplicações `* 0.85` com IEEE-754 | Desvios na 16ª casa decimal corrompem empates legítimos (`DRAW`) e desequilibram a contabilidade. | **B-02**, **DB-02** |

---

## 2. Arquitetura Integrada e Blindada

Para garantir **baixa latência (<5ms no matching e pre-trade risk)** aliada à **durabilidade financeira absoluta**, a solução foi integrada nos serviços existentes da Fase 1:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (Web / Mobile)                             │
│  - TradingView Lightweight Charts (Renderização fluida de candles a 250ms)   │
│  - Boleta de Negociação (CALL / PUT) com trava de 30s antes da expiração    │
│  - WebSocket Client com autenticação JWT e catch-up por lastSequence       │
└───────────────────────▲─────────────────────────────┬───────────────────────┘
                        │ WSS (Ticks ao vivo)         │ POST /contracts (Ingresso <5ms)
                        │                             ▼
┌───────────────────────┴──────────────┐   ┌──────────────────────────────────┐
│      WebSocket Gateway (Fastify/WS)  │   │        API / BFF (Fastify)       │
│  - Fan-out via Redis Pub/Sub         │   │  - Valida JWT RS256 e DTO        │
│  - Catch-up via Redis Streams        │   │  - Idempotency-Key insert-first  │
└───────────────────────▲──────────────┘   └──────────────────┬───────────────┘
                        │                                     │
         ┌──────────────┴──────────────┐                      ▼
         │      Redis 7 Cluster        │   ┌──────────────────────────────────┐
         │ - check_and_reserve_risk.lua│◄──┤  Pre-Trade Risk Gate (<1ms Lua)  │
         │ - release_risk.lua          │   │  Teto de Solvência de 3% Float   │
         │ - Sorted Set: contracts:pend│   └──────────────────┬───────────────┘
         │ - Stream: stream:ticks:*    │                      │
         │ - Pub/Sub: market:ticks:*   │                      ▼
         └──────▲──────────────▲───────┘   ┌──────────────────────────────────┐
                │              │           │    PostgreSQL 16 (ACID <3ms)     │
    ┌───────────┴──┐     ┌─────┴───────┐   │  1. INSERT INTO contracts (OPEN) │
    │ Outbox Relay │     │Candle Worker│   │  2. INSERT outbox (RESERVE_STAKE)│
    │ Despacha p/  │     │Consome Stream   │  3. COMMIT                       │
    │ Redis e Blnk │     │Upsert no PG │   └──────────────────┬───────────────┘
    └──────▲───────┘     └─────┬───────┘                      │
           │                   │                              ▼
┌──────────┴───────────────────▼───────┐   ┌──────────────────────────────────┐
│              PostgreSQL              │   │       Blnk Finance Ledger        │
│  - ticks (numeric 18,6 + SHA-256)    │   │  Partidas Dobradas Append-Only   │
│  - candles (1s, 1m, 5m idempotente)  │   │  user:available -> user:reserved │
│  - contracts (SELECT FOR UPDATE)     │   │  user:reserved -> house_payout   │
└──────────────────────▲───────────────┘   └──────────────────────────────────┘
                       │ 1 tick / 250ms-1s (COMMIT ACID)
┌──────────────────────┴──────────────────────────────────────────────────────┐
│                  Tick Engine OTC (Líder Único com Lease TTL)                │
│  - Ornstein-Uhlenbeck: dX_t = theta*(mu - X_t)*dt + sigma*X_t*dW_t          │
│  - Box-Muller sobre CSPRNG puro (crypto.randomBytes com 53 bits de entropia)│
│  - Sequence monotônica estrita + Hash encadeado SHA-256                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Especificação Técnica dos Módulos Críticos

### 3.1 Motor Ornstein-Uhlenbeck com CSPRNG Criptográfico (`services/tick-engine`)
- **Fórmula Discreta:**
  $$\Delta X_t = \theta (\mu - X_t) \Delta t + \sigma X_t \sqrt{\Delta t} \cdot Z_t$$
- **Geração de $Z_t$:** Transformação de Box-Muller alimentada por duas variáveis uniformes $U_1, U_2 \in (0, 1]$ extraídas diretamente de `crypto.randomBytes(8)`.
- **Integridade:**
  $$\text{hash}_n = \text{SHA-256}(\text{hash}_{n-1} \parallel \text{symbol} \parallel \text{sequence} \parallel \text{ts} \parallel \text{price})$$
- O tick é persistido no PostgreSQL junto com o evento de Outbox na mesma transação antes de qualquer publicação externa (`B-07`, `M-03`).

### 3.2 Teto de Solvência de 3% do Float em Sub-Milissegundo (`check_and_reserve_risk.lua`)
- O saldo total depositado é espelhado no Redis em centavos (`broker:deposit_float_minor`).
- O script Lua atômico roda dentro do Redis em <1ms:
  1. Calcula `max_risk_cap = floor(deposit_float * 0.03)`.
  2. Calcula o risco da aposta: `additional_risk = floor(stake_minor * payout / 100)`.
  3. Compara `current_exposure + additional_risk <= max_risk_cap`.
  4. Se aprovado: executa `INCRBY` na chave de risco da vela e define TTL.
  5. Se reprovado: rejeita atomicamente com erro `ERR_RISK_CAP_EXCEEDED` (HTTP 422).
- Caso o commit no PostgreSQL falhe por timeout, a API dispara o script compensatório `release_risk.lua` para estornar o risco.

### 3.3 Liquidação com Lock Pessimista e Blnk Ledger (`services/settlement-worker`)
- O despachante consulta contratos vencidos no Redis Sorted Set `contracts:pending`.
- O worker abre transação com lock pessimista: `SELECT * FROM contracts WHERE id = :id FOR UPDATE SKIP LOCKED`.
- Busca o tick oficial de saída: `SELECT * FROM ticks WHERE symbol = :symbol AND ts >= :expires_at ORDER BY sequence ASC LIMIT 1`.
  - Se o tick ainda não existe: rollback imediato e retry no próximo ciclo de 50ms.
- Atualiza status para `SETTLED`, grava evento no Outbox e comita.
- O Relay executa a movimentação de dupla entrada no Blnk de forma idempotente:
  - **WIN:** Devolve stake de `user:reserved` para `user:available` (`ref: settlement:{id}`) e credita 85% de lucro de `house_payout` para `user:available` (`ref: credit:{id}:WIN`).
  - **LOSS:** Transfere stake de `user:reserved` para `house_revenue` (`ref: settlement:{id}`).
  - **DRAW:** Devolve stake de `user:reserved` para `user:available` (`ref: settlement:{id}`).

---

## 4. Matriz de Execução do Pool de Agentes

| Agente | Subtasks | Entregáveis Técnicos | Critérios de Aceite |
|---|---|---|---|
| **`broker-architect-agent`** | Desenho & Governança | Especificações técnicas, DDL, Lua scripts e contratos de integração. | Validação da arquitetura sem quebra do baseline. |
| **`backend-implementation-agent`** | T05, T06, T07, T09, T10, T12 | 1. Ornstein-Uhlenbeck + CSPRNG em `services/tick-engine`.<br/>2. Candle Worker idempotente em `services/candle-worker`.<br/>3. Lua Scripts do Float Cap em `services/api`.<br/>4. Settlement Worker com `FOR UPDATE` e Blnk em `services/settlement-worker`. | Zero `Math.random()`.<br/>Zero números em float.<br/>`health-check.sh` 100% verde.<br/>Latência pré-ordem < 5ms. |
| **`frontend-realtime-agent`** | T08, T13 | 1. Gráficos com TradingView Lightweight Charts.<br/>2. WebSocket feed com catch-up por `lastSequence`.<br/>3. Boleta CALL/PUT com trava de compra 30s antes do fim da vela. | Sem travamentos a 250ms/tick.<br/>Exibição de status STALE em desconexão. |
| **`financial-correctness-reviewer`** | Auditoria Financeira | Revisão estrita das invariantes `I-01` a `I-06`: partidas dobradas, idempotência de chaves Blnk e integridade contábil do Float Cap. | Parecer APROVADO sem achados CRÍTICOS ou ALTOS. |
| **`security-reviewer`** | Auditoria de Segurança | Revisão de segurança: aleatoriedade criptográfica, validação JWT RS256, RBAC e prevenção contra race conditions e BOLA/IDOR. | Parecer APROVADO sem achados de segurança. |
| **`qa-resilience-agent`** | T05 a T12, T17, T18 | Suíte completa de testes: estatísticos NIST, estresse do Float Cap, caos de infraestrutura e carga k6. | 100% dos testes verdes com relatórios de evidência. |
| **`bug-fix-agent`** | Suporte a Defeitos | Triagem e correção de defeitos apontados pelos testes ou revisores, sempre com reprodução e teste de regressão. | Diff mínimo estritamente na cadeia causal. |

---

## 5. Bateria Exaustiva de Testes de Validação

### 5.1 Testes Estatísticos e Matemáticos (NIST & Monte Carlo)
1. **Teste de Entropia NIST SP 800-22:**
   - 10.000.000 de números gerados por CSPRNG + Box-Muller submetidos aos testes de frequência, runs e transformada discreta de Fourier.
   - *Critério:* $p\text{-value} > 0.01$ comprovando imprevisibilidade criptográfica.
2. **Simulação de Monte Carlo de Reversão à Média:**
   - 1.000 trajetórias independentes de 100.000 ticks.
   - *Critério:* Zero explosão exponencial ou preço negativo; convergência comprovada para o preço de ancoragem $\mu$.
3. **Teste de Precisão Aritmética:**
   - 500.000 ticks gravados e comparados com precisão `numeric(18,6)`.
   - *Critério:* Preço de saída igual ao de entrada resulta compulsoriamente em `DRAW`. Zero resíduo de ponto flutuante.

### 5.2 Estresse de Concorrência Extrema no Teto de 3% (The Flashmob Attack)
1. **Teste de Disparo Simultâneo:**
   - Float configurado em R$ 100.000,00 (`deposit_float_minor = 10000000`). Teto de risco de 3% = R$ 3.000,00.
   - Cada ordem CALL de R$ 100,00 gera risco de R$ 85,00. Capacidade máxima da vela: 35 contratos.
   - Disparo de **500 requisições simultâneas no mesmo milissegundo** para a mesma vela.
   - *Critério:*
     - Exatamente 35 contratos retornam `201 Created`.
     - 465 contratos retornam `422 Unprocessable Entity` (`RISK_CAP_EXCEEDED`).
     - Risco acumulado no Redis nunca ultrapassa R$ 3.000,00 em nenhum instante.
2. **Teste de Compensação Automática:**
   - Forçar falha no commit do PostgreSQL após aprovação no Lua Script.
   - *Critério:* Script `release_risk.lua` estorna a reserva e libera o teto imediatamente.

### 5.3 Auditoria Contábil de Dupla Entrada (Blnk Invariants)
1. **Auditoria dos 3 Resultados:**
   - 100 contratos de cada modalidade (`WIN`, `LOSS`, `DRAW`).
   - *Critério:* Contas `user:available`, `user:reserved`, `house_revenue` e `house_payout` fecham com soma zero perfeita no Blnk.
2. **Idempotência Contra Clique Duplo:**
   - 10 requisições com a mesma `Idempotency-Key`.
   - *Critério:* 1 único contrato criado e 1 única reserva no Blnk. 9 respostas em cache idênticas.
3. **Retentativa de Liquidação:**
   - Injeção repetida da mesma expiração no consumer do Settlement Worker.
   - *Critério:* Processamento único garantido por `reference: settlement:{id}`. Zero saldo duplicado.

### 5.4 Testes de Caos de Infraestrutura (T17)
1. **Queda do Líder do Tick Engine (`kill -9`):**
   - *Critério:* Nó secundário assume a liderança em $\le 600\text{ms}$ e continua a numeração sem gap ou duplicidade.
2. **Partição de Rede no Redis (5 segundos):**
   - *Critério:* Ticks continuam sendo gravados no PostgreSQL; frontend entra em status `STALE`; na volta do Redis, catch-up restaura os clientes sem perda.
3. **Clock Skew (1.500ms de descompasso):**
   - *Critério:* Settlement Worker não liquida prematuramente; aguarda o tick oficial no PostgreSQL.

### 5.5 Testes de Carga e Benchmark de Latência (T18)
1. **Carga Estável com Alta Densidade:**
   - 300 clientes WebSocket ativos recebendo ticks a cada 250ms por 30 minutos contínuos.
   - Ingress de 50 contratos por minuto.
   - *Critério:*
     - Latência de matching pré-ordem na API: $p95 < 5\text{ms}$ e $p99 < 10\text{ms}$.
     - Zero vazamento de conexões ou memória.
     - Reconciliador de 1 minuto reporta zero divergência entre o banco e o Blnk Ledger.

---

## 6. Próximo Passo Imediato

O plano está documentado, estruturado e blindado. Com sua autorização, acionamos o **`backend-implementation-agent`** para iniciar a **Subtask T05** (implementação do motor Ornstein-Uhlenbeck com CSPRNG, hash SHA-256 e transação ACID no PostgreSQL).
