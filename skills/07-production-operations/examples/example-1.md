# Exemplo 1 — Compose base, override de produção e alertas

- **Modo:** implementação
- **Agente:** `backend-implementation-agent`
- **Pedido:** "Montar o compose de produção da Fase 1 e os alertas críticos."
- **Regras cobertas:** `O-01`, `O-03`, `O-04`, `D-04`, `D-09`, `D-13`, `D-14`, `D-15`

Tags de imagem abaixo são ilustrativas: fixar as versões aprovadas no release. Proxy de edge (`caddy` no exemplo) é `<não definido no contexto>`.

## `infra/compose/docker-compose.yml` (base)

```yaml
x-app: &app
  restart: unless-stopped
  networks: [internal]
  logging:
    driver: json-file
    options: { max-size: "10m", max-file: "5" }
  healthcheck:
    test: ["CMD", "wget", "-qO-", "http://localhost:8080/readyz"]
    interval: 10s
    timeout: 3s
    retries: 3
    start_period: 20s
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_healthy }

services:
  edge:
    image: caddy:2.8.4
    restart: unless-stopped
    ports: ["443:443", "80:80"]
    networks: [edge, internal]
    volumes: [caddydata:/data, ./Caddyfile:/etc/caddy/Caddyfile:ro]
    healthcheck:
      test: ["CMD", "caddy", "validate", "--config", "/etc/caddy/Caddyfile"]
      interval: 30s
    depends_on:
      api: { condition: service_healthy }
      ws-gateway: { condition: service_healthy }

  api:
    <<: *app
    image: ${REGISTRY}/sintetico/api:${TAG:?TAG obrigatória}
    environment:
      DATABASE_URL_FILE: /run/secrets/api_database_url
      REDIS_URL_FILE: /run/secrets/redis_url
    secrets: [api_database_url, redis_url]

  ws-gateway:
    <<: *app
    image: ${REGISTRY}/sintetico/ws-gateway:${TAG:?TAG obrigatória}
    secrets: [redis_url]

  tick-engine:
    <<: *app
    image: ${REGISTRY}/sintetico/tick-engine:${TAG:?TAG obrigatória}
    secrets: [tick_database_url, redis_url]
    stop_grace_period: 20s

  settlement-worker:
    <<: *app
    image: ${REGISTRY}/sintetico/settlement-worker:${TAG:?TAG obrigatória}
    secrets: [settlement_database_url, redis_url]
    stop_grace_period: 20s

  postgres:
    image: ${REGISTRY}/sintetico/postgres:16-timescale-2.17.2-pgbackrest
    restart: unless-stopped
    networks: [internal]
    command:
      - postgres
      - -c
      - wal_level=replica
      - -c
      - archive_mode=on
      - -c
      - archive_command=pgbackrest --stanza=platform archive-push %p
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets: [postgres_password]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:7.4.1
    restart: unless-stopped
    networks: [internal]
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec", "--aclfile", "/run/secrets/redis_acl"]
    secrets: [redis_acl]
    volumes: [redisdata:/data]
    healthcheck:
      test: ["CMD", "redis-cli", "--no-auth-warning", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  keycloak:
    image: quay.io/keycloak/keycloak:26.0.7
    restart: unless-stopped
    networks: [internal]
    command: ["start", "--optimized"]
    environment:
      KC_HEALTH_ENABLED: "true"
      KC_METRICS_ENABLED: "true"
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/9000 && printf 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && grep -q UP <&3"]
      interval: 10s
      start_period: 60s

networks:
  edge: {}
  internal: { internal: true }

volumes:
  pgdata: {}
  redisdata: {}
  caddydata: {}

secrets:
  api_database_url: { file: /srv/sintetico/secrets/api_database_url }
  tick_database_url: { file: /srv/sintetico/secrets/tick_database_url }
  settlement_database_url: { file: /srv/sintetico/secrets/settlement_database_url }
  redis_url: { file: /srv/sintetico/secrets/redis_url }
  redis_acl: { file: /srv/sintetico/secrets/redis_acl }
  postgres_password: { file: /srv/sintetico/secrets/postgres_password }
```

Serviços omitidos (`chart-api`, `outbox-relay`, `candle-worker`, `wallet-adapter`, `blnk`, observabilidade) seguem o mesmo padrão `<<: *app`.

## `infra/compose/compose.prod.yml` (override)

```yaml
services:
  api:
    deploy:
      replicas: 2
      resources: { limits: { cpus: "1.0", memory: 512M } }
  ws-gateway:
    deploy:
      replicas: 2
      resources: { limits: { cpus: "1.0", memory: 512M } }
  tick-engine:
    deploy:
      replicas: 2
      resources: { limits: { cpus: "0.5", memory: 256M } }
  settlement-worker:
    deploy:
      replicas: 2
      resources: { limits: { cpus: "0.5", memory: 256M } }
  postgres:
    deploy:
      resources: { limits: { cpus: "2.0", memory: 4G } }
    shm_size: 1g
  redis:
    deploy:
      resources: { limits: { cpus: "1.0", memory: 1G } }
```

Por que assim:

- `TAG:?` faz o Compose **falhar** sem tag explícita — nunca sobe `latest` por engano (O-01, O-06).
- Rede `internal: true` não tem rota para fora; só `edge` publica porta (O-01).
- `--appendonly yes` preserva `wallet:commands` e `contracts:expiring` pendentes num restart (`D-04`).
- Duas réplicas do Tick Engine são seguras porque só o dono do lease gera ticks (`D-09`).
- Cada serviço tem `DATABASE_URL` própria, com role própria (`04-security-iam`, `S-06`).
- Sem `build:` — imagens vêm do registry, construídas 1× no CI (O-02).

## `infra/prometheus/rules/financial.yml`

```yaml
groups:
  - name: financial
    rules:
      - alert: BalanceDivergence
        expr: max(balance_divergence) > 0
        for: 0m
        labels: { severity: critical, team: platform }
        annotations:
          summary: "Divergência entre contratos e ledger ({{ $value }})"
          runbook_url: "https://runbooks.internal/BalanceDivergence"

      - alert: TickRateLow
        expr: sum by (symbol) (rate(ticks_generated_total[1m])) < 0.9
        for: 30s
        labels: { severity: critical, team: platform }
        annotations:
          summary: "Índice {{ $labels.symbol }} abaixo de 1 tick/s"
          runbook_url: "https://runbooks.internal/TickRateLow"

      - alert: TickEngineDown
        expr: absent(up{job="tick-engine"} == 1)
        for: 15s
        labels: { severity: critical, team: platform }
        annotations:
          summary: "Nenhuma instância do Tick Engine sendo coletada — TickRateLow não dispara sem série"
          runbook_url: "https://runbooks.internal/TickEngineDown"

      - alert: TickLeaderMissing
        expr: sum by (symbol) (tick_engine_leader) != 1
        for: 15s
        labels: { severity: critical, team: platform }
        annotations:
          summary: "Índice {{ $labels.symbol }} com {{ $value }} líderes"
          runbook_url: "https://runbooks.internal/TickLeaderMissing"

      - alert: FinancialDLQNotEmpty
        expr: max by (stream) (dlq_messages{stream=~"wallet:commands|contracts:expiring"}) > 0
        for: 0m
        labels: { severity: critical, team: platform }
        annotations:
          summary: "{{ $value }} mensagem(ns) na DLQ de {{ $labels.stream }}"
          runbook_url: "https://runbooks.internal/FinancialDLQNotEmpty"

      - alert: Watchdog
        expr: vector(1)
        labels: { severity: info }
        annotations:
          summary: "Cadeia de alertas viva — deve estar sempre disparando"
          runbook_url: "https://runbooks.internal/Watchdog"
```

## `infra/prometheus/tests/financial.test.yml`

```yaml
rule_files: [../rules/financial.yml]
evaluation_interval: 15s
tests:
  - interval: 15s
    input_series:
      - series: 'ticks_generated_total{symbol="SYN100"}'
        values: '0+15x4 60x8'
    alert_rule_test:
      - eval_time: 3m
        alertname: TickRateLow
        exp_alerts:
          - exp_labels: { severity: critical, team: platform, symbol: SYN100 }
            exp_annotations:
              summary: "Índice SYN100 abaixo de 1 tick/s"
              runbook_url: "https://runbooks.internal/TickRateLow"
```

- A série sobe 1 tick/s por 1 min e para; aos 3 min a regra precisa estar disparando. Rodar com `promtool test rules infra/prometheus/tests/*.test.yml` no estágio 1 do pipeline.
- Domínio dos runbooks e canal de notificação: `<não definido no contexto>`.
- Thresholds de `ContractsStuckExpiring`, `OutboxLagHigh`, `BackupMissing` e demais: tabela "Alertas mínimos" em `references/api-guide.md`.
