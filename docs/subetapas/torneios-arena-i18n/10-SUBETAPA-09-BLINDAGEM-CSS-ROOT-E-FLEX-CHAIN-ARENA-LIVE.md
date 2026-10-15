# Subetapa 09 — Blindagem CSS `.arena-root` e Cadeia Flex 100vh em `ArenaPage` e `ArenaRoom`

**Status**: CONCLUÍDA E VALIDADA (5/5 testes verdes em `arena-substep09-flex-chain-lock.unit.test.tsx`)  
**Agentes**: `surgical-frontend-agent` (`cirurgiao`), `chief-visual-director` (`designer-senior`), `qa-resilience-agent`  
**Skills**: `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`

---

## 1. Objetivo Cirúrgico

Impedir que qualquer expansão de conteúdo dentro da aba lateral (`Ranking`, `Bot`, `Extracto`) estique a altura do container `arena-live-room`, da coluna do gráfico (`<section aria-label="Gráfico e boleta">`) ou do `<main>` de `ArenaPage.tsx`.

---

## 2. Passo a Passo de Implementação

### Passo 1 — `apps/web/src/arena/arena.css`
- Adicionar suporte a seletores compostos no próprio `.arena-root` (`.arena-root.flex`, `.arena-root.flex-col`, `.arena-root.h-full`, `.arena-root.max-h-full`, `.arena-root.min-h-0`, `.arena-root.overflow-hidden`, `.arena-root.overflow-y-auto`), garantindo que classes aplicadas diretamente no elemento raiz `.arena-root` funcionem com paridade 100%.

### Passo 2 — `apps/web/src/pages/ArenaPage.tsx`
- No `<main>` de `ArenaPage.tsx`, garantir `overflow: 'hidden'`, `height: '100%'`, `maxHeight: '100%'`, `minHeight: 0`, `flex: '1 1 0%'` para que o shell externo jamais crie barra de rolagem de página inteira.

### Passo 3 — `apps/web/src/arena/ArenaRoom.tsx`
- Em `ArenaRoom`:
  - Quando `arena.s.stage === 'lobby'`, o wrapper `data-testid="arena-lobby-view"` recebe `style={{ flex: '1 1 0%', height: '100%', maxHeight: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}` para permitir rolagem suave apenas no Lobby.
  - Em `ArenaLive`:
    - `div[data-testid="arena-live-room"]` recebe `style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', height: '100%', maxHeight: '100%', minHeight: 0, overflow: 'hidden' }}`.
    - O container intermediário (`div` que agrupa `<section>` e `<aside>`) recebe `style={{ display: 'flex', flex: '1 1 0%', minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}`.
    - `<section aria-label="Gráfico e boleta">` recebe `style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minWidth: 0, minHeight: 0, maxHeight: '100%', overflow: 'hidden' }}`.
    - `<aside aria-label="Painel do torneio">` recebe `style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: '100%', height: '100%', overflow: 'hidden' }}`.
    - `div[role="tabpanel"]` recebe `style={{ flex: '1 1 0%', minHeight: 0, maxHeight: '100%', overflowY: 'auto', overflowX: 'hidden' }}`.

---

## 3. Plano de Testes (Unitários, Stress, Segurança e Caos)

1. **Teste Unitário de Travamento da Cadeia Flex (`ArenaLive`)**:
   - Verifica que `arena-live-room`, `<section aria-label="Gráfico e boleta">`, `<aside aria-label="Painel do torneio">` e `div[role="tabpanel"]` possuem estilos computados/inline de contenção estrita (`overflow: hidden` nos pais e `overflow-y: auto` apenas no `tabpanel`).
2. **Teste de Stress**:
   - Alterna entre as abas `Ranking`, `Bot` e `Extracto` 100 vezes seguidas verificando que as propriedades de contenção de altura permanecem intactas.
3. **Teste de Segurança e Caos**:
   - Valida que `ArenaPage` com query params malformados ou `stage === 'lobby'` vs `stage === 'running'` mantém isolamento de overflow sem vazar scroll para `window`/`document.body`.
