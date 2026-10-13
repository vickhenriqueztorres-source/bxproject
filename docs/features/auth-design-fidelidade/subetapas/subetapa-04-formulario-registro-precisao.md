# Subetapa 04 — Formulário de Registro de Alta Conversão & Precisão

> **Objetivo:** Refatorar cirurgicamente o `RegisterPage.tsx`, eliminando a assimetria visual em relação ao Login, padronizando a largura em 440px, otimizando os campos Nombre, Email, Contraseña e País, estilizando os checkboxes de conformidade e integrando o card promocional de prática de $10.000 de forma sóbria e sem afogamento de layout.

---

## 1. Escopo de Arquivos

### Arquivos Modificados / Criados:
- `apps/web/src/pages/RegisterPage.tsx` (Refatoração cirúrgica com o novo Shell e padrões de precisão)
- `apps/web/src/pages/register-page-refinement.unit.test.tsx` (Bateria de testes unitários, estresse, conformidade e UX)

### Arquivos Protegidos:
- `AuthService.register`, `resetMockWallet`, `setGuestMode`.

---

## 2. Diagnóstico Visual e Definição da Solução

### Problema Anterior:
1. O formulário de registro estava supercomprimido verticalmente, com campos quase grudados e paddings não padronizados.
2. A largura era de `460px` (diferente dos `420px` do login), gerando tremor no viewport.
3. Checkboxes com layout desalinhado e estilo nativo do navegador.
4. Select de país rudimentar com padding inconsistente.
5. Card de boas-vindas `$10.000` parecia um bloco solto e desalinhado no rodapé.

### Solução de Precisão Suíça:
- **Alinhamento do Card com o Login**:
  - Largura idêntica: `maxWidth: 440px`.
  - Fundo: `var(--bg-1)` / `#101622` com borda `1px solid var(--line)` e `borderRadius: 8px`.
  - Padding: `32px` uniforme.
- **Campos de Entrada (42px)**:
  - `Nombre`: ícone de usuário de precisão.
  - `Email`: ícone de carta de precisão.
  - `Contraseña`: ícone de cadeado + alternância de olho, com helper text discreto `Mínimo 6 caracteres.` em `11px`.
  - `País`: seletor de alta precisão com bandeira nítida, fonte Geist Sans e chevron vetorial perfeitamente centralizado.
  - Espaçamento uniforme: `16px` entre grupos de campos.
- **Checkboxes de Conformidade**:
  - Checkboxes estilizados com alinhamento flex centralizado/topo com o texto.
  - Links sutis de `términos y condiciones` em cor de sistema institucional (`#4D8DFF`).
- **Botão Primário "Crear cuenta de práctica"**:
  - Altura: `44px`.
  - Fundo: `var(--profit)` com hover mecânico.
  - Seta indicativa de avanço `→`.
- **Card de Bônus de Prática $10.000**:
  - Fundo: `var(--bg-0)` / `#0B0E14` com borda fina `1px solid var(--line)`.
  - Ícone de verificação em verde ganancia.
  - Valor `$10.000` em destaque com fonte tabular.

---

## 3. Matriz de Testes & Critérios de Aceite

### 3.1 Testes Unitários:
- [ ] Validações de campos obrigatórios: impede submissão sem termos aceitos ou com menos de 18 anos.
- [ ] Validação de senha mínima de 6 caracteres.
- [ ] Integração com `AuthShell` com largura exatamente igual à do formulário de login (440px).

### 3.2 Testes de Estresse:
- [ ] 50 submissões rápidas consecutivas: desativação imediata no clique para evitar criação concorrente duplicada de conta.

### 3.3 Testes de Conformidade Regulatória:
- [ ] Bloqueio obrigatório caso os termos não sejam aceitos ou a idade seja inferior a 18 anos.

### 3.4 Testes de UX e Motion:
- [ ] Ausência de jumps de layout na alternância de abas.
- [ ] Transições nos tokens de física de movimento (100ms hover, 1px active press).
