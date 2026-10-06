# Subetapa 2: Motor de Ticks Multi-Ativos Dinâmico (Tick Engine Backend)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Executor:** `bug-fix-agent` (remediação ESM de `core.mjs`) & `backend-implementation-agent`  
**Revisor Estrutural:** `broker-architect-agent`  
**Revisor Financeiro:** `financial-correctness-reviewer`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-02, V-03, V-04, V-05, V-13)  
**Status:** EM REMEDIAÇÃO E EXECUÇÃO DO GATE 2

---

## 1. Objetivo da Subetapa
Evoluir o `services/tick-engine` para operar de forma multi-ativos escalável e resiliente:
- **Descoberta Dinâmica de Ativos**: Ler periodicamente todos os símbolos de `SELECT symbol, params, status FROM indices WHERE status IN ('ACTIVE', 'PAUSED')`.
- **Prevenção de Esgotamento de Conexões**: Tick Engine não deve abrir 1 conexão dedicada permanente do Postgres por par (o que esgotaria `max_connections` com 36–100 pares). O motor gerencia um pool compartilhado e adquire conexões por ciclo de tick atômico.
- **Lease e Concorrência**: Lease de liderança por símbolo no Redis (`lease:tick-engine:${symbol}`) com renovação em pipeline/batch para não saturar I/O.
- **Cadência de Ticks Rigorosa (D-13)**: Exatamente **1 tick por segundo por índice** (com 36 ativos, a taxa total é de 36 ticks/s agregados).
- **Invariante Criptográfica (M-01 a M-04)**: CSPRNG Box-Muller, integridade de cadeia SHA-256 canônica e persistência atômica (`ticks` + `index_state` + `outbox`) antes de qualquer publicação.
- **Proteção Matemática contra Arbitragem**: Modelo estocástico Martingale sem viés que beneficie o jogador (deriva em 60s $\le 0{,}10 \cdot \sigma\sqrt{60}$).
- **Resiliência a Pausa**: Ativos em `PAUSED` continuam emitindo ticks para liquidação justa de ordens abertas, sem aceitar novas ordens.

---

## 2. Os 6 Passos de Execução da Subetapa 2

1. **Passo 1 (Criação do Módulo `services/tick-engine/core.mjs`)**:
   Implementar e expor canonicamente as 4 funções centrais do motor em ESM puro para interoperabilidade com as suítes de teste de gate:
   - `createPriceGenerator()`: gerador GBM estocástico sem drift ($\mu=0$) utilizando CSPRNG `crypto.randomBytes(8)` com transformação Box-Muller e formatação estrita pela precisão decimal do ativo.
   - `genesisHash(symbol)`: cálculo determinístico `SHA-256("genesis|" + symbol)`.
   - `nextSequence(lastSeq)`: avanço monotônico estrito `lastSeq + 1`.
   - `canonicalHash(prevHash, symbol, seq, ts, price)`: serialização padronizada `prevHash|symbol|seq|ts_iso|price` digerida em SHA-256 hex.
2. **Passo 2 (Coordenação Distribuída e Leases no Redis)**:
   Implementar renovação atômica via script Lua dos leases `lease:tick-engine:${symbol}` a cada 500ms com TTL de 2000ms. Garantir que apenas uma instância seja líder por ativo por época.
3. **Passo 3 (Pool Compartilhado de Conexões Postgres)**:
   Refatorar a persistência do `tick-engine` para reutilizar um `pg.Pool` com limite configurável (`DB_POOL_MAX=10`), adquirindo client apenas para transação de escrita e liberando imediatamente.
4. **Passo 4 (Transação Atômica Tripla com Outbox)**:
   Em cada tick gerado:
   ```sql
   BEGIN;
   SELECT last_sequence, last_hash FROM index_state WHERE symbol = :symbol FOR UPDATE;
   INSERT INTO ticks (symbol, sequence, price, hash, prev_hash, ts) VALUES (...);
   UPDATE index_state SET last_sequence = :seq, last_price = :price, last_hash = :hash, last_ts = :ts WHERE symbol = :symbol;
   INSERT INTO outbox (aggregate_type, aggregate_id, topic, payload) VALUES ('TICK', :symbol, 'ticks:' || :symbol, ...);
   COMMIT;
   ```
5. **Passo 5 (Proteção de Pausa e Governança)**:
   Assegurar que ativos com `status = 'PAUSED'` continuem no loop do gerador para permitir o fechamento natural e liquidação de contratos pendentes.
6. **Passo 6 (Suíte de Verificação e Homologação de Gate)**:
   Executar a bateria estocástica (`monte-carlo-ou.test.ts`, `nist-entropy.test.ts`) e o teste de gate `tests/test-multi-02-tick-engine.mjs`.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Cadência Agregada e Concorrência)**:
  - Gerar 100 ticks consecutivos simultâneos para os 36 ativos (3.600 ticks).
  - Verificar cadência agregada de 36 ticks/s sem vazamento de memória ou estouro de conexões.
- **Segurança (Prevenção de Predição de Preços / NIST Monobit)**:
  - Provar que nenhum número pseudo-aleatório (`Math.random`) é utilizado.
  - Executar teste de entropia NIST SP 800-22 Frequency Monobit ($p > 0{,}01$) e Runs Test no sinal dos retornos.
  - Teste de hipótese bicaudal de drift nulo: provar que a média normalizada de variação em 60s está dentro do intervalo de confiança de 99% ($|z| \le 2{,}58$).
- **Caos (Failover de Líder C-01 e Queda do Redis C-05)**:
  - Matar o líder do símbolo no meio do segundo. Uma instância secundária assume em $\le 3$ segundos sem deixar buracos na numeração de `sequence`.
  - Simular desconexão do Redis: o gerador deve pausar com segurança sem emitir ticks órfãos ou romper a cadeia SHA-256.

---

## 4. Garantias Pós-Implementação (Skill 10)

- **`V-02`**: $\min(\text{sequence}) = 1$, $\max(\text{sequence}) - \min(\text{sequence}) + 1 = \text{count}(*)$ e `index_state.last_sequence = max(sequence)` em todos os 36 ativos.
- **`V-03`**: Cadência $\ge 0{,}9$ tick/s e nenhum intervalo $> 3$ s entre ticks consecutivos na janela medida.
- **`V-04`**: Cadeia de hashes SHA-256 íntegra desde a gênese até o último tick em todos os ativos.
- **`V-05`**: Outbox publicado em $\le 5$ s e Stream Redis sincronizado com PostgreSQL.
- **`V-13`**: Integridade da suíte; testes originais preservados sem enfraquecimento.

---

## 5. Critérios de Passagem do Quality Gate 2
- Execução de `node tests/test-multi-02-tick-engine.mjs` $\to$ Exit Code 0 (100 ticks x 36 ativos íntegros, drift nulo aprovado).
- Execução dos testes matemáticos `tests/math/*.test.ts` $\to$ Exit Code 0 (5/5 asserções aprovadas).
- Verificação independente do `post-implementation-verifier` emitindo veredito **`APROVADO`**.
