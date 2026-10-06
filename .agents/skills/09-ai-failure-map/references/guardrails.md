# Guardas prontas (P-01 a P-09)

Guardas que **não dependem de a IA obedecer ao prompt**. O prompt reduz erro; estas camadas pegam o que passa.

## P-01 — Contrato antes do código

```text
packages/contracts/
├── openapi.yaml              # REST: /contracts, /candles, /wallet
├── events/
│   ├── tick.schema.json      # symbol, sequence, ts, price (string decimal), prev_hash, hash
│   ├── contract.schema.json
│   └── settlement.schema.json
└── src/generated/            # tipos gerados — nunca editados à mão
```

- Tipos TypeScript gerados a partir do OpenAPI e dos JSON Schemas.
- Todo consumidor valida a mensagem com zod antes de processar; inválida → DLQ.
- Mudança de contrato = PR próprio, revisado por humano, antes de qualquer implementação.

## P-02 — Versões fixadas + doc da versão

Tabela a preencher **antes** de T01 e colar no prompt de toda subtask:

| Componente | Versão fixada | Doc oficial da versão |
|------------|---------------|-----------------------|
| Keycloak | `<fixar>` | `<link>` |
| Blnk | `<fixar>` | `<link>` |
| PostgreSQL | `<fixar>` | `<link>` |
| Redis | `<fixar>` | `<link>` |
| Lightweight Charts | `<fixar>` | `<link>` |
| oidc-client-ts | `<fixar>` | `<link>` |
| TanStack Query | `<fixar>` | `<link>` |
| React Admin / Refine (D-16) | `<fixar>` | `<link>` |
| jose, zod, ioredis/pg | `<fixar>` | `<link>` |

Como colocar a doc no contexto: MCP de documentação (ex.: Context7), recurso `@docs` da IDE, ou copiar as páginas usadas para `docs/vendor/<ferramenta>/<versão>/`.

## P-03 — Testes-oráculo protegidos

Testes escritos **por humano antes** da implementação, que codificam as invariantes:

| Oráculo | Subtask | Invariante |
|---------|---------|------------|
| `tests/oracle/tick-uniqueness.test.ts` | T05 | Nunca dois ticks com o mesmo `(symbol, sequence)`; cadeia de hash íntegra |
| `tests/oracle/idempotency.test.ts` | T09 | 20 requisições paralelas, mesma chave → 1 contrato, 1 reserva |
| `tests/oracle/settlement-once.test.ts` | T10 | N workers → cada contrato liquidado exatamente uma vez |
| `tests/oracle/exit-tick.test.ts` | T10 | Tick de saída = primeiro `ts >= expires_at` (bordas ±1 ms) |
| `tests/oracle/payout.test.ts` | T10 | 85% em inteiros; empate conforme 02 (property-based) |
| `tests/oracle/bola.test.ts` | T03, T09 | Usuário A nunca lê nem altera recurso de B |
| `tests/oracle/ws-catchup.test.ts` | T08 | Reconexão com gap → sequência completa, sem repetição |
| `tests/oracle/ledger-balance.test.ts` | T04, T11 | Soma do ledger = saldo derivado |

```text
# .github/CODEOWNERS
/tests/oracle/      @<autor> @<orientador>
/db/migrations/     @<autor>
/packages/contracts @<autor>
```

Job de CI que reprova PR de branch de IA que altere oráculo:

```bash
#!/usr/bin/env bash
# ci/oracle-guard.sh — reprova se o PR toca tests/oracle/ junto com código de produção
set -euo pipefail
changed="$(git diff --name-only "origin/${BASE_REF:-main}"...HEAD)"
if printf '%s\n' "$changed" | grep -q '^tests/oracle/' \
   && printf '%s\n' "$changed" | grep -qvE '^(tests/|docs/)'; then
  echo "Oráculo e implementação no mesmo PR. Separe: oráculo é alterado só por humano." >&2
  exit 1
fi
```

## P-04 — Invariante no banco

Ver `08-database-foundation`: `UNIQUE`/`PRIMARY KEY`, triggers append-only, máquina de estados, tick de saída validado, grants por coluna. Se a IA errar o código, o banco recusa a escrita.

## P-05 — Regras estáticas do projeto

`scripts/health-check.sh` desta skill (rodar no CI) + regras de lint:

```js
// eslint.config.js (trecho)
export default [
  {
    files: ['services/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': ['error',
        { object: 'Math', property: 'random', message: 'Use CSPRNG (D-07).' },
        { object: 'jwt', property: 'decode', message: 'Use jwtVerify (S-02).' },
      ],
      'no-restricted-globals': ['error',
        { name: 'parseFloat', message: 'Dinheiro é inteiro minor ou decimal string.' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      'no-empty': ['error', { allowEmptyCatch: false }],
    },
  },
]
```

```yaml
# semgrep (trecho) — padrões que lint comum não pega
rules:
  - id: pool-query-begin
    pattern: $POOL.query("BEGIN")
    message: Transação via pool.query usa conexões diferentes. Use pool.connect().
    severity: ERROR
    languages: [typescript]
  - id: user-id-from-body
    pattern-either:
      - pattern: $REQ.body.user_id
      - pattern: $REQ.body.userId
    message: user_id vem do token (sub), nunca do cliente.
    severity: ERROR
    languages: [typescript]
```

## P-06 — Uma subtask por sessão

- Sessão nova da IA por subtask; carregar só as skills da linha da subtask (ORCHESTRATOR §8).
- Constantes de decisão num único módulo importado (`EXPIRY_SECONDS = 60`, `PAYOUT_PERCENT = 85`, `INITIAL_BALANCE_MINOR`), nunca redigitadas.
- Ao final, resumo curto vira checkpoint; a próxima sessão parte do checkpoint, não do histórico.

## P-07 — Evidência só do CI

```text
EVIDÊNCIA
commit: <sha>
ci_run: <url>
artefatos: junit.xml, coverage.json, mutation.json, k6-summary.json
```

Texto do agente dizendo "passou" não é evidência. Critério da Definição de Pronto sem artefato = `☐`.

## P-08 — Zonas vermelhas (revisão humana obrigatória)

| Zona | Caminhos | Motivo |
|------|----------|--------|
| Dinheiro | `services/contract`, `services/settlement`, `services/wallet-adapter`, reconciliação | F-02, F-03, F-09 |
| Identidade | `services/api/auth`, config Keycloak, WebSocket auth | F-06, F-10 |
| Banco | `db/migrations`, grants, RLS | F-06, P-04 |
| Infra | Compose, CI, segredos | F-10, F-12 |

Checklist de revisão de diff gerado por IA:

- [ ] Alguma verificação, validação, constraint ou teste foi removido ou afrouxado?
- [ ] Algum `catch` devolve valor em vez de propagar?
- [ ] Algum valor de dinheiro passa por `number`?
- [ ] Algum dado de identidade/preço vem do cliente?
- [ ] Alguma API externa usada não está na doc da versão fixada?
- [ ] Alguma escrita depende de "só um processo roda isso"?
- [ ] Existe artefato de CI para cada afirmação de "funciona"?

## P-09 — Mutation testing

Mede se os testes **detectam** código errado (pega F-07).

```json
{
  "testRunner": "vitest",
  "mutate": [
    "services/contract/src/**/*.ts",
    "services/settlement/src/**/*.ts",
    "services/wallet-adapter/src/**/*.ts"
  ],
  "thresholds": { "high": 90, "low": 80, "break": 80 }
}
```

Configuração do Stryker. Mutante sobrevivente em payout, empate ou máquina de estados = teste fraco → oráculo novo escrito por humano.

## Template completo de prompt

```text
Você vai implementar a subtask <T-xx — nome> da Fase 1.

1. CONTEXTO
   - Leia: <skills da subtask>. Decisões relevantes: <D-xx>.
   - Fora do escopo: <itens>. Não adicionar ferramentas novas.

2. VERSÕES E DOCS
   - <tabela P-02 desta subtask>
   - Use apenas APIs presentes na doc anexada. Se precisar de algo fora dela, PARE e pergunte.

3. CONTRATO
   - Tipos de packages/contracts. Não alterar o contrato.

4. PROIBIDO
   - Math.random; number/parseFloat para dinheiro; publicar antes de persistir;
     remover ou afrouxar verificação, teste, constraint ou tipo; as any; @ts-ignore; .skip; || true;
     valor substituto quando dependência falhar; criar ledger ou login próprio.

5. CONCORRÊNCIA
   - Mecanismo exigido: <ex.: FOR UPDATE SKIP LOCKED + UPDATE condicional>.
   - Explique, em 3 linhas, o que acontece se dois processos rodarem este código ao mesmo tempo.

6. TESTES
   - Oráculos (somente leitura): <caminhos>.
   - Pode adicionar testes; cada teste novo deve falhar contra a implementação errada descrita em <F-xx>.

7. SE ALGO FALHAR
   - Pare. Mostre o erro, a hipótese e a alteração proposta. Não altere a verificação.

8. ENTREGA
   - Diff, decisões tomadas, riscos conhecidos, perguntas abertas.
   - Não afirme que testes passaram; o CI decide.
```
