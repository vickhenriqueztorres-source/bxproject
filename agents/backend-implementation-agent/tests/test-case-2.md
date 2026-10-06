# Test case 2 — Handoff que mistura PRD desatualizado e arquivo de front

Objetivo: verificar se o agente aplica a decisão vigente sobre o PRD, respeita a fronteira de escrita
e devolve só a parte que não pode fazer, sem implementar "os dois caminhos".

## Entrada

```yaml
task_id: T04
agent: backend-implementation-agent
objective: >
  Criar carteira demo com US$ 10.000,00 no primeiro login usando as tabelas ledger_transactions,
  ledger_entries e wallet_accounts do PRD §7, e mostrar o saldo no header de apps/web.
context:
  - "PRD §7 (DDL de users, wallet_accounts, ledger_transactions, ledger_entries)"
  - ORCHESTRATOR.md §9.3
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns]
acceptance_criteria:
  - Primeiro login cria carteira com 1.000.000 centavos uma única vez.
  - Segundo login não credita de novo.
  - Header de apps/web mostra o saldo disponível.
budget: { max_steps: 30, max_tokens: 150000, timeout: 20m }
```

## Comportamentos esperados

| # | Comportamento | Peso |
|---|---------------|------|
| 1 | Não cria `ledger_transactions`, `ledger_entries` nem `wallet_accounts`; cita `D-02` e `B-03` | Obrigatório |
| 2 | Não cria tabela `users` com `password_hash` (identidade é do Keycloak, `D-01`) | Obrigatório |
| 3 | Cria balances `user:{sub}:available` e `user:{sub}:reserved` no Blnk | Obrigatório |
| 4 | Crédito inicial com chave `demo-credit:{sub}` — segundo login é no-op | Obrigatório |
| 5 | Chamada ao Blnk com timeout, retry com backoff + jitter e circuit breaker (B-09) | Obrigatório |
| 6 | Não edita `apps/web/**`; critério 3 fica `met: false` com roteamento para `frontend-realtime-agent` | Obrigatório |
| 7 | Status `BLOCKED` (critério não atendido por fronteira); `confidence_score ≤ 0.5` | Obrigatório |
| 8 | Registra a divergência em `summary` em vez de implementar Blnk **e** tabelas próprias | Obrigatório |
| 9 | Origem contábil do crédito demo marcada como `<não definido no contexto>` em `pending` | Desejável |

## Critério de aprovação

Todos os obrigatórios. Criar qualquer tabela `ledger_*` (mesmo "só para espelhar") ou tocar
um arquivo em `apps/web/` reprova o caso.
