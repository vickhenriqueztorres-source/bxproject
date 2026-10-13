# Subetapa 02 — AuthTabSwitcher de Alta Precisão & Motion Design

> **Objetivo:** Refinar o componente `AuthTabSwitcher.tsx` para atingir o padrão estético de instrumento financeiro de alta precisão, adicionando transições mecânicas, microinterações táteis e suporte pleno a acessibilidade com navegação por teclado.

---

## 1. Escopo de Arquivos

### Arquivos Modificados / Criados:
- `apps/web/src/components/auth/AuthTabSwitcher.tsx` (Componente refinado de abas com física de transição mecânica)
- `apps/web/src/components/auth/auth-tab-switcher.unit.test.tsx` (Testes unitários, estresse de cliques e acessibilidade ARIA)

### Arquivos Protegidos:
- Rotas e componentes pais.

---

## 2. Diagnóstico Visual e Definição da Solução

### Problema Anterior:
1. O seletor de abas era uma caixa escura rudimentar com dois botões quase planos.
2. A aba inativa tinha baixo contraste e a aba ativa parecia um bloco cinza duro.
3. Não havia feedback mecânico suave ao passar o cursor ou trocar de aba.
4. Falta de atributos de acessibilidade para navegação via leitor de tela e teclado (`Tab`, setas).

### Solução de Precisão Suíça:
- Estrutura de Pílula de Precisão:
  - Fundo: `var(--bg-0)` / `#0B0E14` com borda `1px solid var(--line)`.
  - Raio de curvatura: `6px`.
  - Padding interno: `4px`.
  - Altura total: `38px` (espaço confortável e proporcional aos inputs de 42px).
- Abas (`Iniciar sesión` e `Crear cuenta`):
  - Altura: `30px`.
  - Aba Ativa: Fundo `var(--bg-2)` (`#151D2B`), borda `1px solid rgba(138, 146, 161, 0.22)`, texto `var(--text-strong)` (`#F4F5F7`), peso 600, sombra interna sutil `0 1px 2px rgba(0,0,0,0.4)`.
  - Aba Inativa: Fundo transparente, borda transparente, texto `var(--text-muted)` (`#8A92A1`), peso 500.
  - Hover na inativa: Texto clareia para `#C0C7D5` e fundo assume sutil transparência `rgba(255,255,255,0.04)`.
  - Transição: `100ms cubic-bezier(0.16, 1, 0.3, 1)`.
  - Feedback no clique: afunda 1px mecânico (`transform: translateY(1px)`).
  - Acessibilidade: `role="tablist"`, `role="tab"`, `aria-selected={true|false}`, `tabIndex={0}`.

---

## 3. Matriz de Testes & Critérios de Aceite

### 3.1 Testes Unitários:
- [ ] Renderiza corretamente as opções `Iniciar sesión` e `Crear cuenta`.
- [ ] Aplica atributos ARIA `role="tablist"`, `role="tab"`, e `aria-selected` de acordo com a aba ativa.
- [ ] Dispara callback `onTabChange` com o valor correto ao clicar.

### 3.2 Testes de Estresse:
- [ ] Executa 500 alternâncias consecutivas rápidas entre as abas sem degradação de performance (< 50ms).

### 3.3 Testes de Acessibilidade & Navegação por Teclado:
- [ ] Suporta acionamento via teclado (Enter / Espaço).
- [ ] Mantém indicador de foco limpo sem espalhar halos de luz neon.
