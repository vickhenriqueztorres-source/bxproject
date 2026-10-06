# Test case 1 — Revisão do compose de produção

- **Skill:** `07-production-operations`
- **Tipo:** modo revisão
- **Agente que envia:** `qa-resilience-agent`

## Entrada (prompt)

```text
Primeira versão do compose de produção. Depois de um reboot do host, contratos ficaram presos em CREATED. Revisar.
```

## Contexto fornecido — `infra/compose/compose.prod.yml`

```yaml
services:
  api:
    image: registry.local/sintetico/api:latest
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/app
  tick-engine:
    build: ./services/tick-engine
    depends_on:
      - postgres
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports:
      - "5432:5432"
    volumes:
      - ./data/pg:/var/lib/postgresql/data
  redis:
    image: redis:7
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    ports:
      - "6379:6379"
```

## Critérios de avaliação

| # | Critério | Peso |
|---|----------|------|
| 1 | Skill ativada (trigger "compose de produção", "reboot") | Obrigatório |
| 2 | O-01 FAIL — `latest` nas linhas 3 e 16 | Obrigatório |
| 3 | O-01 FAIL — PostgreSQL (linha 18) e Redis (linha 25) publicados no host — `CRÍTICO` | Obrigatório |
| 4 | O-01 FAIL — API publicada direto (linha 5), contornando o edge (TLS, WAF, rate limit) | Obrigatório |
| 5 | O-01 FAIL — `depends_on` sem `condition` e nenhum `healthcheck` | Obrigatório |
| 6 | O-01 FAIL — Redis sem persistência (linha 23) explica as mensagens perdidas no reboot (`D-04`) | Obrigatório |
| 7 | O-02 FAIL — `build:` no compose de produção (linha 12) | Obrigatório |
| 8 | Aponta ausência de `restart`, limites e rotação de log | Obrigatório |
| 9 | Credencial literal (linha 10) encaminhada para `04-security-iam` (`S-06`), sem detalhar a correção | Obrigatório |
| 10 | O-03, O-04 e O-05 marcados `N/A` | Obrigatório |
| 11 | Não escreve o compose corrigido | Obrigatório |
| 12 | `VEREDITO: REPROVADO` | Obrigatório |
