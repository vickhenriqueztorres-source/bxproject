# Matriz de testes por subetapa

O que roda em cada etapa de cada subtask, quem escreve e o que o gate exige. Fonte dos casos:
`agents/qa-resilience-agent/references/api-guide.md` ("Plano por subtask"), catálogo `C-01`–`C-12` da skill 06
e os oráculos de `09-oraculos.md`.

## Etapas do gate

| Etapa | Quando | O que roda | Quem escreveu os testes |
|---|---|---|---|
| `impl` | Depois do implementador | Health-check do implementador, `gate:lint`, `test:unit Txx` | Implementador (unit) |
| `qa` | Depois do QA | Fronteira de escrita do QA, stack efêmera, unit, integração (3× em T04/T05/T09/T10), caos, e2e/carga, oráculos presentes | QA |
| `review-start` / `review-end` | Em volta dos revisores | Snapshot, triagem estática, prova de que o revisor não escreveu | — |
| `fix` | Depois do bug-fix | Health-check do bug-fix (diff mínimo, regressão `[DEF-…]`), lint, unit e integração da subtask | Bug-fix |
| `final` | Antes do merge | Regressão de **todas** as subtasks anteriores (unit + integração), caos e oráculos da subtask | — |

Toda etapa começa por "governança intacta" e "evidência fora do git". Se alguém editou `agents/`, `skills/`,
`ORCHESTRATOR.md` ou `docs/fase-1/`, nada passa.

## Contrato dos scripts raiz (entregue pela T01)

O `gate.sh` só chama estes scripts. A T01 cria todos, e o QA da T01 testa o próprio contrato.

| Script | Comportamento exigido |
|---|---|
| `pnpm run gate:lint` | ESLint + `tsc --noEmit` em todos os pacotes |
| `pnpm run test:unit <Txx\|all>` | Vitest sem rede nem banco; filtra pelo prefixo `[Txx-` no título; `all` roda tudo; **sai com erro se 0 testes casarem** |
| `pnpm run test:int <Txx\|all>` | Vitest contra a stack efêmera real; mesmo filtro e mesma regra de 0 testes |
| `pnpm run test:chaos <C-xx …>` | Roda `tests/chaos/C-xx-*.test.ts`; reseta a stack antes de cada cenário; Toxiproxy para latência/queda; termina verificando reconciliação = 0 divergência |
| `pnpm run test:e2e <Txx>` | Playwright em `tests/e2e/` contra stack + front |
| `pnpm run test:load` | `k6 run` em `tests/load/*.k6.js`; thresholds no script reprovam o processo; relatório em `tests/reports/` |
| `pnpm run stack:up` | `docker compose … up -d --wait` no projeto efêmero `fase1-test`; idempotente |
| `pnpm run stack:down` / `stack:reset` | `reset` = `down -v` + `up`, **só** no projeto `fase1-test` |
| `pnpm run demo:up` / `demo:seed` | Stack da apresentação no projeto `fase1-demo`, separado do efêmero; seed das contas e de alguns contratos |

## Nomes de teste

O título carrega os IDs entre colchetes. Um teste pode ter vários.

```ts
it('[T09-INT-04][OR-06] 20 POST /contracts paralelos com a mesma chave → 1 contrato e 1 reserva', …)
it('[C-08][OR-21] matar o settlement worker no meio do lote → cada contrato liquidado 1×', …)
it('[DEF-T10-2] tick de saída é o primeiro com ts >= expires_at', …)
```

## Matriz

| Subtask | Unit (impl) | Integração (qa) | Caos (qa) | E2E / carga | Oráculos | Revisão |
|---|---|---|---|---|---|---|
| T01 | — | Todos os serviços `healthy`; Postgres/Redis sem porta pública; migrations aplicam `schema.md`; contrato dos scripts | — | — | — | security |
| T02 | — | Password grant recusado; PKCE exigido; brute force após 5 tentativas; refresh reusado é recusado; e-mail de verificação chega ao Mailpit | — | — | — | security |
| T03 | Tabela de permissões | `alg:none`, `HS256`, `iss`/`aud` errados, expirado → 401; USER em `/admin` → 403 | C-07 | — | OR-18, OR-19 | security |
| T04 | Chave de idempotência estável | 1º login cria balances e credita 1×; 2º não credita; `UPDATE`/`DELETE` negados | C-02 | — | OR-15, OR-16 | financial + security |
| T05 | Próximo `sequence`; gerador com fonte injetada; hash encadeado | `UNIQUE (symbol, sequence)`; commit falha → nada no Stream; 2 instâncias → 1 líder | C-01, C-06, C-09 | — | OR-01, OR-02, OR-03 | financial |
| T06 | — | Relay publica 1×; republicação idempotente; ordem por `sequence` | C-05 | — | — | financial |
| T07 | `low ≤ open,close ≤ high`; reprocessar = mesmo candle | Candle a partir de ticks gravados | C-05, C-10 | — | OR-04 | financial |
| T08 | — | Auth na 1ª mensagem ≤ 5 s; catch-up por `lastSequence`; 6ª conexão e 11º símbolo recusados; sem `pong` → fecha ≤ 45 s; canal do usuário só recebe eventos do próprio `sub` | C-05, C-11 | 300 WS na T18 | OR-05 | security |
| T09 | Validação de stake; máquina de estados | Idempotência 2× e 20×; chave + corpo diferente → 422; BOLA → 404; mass assignment → 400; outbox 1×; 31ª/min → 429; índice pausado → recusado | — | 50 contratos/min na T18 | OR-06..OR-10 | financial + security |
| T10 | WIN/LOSS/DRAW; payout inteiro D-19 | Settlement concorrente → 1 liquidação; sem tick → NACK; tick de saída correto | C-02, C-04, C-08, C-10 | — | OR-11..OR-14 | financial |
| T11 | Classificação de divergência | Divergência plantada detectada ≤ 1 min, sem `UPDATE` | — | — | OR-17 | financial |
| T12 | — | `GET /candles` com credencial somente leitura; limite; tempo em segundos | — | p95 na T18 | — | — |
| T13 | Unit do front (hooks, `formatMinor`, dedupe) | — | — | E2E jornada do usuário + reconexão | OR-25 | security |
| T14 | Unit do front | — | — | E2E jornada do admin; AUDITOR sem botões de escrita | OR-26 | security |
| T15 | — | Métricas expostas; cada alerta dispara com falha plantada; logs sem token, senha ou e-mail | C-12 | — | OR-23 | — |
| T16 | — | Pipeline reprova com teste vermelho e com segredo plantado; rollback exercitado | — | — | — | security |
| T17 | — | — | C-01..C-12 + reuso de refresh token | — | OR-20, OR-21, OR-22 | financial + security |
| T18 | — | — | — | 300 WS + 50 contratos/min por 10 min | OR-24 | — |

## Regras

- **Flaky:** integração de T04, T05, T09 e T10 roda 3× seguidas no gate `qa`. Uma falha em três = defeito
  (corrida de concorrência é defeito real até prova em contrário, L-01).
- **Regressão:** o gate `final` roda unit + integração de **todas** as subtasks. Quebrou algo antigo: defeito
  `DEF-<Tantiga>-n`, corrigido pelo bug-fix com owner da subtask antiga.
- **Sem teste não é verde:** filtro sem teste correspondente sai com erro (scripts da T01). Oráculo sem teste
  com `[OR-xx]` reprova o gate.
- **`it.todo`** só para valor `<não definido no contexto>`. Com D-19 `Tomada`, o OR-11 não pode ser `todo`.
