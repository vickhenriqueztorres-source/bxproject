# Exemplo 2 — Failover Multi-AZ durante liquidação (modo revisão pós-incidente)

## Entrada

> "Às 14:03:10 o RDS fez failover e voltou às 14:04:42. Teve 37 contratos vencendo nesse intervalo. Os usuários reclamaram que o gráfico parou. Precisa de alguma correção no banco?"

## Linha do tempo

| Hora | Evento | O que o banco garantiu |
|------|--------|------------------------|
| 14:03:10 | Primária indisponível | Commits confirmados até aqui estão no standby (replicação síncrona) |
| 14:03:10–14:04:42 | Tick Engine falha ao persistir | Sem persistência não há publicação (`D-08`); a UI mostra `STALE` |
| 14:03:10–14:04:42 | `POST /contracts` devolve `503` | Nenhum contrato aberto sem tick de entrada oficial |
| 14:03:51 | Um `COMMIT` da API perde a conexão | O cliente repetiu com a mesma `Idempotency-Key` e o `UNIQUE` devolveu o contrato existente |
| 14:04:42 | Standby promovido | `sequence` continua de onde parou; a cadeia de hash segue intacta |
| 14:04:43 | Primeiro tick pós-failover | É o tick de saída dos 37 contratos (primeiro com `ts >= expires_at`, B-08) |
| 14:04:43–14:05:20 | Varredor drena `EXPIRING` | `FOR UPDATE SKIP LOCKED`; nenhuma liquidação duplicada |

## Verificações executadas

```sql
-- 1. sequence sem buraco no intervalo
SELECT count(*) = max(sequence) - min(sequence) + 1 AS sem_buraco
  FROM ticks WHERE symbol = 'SYNTH_VOL_50'
   AND ts BETWEEN '2026-03-10 14:00:00+00' AND '2026-03-10 14:10:00+00';

-- 2. contratos presos
SELECT status, count(*) FROM contracts
 WHERE expires_at BETWEEN '2026-03-10 14:03:10+00' AND '2026-03-10 14:04:42+00'
 GROUP BY status;                                     -- esperado: só SETTLED

-- 3. todos liquidaram com o mesmo primeiro tick após o retorno
SELECT exit_sequence, count(*) FROM contracts
 WHERE expires_at BETWEEN '2026-03-10 14:03:10+00' AND '2026-03-10 14:04:42+00'
 GROUP BY exit_sequence;

-- 4. outbox drenada
SELECT count(*) FROM outbox WHERE published_at IS NULL;   -- esperado: ~0
```

Também rodados: verificação da cadeia de hash (`M-04`) e reconciliação manual (`I-05`), que fechou com divergência 0.

## Saída

```text
SKILL: 08-database-foundation
MODO: REVISÃO
AMBIENTE: prod
ESCOPO ANALISADO: evento RDS 14:03:10–14:04:42, ticks, contracts, outbox, reconciliation_runs

DB-01 Topologia e rede      : PASS — failover automático para a outra AZ
DB-02 Tipos                 : N/A
DB-03 Integridade           : PASS — 37/37 SETTLED; exit tick é o primeiro após expires_at (trigger)
DB-04 Append-only           : PASS — nenhum tick reescrito; cadeia de hash fecha
DB-05 Menor privilégio      : N/A
DB-06 Isolamento (RLS)      : N/A
DB-07 Transações            : PASS — commit incerto resolvido por Idempotency-Key; SKIP LOCKED sem duplicação
DB-08 Réplica               : PASS — settlement leu da primária
DB-09 Conexões              : FAIL — Chart API levou 40 s a mais para reconectar (pool sem validação)
DB-10 Criptografia/segredos : N/A
DB-11 Migrations            : N/A
DB-12 Backup/DR             : PASS — RPO 0; RTO 92 s
DB-13 Observabilidade       : PASS — RDSFailoverOccurred disparou às 14:03:12
DB-14 Retenção              : N/A

ACHADOS:
- [MÉDIO] services/chart-api/src/db.ts:12 — pool sem validação de conexão e sem timeout de
  conexão — impacto: gráfico ficou STALE 40 s além do failover — viola DB-09

MIGRATION: N/A
PENDÊNCIAS: nenhuma
VEREDITO: APROVADO — nenhuma correção de dado necessária; corrigir o pool da Chart API
```

## O que **não** fazer neste incidente

- Inventar ticks "interpolados" para o intervalo: o preço oficial só nasce no Tick Engine (`D-06`).
- Liquidar os 37 contratos como DRAW "porque não teve tick".
- Restaurar backup "para garantir": o failover não perdeu nada e o restore perderia o que veio depois.
