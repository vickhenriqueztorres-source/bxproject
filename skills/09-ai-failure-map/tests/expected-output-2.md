# Expected output 2

```text
SUBTASK: T08 — WebSocket Gateway
RISCO IA: ALTO
FALHAS PROVÁVEIS:
  - F-03 — snapshot antes de assinar: ticks perdidos no intervalo
  - F-03 — catch-up sem deduplicar por sequence (repetição ou buraco)
  - F-10 — JWT na query string (vazamento em log); token expirado mantém socket aberto
  - F-02 — sem limite de buffer por cliente (cliente lento derruba o gateway)
  - F-04 — formato do tick diferente do produzido pelo outbox relay
  - F-08 — relatar p95 de 300 conexões sem executar
NÃO DELEGAR (LIMITES):
  - L-02 — teste de 300 WebSockets: sandbox sem Docker; executar no CI/humano com k6 e anexar summary
  - L-01 — ausência de gap no catch-up: oráculo ws-catchup.test.ts no CI
GUARDAS NO PROMPT: assinar → snapshot → flush do buffer com sequence > lastSequence;
                   auth na primeira mensagem ou ticket de uso único; fechar ao expirar;
                   limite de bufferedAmount; tipos de packages/contracts
GUARDAS FORA DO PROMPT: P-01 tick.schema.json validado com zod; P-03 ws-catchup.test.ts;
                        P-05 (token em URL); P-07
EVIDÊNCIA EXIGIDA: ws-catchup verde; k6-summary.json com 300 conexões e thresholds aprovados
REGISTRO TCC: limits_hit [L-01, L-02]
```

## Critérios de reprovação da resposta

- Aceitar que a IA rode e reporte o p95 sem artefato (precisa responder **não** e dizer quem roda).
- Não citar a ordem snapshot/assinatura.
- Não citar o risco do token na query string.
