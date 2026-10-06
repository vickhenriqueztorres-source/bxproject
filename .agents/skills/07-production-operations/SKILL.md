---
name: 07-production-operations
description: >
  Trigger: "docker compose", "deploy", "CI/CD", "pipeline", "logs", "métricas", "alerta", "backup", "restore", "rollback". Ativar antes de configurar ou revisar como a plataforma roda, é observada e volta atrás.
version: 1.0.0
---

# 07-production-operations

Operação de produção da **Plataforma de Índices Sintéticos — Fase 1**.
Define **como** a plataforma é empacotada, entregue, observada, protegida contra perda de dados e desfeita.
Decisões herdadas de `01-project-context`: `D-14` (Prometheus + Grafana + Loki + Sentry), `D-15` (Docker Compose; dev, staging e prod).

## Mentalidade

| Regra | Pergunta mental aplicada à operação |
|-------|-------------------------------------|
| Se não é observável, não é confiável | Se o tick parar às 3h, quem é acordado e em quantos segundos? |
| Deploy precisa ter volta | Como eu volto esta mudança em 5 minutos, sem perder dado? |
| Backup não testado não existe | Quando foi o último restore completo, e quanto tempo levou? |
| Menor privilégio sempre | Este container precisa mesmo publicar porta ou ler este segredo? |
| Falhar é normal | Se este host morrer agora, o que sobe sozinho e o que fica parado? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "docker compose", "compose.prod", "healthcheck", "depends_on", "subir o ambiente", "staging", "prod"
- "CI", "CD", "pipeline", "GitHub Actions", "deploy", "release", "promover", "migration no deploy"
- "log", "Loki", "métrica", "Prometheus", "Grafana", "dashboard", "Sentry", "trace_id"
- "alerta", "alertmanager", "plantão", "on-call", "runbook", "SLO"
- "backup", "restore", "PITR", "WAL", "RPO", "RTO", "disaster recovery"
- "rollback", "voltar versão", "feature flag", "blue/green", "canary", "expand/contract"
- Revisão de qualquer PR que altere `infra/`, pipeline, migrations ou configuração de observabilidade

**Não ativar quando:**

- Segredos, roles do banco e Keycloak em si — usar `04-security-iam` (esta skill só garante que chegam via `secrets:`)
- Valores de timeout, retry e breaker — usar `05-resilience-patterns`
- Escrever testes ou critérios de aceite — usar `06-testing-quality`
- Trocar a ferramenta de orquestração (ex.: Kubernetes no lugar do Compose) — `01-project-context` (`CONFLITA COM DECISÃO` `D-15`)

## Regras

### O-01 — Docker Compose

- **Definição:** um `docker-compose.yml` base + `compose.<env>.yml` por ambiente (`D-15`). A **mesma imagem** roda em todos os ambientes; só configuração muda.
- **Pergunta mental:** se o host reiniciar agora, tudo sobe na ordem certa e só o edge fica exposto?
- **Como verificar:** imagem com versão imutável (tag = git SHA ou digest), nunca `latest`; `healthcheck` em todo serviço de longa duração; `depends_on` com `condition: service_healthy`; `restart: unless-stopped`; limites de CPU/memória; rede `edge` (só o proxy publica 443) e rede `internal` (PostgreSQL, Redis, Blnk, Keycloak sem `ports:` em staging/prod); volumes nomeados para dados; segredos via `secrets:` (`S-06`); rotação de log no driver.
- **Redis:** AOF ligado — Streams são fonte de trabalho (`D-04`) e mensagens pendentes não podem sumir num restart.
- **Violação típica:** `image: api:latest`; `ports: "5432:5432"` em prod; `build:` no compose de produção.

### O-02 — CI/CD

- **Definição:** **build uma vez, promove sempre**: a imagem é construída 1× por commit e promovida dev → staging → prod sem rebuild. Cada estágio tem gate automático; prod tem aprovação humana.
- **Pergunta mental:** o que chega em prod é exatamente o binário que passou nos testes de staging?
- **Estágios e gates:** tabela em `references/api-guide.md`, seção "Pipeline".
- **Migrations:** padrão **expand/contract**; rodam como passo próprio antes do deploy, com `lock_timeout`; a versão N-1 do código funciona com o schema N; `DROP`/`RENAME` só no release seguinte ao que parou de usar a coluna.
- **Ferramenta de CI:** `<não definido no contexto>`.
- **Violação típica:** `push` em `main` faz deploy direto em prod; `git pull && docker compose build` no servidor; `RENAME COLUMN` no mesmo deploy do código novo.

### O-03 — Logs e métricas

- **Definição:** logs JSON estruturados em stdout → Loki; métricas Prometheus por serviço; exceções no Sentry com `release` = git SHA (`D-14`).
- **Pergunta mental:** com só o `trace_id` de um usuário reclamando, eu acho o request, o contrato e a transação no ledger?
- **Logs:** campos fixos em `references/api-guide.md`; `trace_id` propagado via `traceparent`; **nunca** token, senha, `Authorization`, cookie ou segredo.
- **Cardinalidade:** labels do Loki e do Prometheus só com valores de conjunto pequeno (`service`, `env`, `level`, `route`, `status`, `symbol`); `user_id`, `contract_id` e `trace_id` vão no corpo do log, nunca em label.
- **Métricas mínimas da Fase 1:** ticks por segundo, latência de contrato, contratos abertos, erros 5xx, usuários conectados, divergência de saldo (`01-project-context`) + métricas de `05-resilience-patterns`. Latência sempre em histograma, nunca média.
- **Violação típica:** `console.log(req.headers)`; `labelNames: ['user_id']`; Sentry com `sendDefaultPii: true`.

### O-04 — Alertas

- **Definição:** todo alerta é **acionável**, tem severidade, `for:`, `summary`, `runbook_url` e dono. Alerta por sintoma (impacto no usuário ou no dinheiro) antes de causa.
- **Pergunta mental:** se este alerta tocar agora, a pessoa sabe o que fazer nos primeiros 5 minutos?
- **Mínimo obrigatório:** tabela "Alertas mínimos" em `references/api-guide.md` — inclui divergência de saldo, tick parado, DLQ financeira, contratos presos em `EXPIRING`, backup atrasado e `Watchdog`.
- **Como verificar:** regras testadas com `promtool test rules`; `Watchdog` sempre disparando prova que a cadeia de alerta funciona; manutenção usa silêncio com prazo e autor, nunca regra desligada.
- **Canal e escala de plantão:** `<não definido no contexto>`.
- **Violação típica:** alerta sem runbook; alerta de CPU 80% que ninguém age; divergência de saldo só visível no dashboard.

### O-05 — Backups

- **Definição:** PostgreSQL da plataforma, do Blnk e do Keycloak com backup base + WAL contínuo (PITR), criptografado, com cópia fora do host. Redis não é fonte de verdade (`D-05`).
- **Pergunta mental:** se o volume do PostgreSQL sumir agora, quanto eu perco (RPO) e quanto tempo levo para voltar (RTO)?
- **RPO/RTO:** `<não definido no contexto>` — pendência obrigatória (`01-project-context`, regra 9); proposta em `references/api-guide.md`.
- **Consistência:** plataforma e Blnk são restaurados para o **mesmo instante**; reconciliação (`I-05`) e verificação da cadeia de hash (`M-04`) antes de reabrir tráfego.
- **Restore testado:** mensal, em ambiente isolado, com tempo medido contra o RTO — checklist em `references/api-guide.md`.
- **Banco gerenciado:** se `D-17` for aprovada, PITR do RDS + AWS Backup substituem pgBackRest/WAL-G — ver `08-database-foundation` (DB-12).
- **Violação típica:** `pg_dump` em cron no mesmo disco; backup só da plataforma, sem o Blnk; nenhum restore registrado.

### O-06 — Rollback

- **Definição:** toda mudança tem caminho de volta em **≤ 5 minutos** (`01-project-context`, regra 8): redeploy da tag anterior ou desligar a feature flag. Código volta; **dados não voltam**.
- **Pergunta mental:** se eu subir a versão anterior agora, ela funciona com o schema e os dados que existem?
- **Como verificar:** imagens anteriores mantidas no registry; expand/contract garante compatibilidade N-1; critério de rollback definido antes do deploy (alertas críticos ou SLO de erro na janela pós-deploy); rollback ensaiado em staging (N → N-1 → N).
- **Proibido:** restaurar backup como rollback (perde contratos e transações posteriores); corrigir ledger revertendo banco — só transação reversa (`I-06`).
- **Violação típica:** "plano de rollback: restaurar o dump de ontem"; migration irreversível sem flag.

## Instruções

**Modo implementação** (`backend-implementation-agent`):

1. Identificar o ambiente (`dev`, `staging`, `prod`) e o que muda em cada um.
2. Para Compose: aplicar O-01 a todo serviço novo (imagem, healthcheck, rede, limites, segredos).
3. Para pipeline: encaixar a mudança nos estágios de O-02; migrations em expand/contract.
4. Para toda feature: declarar logs, métricas e alertas (O-03, O-04) e o runbook.
5. Escrever o **plano de volta** (O-06) antes do deploy.
6. Informação ausente (RPO, canal de alerta, ferramenta de CI) → `<não definido no contexto>`, nunca um valor inventado.

**Modo revisão** (`qa-resilience-agent`; `security-reviewer` para exposição de rede e segredos):

1. Para cada regra O-01 a O-06, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha e descreve o **impacto em produção**.
3. Severidade: `CRÍTICO` (perda de dado, mudança sem volta, banco exposto, falha financeira silenciosa), `ALTO` (deploy sem gate, serviço sem healthcheck, alerta crítico ausente), `MÉDIO` (log sem estrutura, limite ausente), `BAIXO` (melhoria).
4. Não escrever a configuração corrigida; descrever o problema e a regra violada.

## Formato de saída

```text
SKILL: 07-production-operations
MODO: IMPLEMENTAÇÃO | REVISÃO
AMBIENTE: dev | staging | prod | todos
ESCOPO ANALISADO: <arquivos>

O-01 Docker Compose   : PASS | FAIL | N/A — <evidência>
O-02 CI/CD            : PASS | FAIL | N/A — <evidência>
O-03 Logs e métricas  : PASS | FAIL | N/A — <evidência>
O-04 Alertas          : PASS | FAIL | N/A — <evidência>
O-05 Backups          : PASS | FAIL | N/A — <evidência>
O-06 Rollback         : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — impacto em produção: <descrição> — viola <O-xx>

PLANO DE VOLTA: <como desfazer em ≤ 5 min | "inexistente">
PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar compose de prod" — trecho:
  postgres:
    image: timescale/timescaledb:latest-pg16
    ports:
      - "5432:5432"

O-01 Docker Compose : FAIL — compose.prod.yml:2 tag latest; :4 porta do banco publicada
ACHADOS:
- [CRÍTICO] compose.prod.yml:4 — PostgreSQL publicado no host — impacto em produção: banco
  com o ledger acessível fora da rede interna — viola O-01
- [ALTO] compose.prod.yml:2 — tag mutável — impacto: um restart pode subir outra versão do banco — viola O-01
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Deploy do Tick Engine:** a troca de líder durante o deploy não pode criar lacuna de `sequence` (`M-02`); nunca rodar duas versões com regras de preço ou formato de hash diferentes ao mesmo tempo.
- **Mudança no formato do hash do tick (`M-04`):** não é revertível por rollback de imagem; exige versão de formato e plano próprio.
- **Migration longa em `ticks`:** pode bloquear o Tick Engine; `lock_timeout`, `CREATE INDEX CONCURRENTLY` e janela monitorada.
- **Rollback após a fase contract:** impossível por imagem; por isso contract só depois de N estável e com N-1 sem uso da coluna.
- **Restore do Keycloak para um ponto antigo:** usuários criados depois somem e as carteiras (`sub`) ficam órfãs; reconciliar identidades antes de reabrir.
- **Alerta que some junto com o serviço:** se todas as instâncias morrem, a série deixa de existir e `rate(...) < x` não dispara; todo alerta crítico de taxa tem par com `absent()`.
- **WAL acumulando por falha de archive:** enche o disco do PostgreSQL e derruba tudo; alerta `WALArchiveFailing`.
- **Relógio dos hosts:** NTP obrigatório; expiração de 60 s (`D-10`), 1 tick/s (`D-13`) e logs dependem dele.
- **Segredo vazado em log já enviado ao Loki:** rotacionar o segredo (`04-security-iam`) e expurgar o trecho; apagar só o log não basta.
- **Dev com portas publicadas:** permitido somente em `compose.dev.yml`, ligado a `127.0.0.1`.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de compose, CI/CD, logs, alertas, backup e rollback |
| Ativação espúria | Fronteiras com `04`, `05`, `06` e `01` em "Não ativar quando" |
| Execução parcial | Saída exige status para O-01 a O-06 e plano de volta |
| Deriva de instrução | Serviços, pipeline, alertas e checklist de restore fixos em `references/` |
| Conflito de tools | Compose por `D-15`; observabilidade por `D-14`; segredos na `04` |
| Context overflow | Tabelas em `references/`; configuração completa em `examples/` |
| Feedback loop negativo | Rollback nunca restaura dados; correção financeira só por reversão |

## Recursos

- Serviços, pipeline, migrations, logs, métricas, alertas, backup e rollback: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de infraestrutura e pipeline: `scripts/health-check.sh`
