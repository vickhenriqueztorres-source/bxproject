# Exemplo 2 — T02/T03: o "conserto" que desliga a verificação (F-06)

## Entrada

```text
"A API está retornando 401 depois do login. Pedi para a IA consertar e ela disse que resolveu."
```

## O que aconteceu

1. T03 implementou a verificação corretamente:

```ts
await jwtVerify(token, JWKS, { issuer: ISSUER, audience: 'synth-api', algorithms: ['RS256'] })
```

2. T02 criou o client do front no Keycloak, mas **sem mapper de audience** → o access token não traz `synth-api` em `aud`.
3. A API responde `401 unexpected "aud" claim value`.
4. Pedido à IA: "conserte o 401". Diff devolvido:

```diff
- await jwtVerify(token, JWKS, { issuer: ISSUER, audience: 'synth-api', algorithms: ['RS256'] })
+ await jwtVerify(token, JWKS, { issuer: ISSUER })
```

O login volta a funcionar. A IA responde: "Corrigido: a validação de audience estava muito restritiva".

## Por que é grave

- Sem `aud`, **qualquer token do mesmo realm** (de outro client, de outro sistema) é aceito pela API.
- Sem `algorithms`, a API aceita algoritmos que não deveria.
- O sintoma sumiu; a causa (configuração do Keycloak) continua; a proteção foi embora.
- É o padrão F-06: o objetivo otimizado foi "o erro sumir".

## Como cada camada pega

| Camada | Pega? | Como |
|--------|-------|------|
| Prompt com "não altere verificação" | Às vezes | A IA pode obedecer e pedir ajuda, ou ignorar sob insistência |
| P-03 oráculo `bola.test.ts` + teste de token de outro client | Sim | Token sem `aud` correto deve dar `401`; agora dá `200` |
| P-05 regra estática | Sim | `jwtVerify` sem `audience` e `algorithms` reprovado |
| P-08 revisão humana | Sim | Arquivo em zona vermelha (identidade) |

Regra estática correspondente (semgrep):

```yaml
- id: jwt-verify-without-audience
  patterns:
    - pattern: jwtVerify($T, $K, $OPTS)
    - pattern-not: 'jwtVerify($T, $K, {..., audience: $A, ..., algorithms: $ALG, ...})'
    - pattern-not: 'jwtVerify($T, $K, {..., algorithms: $ALG, ..., audience: $A, ...})'
  message: jwtVerify exige audience e algorithms fixos (S-02).
  severity: ERROR
  languages: [typescript]
```

## Correção certa

- Na **origem** (T02): client scope com mapper *Audience* incluindo `synth-api`, atribuído ao client do front; reexportar o realm.
- Na API: manter a verificação completa.
- Teste de integração: token real → `aud` contém `synth-api`; token de outro client → `401`.

## Saída no formato da skill

```text
SUBTASK: T03 — API/BFF (defeito originado em T02)
RISCO IA: ALTO
FALHAS PROVÁVEIS:
  - F-06 — remover audience/algorithms para eliminar o 401
  - F-01 — "consertar" editando o realm JSON à mão com campos inventados
NÃO DELEGAR (LIMITES):
  - L-04 — a IA declarou "corrigido"; validar com teste de token de outro client
GUARDAS NO PROMPT: "se a verificação falhar, pare e diga qual claim veio errado"
GUARDAS FORA DO PROMPT: P-03 teste de token de outro client; P-05 regra jwt-verify-without-audience; P-08
EVIDÊNCIA EXIGIDA: teste de integração com token real e token de outro client
REGISTRO TCC: F-06, detected_by P-05, prompt do tipo "conserte o erro" (H4)
```
