# Subetapa 03 — Formulário de Login de Precisão Suíça

> **Objetivo:** Refatorar cirurgicamente o `LoginPage.tsx`, aplicando a escala fixa de espaçamento de 8px, padronizando os campos de entrada em 42px com anel de foco de precisão, elevando o acabamento visual do botão primário para padrão de terminal financeiro institucional e blindando a experiência contra tremores (*shake*), bloqueios de força bruta e erros ruidosos.

---

## 1. Escopo de Arquivos

### Arquivos Modificados / Criados:
- `apps/web/src/pages/LoginPage.tsx` (Refatoração cirúrgica com o novo Shell e padrões de precisão)
- `apps/web/src/pages/login-page-refinement.unit.test.tsx` (Bateria de testes unitários, estresse, segurança e UX)

### Arquivos Protegidos:
- `AuthService.login`, hooks de autenticação, geração de tokens JWT.

---

## 2. Diagnóstico Visual e Definição da Solução

### Problema Anterior:
1. Card de formulário com largura de `420px`, desalinhado do formulário de registro (`460px`).
2. Espaçamentos verticais desconexos: margens de `18px`, `22px`, `36px 32px` sem proporção.
3. Botão "Entrar" com verde chapado sem elevação ou contraste tipográfico fino.
4. Falta de feedback tátil e foco refinado nos campos.
5. Card de bloqueio de conta por força bruta pouco integrado ao grid visual.

### Solução de Precisão Suíça:
- **Card do Formulário**:
  - Largura máxima unificada: `440px`.
  - Fundo: `var(--bg-1)` / `#101622` com borda `1px solid var(--line)`.
  - Raio de canto: `8px`.
  - Padding interno: `32px` uniforme.
  - Sombra sutil de profundidade: `0 16px 36px rgba(0,0,0,0.5)`.
- **Hierarquia Tipográfica**:
  - Título: `24px`, peso 800, `letter-spacing: -0.02em`, cor `var(--text-strong)`.
  - Subtítulo: `13px`, peso 400, cor `var(--text-muted)`, `line-height: 1.5`, margem inferior `24px`.
- **Inputs de Precisão**:
  - Altura fixa: `42px`.
  - Fundo: `var(--bg-3)` (`#1C2738`), borda `1px solid var(--line)`.
  - Raio: `6px`.
  - Ícone à esquerda centralizado (12px de recuo, tamanho 16px).
  - Texto digitado em Geist Sans `13.5px`, nítido e com contraste 7:1.
  - Foco: borda assume `1px solid var(--profit)` com anel de 1px sem espalhar glow (`box-shadow: 0 0 0 1px rgba(34, 196, 122, 0.25)`).
- **Tratamento de Erros e Bloqueio**:
  - Erro estático: caixa em `rgba(242, 84, 91, 0.1)` com borda vermelha discreta e ícone de alerta.
  - **Zero tremor / shake**.
  - Card de bloqueio por força bruta (após 5 tentativas): ícone de escudo em âmbar/vermelho, mensagem institucional clara e contador em `Geist Mono` com `tabular-nums`.
- **Botão Primário "Entrar"**:
  - Altura: `44px`.
  - Fundo: `var(--profit)` (`#22C47A`), hover em `#1EB06D`.
  - Texto em negrito `#08140B`.
  - Feedback mecânico no clique (`transform: translateY(1px)`).
  - Estado ocupado: `Accediendo al terminal...` com opacidade 75%, sem spinners decorativos.

---

## 3. Matriz de Testes & Critérios de Aceite

### 3.1 Testes Unitários:
- [ ] Renderiza os 5 estados da interface (Vazio, Preenchido, Carregando, Erro e Bloqueado).
- [ ] Formulário integrado ao `AuthShell` com largura máxima de 440px.
- [ ] Presença dos atributos acessíveis de label e input com identificadores únicos.
- [ ] Alternância de visibilidade de senha (Eye / EyeOff).

### 3.2 Testes de Estresse:
- [ ] Submissão contínua com 50 cliques em sequência: garante que o botão desabilita no primeiro disparo e previne duplo login.

### 3.3 Testes de Segurança:
- [ ] Bloqueio por força bruta ativado exatamente na 5ª tentativa falha.
- [ ] Não renderiza senhas em texto puro nos atributos do DOM ou logs.

### 3.4 Testes Anti-Cassino:
- [ ] Confirmação de ausência de classes de `shake`, gradientes berrantes ou ruídos visuais.
