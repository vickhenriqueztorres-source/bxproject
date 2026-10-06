# Exemplo 1 — Gate da Subetapa 4 reprovado por contratos presos

## Entrada

```text
Pedido: "fecha o gate da subetapa 4 (contratos multi-ativos). Os testes passaram."
Commit: 4b7e0d2
Ambiente: ephemeral (docker compose -p verify-4b7e0d2)
Janela: 2026-06-10T14:02:00Z → 2026-06-10T14:10:00Z
Ativos: 36 do catálogo; SYNTH_VOL_10 pausado às 14:05:00 pelo próprio teste
```

## Execução

1. Garantias da subetapa 4 (matriz do `api-guide`): `V-07`, `V-08`, `V-09`, `V-10`, `V-13`.
2. `health-check.sh before` (fingerprint do agente `post-implementation-verifier`).
3. Testes do gate, sem alteração:

```text
$ pnpm vitest run tests/integration/contracts-multi-asset.test.ts
 ✓ [V-07] liquida BTCUSD_OTC só com tick de BTCUSD_OTC (412 ms)
 ✓ [V-10] rejeita POST /contracts em ativo PAUSED (88 ms)
 ✓ [I-03] mesma Idempotency-Key 20× em paralelo → 1 contrato (1.2 s)
 Test Files  1 passed (1)   Tests  3 passed (3)
exit 0
```

4. Pós-condições no banco:

```text
$ CHECKS="V-07 V-08 V-09 V-10" ENVIRONMENT=ephemeral ... bash scripts/verify-postconditions.sh
V-07 Anti-cross   : PASS — 0 linhas
V-08 Prazo        : FAIL — 312 linha(s); primeiras:
    5f1c…|EURUSD_OTC|FAILED_RETRYABLE|2026-06-10 14:03:11+00|
    8a20…|EURUSD_OTC|FAILED_RETRYABLE|2026-06-10 14:03:12+00|
    0c9d…|GBPUSD_OTC|FAILED_RETRYABLE|2026-06-10 14:03:12+00|
V-09 Reconciliação : PASS — OK, divergência 0
V-09 Payout L/D   : PASS — 0 linhas
V-09 Payout WIN   : PENDENTE — D-19 (arredondamento) não decidida
V-10 Pausado      : PASS — 0 linhas
Resultado: REPROVADO (1 FAIL, 0 INCONCLUSIVO)
```

5. Diagnóstico mínimo (só leitura): os 312 contratos são todos de ativos Forex; nenhum de Cripto.

```sql
SELECT symbol, count(*) FROM contracts
WHERE status = 'FAILED_RETRYABLE' GROUP BY symbol ORDER BY 2 DESC;
```

## Saída

```text
SKILL: 10-post-implementation-verification
MODO: GATE
COMMIT: 4b7e0d2
AMBIENTE: ephemeral
JANELA: 2026-06-10T14:02:00Z → 2026-06-10T14:10:00Z
ESCOPO: Subetapa 4 — contratos e settlement multi-ativos

V-07 Anti-cross  : PASS — 0 linhas; 9.814 SETTLED na janela
V-08 Prazo       : FAIL — 312 contratos em FAILED_RETRYABLE há > 10 s, todos Forex
V-09 Dinheiro    : PASS (reconciliação OK, LOSS/DRAW) · PENDENTE (WIN, D-19)
V-10 Pausado     : PASS — 0 contratos criados em SYNTH_VOL_10 depois de 14:05:00
V-13 Integridade : PASS — fingerprint antes = depois

FALHAS:
- V-08 — 312 contratos presos, só ativos Forex — reprodução: consulta V-08 do api-guide com a mesma
  janela — destino: bug-fix-agent (hipótese a confirmar: seleção do tick de saída ou da precisão
  específica de Forex; o verificador não corrige)

PENDÊNCIAS: D-19
VEREDITO: REPROVADO
```

## Por que este é o comportamento certo

- Os testes passaram, mas não cobriam ativos Forex na liquidação. A pós-condição no banco pegou.
- `V-07` passou porque **não** houve cruzamento: o problema é liquidação travada, não errada.
- A reconciliação fechou porque contrato preso ainda está reservado; dinheiro certo não prova prazo cumprido.
- O verificador não abre o código para "consertar rápido": registra a reprodução e entrega ao `bug-fix-agent`.
