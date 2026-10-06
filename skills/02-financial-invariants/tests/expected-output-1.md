# Expected output 1

## Deve conter

- Status para as 6 invariantes
- `FAIL` em I-01, I-02, I-03 e I-04
- Evidência com arquivo e linha em todo `FAIL`
- `VEREDITO: REPROVADO`

## Não deve conter

- Bloco de código com a correção
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 02-financial-invariants
MODO: REVISÃO
ESCOPO ANALISADO: services/settlement-worker/settle.ts

I-01 Append-only     : FAIL — settle.ts:7 atualiza saldo com UPDATE wallets
I-02 Double-entry    : FAIL — settle.ts:10 transação Blnk sem source/destination
I-03 Idempotência    : FAIL — settle.ts:10 reference = randomUUID()
I-04 ACID            : FAIL — settle.ts:2 lê contrato sem FOR UPDATE; não verifica SETTLED
I-05 Reconciliação   : N/A — fora do trecho analisado
I-06 Reversão        : N/A — fora do trecho analisado

ACHADOS:
- [CRÍTICO] settle.ts:7 — saldo mutável fora do ledger; crédito de 1,85 × stake
  soma stake + lucro em uma única linha sem origem — viola I-01, I-02
- [CRÍTICO] settle.ts:10 — retry gera novo efeito financeiro — viola I-03
- [CRÍTICO] settle.ts:2 — duas execuções concorrentes liquidam o mesmo contrato — viola I-04
- [ALTO] settle.ts:5 — DRAW (saída = entrada) classificado como LOSS — fluxo DRAW ausente
- [ALTO] settle.ts:3 — sem tratamento quando não há tick de saída (deve NACK + retry)
- [ALTO] settle.ts:11 — status SETTLED gravado depois da chamada externa, fora de transação

VEREDITO: REPROVADO
```
