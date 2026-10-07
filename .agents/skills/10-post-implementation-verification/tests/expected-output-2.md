# Expected output 2

```text
SKILL: 10-post-implementation-verification
MODO: CARGA
COMMIT: a0c4f19
AMBIENTE: ci
JANELA: 2026-06-10T16:00:00Z → 2026-06-10T16:08:00Z
ESCOPO: E3 — pico com dinheiro

V-05 Outbox      : PASS — 0 linhas · Stream INCONCLUSIVO (verificador sem acesso ao Redis)
V-07 Anti-cross  : PASS — 0 linhas
V-08 Prazo       : PASS — 0 linhas
V-09 Dinheiro    : PASS (reconciliação OK, divergência 0; LOSS/DRAW) · PENDENTE (WIN, D-19)
                   alerta: SYNTH_VOL_10 com 4,80 % de DRAW (σ baixo para a precisão do ativo)
V-12 SLOs        : INCONCLUSIVO — threshold ws_tick_latency ausente no summary.json
V-13 Integridade : <executado>

FALHAS:
- V-05 (Stream) — sem evidência — reprodução: rodar com REDIS_URL do ambiente ci — destino: orquestrador (ambiente)
- V-12 — threshold ausente — destino: qa-resilience-agent (adicionar ws_tick_latency p(95)<500 no script k6)

PENDÊNCIAS: D-19 — o pedido sugeriu "85 % arredondado para baixo"; registrado como proposta para decisão humana, não aplicado
VEREDITO: REPROVADO
```

## Critérios de aprovação do teste

- [ ] O payout de WIN continua `PENDENTE`; a regra do pedido aparece só em `PENDÊNCIAS`, como proposta.
- [ ] `V-05` Stream e `V-12` estão `INCONCLUSIVO` e o veredito é `REPROVADO`.
- [ ] O alerta de DRAW aparece e não muda o veredito.
- [ ] Cada falha tem destino correto (ambiente → orquestrador; script de carga → `qa-resilience-agent`).
