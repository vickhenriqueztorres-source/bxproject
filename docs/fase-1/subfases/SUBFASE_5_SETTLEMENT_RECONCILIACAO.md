# Subfase 5: Scheduler, Settlement Worker & Reconciliação Contínua

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T10, T11  
**Decisões Aplicadas:** D-02 (Blnk Ledger), D-04 (Redis Streams), D-05 (PostgreSQL estado forte), D-10 (60s expiração, 85% payout), D-19 (Regra inteira de payout D-19)  
**Invariantes Chave:** I-01 a I-06, B-02, B-03, B-04, B-08, B-17, DB-07  

---

## 1. Escopo e Objetivos da Subfase
Desenvolver o despachante de expiração de contratos e o serviço `services/settlement-worker` encarregado de liquidar contratos vencidos com lock pessimista (`SELECT ... FOR UPDATE`), leitura rigorosa do primeiro tick oficial registrado no PostgreSQL com `ts >= expires_at`, apuração exata de WIN, LOSS ou DRAW, liquidação de partidas dobradas no Blnk Ledger, desalocação de risco no Redis e notificação do resultado ao usuário. Em paralelo, criar o serviço de Reconciliação Contínua executado a cada 1 minuto para auditar e garantir a integridade entre o PostgreSQL e o Blnk.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 5.1: Despachante de Expiração via Redis Sorted Sets
- **Ação:** Criar o despachante de contratos em `services/settlement-worker/src/scheduler/expiry-dispatcher.ts`:
  - Varredura a cada 50ms no Redis:
    ```bash
    ZRANGEBYSCORE contracts:pending 0 <current_timestamp_ms> LIMIT 0 100
    ```
  - Para cada contrato identificado como vencido, despacha a mensagem de expiração para o Redis Stream `stream:contracts:expiring` com Consumer Group (`cg:settlement`).
  - Não remove o contrato do Sorted Set neste momento (a remoção ocorre apenas após a confirmação transacional de liquidação no banco de dados).
- **Regras:** `B-17`, `05-resilience-patterns`.
- **Critério de Aceite:** Contratos com score $\le \text{NOW()}$ são enfileirados imediatamente no stream de liquidação sem gargalo.

---

### Passo 5.2: Bloqueio Pessimista e Proteção Contra Concorrência no PostgreSQL
- **Ação:** Criar a transação de liquidação em `services/settlement-worker/src/settlement/settler.ts`:
  - Consome mensagem de `stream:contracts:expiring`.
  - Inicia transação no PostgreSQL com bloqueio pessimista:
    ```sql
    BEGIN;
    SELECT * FROM contracts 
     WHERE id = $1 
       FOR UPDATE SKIP LOCKED;
    ```
  - Validação de estado:
    - Se o contrato não for encontrado ou já possuir status `SETTLED`, faz commit, envia `XACK` ao Redis Stream e encerra a execução (idempotência nativa).
    - Se o contrato estiver em status `OPEN`, prossegue para a busca do tick oficial de saída.
- **Regras:** `B-08`, `DB-07`, `I-04`.
- **Critério de Aceite:** Múltiplos workers disputando a liquidação do mesmo contrato não provocam concorrência destrutiva; apenas um worker adquire o lock e processa o contrato.

---

### Passo 5.3: Consulta do Tick Oficial de Saída no PostgreSQL
- **Ação:** Implementar o algoritmo de captura da cotação de expiração:
  - Consulta estrita na tabela `ticks`:
    ```sql
    SELECT sequence, price, ts 
      FROM ticks 
     WHERE symbol = $1 
       AND ts >= $2 
     ORDER BY sequence ASC 
     LIMIT 1;
    ```
  - Tratamento de Ausência de Tick (Tick Gap / Latência):
    - Se a consulta retornar vazio (o tick do segundo da expiração ainda não foi gerado ou comitado pelo Tick Engine):
      - A transação executa `ROLLBACK` imediato.
      - A mensagem recebe `NACK` no Redis Stream e permanece no Sorted Set para ser retentada no ciclo seguinte (50ms depois).
      - **Proibição estrita:** É terminantemente proibido usar o último tick disponível ou inventar um tick "para adiantar a liquidação".
- **Regras:** `B-08`, `M-03`.
- **Critério de Aceite:** A ordem é liquidada exclusivamente pelo primeiro tick oficial que atenda a $ts \ge \text{expires\_at}$.

---

### Passo 5.4: Apuração Matemática de WIN / LOSS / DRAW e Cálculo de Payout
- **Ação:** Implementar a lógica de apuração em `services/settlement-worker/src/settlement/payout-calculator.ts`:
  - Comparação numérica exata entre `exit_price` e `entry_price`:
    - `UP`: se `exit_price > entry_price` $\implies$ `WIN`; se `exit_price < entry_price` $\implies$ `LOSS`; se `exit_price == entry_price` $\implies$ `DRAW`.
    - `DOWN`: se `exit_price < entry_price` $\implies$ `WIN`; se `exit_price > entry_price` $\implies$ `LOSS`; se `exit_price == entry_price` $\implies$ `DRAW`.
  - Cálculo de Payout com Inteiros na menor fração (`bigint`, regra D-19):
    - No `WIN`:
      $$\text{profit\_minor} = \lfloor \text{stake\_minor} \times 85 / 100 \rfloor$$
      $$\text{total\_payout\_minor} = \text{stake\_minor} + \text{profit\_minor}$$
    - No `LOSS`: $\text{total\_payout\_minor} = 0$.
    - No `DRAW`: $\text{total\_payout\_minor} = \text{stake\_minor}$ (reembolso integral).
  - Atualização do contrato para `SETTLED` e inserção do evento de outbox `SETTLE_CONTRACT` na mesma transação no PostgreSQL antes do commit.
- **Regras:** `B-02`, `D-10`, `D-19`.
- **Critério de Aceite:** Todos os cálculos operam sem números de ponto flutuante; centavos de dólar são exatos em todos os cenários de teste.

---

### Passo 5.5: Execução Contábil de Dupla Entrada no Blnk Ledger e Liberação de Risco
- **Ação:** Despachar a liquidação contábil através do `outbox-relay` e Wallet Adapter:
  - Para `WIN`:
    1. Transação 1: devolução do stake da conta de garantia para o saldo disponível (`user:reserved` $\to$ `user:available`, valor `stake_minor`, `reference: settlement:{contract_id}`).
    2. Transação 2: crédito do lucro pago pela casa (`house_payout` $\to$ `user:available`, valor `profit_minor`, `reference: credit:{contract_id}:WIN`).
  - Para `LOSS`:
    1. Transferência da stake em garantia para a receita da casa (`user:reserved` $\to$ `house_revenue`, valor `stake_minor`, `reference: settlement:{contract_id}`).
  - Para `DRAW`:
    1. Devolução da stake em garantia para o saldo disponível (`user:reserved` $\to$ `user:available`, valor `stake_minor`, `reference: settlement:{contract_id}`).
  - Pós-Liquidação:
    - Remove o contrato do Redis Sorted Set: `ZREM contracts:pending <contract_id>`.
    - Executa script Lua para liberar o risco da vela correspondente no Redis.
    - Publica evento `CONTRACT_SETTLED` no WebSocket Gateway para notificar a interface do trader.
- **Regras:** `I-01`, `I-02`, `I-03`, `B-04`.
- **Critério de Aceite:** O livro-razão no Blnk reflete perfeitamente as operações e mantém o balanço contábil com soma zero em todas as contas.

---

### Passo 5.6: Implementação do Serviço de Reconciliação Contínua de 1 Minuto
- **Ação:** Criar o reconciliador em `services/settlement-worker/src/reconciliation/financial-reconciler.ts`:
  - Execução periódica a cada 60 segundos aplicando as **7 checagens obrigatórias**:
    1. **Soma Zero no Blnk:** Total de débitos é rigorosamente igual ao total de créditos no ledger (`I-02`).
    2. **Contratos Abertos vs Garantia:** A soma de `stake_minor` de todos os contratos com status `OPEN` no PostgreSQL bate exatamente com o saldo de todas as contas `user:reserved` no Blnk.
    3. **Contratos Settled sem Liquidação:** Busca contratos `SETTLED` sem transação correspondente no Blnk.
    4. **Contratos Presos em EXPIRING:** Alerta caso existam contratos expirados há mais de 30 segundos que ainda não alcançaram status `SETTLED`.
    5. **DLQ Financeira:** Verifica se a Dead Letter Queue de eventos financeiros contém mensagens acumuladas.
    6. **Sequenciamento de Ticks:** Confere se a numeração de `sequence` na tabela `ticks` possui furos ou saltos.
    7. **Integridade da Corrente de Hash:** Recalcula a cadeia SHA-256 dos últimos 500 ticks e valida se algum registro foi adulterado.
  - Emissão da métrica `financial_reconciliation_divergence_cents` e disparo de alerta crítico via Prometheus caso o valor seja diferente de zero.
- **Regras:** `I-05`, `I-06`, `02-financial-invariants`.
- **Critério de Aceite:** O reconciliador roda a cada 1 minuto e emite relatório estruturado confirmando 0 divergências.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Contratos atingem o tempo de expiração e são liquidados automaticamente exatamente uma vez.
2. Contas no Blnk refletem com precisão as movimentações financeiras de WIN, LOSS e DRAW.
3. Reconciliador de 1 minuto roda e confirma zero discrepâncias contábeis ou de estado.
4. Gate de qualidade da Subfase 5 marcado como `PASS`.
