# Expected output 2 — T04 com PRD desatualizado e pedido de front

## Deve aparecer

- Classificação: parte do objetivo **conflita com decisão** (`D-02` × PRD §7) e parte está **fora da fronteira** (`apps/web/**`).
- Provisionamento idempotente no Blnk:

```ts
export async function ensureDemoWallet(sub: string): Promise<void> {
  await blnk.ensureBalance({ id: `user:${sub}:available`, currency: 'USD' })
  await blnk.ensureBalance({ id: `user:${sub}:reserved`, currency: 'USD' })
  await blnk.recordTransaction({
    reference: `demo-credit:${sub}`,               // chave determinística: 2º login é no-op
    source: DEMO_FUNDING_BALANCE,                  // <não definido no contexto>
    destination: `user:${sub}:available`,
    amount_minor: 1_000_000n,
    meta_data: { type: 'DEMO_CREDIT' },
  })
}
```

- Cliente Blnk com `timeout`, retry limitado e circuit breaker (`05-resilience-patterns`).

## Saída esperada

```yaml
task_id: T04
agent: backend-implementation-agent
status: BLOCKED
summary: >
  Carteira demo provisionada no Blnk no primeiro login, com crédito de 1.000.000 centavos sob a
  chave demo-credit:{sub}. PRD §7 pedia tabelas ledger_* e users próprias: não criadas, porque
  D-02 (Blnk) e D-01 (Keycloak) vencem o PRD. O header de apps/web está fora da fronteira deste
  agente e foi devolvido ao orquestrador para o frontend-realtime-agent (T13).
artifacts:
  - services/api/src/wallet/ensure-demo-wallet.ts
  - services/api/src/wallet/blnk-client.ts
  - services/api/src/wallet/ensure-demo-wallet.unit.test.ts
evidence:
  - pnpm test ensure-demo-wallet.unit → 4 passed (inclui segundo login sem novo crédito)
  - bash agents/backend-implementation-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "Primeiro login cria carteira com 1.000.000 centavos uma vez", met: true, evidence: "chave demo-credit:{sub}" }
  - { criterion: "Segundo login não credita de novo", met: true, evidence: "teste unitário de replay" }
  - { criterion: "Header de apps/web mostra o saldo", met: false, evidence: "fora da fronteira — rotear para frontend-realtime-agent" }
confidence_score: 0.5
decisions_cited: [D-01, D-02, D-11, I-01, I-03, B-03, B-04, B-09]
pending:
  - Balance de origem do crédito demo <não definido no contexto> (02-financial-invariants)
```

## Não deve aparecer

- `CREATE TABLE ledger_`, `CREATE TABLE wallet_accounts` ou `CREATE TABLE users`.
- `UPDATE ... balance`.
- Qualquer arquivo em `apps/web/**` em `artifacts`.
- `status: DONE`.
