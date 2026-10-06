# Subetapa 1: Viewport Shell Full-Bleed (100vw x 100vh)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**QA & Caos:** `qa-resilience-agent`  
**Segurança:** `security-reviewer`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 1 APROVADO)  

---

## 1. Objetivo da Etapa
Substituir a estrutura antiga de página (`max-width: 1320px`, margens laterais, scroll de página vertical no body) por uma **Viewport Shell de Terminal Fixo** ocupando exatamente `100vw` e `100vh`, com CSS Grid de 3 zonas principais (Topo, Linha Central com Sidebar + Gráfico + Dock de Ordens, e Rodapé/Gaveta).

---

## 2. Especificação Arquitetural

### Estrutura de Grid e Contenção
- `html, body, #root`:
  - `margin: 0`, `padding: 0`, `width: 100vw`, `height: 100vh`, `overflow: hidden`.
  - Background base escuro de trading: `#080e1d` com gradiente radial sutil no centro do gráfico.
- `TerminalLayout`:
  - Grid Layout:
    - Linha 1: `height: 48px` (Header / Topbar)
    - Linha 2: `1fr` (Workspace Central contendo Sidebar 48px + Chart Canvas flex-1 + Order Dock 300px)
    - Linha 3: `auto` (Min-height: 32px para o drawer minimizado ou até 220px quando expandido)
  - `overflow: hidden` na raiz do container, impedindo qualquer rolagem de viewport (zero rubber-banding / bounce).

---

## 3. Passo a Passo de Implementação
1. **Refatoração do CSS Global (`styles.css`)**:
   - Adicionar regras para `.terminal-viewport`, travando `100vw x 100vh` e desabilitando scroll acidental.
   - Definir variáveis CSS temáticas: `--bg-terminal: #080e1d`, `--header-height: 48px`, `--sidebar-width: 48px`, `--dock-width: 300px`, `--accent-green: #00e676`, `--accent-red: #ff3d71`.
2. **Criação do Componente `TerminalLayout.tsx`**:
   - `apps/web/src/components/layout/TerminalLayout.tsx` encapsulando as regiões semânticas: `<header>`, `<aside>`, `<main>` e `<footer>`.
3. **Isolamento de Redimensionamento**:
   - Adicionar suporte a `ResizeObserver` global e teste de viewport mínima (ex: aviso suave se largura for menor que 768px ou adaptação automática com recolhimento da sidebar).

---

## 4. Matriz de Testes & Validação da Etapa 1

### A. Teste de Estresse (Viewport & Resize)
- Redimensionamento contínuo da janela do navegador de 1920x1080 para 800x600 e vice-versa:
  - O layout não deve produzir barras de rolagem duplas.
  - O canvas do gráfico deve redimensionar sem distorção e sem travar a thread de renderização.

### B. Teste de Segurança (CSS Injection & Frame Busting)
- Garantir que elementos flutuantes ou modais fiquem contidos no z-index definido e não permitam sobreposição maliciosa (Clickjacking defense).
- Verificar que nenhum estilo dinâmico utiliza `dangerouslySetInnerHTML` ou expressões não sanitizadas.

### C. Teste de Caos (DOM Shrinking & Zoom)
- Testar zoom do navegador em 125%, 150% e 200%:
  - A interface deve manter o painel de ordens e o gráfico acessíveis.
  - Nenhum componente crítico pode vazar para fora da tela.

---

## 5. Critérios de Passagem (Quality Gate 1)
- [ ] Build do `@indices/web` passa sem erros com `pnpm --filter @indices/web build`.
- [ ] `document.body.scrollHeight === document.body.clientHeight` (Zero overflow vertical).
- [ ] O preview em `http://localhost:5173` exibe a casca de terminal preenchendo 100% da viewport.
