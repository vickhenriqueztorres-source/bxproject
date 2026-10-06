# Alta disponibilidade e recuperação de desastre

## RPO e RTO por cenário (PROPOSTO)

O valor geral alinhado com a `07` é RPO ≤ 5 min e RTO ≤ 1 h (PROPOSTO). Por cenário:

| Cenário | RPO | RTO | Mecanismo |
|---------|-----|-----|-----------|
| Falha da instância ou da AZ | 0 | 1 a 2 min | Failover Multi-AZ (standby síncrono) |
| Bug ou migration corrompe dados | Até o instante anterior ao evento | ≤ 1 h | PITR para **nova** instância + extração do dado |
| `DROP` ou `DELETE` acidental (owner) | Até o instante anterior ao evento | ≤ 1 h | PITR para nova instância |
| Perda da região | Minutos | Horas | Backups automáticos replicados cross-region |
| Conta AWS comprometida / ransomware | ≤ 24 h | Horas | Cópia diária no cofre cross-account com Vault Lock |

## Multi-AZ

| Item | Comportamento | O que a aplicação precisa fazer |
|------|---------------|--------------------------------|
| Replicação | Síncrona para o standby em outra AZ | Nada: commit confirmado já está nas duas AZs |
| Failover | Automático, em geral 60 a 120 s; o DNS do endpoint muda | Reconectar com backoff (R-03); o RDS Proxy encurta a janela |
| Durante o failover | Escrita e leitura falham | API devolve `503`; Tick Engine **não** publica; a UI mostra `STALE` |
| Commit em andamento | Resultado desconhecido para o cliente | Repetir com a mesma `Idempotency-Key`/`dedupe_key` |
| Standby | Não aceita leitura | Leitura extra vai para a réplica |
| Manutenção de SO | Aplicada primeiro no standby, depois failover | Janela fora do pico; avisar o plantão |

### Checklist após qualquer failover

1. O Tick Engine voltou? `ticks` cresce de novo e a `sequence` continua sem buraco.
2. A cadeia de hash fecha (`M-04`) no intervalo do failover.
3. Contratos em `EXPIRING` ou `FAILED_RETRYABLE` estão sendo drenados pelo varredor.
4. O backlog da `outbox` (`published_at IS NULL`) está diminuindo.
5. A reconciliação (`I-05`) roda manualmente e fecha com divergência 0.
6. O evento é registrado no runbook com duração e impacto.

### Ensaio em staging (mensal, PROPOSTO)

`Reboot with failover` com carga sintética rodando: 50 contratos/min e WebSockets abertos. Critério: nenhum settlement duplicado, nenhum saldo divergente, recuperação automática sem intervenção e tempo medido. O ensaio entra no catálogo de caos da `06-testing-quality`.

## Read replica

**Não é obrigatória na Fase 1.** Criar quando a CPU da primária ficar acima de 60% por leitura, ou quando surgir relatório pesado.

| Pode ler da réplica | **Nunca** ler da réplica |
|---------------------|--------------------------|
| `GET /candles` e histórico do gráfico | Tick de entrada na abertura de contrato |
| Listagens do admin, **com aviso de atraso** | Tick de saída no settlement (B-08) |
| Relatórios e consultas do `auditor_ro` | Conferência de `Idempotency-Key` |
| Exportações | Reconciliação (`I-05`) |
| | `GET /contracts/{id}` logo depois do `POST` (read-your-writes) |
| | Qualquer leitura seguida de escrita |

Regras da réplica: alerta `PostgresReplicaLagHigh` (> 30 s); a réplica tem o próprio endpoint e as roles de leitura apontam para ele por configuração; se a réplica cair, a leitura volta para a primária de forma explícita, nunca silenciosa.

## Backups

| Camada | Configuração (PROPOSTO) |
|--------|--------------------------|
| Backups automáticos | Retenção de 30 dias (o máximo do RDS é 35); janela fora do pico |
| PITR | Para qualquer segundo dentro da retenção. Os logs vão para o storage do RDS em intervalos de minutos |
| Cross-region | Replicação dos backups automáticos para a região secundária (`<não definido no contexto>`) |
| Cofre imutável | AWS Backup: cópia diária para um cofre em **outra conta**, com Vault Lock em modo compliance |
| Snapshot manual | Antes de toda migration de risco e de todo major upgrade |
| Snapshot final | Obrigatório (`skip_final_snapshot = false`) |
| Proteção | `deletion_protection = true`; delete e modify geram alerta via CloudTrail |
| Criptografia | Todos os backups criptografados com CMK; uma CMK por região |

O PITR restaura a **instância inteira** num instante só. Como `synth`, `blnk` e `keycloak` vivem juntos, os três voltam coerentes, como O-05 exige.

## O que restore **não** é

- **Não é rollback de deploy.** Restaurar perde todo contrato e toda transação posterior (O-06).
- **Não é correção de saldo.** Correção é transação reversa (`I-06`) registrada em `admin_reversals`.
- **Não sobrescreve produção.** O restore sempre cria uma **nova** instância. Se for preciso trocar de instância, a troca é uma decisão de incidente, com freeze de escrita.

## Runbook — restore (drill mensal e incidente)

1. **Escolher o instante.** Incidente: o último segundo antes do evento, tirado do pgaudit ou dos logs. Drill: um instante aleatório das últimas 24 h.
2. **Restaurar** via PITR para uma instância nova, numa VPC isolada, com SG fechado e parameter group de prod.
3. **Conferir a estrutura:** versão das migrations aplicadas igual à de prod naquele instante; roles e grants presentes.
4. **Conferir a integridade:**
   - Cadeia de hash dos ticks (`M-04`) do gênese até o último tick restaurado.
   - `SELECT count(*) FROM contracts WHERE status = 'SETTLED' AND result IS NULL`, que precisa dar 0 (a constraint garante; conferir mesmo assim).
   - Reconciliação (`I-05`) contra o `blnk` restaurado no mesmo instante, com divergência 0.
   - `wallet_accounts` × usuários do `keycloak` restaurado, sem órfãos.
5. **Medir:** tempo total contra o RTO e dados perdidos contra o RPO.
6. **Registrar** em `runbooks/restore.md` (O-05): data, instante restaurado, tempos, resultado e problemas.
7. **Destruir** a instância do drill. Em incidente, seguir o plano decidido no passo 1.

Drill que falha em qualquer passo do 3 ao 5 gera um incidente `ALTO`, mesmo sem impacto em produção.

## Região secundária

Na Fase 1 não existe standby quente em outra região: o DR regional é feito por restore. Promover a região secundária exige restaurar o banco, subir os serviços, apontar o DNS e rodar o checklist completo. Ensaio: `<não definido no contexto>` (sugestão: semestral).
