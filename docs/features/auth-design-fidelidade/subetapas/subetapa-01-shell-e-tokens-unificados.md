# Subetapa 01 — Shell Institucional e Header Unificado de Alta Precisão

> **Objetivo:** Unificar a carcaça estrutural (Shell) de `LoginPage.tsx` e `RegisterPage.tsx`, eliminando o Layout Shift de 60px entre rotas, erradicando a duplicação de logo na coluna esquerda e implementando o Header Superior Institucional padronizado com telemetria em tempo real.

---

## 1. Escopo de Arquivos

### Arquivos Modificados / Criados:
- `apps/web/src/components/auth/AuthShell.tsx` (Componente reutilizável de layout que engloba Header, Coluna Esquerda Institucional com Vol 50 e Coluna Direita de Formulários)
- `apps/web/src/pages/subetapa-01-auth-shell.unit.test.tsx` (Bateria de testes unitários, estresse de montagem e verificação estrutural)

### Arquivos Protegidos:
- Serviços de backend, tokens JWT, lógica de conexão e regras de carteira.

---

## 2. Diagnóstico Visual e Definição da Solução

### Problema Anterior:
1. No `LoginPage`, a tela começava diretamente com um Split 55%/45%, sem barra superior. O logo ficava isolado no topo da coluna esquerda.
2. No `RegisterPage`, existia um `<header>` fixo de 60px de altura com o logo e telemetria, e logo abaixo, na coluna esquerda, o logo aparecia novamente.
3. Ao transitar entre Login e Registro, o topo da tela pulava 60px para baixo ou para cima.

### Solução de Precisão Suíça:
- Criar o `AuthShell.tsx`:
  - **Header Superior Institucional (Altura 56px)**:
    - Fundo: `var(--bg-1)` / `#101622` com borda inferior `1px solid var(--line)`.
    - Lado Esquerdo: Logo oficial horizontal `BinmaxLogo` com altura 28px, clicável para navegar para `/`.
    - Lado Direito:
      1. Telemetria de latência: bolinha verde pulsante sutil (`#22C47A`) com texto tabular `16ms` em `Geist Mono`.
      2. Seletor de idioma: `ES ⌵` com tipografia limpa.
      3. Botão de alternância contextual:
         - Quando na tela de Login: exibe botão `Crear cuenta` (navega para `/registro`).
         - Quando na tela de Registro: exibe botão `Iniciar sesión` (navega para `/login`).
         - Estilo do botão: `bm-btn-precision` discreto com borda fina e hover mecânico.
  - **Área Central (Split Screen 55% / 45%)**:
    - Altura calculada: `minHeight: calc(100vh - 56px)`.
    - Largura máxima centralizada: `1440px` (ou full-width responsivo).
    - Coluna Esquerda (55% desktop, oculta em mobile `< 960px`):
      - Fundo: `#070D18` com borda direita `1px solid var(--line)`.
      - Padding matemático: `48px 48px` (escala fixa de 8px).
      - Conteúdo: Headline oficial The Hunter / Terminal Suíço, mini-gráfico `Vol50LiveMiniChart` (220px) e 3 pilares de confiança no rodapé em grid alinhado.
    - Coluna Direita (45% desktop, 100% mobile):
      - Fundo: `var(--bg-0)` / `#0B0E14`.
      - Centralização perfeita vertical e horizontal do card do formulário (`maxWidth: 440px`).

---

## 3. Matriz de Testes & Critérios de Aceite

### 3.1 Testes Unitários:
- [ ] O `AuthShell` renderiza o Header institucional de 56px com o logo da BINMAX sem duplicação no corpo.
- [ ] O indicador de latência `16ms` é renderizado com a classe `bm-tabular-nums` e fonte Geist Mono.
- [ ] O botão contextual no Header renderiza a ação oposta à rota ativa (`Crear cuenta` no login; `Iniciar sesión` no registro).
- [ ] A coluna esquerda renderiza o mini-gráfico `Vol50LiveMiniChart` e os 3 pilares de confiança.

### 3.2 Testes de Estresse:
- [ ] Executar 100 montagens síncronas do `AuthShell` em menos de 400ms sem vazamento de nós no DOM.

### 3.3 Testes de Caos:
- [ ] Renderizar com viewport mobile (`width <= 768px`) garantindo que a coluna esquerda colapsa sem quebrar a renderização do formulário.

### 3.4 Testes de Segurança:
- [ ] Garantir que nenhum elemento do Shell exponha dados sensíveis do usuário ou dados de sessão.
