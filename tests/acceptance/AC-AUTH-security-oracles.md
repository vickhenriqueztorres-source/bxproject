# T13 — critérios oráculo de recuperação e JWT

O alvo é o Fastify real com PostgreSQL `postgres:16-alpine` descartável.
Uma JWKS HTTP local publica uma chave RSA efêmera somente para verificar o
middleware; ela não substitui o teste de integração com Keycloak 26.0.0.

## AC-AUTH-15 / S-01 — pedido de recuperação não divulga conta nem token

- **Dado** um usuário recém-gravado em PostgreSQL real e um email inexistente,
  **quando** cada endereço recebe `POST /api/v1/auth/recovery/request`, **então**
  ambas as respostas têm status 200 e corpo idêntico, sem propriedade `token` e
  sem conter o token gravado no banco para a conta existente.
- **E** a consulta SQL comprova exatamente um token criado para a conta
  existente e zero para o email inexistente.

Teste: `tests/integration/auth-recovery-jwt-security.oracle.test.mjs` —
`[AC-AUTH-15][S-01] recuperação tem resposta uniforme e não divulga token`.

## AC-AUTH-12 / S-02 — API exige JWT RS256 íntegro e claims de access token

- **Dado** o mesmo usuário no banco, **quando** `/api/v1/auth/me` recebe um
  JWT HS256 assinado com o segredo padrão antigo, mesmo contendo `iss`, `aud`
  e `typ` válidos, **então** responde 401 e não retorna o registro privado.
- **Dado** uma chave RSA efêmera publicada por JWKS HTTP local e um JWT RS256
  válido com `iss` do realm de teste, `aud=broker-api`, `typ=Bearer`, `sub`,
  `iat` e `exp`, **quando** `/me` o recebe, **então** responde 200 com o UUID
  do usuário persistido (controle positivo da fixture criptográfica).
- **Dado** a mesma chave, **quando** um JWT RS256 omite separadamente `iss`,
  `aud` ou `typ`, **então** cada variante responde 401 e não retorna o UUID.

Testes: `tests/integration/auth-recovery-jwt-security.oracle.test.mjs` —
`[AC-AUTH-12][S-02] segredo padrão HS256 não autentica`;
`[AC-AUTH-12][S-02] RS256 válido autentica com JWKS de teste`;
`[AC-AUTH-12][S-02] claims iss aud typ são obrigatórias separadamente`.

## Lacuna explícita

Este oráculo usa PostgreSQL real e criptografia real. A prova de claims
emitidos pelo Keycloak 26.0.0 e de todo o fluxo OIDC/PKCE ainda requer o
cenário de integração Keycloak da subetapa 04.
