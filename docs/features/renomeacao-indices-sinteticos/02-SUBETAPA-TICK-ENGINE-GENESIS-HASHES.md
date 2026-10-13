# SUBETAPA 02: Adaptação do Tick Engine, Genesis Hashes & Cadeia Canônica SHA-256

> **Status:** HOMOLOGADO E APROVADO (GATE 2 PASS)  
> **Data de Homologação:** 12/10/2026  
> **Responsáveis:** `backend-implementation-agent`, `broker-architect-agent`, `qa-resilience-agent`  
> **Skills Chave:** `03-synthetic-market-engine`, `05-resilience-patterns`, `08-database-foundation`  

---

## 1. Escopo Técnico e Invariantes

1. **Configuração de Ativos no Tick Engine (`services/tick-engine/`)**:
   - Atualizar constantes de símbolos, precisão e parâmetros estocásticos $\sigma$ em `services/tick-engine/src/constants.ts` e `services/tick-engine/engine.mjs`.
2. **Gênesis Hash e Cadeia Canônica de Prova Criptográfica**:
   - Cada novo símbolo terá seu `genesisHash(newSymbol) = sha256(newSymbol + ':genesis')`.
   - A função de hash canônico `canonicalHash(prevHash, symbol, sequence, ts, price)` deve operar com os novos símbolos.
3. **Publicação em Redis Streams & Outbox**:
   - Publicar nos streams `ticks:{symbol}` com o novo símbolo.
   - Manter compatibilidade ou multiplexador se houver consumidores legados.

---

## 2. Passo a Passo de Implementação

1. [ ] Atualizar catálogo de símbolos no `tick-engine`.
2. [ ] Atualizar cálculo de gênesis hashes e testes unitários do motor estocástico.
3. [ ] Atualizar geradores Ornstein-Uhlenbeck / Martingale com CSPRNG Box-Muller.
4. [ ] Verificar atomicidade da transação de persistência Outbox no PostgreSQL.

---

## 3. Matriz de Testes de Estresse, Caos e Segurança

| Código | Tipo de Teste | Descrição | Critério de Aceite |
|---|---|---|---|
| **T-TE-01** | **Criptografia / Integridade** | Validar cadeia de 10.000 hashes SHA-256 para cada novo índice | Zero colisões, encadeamento matemático perfeito $H_i = SHA256(H_{i-1} \parallel S \parallel seq \parallel ts \parallel P)$. |
| **T-TE-02** | **Estresse de Geração** | Executar geração contínua a 10Hz por 60 segundos nos 6 índices | Zero drops de sequence, sem estouro de memória RAM. |
| **T-TE-03** | **Caos / Crash Recovery** | Matar o processo do tick-engine no meio da geração e reiniciar | Recupera sequence anterior do Redis/Postgres sem duplicações ou retrocesso de tempo. |
| **T-TE-04** | **Aleatoriedade CSPRNG** | Teste qui-quadrado de distribuição Gaussiana dos passos de preço | Passos conformes com distribuição normal ($\mu \approx 0, \sigma$ calibrado), proibido `Math.random`. |

---

## 4. Gate de Homologação da Subetapa 02

A Subetapa 02 é considerada **HOMOLOGADA** somente quando:
1. `services/tick-engine/test/hash-chain.unit.test.ts` e `ou-generator.unit.test.ts` passarem com 100% de sucesso.
2. Ticks com os novos nomes forem publicados no Redis Stream e persistidos na tabela `ticks` do Postgres.
