# Expected output 1

## Deve conter

- Status para os 6 controles
- `FAIL` em S-02, S-03, S-04 e S-05
- `N/A` em S-01 e S-06
- Vetor de ataque e evidência com arquivo e linha em todo achado
- `VEREDITO: REPROVADO`

## Não deve conter

- Bloco de código com a correção
- Sugestão de "esconder" a rota admin como forma de proteção
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 04-security-iam
MODO: REVISÃO
ESCOPO ANALISADO: services/api/routes/contracts.ts

S-01 Keycloak/OIDC     : N/A — fora do trecho analisado
S-02 JWT validation    : FAIL — contracts.ts:2 e :9 usam jwt.decode sem verificar assinatura, iss, aud, exp
S-03 RBAC              : FAIL — contracts.ts:15 autorização por req.body.isAdmin; sem role, sem MFA
S-04 BOLA/IDOR         : FAIL — contracts.ts:3 query sem filtro por user_id; contracts.ts:4 responde 403
S-05 Mass assignment   : FAIL — contracts.ts:10 e :16 repassam req.body inteiro
S-06 Secrets           : N/A — fora do trecho analisado

ACHADOS:
- [CRÍTICO] contracts.ts:2 — token não é validado — vetor: forjar JWT com alg none e qualquer sub
  para agir como qualquer usuário — viola S-02
- [CRÍTICO] contracts.ts:3 — leitura de contrato de qualquer usuário — vetor: iterar ids em
  GET /contracts/{id} — viola S-04
- [CRÍTICO] contracts.ts:10 — spread do body após user_id — vetor: enviar
  {"user_id": "<vítima>", "status": "SETTLED", "entry_price": "1"} — viola S-05 (e I-01 da 02)
- [CRÍTICO] contracts.ts:15 — escalada de privilégio — vetor: enviar {"isAdmin": true} e criar
  reversão financeira arbitrária — viola S-03
- [ALTO] contracts.ts:16 — reversão sem DTO, sem motivo e sem auditoria — viola S-05, S-03
- [MÉDIO] contracts.ts:4 — 403 para recurso inexistente vs. 200 para existente permite enumerar ids — viola S-04
- [MÉDIO] contracts.ts:2 — authorization! sem checagem; header ausente gera 500 em vez de 401 — viola S-02

ENCAMINHAR: fluxo de reversão e chave reversal:{transaction_reference} → 02-financial-invariants

PENDÊNCIAS: valor de acr para MFA — <não definido no contexto>
VEREDITO: REPROVADO
```
