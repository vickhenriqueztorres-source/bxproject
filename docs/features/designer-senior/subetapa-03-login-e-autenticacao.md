# Subetapa 03 — Login e Autenticação (Ambiente de Confiança Bancária Suíça)

> **Filosofia:** A pessoa está decidindo confiar, não operando. Espaço, respiração generosa, foco unitário, honestidade de copy e zero elementos de joguinho.

---

## 1. Escopo de Arquivos

### Arquivos Permitidos:
- `apps/web/src/pages/LoginPage.tsx` (Refinamento de layout, tipografia e microinterações)
- `apps/web/src/pages/PasswordRecoveryPage.tsx` (Refinamento de foco e consistência)
- `apps/web/src/pages/RegisterPage.tsx` (Alinhamento visual e semântico)
- `apps/web/src/pages/auth-precision-stress.unit.test.tsx` (Testes de estresse, segurança e UX)

### Arquivos Proibidos:
- Qualquer alteração nos fluxos de token JWT, OIDC, PKCE ou Keycloak.

---

## 2. Passo a Passo de Implementação

1. **Copywriting Alinhado ao Posicionamento**:
   - Ajustar as headlines principais para a tese do The Hunter e The Harvester:
     - *"A Binmax é a plataforma onde o gráfico obedece ao seu clique, não ao algoritmo da casa."*
     - *"Precisão cirúrgica. Latência real de 16ms. Saque transparente via PIX."*
   - Eliminar termos sensacionalistas de dinheiro fácil.

2. **Física de Entrada e Microinterações**:
   - Entrada de página: o conteúdo aparece em um bloco só com opacidade e 16px de subida em 260ms (`--bm-t-enter`). Sem efeito cascata (stagger) de 20 elementos.
   - Hover em botões primários: o fundo clareia 6% em 100ms (`--bm-t-micro`). Sem aumentar de tamanho, sem sombra neon.
   - Foco por teclado: anel de 2px de precisão sem animação.
   - Clique: afunda 1px em 100ms.

3. **Tratamento Cirúrgico de Erros**:
   - Quando o login ou validação falhar: mensagem surge com fade de 180ms abaixo do campo e borda assume vermelho em 100ms.
   - **O campo NUNCA balança.** A animação de tremor (*shake*) é proibida por infantilizar o produto.

4. **Os 5 Estados**:
   - Vazio (Campos limpos com labels menores e cinzas)
   - Preenchido (Tipografia nítida)
   - Carregando / Autenticando (Botão com estado ocupado discreto sem spinners psicodélicos)
   - Erro (Borda vermelha e mensagem legível)
   - Sucesso (Transição suave em 180ms para o redirecionamento)

---

## 3. Matriz de Testes

### 3.1 Testes Unitários
- Renderização dos 5 estados de formulário.
- Ausência de classes de `@keyframes shake` e validação do feedback estático.
- Presença das cópias institucionais corretas.

### 3.2 Testes de Estresse
- Submissão rápida repetida (spam de clique): desativação síncrona do botão para evitar duplo envio (D-12 / I-04).

### 3.3 Testes de Caos
- Timeout de rede na autenticação: transição para estado de erro elegante sem travar o estado do formulário.

### 3.4 Testes de Segurança
- Sanitização de campos de senha e mascaramento adequado.
- Garantia de que tokens de autenticação não vazem no DOM ou em atributos `data-*`.

---

## 4. Critério de Aceite da Subetapa 03
- Suíte `auth-precision-stress.unit.test.tsx` e `auth-pages.unit.test.tsx` 100% verdes no Vitest.
- Auditoria do `designer-senior` aprovada.
