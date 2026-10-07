# Subetapa 1: Backend Staleness Gate & Validação Atômica de Preço

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `backend-implementation-agent`  
**Agente Revisor Financeiro:** `financial-correctness-reviewer`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `08-database-foundation`  
**Invariantes Protegidas:** M-02 (Sequence contínua), B-01 (ACID de contratos), I-01 a I-03 (Consistência do Ledger), S-02 (Validação de input/estado)

---

## 1. Escopo e Objetivos da Subetapa
Impedir de forma atômica no backend que qualquer contrato seja aberto ou liquidado sobre uma cotação defasada (`stale`). O `ContractService` deve consultar `index_state`, validar a diferença entre `now()` e `last_ts` e, caso o atraso exceda o teto de tolerância (`STALENESS_THRESHOLD = 5000ms`), rejeitar a requisição imediatamente com código de erro explícito `FEED_STALE` e HTTP 409 / 422, impedindo a criação do registro e a reserva indevida no Ledger Blnk.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 1.1: Definição da Constante e Regras de Frescor por Símbolo
- **Ação:** Configurar constantes de limite de tolerância de atraso (`MAX_TICK_AGE_MS = 5000`) no domínio de contratos (`services/api/src/services/contract-service.ts` e `services/api/contract-domain.mjs`).
- **Critério de Aceite:** Atrasos de até 3000ms são aceitos em condições normais de rede; atrasos $\ge 5000\text{ ms}$ disparam rejeição imediata.

### Passo 1.2: Refatoração da Consulta `index_state` no `ContractService`
- **Ação:** Modificar a leitura de `index_state` para capturar `last_ts`, `last_price`, `last_sequence` e calcular a idade do tick:
  $$\Delta t = \text{Date.now()} - \text{new Date}(last\_ts)\text{.getTime()}$$
- **Critério de Aceite:** Se `last_sequence == 0` ou $\Delta t > 5000\text{ ms}$, abortar antes de acionar o `RiskManager` ou iniciar a transação do banco.

### Passo 1.3: Mapeamento de Erro e Código HTTP Padronizado
- **Ação:** Criar exceção de domínio `StaleFeedError` com código `FEED_STALE`. Configurar o handler Fastify para traduzir este erro em HTTP 409 Conflict com payload estruturado:
  ```json
  { "code": "FEED_STALE", "message": "O feed de cotações para este ativo está desatualizado. Abertura de contratos suspensa.", "symbol": "BTCUSD_OTC", "tick_age_ms": 6420 }
  ```
- **Critério de Aceite:** O payload fornece a idade exata do tick para auditoria, sem expor dados internos sensíveis.

### Passo 1.4: Blindagem contra Fallback Falso de Preço Padrão
- **Ação:** Eliminar o fallback ingênuo de `"100.000000"` caso o ativo não tenha registros em `index_state`. Se o par não tiver cotação ativa confirmada, lançar `TICK_UNAVAILABLE`.
- **Critério de Aceite:** Zero contratos criados com preço fictício ou padrão não gerado pelo motor oficial.

### Passo 1.5: Verificação de Frescor no Settlement Worker
- **Ação:** Assegurar que o `settlement-worker` valide que o tick oficial de liquidação possui timestamp $\ge expires\_at$, e que caso haja congelamento no motor durante a vida do contrato, o contrato aguarde o primeiro tick legítimo em vez de fechar com preço pretérito.
- **Critério de Aceite:** Contrato não pode ser liquidado com tick cujo `ts < expires_at`.

### Passo 1.6: Atualização do Mock de Modo Convidado (Guest Mode)
- **Ação:** Atualizar [`apps/web/src/api/client.ts`](file:///D:/brokerproject/apps/web/src/api/client.ts) para também validar staleness em modo convidado se o último tick conhecido do símbolo tiver idade superior a 5000ms.
- **Critério de Aceite:** Comportamento idêntico entre modo real e modo convidado: bloqueio estrito em caso de feed congelado.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Unidade & Domínio
* Criar `tests/unit/contract-staleness-gate.unit.test.ts`.
* Simular `index_state` com `last_ts` há 1.000ms $\to$ **APROVA**.
* Simular `index_state` com `last_ts` há 5.001ms $\to$ **REJEITA** com `FEED_STALE`.

### 3.2 Teste de Integração Real
* Submeter requisição `POST /contracts` para ativo com motor pausado há 10 segundos.
* Confirmar retorno HTTP 409 e zero inserções em `contracts` e `outbox`.

### 3.3 Teste de Caos
* Injetar silêncio artificial no gerador de ticks de `BTCUSD_OTC` por 15 segundos.
* Disparar 50 requisições simultâneas de compra/venda.
* Todas as 50 devem ser rejeitadas com `FEED_STALE`, sem vazamento de saldo ou inconsistência.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. 100% dos testes de unidade e integração da Subetapa 1 passando sem erros.
2. Nenhuma ordem executada com cotação com idade $\ge 5000\text{ ms}$.
3. Homologação formal do `financial-correctness-reviewer`.
