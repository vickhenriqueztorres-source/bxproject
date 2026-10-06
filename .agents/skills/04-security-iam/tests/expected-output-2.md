# Expected output 2

## Deve conter

- `FAIL` em S-01 e S-06
- `N/A` em S-02, S-03, S-04 e S-05
- Ação de rotação para a chave Blnk exposta
- `VEREDITO: REPROVADO`

## Não deve conter

- Os valores dos segredos repetidos na saída
- Sugestão de usar `sessionStorage` como solução para token
- `VEREDITO: APROVADO`

## Saída de referência

```text
SKILL: 04-security-iam
MODO: REVISÃO
ESCOPO ANALISADO: apps/web/src/auth.ts, infra/keycloak/realm-export.json, docker-compose.yml

S-01 Keycloak/OIDC     : FAIL — auth.ts:5 implicit flow; realm-export.json:4-7 implicit, password grant e curingas
S-02 JWT validation    : N/A — fora do trecho analisado
S-03 RBAC              : N/A — fora do trecho analisado
S-04 BOLA/IDOR         : N/A — fora do trecho analisado
S-05 Mass assignment   : N/A — fora do trecho analisado
S-06 Secrets           : FAIL — docker-compose.yml:5, :8, :9, :12 segredos literais; :12 no bundle do front

ACHADOS:
- [CRÍTICO] docker-compose.yml:12 — chave do Blnk em VITE_* é embutida no JS público —
  vetor: qualquer visitante lê a chave e movimenta o ledger direto — viola S-06
- [CRÍTICO] docker-compose.yml:9 — chave Blnk de produção versionada — vetor: acesso ao repositório — viola S-06
  AÇÃO: rotacionar a chave antes de qualquer outra correção
- [ALTO] auth.ts:6 e :8 — access token em localStorage — vetor: qualquer XSS exfiltra o token — viola S-01
- [ALTO] auth.ts:5 + realm-export.json:4 — implicit flow, token na URL, sem PKCE — vetor: vazamento por
  histórico, Referer e logs — viola S-01
- [ALTO] realm-export.json:6-7 — redirectUris/webOrigins "*" — vetor: open redirect entrega o código
  para domínio do atacante — viola S-01
- [ALTO] realm-export.json:5 — Direct Access Grants ligado — vetor: login por senha fora do fluxo com MFA — viola S-01
- [ALTO] docker-compose.yml:8 — API conectando como superusuário postgres — viola S-06 (menor privilégio)
- [MÉDIO] docker-compose.yml:5 — senha admin fraca e literal no Keycloak — viola S-06

PENDÊNCIAS: gerenciador de segredos de staging/prod — <não definido no contexto>
VEREDITO: REPROVADO
```
