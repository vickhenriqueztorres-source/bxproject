# Subfase 2: Motor de Mercado OTC (Ornstein-Uhlenbeck + CSPRNG) & Outbox Relay

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T05, T06  
**Decisões Aplicadas:** D-04 (Redis Streams vs Pub/Sub), D-06 (Engine próprio), D-07 (CSPRNG), D-08 (Persistir antes de publicar), D-09 (Líder único com lease), D-13 (1 tick/s ou 250ms configurável)  
**Invariantes Chave:** M-01 a M-04, B-06, B-07, R-01, DB-03  

---

## 1. Escopo e Objetivos da Subfase
Construir o motor matemático de preços sintéticos em `services/tick-engine` baseado no processo estocástico de Ornstein-Uhlenbeck com reversão à média, garantindo imprevisibilidade criptográfica total via CSPRNG + Box-Muller, integridade contínua via sequence monotônica e hash encadeado SHA-256, eleição de líder único com lease TTL no Redis, e persistência transacional com transactional outbox no PostgreSQL. Em seguida, desenvolver o `services/outbox-relay` para despachar eventos confirmados para o Redis Streams e Pub/Sub.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 2.1: Implementação da Equação Estocástica de Ornstein-Uhlenbeck com CSPRNG
- **Ação:** Criar `services/tick-engine/src/engine/ou-generator.ts`:
  - Equação: $\Delta X_t = \theta (\mu - X_t) \Delta t + \sigma X_t \sqrt{\Delta t} \cdot Z_t$.
  - Gerador criptográfico seguro:
    - Extração de 64 bits de entropia de `crypto.randomBytes(8)` para duas variáveis uniformes $U_1, U_2 \in (0, 1]$.
    - Transformação Box-Muller: $Z_t = \sqrt{-2 \ln(U_1)} \cos(2\pi U_2)$.
  - Proteção de bordas: trava de valor mínimo para impedir cotações negativas ou colapso a zero.
  - Injeção de dependência da fonte de aleatoriedade (`RandomSource` interface) para permitir testes determinísticos e suites estatísticas.
- **Regras:** `M-01`, `B-06` (proibição estrita de `Math.random()`).
- **Critério de Aceite:** O gerador passa no teste de distribuição normal ($p\text{-value} > 0.01$) e respeita parâmetros de volatilidade e reversão à média.

---

### Passo 2.2: Algoritmo de Eleição de Líder Único com Lease TTL no Redis
- **Ação:** Criar `services/tick-engine/src/cluster/leader-elector.ts`:
  - Chave de lease: `lease:tick_leader:{symbol}`.
  - Aquisição atômica com `SET lease:tick_leader:{symbol} <instance_id> NX PX 600`.
  - Renovação periódica a cada 200ms via script Lua compare-and-set:
    ```lua
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('pexpire', KEYS[1], ARGV[2])
    else
      return 0
    end
    ```
  - Incremento de fencing token (`lease_epoch`) no PostgreSQL a cada nova liderança para invalidar writes de líderes antigos (evitando split-brain).
- **Regras:** `D-09`, `DB-07`.
- **Critério de Aceite:** Duas instâncias rodando em paralelo disputam a chave; apenas uma assume a emissão; ao matar a líder com `kill -9`, a segunda assume em até 600ms.

---

### Passo 2.3: Sequenciador Monotônico e Hash Encadeado SHA-256
- **Ação:** Criar `services/tick-engine/src/engine/hash-chain.ts`:
  - Ao assumir a liderança, lê o último tick gravado em `index_state` (`last_sequence` e `last_hash`).
  - Gênese (caso o banco esteja vazio): `hash_0 = SHA-256("genesis|" || symbol)`.
  - Regra de encadeamento canônica:
    $$\text{hash}_n = \text{SHA-256}(\text{hash}_{n-1} \parallel \text{symbol} \parallel \text{sequence} \parallel \text{ts} \parallel \text{price})$$
  - Serialização canônica determinística para evitar divergências de formatação.
- **Regras:** `M-02`, `M-04`.
- **Critério de Aceite:** A sequência de hashes é imutável; qualquer alteração manual em um tick antigo invalida a checagem de integridade criptográfica.

---

### Passo 2.4: Transação ACID Atômica (Tick + Outbox no PostgreSQL)
- **Ação:** Criar `services/tick-engine/src/persistence/tick-repository.ts`:
  - O líder monta uma única transação no PostgreSQL a cada ciclo:
    ```sql
    BEGIN;
    UPDATE index_state 
       SET last_sequence = last_sequence + 1,
           last_price = $2,
           last_hash = $3,
           updated_at = $4
     WHERE symbol = $1
    RETURNING last_sequence;

    INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
    VALUES ($1, $sequence, $2, $4, $prev_hash, $3);

    INSERT INTO outbox_events (event_type, payload)
    VALUES ('TICK_GENERATED', json_build_object(
      'symbol', $1, 'sequence', $sequence, 'price', $2, 'ts', $4
    ));
    COMMIT;
    ```
  - Bloqueio estrito: o Tick Engine **NÃO** executa chamadas de rede para Redis Streams ou Pub/Sub. Ele apenas grava no PostgreSQL.
- **Regras:** `B-07`, `M-03`.
- **Critério de Aceite:** Se a conexão com o banco cair antes do commit, nenhum tick é emitido externamente e a sequência não sofre furos.

---

### Passo 2.5: Implementação do Outbox Relay Worker (`services/outbox-relay`)
- **Ação:** Criar o serviço `services/outbox-relay`:
  - Leitura contínua em batches de `outbox_events` onde `status = 'PENDING'` ordenados por `created_at ASC`.
  - Para cada evento `TICK_GENERATED`:
    - Publica no Redis Stream `stream:ticks:{symbol}` com ID determinístico `{sequence}-0` (o Redis rejeita IDs menores ou duplicados).
    - Publica no canal Redis Pub/Sub `market:ticks:{symbol}` para distribuição em tempo real no WebSocket Gateway.
    - Marca o evento como `PROCESSED` na tabela `outbox_events` com `processed_at = NOW()`.
  - Tratamento de falhas com backoff exponencial e limite de retentativas antes de envio para DLQ.
- **Regras:** `D-04`, `D-08`, `R-01`.
- **Critério de Aceite:** Os ticks gravados no PostgreSQL aparecem no Redis Stream na mesma ordem e sem duplicatas.

---

### Passo 2.6: Suíte de Testes Unitários e Validação Criptográfica do Motor
- **Ação:** Criar testes em `services/tick-engine/test/`:
  - `ou-generator.unit.test.ts`: teste com mock de `RandomSource` para verificar convergência da fórmula de Ornstein-Uhlenbeck.
  - `hash-chain.unit.test.ts`: prova matemática de que o hash encadeado detecta adulterações.
  - `leader-elector.integration.test.ts`: teste de concorrência com duas instâncias reais disputando lease no Redis.
  - `tick-acid.integration.test.ts`: injeção de erro após `INSERT ticks` garantindo que o rollback desfaz tudo e nada vaza para o outbox.
- **Regras:** `06-testing-quality`, QA-05, QA-06.
- **Critério de Aceite:** 100% dos testes unitários e de integração do motor OTC passam com sucesso.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. O gerador emite ticks na taxa configurada (1 tick/s ou 250ms) mantendo o preço estável em torno do preço base.
2. Nenhuma menção a `Math.random()` existe no código de `services/tick-engine`.
3. Ticks persistem no PostgreSQL com hash SHA-256 e são entregues via Redis Stream pelo Outbox Relay.
4. Gate de qualidade da Subfase 2 marcado como `PASS`.
