# API guide — qa-resilience-agent

Referência carregada sob demanda. Regras, matriz regra → nível, catálogo de caos `C-01` a `C-12`
e SLOs propostos estão na skill `06-testing-quality`. Este guia diz **o que testar em cada subtask**,
**onde escrever**, **como provar** e **como devolver**.

## Fronteira de escrita

```text
services/<serviço>/test/unit/          *.test.ts        sem rede, sem banco
services/<serviço>/test/integration/   *.int.test.ts    containers reais
tests/
  support/                             helpers (abaixo)
  acceptance/                          AC-<task>.md      Dado/Quando/Então
  chaos/                               C-0x-*.test.ts    efêmero / staging
  chaos/env/                           overlay Toxiproxy do ambiente efêmero
  load/                                *.k6.js           staging
  e2e/                                 *.e2e.ts          Playwright
  reports/                             saída de execução (gitignored)
```

O `health-check.sh` reprova qualquer alteração fora desses caminhos. A checagem assume que o trabalho
do implementador já está commitado quando o QA começa.

## Plano por subtask

| Subtask | Unit | Integração | Caos / Carga | Regras |
|---------|------|------------|--------------|--------|
| T01 Compose | — | Todos os serviços sobem com healthcheck verde; Postgres/Redis sem porta pública | — | O-01, S-06 |
| T02 Keycloak | — | Password grant recusado; PKCE exigido; brute force após 5 tentativas | Reusar refresh token (§10.3) | S-01 |
| T03 API/BFF | Tabela de permissões | `alg: none`, `HS256`, `iss`/`aud` errados, expirado → `401`; USER em `/admin` → `403` | `C-07` | S-02, S-03 |
| T04 Wallet | Chave derivada estável | 1º login cria balances e credita 1×; 2º login não credita | `C-02` | I-02, I-03 |
| T05 Tick Engine | Próximo `sequence`; gerador com fonte injetada; hash encadeado | `PRIMARY KEY (symbol, sequence)`; commit falha → nada no Stream | `C-01`, `C-06`, `C-09` | M-01..M-04 |
| T06 Outbox relay | — | Relay publica 1×; republicação idempotente | `C-05` | R-01 |
| T07 Candle Worker | Property `low ≤ open,close ≤ high`; reprocessar = mesmo candle | Candle a partir de ticks gravados | `C-05`, `C-10` | M-05, R-06 |
| T08 WS Gateway | — | Auth na 1ª mensagem em ≤ 5 s; catch-up por `lastSequence`; 6ª conexão recusada; 11º símbolo recusado; sem `pong` → fechada em ≤ 45 s | `C-05`, `C-11`; 300 WS (T18) | M-06, S-02 |
| T09 Contracts | Validação de stake; máquina de estados | Idempotência 2× e 20×; mesma chave + corpo diferente → 422; BOLA → 404; mass assignment → 400; outbox 1×; 31ª requisição no minuto → 429 | 50 contratos/min (T18) | I-03, I-04, S-04, S-05 |
| T10 Settlement | WIN/LOSS/DRAW; payout inteiro | Settlement concorrente → 1 liquidação; sem tick → NACK | `C-02`, `C-04`, `C-08`, `C-10` | I-02..I-04, R-06 |
| T11 Reconciliação | Classificação de divergência | Divergência plantada detectada em ≤ 1 min | Pós-condição de todo caos (`C-12` roda em T15: exige os alertas) | I-05 |
| T12 Chart API | — | `GET /candles` com credencial somente leitura | p95 `GET /candles` (T18) | M-05, S-06 |
| T13/T14 Front | — (front escreve unit) | — | E2E login, boleta, reconexão; AUDITOR sem botões de escrita | F-xx, S-03 |
| T15 Observabilidade | — | Métricas expostas; alerta dispara com falha plantada; log capturado de um fluxo completo (login → contrato → settlement) não contém `Bearer `, token, senha nem e-mail | `C-12` | O-03, O-04, S-06, I-05 |
| T16 CI/CD | — | Pipeline reprova com teste vermelho e com segredo plantado | — | O-02 |
| T17 Caos | — | — | `C-01` a `C-12` + §10.3 | Q-03 |
| T18 Carga | — | — | Perfil abaixo | Q-04 |

## Mapa da Definição de Pronto (§11)

| # | Critério | Teste que prova |
|---|----------|-----------------|
| 1 | Tick engine tem líder único | `C-01` + integração de lease com 2 instâncias |
| 2 | Tick persistido antes de distribuído | Integração "commit falha → nada no Stream"; `C-06` |
| 3 | Tick duplicado impossível no banco | Integração `UNIQUE (symbol, sequence)` |
| 4 | Candle reconstruível a partir dos ticks | Property de reprocessamento + integração |
| 5 | WebSocket reconecta e faz catch-up | `C-05` + E2E de reconexão |
| 6 | Contrato tem idempotência | Integração 2× e 20× paralelo |
| 7 | Settlement tem idempotência | Integração concorrente + `C-08` |
| 8 | Ledger é append-only | Integração: `UPDATE`/`DELETE` negado pela role |
| 9 | Reconciliação roda continuamente | Integração com divergência plantada |
| 10 | Falha de Redis não corrompe dinheiro | `C-05` com pós-condições financeiras |
| 11 | Falha de worker não perde settlement | `C-08` |
| 12 | Falha de Keycloak não quebra contratos abertos | `C-07` |
| 13 | Alertas cobrem pontos críticos | T15: falha plantada → alerta |
| 14 | Testes de caos e carga passam | Relatório T17 + T18 |

## Helpers (`tests/support/`)

| Helper | Contrato |
|--------|----------|
| `assertNotProduction()` | Lança erro se `TARGET_ENV` não for `ephemeral` ou `staging`, ou se a URL alvo bater com o domínio de produção |
| `createSyntheticUser(prefix)` | Cria usuário `qa-<prefix>-<uuid>` no Keycloak de teste e devolve token; nunca reaproveita |
| `uniqueSymbol()` / `streamPrefix()` | Isolamento por teste (QA-12) |
| `ledgerSum()` | Soma de todos os balances no Blnk de teste; deve ser `0n` |
| `effectsFor(contractId)` | Transações do Blnk por `reference` do contrato |
| `runReconciliation()` | Dispara o reconciliador uma vez e devolve as divergências |
| `assertTickSequenceContinuous(symbol)` | Sem lacuna nem duplicata de `sequence` |
| `assertPostConditions({ contracts, symbol })` | Agrega as cinco pós-condições do Q-03 |
| `killService(name)` / `restartService(name)` | `docker compose kill/restart` no ambiente efêmero; devolve PID antes/depois |
| `toxiproxy.latency(name, ms)` / `.down(name)` | Injeção de rede; devolve prova (latência medida) |

## Ambientes

| Nível | Ambiente | Guarda |
|-------|----------|--------|
| Unit | Local / CI | Nenhuma rede |
| Integração | Containers efêmeros com as tags do Compose | Testcontainers sobe e derruba |
| Caos | Ambiente efêmero (preferido) ou staging autorizado no handoff | `assertNotProduction()` |
| Carga | Staging com dados sintéticos | `assertNotProduction()` + usuários `qa-*` |
| Produção | **Proibido na Fase 1** | — |

## Perfil de carga (T18)

| Métrica | Limite usado | Origem |
|---------|--------------|--------|
| WebSockets simultâneos | 300 | §10.4 — decidido |
| Contratos | 50/min | §10.4 — decidido |
| Ticks | 1/s por índice, sem lacuna | §10.4, `D-13` — decidido |
| `POST /contracts` p95 | < 200 ms | §10.4 — decidido (skill 06 propõe 300 ms; divergência em `pending`) |
| `POST /contracts` p99 | < 800 ms | skill 06 — PROPOSTO |
| `GET /candles` p95 | < 200 ms | skill 06 — PROPOSTO |
| Erro (`5xx` + timeouts) | < 0,1% | skill 06 — PROPOSTO |
| Settlement duplicado | 0 | §10.4 — decidido |
| Divergência de saldo | 0 | §10.4 — decidido |
| Usuários simultâneos alvo | `<não definido no contexto>` | — |

## Status, veredito e defeito

| Situação | `status` | `verdict` |
|----------|----------|-----------|
| Testes escritos, executados, todos verdes | `DONE` | `APROVADO` |
| Testes executados, algum vermelho por bug do produto | `DONE` | `REPROVADO` + `defects` |
| Ambiente ausente ou escopo incompleto | `BLOCKED` | — |
| Handoff inválido | `FAILED` | — |

```yaml
defects:
  - id: DEF-T17-1
    severity: CR��TICO
    test: tests/chaos/C-08-settlement-kill.test.ts::"[C-08][I-03] cada contrato liquidado exatamente 1×"
    reproduction: >
      200 contratos expirando; kill -9 no settlement-worker após 80 liquidações; worker volta.
      Esperado: 200 créditos. Observado: 201 — contrato <id> com references credit:<id>:WIN:1 e :2.
    route_to: backend-implementation-agent
```

Severidade do defeito segue a skill 06: `CRÍTICO` bug financeiro ou de segurança, `ALTO` regra
obrigatória quebrada ou flaky, `MÉDIO` asserção/observabilidade fraca, `BAIXO` melhoria.
