# Subetapa 04: Bateria Integrada de Testes de Estresse, Caos, Segurança e E2E

**Responsáveis:** `qa-resilience-agent`, `security-reviewer`, `financial-correctness-reviewer`, `post-implementation-verifier`  
**Escopo de Arquivos:**
- `apps/web/src/pages/auth-full-lifecycle-e2e.unit.test.tsx`
- `tests/unit/auth-security-chaos.test.ts`

---

## 1. Objetivo Técnico
Certificar formalmente a robustez de ponta a ponta do sistema de autenticação, validando:
1. Ciclo de vida completo: Registro de nova conta -> Login com credenciais cadastradas -> Recuperação de senha com token de 15 minutos -> Redefinição de senha -> Login com a nova senha -> Bloqueio de login com a senha antiga -> Saldo demonstrativo de US$ 10.000 preservado.
2. Testes de estresse com múltiplas operações concorrentes.
3. Testes de caos com tokens expirados ou malformados.
4. Testes de segurança contra injeção e brute-force.
5. Verificação de não-regressão na suíte completa de testes da plataforma.

---

## 2. Cenários de Teste

### 2.1 E2E: Ciclo de Vida Completo do Usuário
1. Criar novo usuário `test-trader@binmax.com` com senha `StrongPass@2026`.
2. Verificar que a sessão foi inicializada e saldo demo é exatamente `$10,000.00` (`1000000` centavos).
3. Efetuar logout.
4. Fazer login com `test-trader@binmax.com` e senha correta `StrongPass@2026` -> Sucesso.
5. Solicitar recuperação de senha para `test-trader@binmax.com` -> Recebe token válido por 15m.
6. Redefinir senha para `NewStrongPass@2026` usando o token.
7. Tentar login com a senha antiga `StrongPass@2026` -> Rejeitado com erro 401 / credenciais inválidas.
8. Fazer login com a nova senha `NewStrongPass@2026` -> Sucesso absoluto!

### 2.2 Estresse
- Executar 50 cadastros com e-mails distintos em sequência rápida.
- Executar 50 logins simultâneos sem vazamento de memória ou locks residuais.

### 2.3 Caos & Segurança
- Tentar redefinir senha com token expirado (>15 minutos) -> Rejeitado.
- Tentar reusar token já utilizado anteriormente -> Rejeitado.
- Tentar 5 logins consecutivos com senha incorreta -> Bloqueio temporário da conta.
- Injeção de caracteres especiais e tags HTML nos campos de cadastro -> Sanitização total sem execução.
