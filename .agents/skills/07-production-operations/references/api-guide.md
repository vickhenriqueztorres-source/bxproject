# API guide — 07-production-operations

Referência carregada sob demanda. Valores marcados **PROPOSTO** não constam em `01-project-context` e devem ser confirmados pelo `tech-lead-orchestrator`.

## Estrutura de arquivos

```text
infra/
  compose/
    docker-compose.yml        base: serviços, redes, volumes, healthchecks
    compose.dev.yml           portas em 127.0.0.1, build local, logs verbosos
    compose.staging.yml       igual a prod, dados sintéticos, client load-test
    compose.prod.yml          réplicas, limites, secrets, sem build
  prometheus/
    prometheus.yml
    rules/*.yml               alertas (com runbook_url)
    tests/*.test.yml          promtool test rules
  grafana/dashboards/*.json
  loki/  backup/
db/migrations/                NNNN_<nome>.up.sql / NNNN_<nome>.down.sql
runbooks/                     um arquivo por alerta + rollback.md + restore.md
```

## Serviços do Compose

| Serviço | Rede | Porta publicada (staging/prod) | Healthcheck | Réplicas |
|---------|------|--------------------------------|-------------|----------|
| `edge` (Cloudflare/Nginx/Caddy: `<não definido no contexto>`) | edge, internal | 443, 80 (redirect) | config válida + upstream | 1 |
| `api` | internal | — | `GET /readyz` | ≥ 2 |
| `ws-gateway` | internal | — | `GET /readyz` | ≥ 2 |
| `chart-api` | internal | — | `GET /readyz` | ≥ 1 |
| `tick-engine` | internal | — | `GET /readyz` (líder ou standby) | 2 (lease `D-09`) |
| `outbox-relay` | internal | — | `GET /readyz` | ≥ 1 (ticks: lease por símbolo) |
| `candle-worker` | internal | — | `GET /readyz` | ≥ 1 |
| `settlement-worker` | internal | — | `GET /readyz` | ≥ 2 |
| `wallet-adapter` | internal | — | `GET /readyz` | ≥ 2 |
| `keycloak` | internal (via edge) | — | `/health/ready` (porta de gerenciamento) | 1 |
| `postgres` (TimescaleDB) | internal | — | `pg_isready` | 1 |
| `blnk` | internal | — | `<não definido no contexto>` | 1 |
| `redis` | internal | — | `redis-cli ping` | 1 |
| `prometheus`, `grafana`, `loki` | internal (Grafana via edge com SSO) | — | endpoint `/-/ready` ou `/api/health` | 1 |

`/healthz` = processo vivo; `/readyz` = dependências alcançáveis (PostgreSQL, Redis) — PROPOSTO.

## Ambientes

| Item | dev | staging | prod |
|------|-----|---------|------|
| Imagem | build local | tag git SHA | mesma tag do staging |
| Portas internas publicadas | sim, em `127.0.0.1` | não | não |
| Segredos | `.env` local fora do git | gerenciador `<não definido no contexto>` | gerenciador `<não definido no contexto>` |
| Dados | descartáveis | sintéticos | reais (demo) |
| Chaos e carga (`06`) | — | sim | **nunca** |

## Pipeline

| # | Estágio | Gate (falhou → para) |
|---|---------|----------------------|
| 1 | Lint + typecheck | zero erro |
| 2 | Unit tests (`06`, Q-01) | 100% verde; sem `.only` |
| 3 | Integration tests (`06`, Q-02) | 100% verde |
| 4 | Build da imagem, tag = git SHA | 1 build por commit |
| 5 | Scan: dependências, imagem, segredos no código | zero crítico |
| 6 | Push para o registry (`<não definido no contexto>`) | digest registrado |
| 7 | Deploy em staging + migrations | healthchecks verdes |
| 8 | Smoke + acceptance (`06`, Q-05) | 100% verde |
| 9 | Aprovação humana | registro de quem aprovou |
| 10 | Migrations em prod (expand) | sem lock além de `lock_timeout` |
| 11 | Deploy em prod (mesmo digest) | healthchecks verdes |
| 12 | Janela de observação: 15 min — PROPOSTO | nenhum alerta crítico; 5xx < 0,1% → senão rollback (O-06) |

Chaos e carga (`06`, Q-03/Q-04) rodam agendados contra staging, não a cada commit — PROPOSTO.

## Migrations — expand/contract

Exemplo: renomear `contracts.stake` para `contracts.amount`.

| Release | Migration | Código |
|---------|-----------|--------|
| N (expand) | `ADD COLUMN amount`; trigger ou backfill em lotes copiando `stake` | escreve nas duas, lê `stake` |
| N+1 | — | lê `amount`, escreve nas duas |
| N+2 (contract) | `DROP COLUMN stake` — somente após N+1 estável | usa só `amount` |

Regras: `SET lock_timeout = '2s'` em toda migration; `CREATE INDEX CONCURRENTLY`; backfill em lotes; todo `up` tem `down` até a fase contract; tabela `ticks` (hypertable) só com janela monitorada.

## Logs

| Campo | Obrigatório | Exemplo |
|-------|-------------|---------|
| `ts` | sim | `2026-03-10T12:00:00.123Z` |
| `level` | sim | `info` |
| `service` | sim | `settlement-worker` |
| `env` | sim | `prod` |
| `version` | sim | git SHA |
| `trace_id` | sim (quando houver request/mensagem) | do `traceparent` |
| `event` | sim | `contract.settled` |
| `msg` | sim | texto curto |
| `user_id` | quando aplicável | `sub` do JWT |
| `contract_id`, `sequence`, `stream_id` | quando aplicável | |

**Proibido em log:** access/refresh token, `Authorization`, cookie, senha, client secret, `DATABASE_URL` com senha, body completo de request.
**Labels do Loki:** somente `service`, `env`, `level`.
**Retenção:** `<não definido no contexto>`.

## Métricas mínimas

| Métrica (`01-project-context`) | Nome proposto | Tipo | Labels |
|-------------------------------|---------------|------|--------|
| Ticks por segundo | `ticks_generated_total` | Counter | `symbol` |
| Latência de contrato | `contract_open_duration_seconds` | Histogram | `outcome` |
| Contratos abertos | `contracts_open` | Gauge | `symbol` |
| Erros 5xx | `http_requests_total` | Counter | `route`, `method`, `status` |
| Usuários conectados | `ws_connections` | Gauge | `instance` |
| Divergência de saldo | `balance_divergence` | Gauge | `kind` |
| Liderança do tick | `tick_engine_leader` | Gauge (0/1) | `symbol`, `instance` |
| Último backup | `backup_last_success_timestamp_seconds` | Gauge | `database` |

Mais as métricas de resiliência de `05-resilience-patterns/references/api-guide.md`. Nomes **PROPOSTOS**.

## Alertas mínimos

| Alerta | Expressão (resumo) | `for` | Severidade |
|--------|--------------------|-------|------------|
| `BalanceDivergence` | `max(balance_divergence) > 0` | 0m | crítico |
| `TickRateLow` | `sum by (symbol) (rate(ticks_generated_total[1m])) < 0.9` (`D-13`) | 30s | crítico |
| `TickEngineDown` | `absent(up{job="tick-engine"} == 1)` — cobre a série que some | 15s | crítico |
| `TickLeaderMissing` | `sum by (symbol) (tick_engine_leader) != 1` | 15s | crítico |
| `FinancialDLQNotEmpty` | `dlq_messages{stream=~"wallet:commands\|contracts:expiring"} > 0` | 0m | crítico |
| `ContractsStuckExpiring` | contratos `EXPIRING` há > 10 s (`I-05`) | 1m | crítico |
| `OutboxLagHigh` | `outbox_lag_seconds > 5` | 2m | alto |
| `CircuitBreakerOpen` | breaker `OPEN` | 1m | alto |
| `Api5xxHigh` | taxa de 5xx > 1% | 5m | alto |
| `BackupMissing` | `time() - backup_last_success_timestamp_seconds > 26h` | 10m | alto |
| `WALArchiveFailing` | `pg_stat_archiver` com falhas crescendo | 10m | alto |
| `CertificateExpiring` | expira em < 14 dias | 1h | médio |
| `Watchdog` | `vector(1)` — sempre disparando | — | info |

Thresholds de `OutboxLagHigh`, `CircuitBreakerOpen` e `Api5xxHigh` **PROPOSTOS**. Toda regra tem `annotations.runbook_url` → `runbooks/<alerta>.md`. Roteamento (Alertmanager ou Grafana Alerting): `<não definido no contexto>`.

## Backup

| Banco | Método | Frequência | Retenção | Destino |
|-------|--------|------------|----------|---------|
| PostgreSQL da plataforma | backup base + WAL contínuo (pgBackRest ou WAL-G — PROPOSTO) | base diária, WAL contínuo | 30 dias — PROPOSTO | storage fora do host, criptografado |
| PostgreSQL do Blnk | idem, **mesma ferramenta e mesma política** | idem | idem | idem |
| PostgreSQL do Keycloak | idem | idem | idem | idem |
| Redis | AOF local; sem backup externo (reconstruível do outbox/ticks) | — | — | — |

RPO/RTO: `<não definido no contexto>`. Proposta: RPO ≤ 5 min, RTO ≤ 1 h — PROPOSTO.

## Checklist de restore (mensal)

1. Escolher um instante `T` e restaurar plataforma, Blnk e Keycloak para `T` em ambiente isolado.
2. Subir os serviços com tráfego bloqueado no edge.
3. Reconstruir Streams do Redis a partir do outbox não publicado e dos ticks (republicação idempotente, `R-01`).
4. Rodar a reconciliação (`I-05`): zero divergência.
5. Verificar a cadeia de hash dos ticks (`M-04`) até `T`.
6. Conferir identidades: todo `user_id` de carteira existe no Keycloak restaurado.
7. Registrar tempo total vs RTO e dados perdidos vs RPO em `runbooks/restore.md`.

## Runbook de rollback

1. Confirmar o critério (alerta crítico ou SLO violado na janela pós-deploy).
2. Se a mudança está atrás de flag: desligar a flag. Fim.
3. Senão: redeploy do digest anterior (`TAG=<sha anterior> docker compose ... up -d`) — sem rebuild.
4. Verificar healthchecks, `TickRateLow`, `Api5xxHigh` e `BalanceDivergence`.
5. **Não** reverter migrations da fase expand (são compatíveis com N-1).
6. Dados gravados pela versão nova ficam; correção financeira só por transação reversa (`I-06`).
7. Registrar o incidente e abrir issue com a causa.
