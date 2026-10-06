# Subfase 4: Carteira Blnk, Teto de Solvência de 3% Float & API de Contratos

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Subtasks do PRD:** T04, T09  
**Decisões Aplicadas:** D-02 (Blnk Ledger), D-10 (60s expiração, 85% payout), D-11 (Carteira Demo 10.000 USD), D-12 (Idempotency-Key obrigatória), D-18 (Moeda USD em centavos)  
**Invariantes Chave:** I-01 a I-03, B-01 a B-05, B-10, B-11, B-15, S-04, S-05  

---

## 1. Escopo e Objetivos da Subfase
Integrar o `services/wallet-adapter` com a API oficial do Blnk Finance para gerenciar a carteira demo de US$ 10.000,00 (`1_000_000` centavos) e executar a contabilidade de partidas dobradas. Desenvolver o motor atômico de validação de risco pré-ordem em Redis Lua (<1ms) aplicando o teto de solvência de 3% do capital depositado da casa por vela de expiração. Implementar a rota `POST /contracts` com `Idempotency-Key` estrita, captura do preço de entrada oficial e persistência atômica no PostgreSQL com latência de resposta inferior a 5ms.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 4.1: Implementação do Wallet Adapter (`services/wallet-adapter`) para o Blnk Ledger
- **Ação:** Criar o adaptador de integração com o Blnk Finance Core:
  - Inicialização do Ledger de desenvolvimento (`ledger_id: "broker_demo"`).
  - Criação das contas mestras da plataforma:
    - `@house_revenue`: conta de receita retida pela casa (losses dos traders).
    - `@house_payout`: conta de liquidez da casa para pagamento de lucros de traders.
    - `@broker_float`: espelho do capital total depositado na plataforma.
  - Função de onboarding do usuário:
    - Criação da conta de saldo disponível (`@user_{id}:available`) e de saldo em garantia (`@user_{id}:reserved`).
    - Crédito inicial idempotente de US$ 10.000,00 (`1_000_000` centavos USD) com referência `onboarding:{user_id}`.
  - Implementação de Circuit Breaker e retentativas com backoff exponencial nas chamadas HTTP à API do Blnk.
- **Regras:** `D-02`, `I-01`, `B-03`, `B-15`.
- **Critério de Aceite:** O usuário tem seu saldo demo criado no Blnk e nenhuma linha de saldo próprio existe nas tabelas do PostgreSQL.

---

### Passo 4.2: Script Lua Atômico do Teto de Solvência de 3% (`check_and_reserve_risk.lua`)
- **Ação:** Criar e registrar no Redis o script `infra/redis/scripts/check_and_reserve_risk.lua`:
  - Entrada:
    - `KEYS[1]`: `broker:deposit_float_minor` (saldo acumulado de depósitos no sistema em centavos).
    - `KEYS[2]`: `risk:candle:{symbol}:{expiry_bucket}:{direction}` (chave de exposição direcional da vela).
    - `ARGV[1]`: `stake_minor` (valor apostado pelo usuário em centavos inteiros).
    - `ARGV[2]`: `payout_percentage` (fixado em 85 para a Fase 1).
    - `ARGV[3]`: `ttl_seconds` (tempo de vida da chave de risco, e.g., 600 segundos).
  - Lógica do Script:
    1. Lê `deposit_float`. Se menor ou igual a 0, retorna `ERR_NO_DEPOSIT_FLOAT`.
    2. Calcula `max_risk_cap = math.floor(deposit_float * 0.03)`.
    3. Calcula o risco adicional da aposta: `additional_risk = math.floor(stake_minor * payout_percentage / 100)`.
    4. Lê `current_exposure`.
    5. Se `(current_exposure + additional_risk) > max_risk_cap`, rejeita atomicamente com erro `ERR_RISK_CAP_EXCEEDED` sem alterar nada.
    6. Se dentro do teto: executa `INCRBY` na chave de risco, define TTL e retorna `APPROVED`.
- **Regras:** `05-resilience-patterns`, Gestão de Risco Pré-Ordem.
- **Critério de Aceite:** O script executa em sub-milissegundo (<1ms) e barra rigorosamente qualquer ordem que ultrapassaria 3% do capital da plataforma na mesma direção e vela.

---

### Passo 4.3: Script Compensatório de Liberação de Risco (`release_risk.lua`)
- **Ação:** Criar `infra/redis/scripts/release_risk.lua`:
  - Utilizado pela API em caso de falha a jusante (ex: timeout no PostgreSQL após a reserva no Redis, ou saldo insuficiente do usuário no Blnk):
    ```lua
    local current_exposure = tonumber(redis.call('GET', KEYS[1]) or '0')
    local amount_to_release = tonumber(ARGV[1])
    if current_exposure > 0 then
      redis.call('DECRBY', KEYS[1], math.min(current_exposure, amount_to_release))
    end
    return 1
    ```
- **Regras:** `05-resilience-patterns` (Saga / Padrão de Compensação).
- **Critério de Aceite:** Quando uma ordem é abortada antes do commit no PostgreSQL, o risco pré-alocado é devolvido ao pool sem vazamentos.

---

### Passo 4.4: Endpoint de Abertura de Contratos (`POST /contracts`)
- **Ação:** Criar `services/api/src/routes/contracts/open-contract.ts`:
  - Validação de entrada:
    - Header obrigatório: `Idempotency-Key` (UUIDv4).
    - DTO Zod estrito: `{ symbol: string, direction: "UP" | "DOWN", stake_minor: number }`. Rejeita qualquer outro campo (como preço, resultado ou saldo) com `400 Bad Request`.
    - Validação de limites: `stake_minor` deve ser inteiro entre 100 (US$ 1,00) e 10.000 (US$ 100,00).
  - Verificação de Idempotência Insert-First:
    - Consulta rápida ou insert na tabela `idempotency_keys`: se a mesma chave existir com o mesmo corpo, devolve a resposta cacheada; se o corpo for diferente, devolve `422 Unprocessable Entity`.
  - Execução do Gate de Risco:
    - Chama `check_and_reserve_risk.lua` no Redis. Se retornar `ERR_RISK_CAP_EXCEEDED`, responde imediatamente com `422` e mensagem explicativa.
- **Regras:** `B-01`, `B-02`, `B-05`, `S-04`, `S-05`.
- **Critério de Aceite:** A API rejeita requisições malformadas, deduplica chamadas repetidas com a mesma chave e aplica a checagem de risco em menos de 2ms.

---

### Passo 4.5: Transação ACID de Criação do Contrato e Reserva de Stake
- **Ação:** Implementar o fluxo transacional no PostgreSQL (`services/api/src/services/contract-service.ts`):
  1. Lê o preço de entrada oficial: o último tick persistido com sucesso na tabela `ticks` ou no cache oficial sincronizado do banco.
  2. Calcula a data de expiração: `expires_at = tick.ts + 60s` (D-10).
  3. Abre transação no PostgreSQL:
     ```sql
     BEGIN;
     INSERT INTO contracts (
       id, user_id, symbol, direction, status, stake_minor, payout_minor, 
       entry_price, opened_at, expires_at, idempotency_key
     ) VALUES (
       $1, $userId, $symbol, $direction, 'OPEN', $stake_minor, $payout_minor, 
       $entryPrice, NOW(), $expiresAt, $idempotencyKey
     );

     INSERT INTO outbox_events (event_type, payload)
     VALUES ('RESERVE_STAKE', json_build_object(
       'contract_id', $1, 'user_id', $userId, 'stake_minor', $stake_minor
     ));
     COMMIT;
     ```
  4. Adiciona a ordem no Redis Sorted Set de monitoramento de expiração:
     ```bash
     ZADD contracts:pending <expires_at_timestamp_ms> <contract_id>
     ```
  5. Responde ao cliente com HTTP `201 Created` contendo os detalhes oficiais da ordem (tempo total de resposta do endpoint < 5ms).
- **Regras:** `B-01`, `B-04`, `I-03`.
- **Critério de Aceite:** O contrato é gravado como `OPEN` no banco e o outbox despacha a transação de reserva no Blnk (`reference: reserve:{contract_id}`).

---

### Passo 4.6: Endpoints de Consulta do Usuário e Testes de Concorrência
- **Ação:**
  - Implementar endpoints de leitura em `services/api`:
    - `GET /api/v1/contracts`: lista contratos do usuário autenticado (`WHERE user_id = :sub`), com filtros por `status` e paginação.
    - `GET /api/v1/contracts/:id`: detalhes do contrato. Se o contrato pertencer a outro usuário, retorna `404 Not Found` (prevenção rigorosa de BOLA/IDOR).
    - `GET /api/v1/wallet`: consulta saldo demo no Blnk via Wallet Adapter.
  - Criar testes em `services/api/test/`:
    - `contracts-idempotency.integration.test.ts`: 20 requisições simultâneas com a mesma `Idempotency-Key` geram exatamente 1 contrato.
    - `contracts-risk-cap.integration.test.ts`: estresse com ordens excedendo o teto de 3% comprovando a rejeição automática sem afetar o banco.
    - `contracts-bola.integration.test.ts`: usuário B tenta acessar contrato de A e recebe `404`.
- **Regras:** `S-04`, `06-testing-quality`, QA-07.
- **Critério de Aceite:** Todas as consultas respeitam o escopo do usuário autenticado e a concorrência pré-ordem opera com consistência perfeita.

---

## 3. Validação e Critérios de Conclusão da Subfase
1. Carteira demo criada no Blnk Ledger com US$ 10.000,00 para novos usuários.
2. Script Lua do teto de 3% do float bloqueia apostas concorrentes quando o limite da vela é alcançado.
3. Rota `POST /contracts` abre ordens em menos de 5ms com persistência no Postgres e evento de outbox de reserva.
4. Gate de qualidade da Subfase 4 marcado como `PASS`.
