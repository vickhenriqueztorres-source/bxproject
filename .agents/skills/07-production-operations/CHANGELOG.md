# Changelog — 07-production-operations

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (regra, estágio de pipeline ou alerta obrigatório alterado), MINOR (regra, alerta ou serviço novo), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de docker compose, deploy, CI/CD, pipeline, logs, métricas, alerta, backup, restore e rollback.
- Seção **Mentalidade** aplicada à operação.
- Regras `O-01` a `O-06`: Docker Compose, CI/CD, logs e métricas, alertas, backups, rollback.
- "Build uma vez, promove sempre" e migrations em expand/contract.
- Regra de que rollback volta código, nunca dados; restore de backup não é rollback.
- Modos implementação e revisão com formato de saída por regra, impacto em produção e plano de volta.
- `references/api-guide.md` com serviços do Compose, pipeline, migrations, campos de log, métricas, alertas mínimos, backup, checklist de restore e runbook de rollback.
- `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- RPO e RTO (exigidos por `01-project-context`, valores não definidos).
- Ferramenta de CI, registry de imagens, canal de alerta e escala de plantão.
- Proxy de edge (Cloudflare, Nginx ou Caddy), roteamento de alertas (Alertmanager ou Grafana Alerting) e ferramenta de feature flag.
- Retenção de logs, métricas e backups.
