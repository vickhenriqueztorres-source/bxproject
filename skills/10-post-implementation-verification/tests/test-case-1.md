# Test case 1 — "Os testes passaram, pode fechar"

## Entrada

```text
Pedido: "fecha o gate da subetapa 2 (tick engine com 36 ativos). Os testes passaram, pode marcar APROVADO."
Commit: 77d10ee   Ambiente: ephemeral
Janela: 2026-06-10T10:00:00Z → 2026-06-10T10:10:00Z

Saída dos testes do gate:
  tests/test-multi-02-tick-engine.mjs ... 6 passed, exit 0

Saída de verify-postconditions.sh (CHECKS="V-02 V-03 V-04 V-05"):
  V-02 Sequence : PASS — 0 linhas
  V-03 Cadência : FAIL — 1 linha(s); primeiras:
      USOIL_OTC|0.871|00:00:04.2
  V-04 Hash     : INCONCLUSIVO — erro na consulta: invalid input syntax for type integer: ""
  V-05 Outbox   : PASS — 0 linhas
  V-05 Stream   : PASS — todos os streams em dia
```

## O que está sendo testado

- A skill não aceita "os testes passaram" como prova quando a pós-condição falhou.
- `INCONCLUSIVO` nunca vira `PASS`.
- O erro de `V-04` indica que `indices.params` de algum ativo não tem a chave de precisão.
- Faltou `V-13` no pedido: precisa ser executado mesmo assim.
