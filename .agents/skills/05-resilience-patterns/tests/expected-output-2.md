# Expected output 2

## Deve conter

- `FAIL` em R-02, R-03, R-05 e R-06
- `N/A` em R-01 e R-04
- Causa raiz do sintoma "EXPIRING para sempre"
- Encaminhamento para `02-financial-invariants`
- `VEREDITO: REPROVADO`

## Não deve conter

- Avaliação das invariantes I-01 a I-06 (pertencem à `02`)
- Bloco de código com a correção
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 05-resilience-patterns
MODO: REVISÃO
DEPENDÊNCIAS: Redis Streams, PostgreSQL (via settle)
ESCOPO ANALISADO: services/settlement-worker/consumer.ts

R-01 Outbox            : N/A — fora do trecho analisado
R-02 Retry + backoff   : FAIL — consumer.ts:6 qualquer erro tratado igual; sem tentativa nem backoff
R-03 Timeout           : FAIL — consumer.ts:1 BLOCK 0 espera indefinidamente
R-04 Circuit breaker   : N/A — sem chamada externa direta no trecho
R-05 DLQ               : FAIL — consumer.ts:7 erro apenas logado; mensagem descartada
R-06 Consumer groups   : FAIL — consumer.ts:3 XACK antes de settle(); consumer.ts:1 nome fixo; sem XAUTOCLAIM

ACHADOS:
- [CRÍTICO] consumer.ts:3 — XACK antes do processamento — cenário: settle() lança erro ou o pod é
  encerrado no deploy; a mensagem já foi confirmada e nunca é reentregue; contrato fica EXPIRING
  para sempre (sintoma relatado) — viola R-06
- [ALTO] consumer.ts:1 — todas as réplicas usam o consumidor 'worker' — cenário: pendentes de um pod
  morto parecem pertencer aos vivos e não são recuperados de forma confiável — viola R-06
- [ALTO] consumer.ts — sem loop de XAUTOCLAIM — cenário: mensagens lidas por um pod que morreu
  ficam pendentes para sempre — viola R-06
- [ALTO] consumer.ts:7 — erro engolido, sem DLQ nem métrica — cenário: falha persistente invisível — viola R-05
- [MÉDIO] consumer.ts:1 — BLOCK 0 — cenário: SIGTERM no deploy não interrompe a leitura;
  pod é morto à força no meio do lote — viola R-03
- [MÉDIO] consumer.ts:1 — leitura única, fora de loop; processa um lote e encerra — viola R-06
- [MÉDIO] consumer.ts:6 — erro transitório e permanente tratados igual — viola R-02

ENCAMINHAR: idempotência e FOR UPDATE dentro de settle() → 02-financial-invariants (I-03, I-04)

PENDÊNCIAS: nenhuma
VEREDITO: REPROVADO
```
