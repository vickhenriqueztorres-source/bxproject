# Subetapa 03: Conexão Cirúrgica das Telas de Login, Registro e Recuperação

**Responsáveis:** `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`  
**Escopo de Arquivos:**
- `apps/web/src/pages/RegisterPage.tsx`
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/PasswordRecoveryPage.tsx`
- `apps/web/src/pages/auth-pages.unit.test.tsx`

---

## 1. Objetivo Técnico
Substituir a lógica de mock em `LoginPage.tsx`, `RegisterPage.tsx` e `PasswordRecoveryPage.tsx` por chamadas reais a `AuthService`, mantendo estritamente o layout, fidelidade visual, tokens e mensagens em espanhol neutro.

---

## 2. Requisitos por Tela

### 2.1 `RegisterPage.tsx` (`/registro`)
- Ao submeter o formulário:
  - Invoca `await AuthService.register({ name, email, password, country })`.
  - Em caso de sucesso: Redireciona imediatamente para `/operar` com a sessão ativa e US$ 10.000 em saldo demonstrativo.
  - Em caso de e-mail já cadastrado: Exibe mensagem de erro em vermelho: `"Este correo ya está registrado en BINMAX."`.

### 2.2 `LoginPage.tsx` (`/login`)
- Ao submeter o formulário:
  - Invoca `await AuthService.login({ email, password })`.
  - Em caso de sucesso: Redireciona para `/operar` com o usuário autenticado.
  - Em caso de credencial incorreta: Exibe `"Email o contraseña incorrectos."` e incrementa contador de tentativas falhas.
  - Atingindo 5 tentativas falhas: Bloqueia o formulário e exibe o cartão cinza `"Cuenta bloqueada"`.

### 2.3 `PasswordRecoveryPage.tsx` (`/recuperar`)
- Passo 1: Invoca `AuthService.requestPasswordRecovery(email)`. Avança para o Passo 2 com o e-mail exibido.
- Passo 2: Exibe o aviso `"El enlace vence en 15 minutos"` e armazena o token emitido.
- Passo 3: Invoca `AuthService.resetPassword({ token, newPassword })`. Exibe `"Contraseña actualizada con éxito."` e redireciona para `/login`.
- Em seguida, o usuário pode logar com a nova senha imediatamente no `/login`!

---

## 3. Testes Obrigatórios
1. **Fluxo de Registro -> Redirecionamento.**
2. **Fluxo de Login com Sucesso e com Falha.**
3. **Fluxo de Recuperação com Atualização de Senha e Novo Login.**
