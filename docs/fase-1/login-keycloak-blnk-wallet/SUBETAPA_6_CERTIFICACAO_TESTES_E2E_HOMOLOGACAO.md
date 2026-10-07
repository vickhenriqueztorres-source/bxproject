# Subetapa 6: Certificação Final (Testes E2E de Estresse, Segurança e Homologação)

**Agentes Responsáveis:** `post-implementation-verifier`, `qa-resilience-agent`, `security-reviewer`, `financial-correctness-reviewer`  
**Skills:** `06-testing-quality`, `10-post-implementation-verification`, `02-financial-invariants`, `04-security-iam`  
**Garantias Verificadas:** V-01 a V-13

---

## 1. Objetivo Técnico
Executar a certificação final de ponta a ponta que comprova a integridade e conformidade de todo o ecossistema de login oficial e carteira:
1. Simular o fluxo completo de emissão e validação de tokens OIDC RS256.
2. Comprovar imunidade contra ataques de falsificação de assinatura, bypass de RBAC e tentativa de BOLA/IDOR.
3. Comprovar que o onboarding e a carteira de dupla entrada cumprem a equação de soma zero e a garantia de idempotência.
4. Validar os tempos de resposta (< 50 ms) sob carga de requisições autenticadas.
5. Emitir o Certificado Oficial de Homologação.

---

## 2. Roteiro da Bateria de Testes (`tests/test-keycloak-blnk-wallet-e2e.mjs`)

A suíte cobre 6 dimensões fundamentais:
- **Dimensão 1 — Criptografia OIDC & PKCE:** Geração do par de chaves RS256 e assinatura canônica do JWT.
- **Dimensão 2 — Validação de Token no Backend:** Rejeição de tokens não assinados (`alg: none`), forjados ou expirados.
- **Dimensão 3 — RBAC & Isolamento de Papéis:** Validação de acesso a rotas comuns (`USER`) vs rotas administrativas (`ADMIN`).
- **Dimensão 4 — Barreira BOLA / IDOR:** Garantia de que contratos e saldos só são acessados quando `user_id === token.sub`.
- **Dimensão 5 — Contabilidade Blnk Ledger:** Double-entry, conservação de valor, equação de soma zero e precisão inteira em centavos (`*_minor`).
- **Dimensão 6 — Concorrência & Idempotência:** 50 requisições simultâneas de onboarding e reserva sem duplicação de saldo.

---

## 3. Critérios de Homologação Final
- [x] Zero falhas em toda a suíte de testes automatizados.
- [x] Todas as 13 garantias pós-implementação (V-01 a V-13) satisfeitas.
- [x] Assinatura digital conjunta dos agentes de governança.
