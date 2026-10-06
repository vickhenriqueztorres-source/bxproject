# PostgreSQL gerenciado com alta disponibilidade

Minha recomendação prática: **AWS RDS PostgreSQL Multi-AZ** como banco principal, com **Redis gerenciado** separado para cache, Streams e WebSocket. Não colocaria o banco financeiro principal em um único VPS. RDS oferece backups automáticos, recuperação a um ponto no tempo e replicação de backups entre regiões para estratégia de desastre.

## Arquitetura final

```text
[API / Contract Service / Settlement Workers]
                    |
                    v
      [AWS RDS PostgreSQL Multi-AZ]
      - contratos
      - ledger de dupla entrada
      - usuários internos
      - auditoria
      - idempotency keys
      - outbox
      - ticks oficiais
      - candles OHLCV
                    |
                    +--> backups automáticos + PITR
                    +--> réplica/read replica para relatórios
                    +--> backup cross-region
```

```text
[Redis gerenciado]
- cache
- rate limit
- Streams
- Pub/Sub
- fan-out WebSocket
- leader lease do tick engine
```

## Por que PostgreSQL

Ele é a escolha certa porque o projeto precisa de:

- **ACID:** contrato, ledger e settlement precisam confirmar juntos ou fazer rollback.
- **Locks e isolamento:** evita dois workers liquidarem o mesmo contrato.
- **Constraints:** impede duplicidade de `idempotency_key`, tick e transação.
- **JSONB + SQL:** ótimo para auditoria, eventos e dados operacionais.
- **Particionamento:** ticks e logs podem ser particionados por tempo.
- **Read replicas:** gráficos e relatórios não travam o settlement.

Para ticks, você pode usar **PostgreSQL particionado por data** ou TimescaleDB em infraestrutura própria. Mas eu não colocaria extensão TimescaleDB como requisito do banco financeiro principal; mantenha o ledger/contratos em Postgres puro e use uma base de séries temporais separada se o volume ficar grande.

## O desenho profissional

```text
                ┌─────────────────────┐
                │ Primary PostgreSQL  │
                │ Multi-AZ            │
                │ escrita financeira  │
                └──────────┬──────────┘
                           │ replicação síncrona
                           v
                ┌─────────────────────┐
                │ Standby em outra AZ │
                │ failover automático │
                └─────────────────────┘

                ┌─────────────────────┐
                │ Read Replica        │
                │ candles, relatórios │
                │ admin, analytics    │
                └─────────────────────┘

                ┌─────────────────────┐
                │ Backup/PITR         │
                │ cross-region        │
                └─────────────────────┘
```

## Configuração obrigatória

| Camada | Configuração profissional |
|---|---|
| Banco principal | RDS PostgreSQL Multi-AZ |
| Alta disponibilidade | Standby em outra zona de disponibilidade |
| Recuperação | Backups automáticos + PITR |
| Disaster recovery | Backups/snapshots em outra região |
| Leitura pesada | Read replica |
| Conexões | RDS Proxy ou PgBouncer |
| Segurança | Banco em subnet privada, sem IP público |
| Criptografia | Em repouso com KMS; em trânsito com TLS |
| Acesso | Security Groups, IAM, usuário por serviço |
| Migrações | CI/CD + staging + rollback |
| Observabilidade | Latência, locks, conexões, replication lag, disco |
| Teste real | Restore mensal em ambiente isolado |

Cloud SQL também é uma ótima alternativa profissional: oferece backups Me diz ai a fase 1 resumjdo

A **Fase 1 resumida** é isto:

> **Um MVP demo de índices sintéticos: usuário entra, vê gráfico em tempo real, abre contrato UP/DOWN com carteira demo, e o sistema liquida automaticamente com ledger auditável — sem dinheiro real.**

## O que entra

| Área | Entrega |
|---|---|
| Login | Keycloak: cadastro, login, MFA, sessões |
| Carteira | Carteira demo de R$ 10.000 + ledger |
| Índice | 1 índice sintético: `SYNTH_VOL_50` |
| Preço | Tick engine próprio com CSPRNG, 1 tick/segundo |
| Gráfico | TradingView Lightweight Charts + WebSocket |
| Operação | Contrato UP/DOWN, 60 segundos, payout 85% |
| Liquidação | Settlement automático no vencimento |
| Dinheiro | Ledger de dupla entrada, append-only |
| Admin | Painel básico: usuários, contratos, ledger, alertas |
| Monitoramento | Prometheus, Grafana, Loki e alertas |

## O que não entra

- Dinheiro real, depósito ou saque.
- KYC/AML formal.
- OTC de BTC/EURUSD.
- Múltiplos índices.
- API pública.
- App nativo.
- Suporte 24/7.

## Fluxo do usuário

```text
Login
  → vê saldo demo
  → vê gráfico em tempo real
  → escolhe UP ou DOWN
  → define stake
  → contrato é criado
  → preço de entrada é registrado
  → aguarda 60 segundos
  → sistema busca tick de saída
  → calcula WIN / LOSS / DRAW
  → liquida automaticamente
  → atualiza saldo e histórico
```

## Arquitetura mínima

```text
React + Lightweight Charts
        |
API + Keycloak
        |
Tick Engine → Redis → WebSocket
        |
PostgreSQL
        |
Ledger + Settlement Worker
```

## Regras fixas

- Preço, resultado e saldo vêm **sempre do backend**.
- Toda operação tem `Idempotency-Key`.
- Ledger é append-only.
- Settlement acontece apenas uma vez.
- Usuário A nunca acessa dados do usuário B.
- Redis caiu? UI fica `STALE`, mas dinheiro continua correto no Postgres.

## Critério de pronto

A Fase 1 está pronta quando:

- 300 WebSockets conectam.
- 50 contratos/minuto funcionam.
- Nenhum settlement duplica.
- Nenhum saldo diverge.
- Nenhum usuário acessa dado alheio.
- Gráfico atualiza em tempo real.
- Alertas detectam falha de tick, settlement e saldo.

É um MVP no sentido estrito: **o menor conjunto de funcionalidades que já entrega valor real e permite validar a ideia** — sem inflar escopo.[1][2][3]


