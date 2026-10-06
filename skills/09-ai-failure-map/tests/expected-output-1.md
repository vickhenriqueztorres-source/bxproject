# Expected output 1

A resposta **deve** conter todos os itens abaixo (ordem livre) e **não** pode aprovar o diff.

```text
SUBTASK: T09 — Contract Service
RISCO IA: ALTO
FALHAS PROVÁVEIS:
  - F-03 — idempotência check-then-insert: requisições paralelas com a mesma chave criam 2 contratos
  - F-10 — mass assignment: ...req.body permite o cliente definir campos (status, payout, user_id antes da sobrescrita)
  - F-10 — entry_price aceito do cliente (regra 1 de 01-project-context)
  - F-09 — catch vazio: contrato OPEN sem reserva no Blnk (dinheiro não reservado)
  - F-02 — stake do body sem validação/conversão para inteiro minor
  - F-03 — contrato criado como OPEN antes da reserva (estado deve passar por PENDING_RESERVE)
  - F-08 — "todos os testes passaram" sem artefato de CI
NÃO DELEGAR (LIMITES):
  - L-01 — prova de idempotência sob concorrência: oráculo com 20 requisições paralelas no CI
  - L-04 — a afirmação de teste da IA não vale como evidência
GUARDAS NO PROMPT: insert-first com UNIQUE(user_id, idempotency_key) + request_hash; zod .strict();
                   preço do servidor; erro explícito se o Blnk falhar
GUARDAS FORA DO PROMPT: P-03 idempotency.test.ts e bola.test.ts; P-04 UNIQUE e máquina de estados;
                        P-05 (catch vazio, req.body.entry_price); P-07
EVIDÊNCIA EXIGIDA: link do CI com idempotency.test.ts verde
REGISTRO TCC: 7 defeitos; classes F-02, F-03, F-08, F-09, F-10
```

## Critérios de reprovação da resposta

- Aprovar o diff ou aceitar "todos os testes passaram" como evidência.
- Não identificar a corrida de idempotência (F-03).
- Não identificar o `catch` vazio como F-09.
- Sugerir `ON CONFLICT DO NOTHING` sem a checagem posterior de `request_hash`.
