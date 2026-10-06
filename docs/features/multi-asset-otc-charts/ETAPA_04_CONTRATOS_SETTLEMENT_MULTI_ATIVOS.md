# Subetapa 4: Contratos e Settlement Multi-Ativos (Isolamento Financeiro & Anti-Cross)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Executor:** `bug-fix-agent` (remediação ESM de `contract-domain.mjs` e `settlement-worker/core.mjs`) & `backend-implementation-agent`  
**Revisor Chefe de Contabilidade & Saldo:** `financial-correctness-reviewer` (REVISÃO OBRIGATÓRIA)  
**Segurança & Validação:** `security-reviewer`  
**QA & Resiliência:** `qa-resilience-agent`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-07, V-08, V-09, V-10, V-13)  
**Status:** EM REMEDIAÇÃO E HOMOLOGAÇÃO DO GATE 4

---

## 1. Visão Geral e Justificativa de Risco Financeiro

Esta é a **subetapa mais crítica e de maior risco da arquitetura**, pois é exatamente onde o dinheiro demo/real é debitado, bloqueado, liquidado e creditado:
1. **Cruzamento Indevido de Ativos (Cross-Asset Settlement)**: Liquidar um contrato de `BTCUSD_OTC` utilizando o tick de cotação do `EURUSD_OTC` geraria fraudes colossais. A barreira anti-cross possui tolerância zero: **1 único contrato cruzado reprova toda a homologação**.
2. **Integridade de Saldo (Blnk Ledger)**: Todo o dinheiro é movimentado em partidas dobradas (double-entry). O saldo nunca fica em tabelas manuais do PostgreSQL ou Redis.
3. **Anti-Tampering de Preço (A-07 / S-02)**: O cliente **nunca** informa `entry_price`, `exit_price`, `result` ou `user_id`. O preço de entrada é capturado deterministicamente do `index_state` pelo backend.

---

## 2. Os 6 Passos de Execução da Subetapa 4

1. **Passo 1 (Criação do Módulo `services/api/contract-domain.mjs`)**:
   Implementar e expor o schema Zod estrito `contractCreateSchema`:
   - Campos permitidos: `symbol` (string), `direction` (enum 'UP' | 'DOWN'), `stake_minor` (inteiro entre 100 e 10.000 centavos USD).
   - Bloqueio estrito (`.strict()`): se o cliente enviar `entry_price`, `exit_price`, `user_id` ou qualquer campo adicional, a validação rejeita com HTTP 400.
2. **Passo 2 (Criação do Módulo `services/settlement-worker/core.mjs`)**:
   Implementar funções puras de liquidação:
   - `priceUnits(price, precision)`: normalização inteira determinística sem perda de precisão flutuante.
   - `settlementFor(direction, entryPrice, exitPrice, stakeMinor)`: cálculo exato de WIN, LOSS ou DRAW e dos montantes `payoutMinor` e `profitMinor`.
3. **Passo 3 (Captura Autoritativa de Strike em $O(1)$)**:
   Na rota `POST /contracts`, obter o strike autoritativo via `SELECT last_price, last_sequence, last_ts FROM index_state WHERE symbol = :symbol FOR SHARE`, rejeitando imediatamente ativos com `status != 'ACTIVE'` com HTTP 409 (`INDEX_PAUSED`).
4. **Passo 4 (Barreira Anti-Cross no Settlement Worker)**:
   No worker de liquidação:
   ```sql
   SELECT c.* FROM contracts c WHERE c.status = 'OPEN' AND c.expires_at <= NOW() FOR UPDATE SKIP LOCKED;
   SELECT t.price, t.sequence, t.ts FROM ticks t WHERE t.symbol = c.symbol AND t.ts >= c.expires_at ORDER BY t.sequence ASC LIMIT 1;
   ```
   Se `tick.symbol != contract.symbol`, abortar a transação com alerta de segurança crítico.
5. **Passo 5 (Partidas Dobradas no Blnk Ledger e Idempotência)**:
   Gerar transações financeiras com chaves idempotentes determinísticas:
   - Reserva de aposta: `reserve:{contract_id}`.
   - Liquidação: `settle:{contract_id}`.
   - Crédito de ganho: `credit:{contract_id}:WIN`.
   Manter a equação de conservação contábil ($\sum \text{debits} = \sum \text{credits}$).
6. **Passo 6 (Suíte de Testes Automatizada do Gate 4)**:
   Executar `tests/test-multi-04-contracts-settlement.mjs`, `tests/integration/blnk-accounting-audit.test.ts` e `tests/integration/flashmob-risk-cap.test.ts`.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Corrida Concorrente de Ordens e Solvência)**:
  - Disparar burst concorrente de 200 `POST /contracts` no mesmo milissegundo do tick oficial. Provar que todas as ordens capturam o strike correto do `index_state` sem contenção de locks.
  - Teste de flashmob: simular ataque concorrente de ordens que supere o teto de 3% de risco do float. O script Lua atômico no Redis deve cortar novas ordens instantaneamente (< 1ms).
- **Segurança (Anti-Tampering e Anti-Cross)**:
  - Tentar injetar `entry_price` e `user_id` no payload HTTP: comprovar rejeição com HTTP 400 (`A-07`, `S-02`).
  - Simular injeção de tick de EURUSD para liquidar contrato de BTCUSD: a barreira anti-cross deve lançar `CROSS_SETTLEMENT_CRITICAL` e abortar o processamento.
- **Caos (Recuperação e Retry Idempotente)**:
  - Simular falha de rede com o Blnk Ledger após a gravação do contrato no Postgres. O retry do outbox deve reenviar com a mesma chave `reserve:{contract_id}` sem duplicar débitos no saldo do usuário.

---

## 4. Garantias Pós-Implementação (Skill 10)

- **`V-07`**: Anti-cross absoluto: zero contratos liquidados com tick de outro ativo; resultado recalculado confere 100%.
- **`V-08`**: Prazo de liquidação: todo contrato vencido liquida em $\le 10$ s após `expires_at`; nenhum contrato retido em estados intermediários.
- **`V-09`**: Dinheiro fecha: reconciliação `OK` com divergência zero no Blnk Ledger; payout coerente com o resultado.
- **`V-10`**: Ativo `PAUSED` recusa ordens novas e continua liquidando os contratos abertos normalmente.
- **`V-13`**: Integridade da suíte; testes originais preservados sem enfraquecimento.

---

## 5. Critérios de Passagem do Quality Gate 4
- Executar `node tests/test-multi-04-contracts-settlement.mjs` $\to$ Exit Code 0.
- Executar `npx tsx --test tests/integration/*.test.ts` $\to$ Exit Code 0 (Blnk zero-sum e Float Cap 3%).
- Homologação do `financial-correctness-reviewer` e do `post-implementation-verifier` emitindo veredito **`APROVADO`**.
