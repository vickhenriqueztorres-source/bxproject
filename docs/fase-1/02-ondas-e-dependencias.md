# Ondas, dependências e mapa do PRD

## Ordem de execução

O orquestrador pega sempre a **primeira** subtask `PENDING` desta tabela cujas dependências estão `DONE`.
Se uma trava, as que não dependem dela seguem.

| Ordem | Subtask | Depende de | Onda | Zona vermelha (P-08) |
|---|---|---|---|---|
| 1 | T01 Monorepo + Compose + schema base | — | 1 · Fundação | infra, migration |
| 2 | T02 Keycloak realm | T01 | 1 · Fundação | auth |
| 3 | T03 API/BFF JWT + RBAC + DTO | T02 | 1 · Fundação | auth |
| 4 | T05 Tick Engine | T01 | 2 · Mercado | concorrência |
| 5 | T06 Outbox relay | T05 | 2 · Mercado | — |
| 6 | T04 Wallet Adapter + Blnk | T03, T06 | 2 · Mercado | dinheiro |
| 7 | T07 Candle Worker | T06 | 2 · Mercado | — |
| 8 | T12 Chart API | T07, T03 | 2 · Mercado | — |
| 9 | T08 WebSocket Gateway | T06, T03 | 3 · Contrato | auth |
| 10 | T09 Contract Service + admin API | T04, T05, T06 | 3 · Contrato | dinheiro, auth |
| 11 | T10 Scheduler + Settlement | T09 | 3 · Contrato | dinheiro |
| 12 | T11 Reconciliação | T10, T07 | 3 · Contrato | dinheiro |
| 13 | T15 Observabilidade | T11, T08, T12 | 4 · Operação | — |
| 14 | T13 Front-end | T08, T10, T12 | 4 · Telas | auth |
| 15 | T14 Painel admin | T09, T15 | 4 · Telas | auth |
| 16 | T16 CI/CD | T13, T14 | 5 · Entrega | infra |
| 17 | T17 Caos completo | T11, T15 | 5 · Entrega | dinheiro |
| 18 | T18 Carga | T17 | 5 · Entrega | — |

Mudanças em relação à ordem numérica, e por quê:

- **T05/T06 antes de T04:** a carteira usa outbox + Stream para o crédito inicial (o `C-02` da T04 depende do relay).
- **T15 antes de T13/T14:** o painel admin mostra alertas, e o `C-12` (reconciliação + alerta) só fecha com T15.
- **T16 no fim:** o `gate.sh` já faz o papel do CI local desde a T01. A T16 só leva o mesmo gate para o pipeline.

## Mapa PRD → subtask

| PRD | Entrega | Subtasks | Oráculo |
|---|---|---|---|
| US-01 Cadastro com confirmação de e-mail | Registro no Keycloak, e-mail no Mailpit, redireciona ao dashboard | T01, T02, T13 | OR-25 |
| US-02 Login, MFA opcional, sessão com refresh | OIDC + PKCE, TOTP opcional para USER, refresh com rotação | T02, T03, T13 | OR-18, OR-25 |
| US-03 Saldo demo US$ 10.000 no header, tempo real | Crédito inicial idempotente; evento de saldo no canal do usuário | T04, T08, T13 | OR-15, OR-25 |
| US-04 Gráfico de candles, 1 tick/s, 100 candles | Tick engine, candles, `/candles`, WebSocket | T05, T07, T12, T08, T13 | OR-01..05 |
| US-05 Abrir UP/DOWN, stake US$ 1–100, 60 s, idempotente | `POST /contracts` com `Idempotency-Key` | T09, T13 | OR-06..09 |
| US-06 Resultado WIN/LOSS/DRAW + notificação | Settlement, payout D-19, evento no canal do usuário | T10, T08, T13 | OR-11..14 |
| US-07 Histórico com filtro por resultado | `GET /contracts?result=` | T09, T13 | OR-25 |
| US-08 Admin: usuários, saldo, busca por e-mail | `GET /admin/users` | T09, T14 | OR-26 |
| US-09 Admin: contratos com filtro por status | `GET /admin/contracts` | T09, T14 | OR-26 |
| US-10 Admin: pausar/retomar índice | `POST /admin/indices/{symbol}/pause|resume`; ticks continuam; abertos liquidam | T09, T14 | OR-10, OR-26 |
| Persona Admin: bloquear usuário, ledger, alertas | `block/unblock`, `/admin/users/{id}/transactions`, `/admin/alerts` | T09, T14, T15 | OR-26 |
| Monitoramento básico | Prometheus, Grafana, Loki, alertas | T15 | OR-23 |
| Métricas: p95 < 200 ms, 5xx < 0,1 %, divergência 0 | Carga com thresholds no k6 | T18 | OR-24 |

## Definição de Pronto (ORCHESTRATOR §11) → onde é provada

| # | Critério | Subtask | Oráculo |
|---|---|---|---|
| 1 | Tick engine tem líder único | T05 | OR-01 |
| 2 | Tick persistido antes de distribuído | T05 | OR-02 |
| 3 | Tick duplicado impossível no banco | T05 | OR-03 |
| 4 | Candle reconstruível a partir dos ticks | T07 | OR-04 |
| 5 | WebSocket reconecta e faz catch-up | T08 | OR-05 |
| 6 | Contrato tem idempotência | T09 | OR-06 |
| 7 | Settlement tem idempotência | T10 | OR-13 |
| 8 | Ledger é append-only | T04 | OR-16 |
| 9 | Reconciliação roda continuamente | T11 | OR-17 |
| 10 | Falha de Redis não corrompe dinheiro | T17 | OR-20 |
| 11 | Falha de worker não perde settlement | T17 | OR-21 |
| 12 | Falha de Keycloak não quebra contratos abertos | T17 | OR-22 |
| 13 | Alertas cobrem os pontos críticos | T15 | OR-23 |
| 14 | Testes de caos e carga passam | T17, T18 | OR-20..22, OR-24 |
