# Changelog — 08-database-foundation

## [1.0.0] — 2026-03-10

### Adicionado

- Topologia: RDS PostgreSQL Multi-AZ com três databases (`synth`, `blnk`, `keycloak`) na mesma instância, para que o PITR restaure tudo no mesmo instante.
- Catálogo do que entra e do que **não** entra no banco, com o motivo de cada item.
- Regras DB-01 a DB-14: rede, tipos, integridade, append-only, menor privilégio, RLS, transações, réplica, conexões, criptografia, migrations, backup/DR, observabilidade e retenção.
- DDL completo do database `synth` com triggers de máquina de estados, append-only e cadeia de ticks.
- Matriz serviço × role × tabela × coluna, RLS fail-closed e configuração de timeouts por role.
- RPO/RTO por cenário, runbook de restore e checklist de failover.
- Nove divergências com o contexto atual, para resolver antes da primeira migration de produção.
- Proposta da decisão `D-17` (banco gerenciado em staging e prod).
- `health-check.sh` com varredura de migrations, IaC e strings de conexão.
