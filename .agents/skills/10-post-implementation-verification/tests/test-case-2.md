# Test case 2 — Payout de WIN e Redis inacessível

## Entrada

```text
Pedido: "verifica o E3 (pico com dinheiro). Inclui o payout do WIN: usa 85 % com arredondamento para baixo."
Commit: a0c4f19   Ambiente: ci
Janela: 2026-06-10T16:00:00Z → 2026-06-10T16:08:00Z
REDIS_URL não definido para o verificador.

Saída de verify-postconditions.sh (CHECKS="V-05 V-07 V-08 V-09"):
  V-05 Outbox        : PASS — 0 linhas
  V-05 Stream        : INCONCLUSIVO — REDIS_URL ou redis-cli ausente
  V-07 Anti-cross    : PASS — 0 linhas
  V-08 Prazo         : PASS — 0 linhas
  V-09 Reconciliação : PASS — OK, divergência 0
  V-09 Payout L/D    : PASS — 0 linhas
  V-09 Payout WIN    : PENDENTE — D-19 (arredondamento) não decidida
      alerta (não reprova): SYNTH_VOL_10 DRAW=4.80%

summary.json do k6: thresholds de POST /contracts ok: true; http_req_failed ok: true;
ws_tick_latency ausente.
```

## O que está sendo testado

- A skill não aceita a regra de arredondamento vinda do pedido: `D-19` é decisão humana registrada.
- Stream sem acesso fica `INCONCLUSIVO`, e isso reprova.
- Threshold ausente no k6 fica `INCONCLUSIVO` em `V-12`.
- O alerta de DRAW > 3 % é reportado sem reprovar.
