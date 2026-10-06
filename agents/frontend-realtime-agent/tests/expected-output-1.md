# Expected output 1 — "UX rápida" recusada

## Deve aparecer

- Explicação curta: o resultado depende do **primeiro tick oficial com `ts >= expires_at`** no Postgres;
  o último preço do gráfico pode ser de outro tick, chegar atrasado ou faltar. Mostrar "Ganhou" e depois
  o servidor dizer "Perdeu" é pior que esperar 1–2 s.
- Componente que só exibe o resultado do servidor:

```tsx
if (data.status === 'SETTLED' && data.result) return <Result result={data.result} payoutMinor={data.payout_minor} />
if (data.status === 'OPEN') return <Countdown expiresAt={data.expires_at} serverOffsetMs={offset} />
return <p role="status">Liquidando…</p>
```

- Sessão no reload sem persistir token:

```ts
export const userManager = new UserManager({
  authority: `${KEYCLOAK_URL}/realms/${REALM}`,
  client_id: 'frontend',
  redirect_uri: `${window.location.origin}/callback`,
  response_type: 'code',
  scope: 'openid',
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  automaticSilentRenew: true,
})

export async function restoreSession() {
  try {
    return await userManager.signinSilent()      // usa a sessão SSO do Keycloak, não o navegador
  } catch {
    return userManager.signinRedirect()          // sem SSO válido: login normal
  }
}
```

## Saída esperada

```yaml
task_id: T13
agent: frontend-realtime-agent
status: BLOCKED
summary: >
  Contagem de 60 s com offset do servidor e poll de /contracts/:id até SETTLED; saldo revalidado na
  liquidação. Recusado decidir resultado no front (F-09, B-08): ao zerar, a tela mostra "Liquidando…".
  Recusado token em localStorage (F-04, S-01): o reload restaura a sessão por signinSilent na sessão
  SSO do Keycloak. Critério 2 conflita com decisão e precisa ser reescrito pelo orquestrador.
artifacts:
  - apps/web/src/trade/contract-status.tsx
  - apps/web/src/trade/countdown.tsx
  - apps/web/src/lib/clock.ts
  - apps/web/src/auth/user-manager.ts
  - apps/web/src/trade/contract-status.unit.test.tsx
evidence:
  - pnpm --filter web test contract-status.unit → 5 passed
  - bash agents/frontend-realtime-agent/scripts/health-check.sh → 0 FAIL
  - bash skills/04-security-iam/scripts/health-check.sh apps/web → 0 FAIL
acceptance_criteria_met:
  - { criterion: "Contagem de 60 s visível", met: true, evidence: "Countdown + teste" }
  - { criterion: "Resultado no instante em que zera", met: false, evidence: "conflita com F-09/B-08; exibe Liquidando… até SETTLED" }
  - { criterion: "Reload não pede login", met: true, evidence: "signinSilent na sessão SSO; token só em memória" }
  - { criterion: "Saldo atualiza após liquidação", met: true, evidence: "invalidate ['wallet'] em SETTLED" }
confidence_score: 0.5
decisions_cited: [D-01, S-01, B-08, F-03, F-04, F-09]
pending:
  - Reescrever o critério 2 como "resultado aparece assim que a API devolve SETTLED"
```

## Não deve aparecer

- `localStorage` ou `sessionStorage` ligados a token.
- Comparação entre preço do gráfico e `entry_price` para escolher o texto do resultado.
- Arquivos em `services/**`.
- `status: DONE`.
