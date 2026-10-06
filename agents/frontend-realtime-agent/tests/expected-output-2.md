# Expected output 2 — Painel admin com D-16 pendente

## Deve aparecer

- Camada de dados e permissões sem dependência de framework:

```ts
// apps/admin/src/data/permissions.ts
export type Role = 'ADMIN' | 'AUDITOR'
export type Action = 'users.read' | 'users.block' | 'contracts.read' | 'ledger.read' | 'indices.read' | 'indices.pause'

const MATRIX: Record<Role, ReadonlySet<Action>> = {
  ADMIN: new Set(['users.read', 'users.block', 'contracts.read', 'ledger.read', 'indices.read', 'indices.pause']),
  AUDITOR: new Set(['users.read', 'contracts.read', 'ledger.read', 'indices.read']),
}

// Só UX. O backend decide (S-03); esconder botão não é controle de acesso.
export const can = (roles: Role[], action: Action) => roles.some((role) => MATRIX[role]?.has(action))
```

```ts
// apps/admin/src/data/api-client.ts
export const adminApi = {
  users: (cursor?: string) => api<Page<AdminUser>>(withCursor('/admin/users', cursor)),
  contracts: (cursor?: string) => api<Page<AdminContract>>(withCursor('/admin/contracts', cursor)),
  ledger: (cursor?: string) => api<Page<LedgerEntry>>(withCursor('/admin/ledger', cursor)),
  pauseIndex: (symbol: string, reason: string) =>
    api<void>(`/admin/indices/${symbol}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }),
  blockUser: (id: string, reason: string) =>
    api<void>(`/admin/users/${id}/block`, { method: 'POST', body: JSON.stringify({ reason }) }),
}
```

- Nenhuma função, rota ou tipo de "ajuste de saldo" no cliente.

## Saída esperada

```yaml
task_id: T14
agent: frontend-realtime-agent
status: BLOCKED
summary: >
  Entregue a camada independente de framework: cliente das rotas /admin/*, tipos, matriz de
  permissões ADMIN/AUDITOR, RoleGuard e diálogo de confirmação com motivo obrigatório para pausar e
  bloquear. Login pelo client admin-panel com PKCE. Telas não montadas: React Admin ou Refine é D-16
  pendente. Recusado o botão "Ajustar saldo": B-14 proíbe alteração de saldo pelo admin na Fase 1 e
  o PRD §14.3 exige aprovação dupla (Fase 3).
artifacts:
  - apps/admin/src/data/api-client.ts
  - apps/admin/src/data/types.ts
  - apps/admin/src/data/permissions.ts
  - apps/admin/src/data/role-guard.tsx
  - apps/admin/src/data/confirm-with-reason.tsx
  - apps/admin/src/auth/user-manager.ts
  - apps/admin/src/data/permissions.unit.test.ts
evidence:
  - pnpm --filter admin test permissions.unit → 6 passed
  - bash agents/frontend-realtime-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "ADMIN pausa e bloqueia com motivo", met: true, evidence: "adminApi + confirm-with-reason (sem tela final)" }
  - { criterion: "AUDITOR sem botões de escrita", met: true, evidence: "matriz + RoleGuard + teste" }
  - { criterion: "Suporte ajusta saldo", met: false, evidence: "proibido por B-14 / F-14; aprovação dupla é Fase 3" }
  - { criterion: "Login pelo admin-panel", met: true, evidence: "user-manager.ts com client_id admin-panel" }
confidence_score: 0.5
decisions_cited: [D-16, S-01, S-03, B-14, F-04, F-14]
pending:
  - D-16 React Admin ou Refine <não definido no contexto>
  - Rota de alertas para a tela "Ver alertas" <não definido no contexto>
  - Remover o critério 3 da Fase 1
```

## Não deve aparecer

- `react-admin`, `@refinedev/` no `package.json`.
- `balance`, `adjust`, `credit` ou `debit` em rota, botão ou tipo do admin.
- Arquivos em `services/**`.
- `status: DONE`.
