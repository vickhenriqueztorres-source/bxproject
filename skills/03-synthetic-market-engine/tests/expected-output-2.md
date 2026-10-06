# Expected output 2

## Deve conter

- `M-05 Candle OHLCV : FAIL`
- Causa raiz do volume 120 e do close errado
- Referência a `D-04` (Pub/Sub não é fonte de trabalho)
- Encaminhamento para `05-resilience-patterns`
- `VEREDITO: REPROVADO`

## Não deve conter

- Detalhes de `XAUTOCLAIM`, DLQ ou backoff (pertencem à `05`)
- Bloco de código com a correção
- `FAIL` em M-01 a M-04 (fora do trecho analisado)

## Saída de referência

```text
SKILL: 03-synthetic-market-engine
MODO: REVISÃO
ETAPAS: AGREGAÇÃO
ESCOPO ANALISADO: services/candle-worker/worker.ts

M-01 CSPRNG              : N/A — fora do trecho analisado
M-02 Tick sequence       : N/A — fora do trecho analisado
M-03 Persistir→publicar  : N/A — fora do trecho analisado
M-04 Hash encadeado      : N/A — fora do trecho analisado
M-05 Candle OHLCV        : FAIL — worker.ts:1 agrega em Map em memória; worker.ts:9 volume += 1
M-06 WebSocket feed      : N/A — fora do trecho analisado

ACHADOS:
- [ALTO] worker.ts:9 — volume += 1 não é idempotente; com 2 réplicas assinando o mesmo canal,
  cada tick é contado 2 vezes (60 ticks → volume 120) — viola M-05
- [ALTO] worker.ts:8 — close = última mensagem recebida, não o tick de maior sequence;
  mensagem atrasada sobrescreve o close — viola M-05
- [ALTO] worker.ts:2 — Pub/Sub como fonte de trabalho; mensagens perdidas durante reinício
  nunca entram no candle — viola M-05 (D-04)
- [ALTO] worker.ts:11 — upsert grava valores da réplica local; réplicas diferentes sobrescrevem
  open/high/low uma da outra — viola M-05
- [MÉDIO] worker.ts:11 — db.query sem await; erro de escrita é silencioso
- [MÉDIO] worker.ts:6 — Math.max/Math.min sobre preço em ponto flutuante

ENCAMINHAR: consumo via consumer group, XACK após commit e reentrega → 05-resilience-patterns

PENDÊNCIAS: intervalos além de 1m — <não definido no contexto>
VEREDITO: REPROVADO
```
