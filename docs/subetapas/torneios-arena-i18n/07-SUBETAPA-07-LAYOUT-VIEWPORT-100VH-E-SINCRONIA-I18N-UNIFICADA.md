# Subetapa 07 — Layout Full-Bleed `100vh` da Arena (Sem Corte de Topo/Rodapé) e Sincronia Unificada de Idioma (PT/ES)

> **Agentes Alocados**: `surgical-frontend-agent`, `frontend-realtime-agent`, `chief-visual-director`, `security-reviewer`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `arena-css-table-buttons-fix.unit.test.tsx`: 5/5 passed)

---

## 1. Diagnóstico Forense das Imagens 1, 2 e 3
1. **Estouro de `100vh` por Duplicação do `global-demo-banner` em [`App.tsx:525`](../../../apps/web/src/App.tsx#L525)**:
   - Na Imagem 3 (`media_1791997512455_2b59159e.png`), aparece no topo a faixa amarela `...ningún dinero real circula.` (`global-demo-banner` de `App.tsx`), empurrando a `ArenaPage` (`height: 100vh`) para baixo e cortando o `TerminalFooter` e a parte inferior da tela.
   - Além disso, na `ArenaLive` ([`ArenaRoom.tsx:119`](../../../apps/web/src/arena/ArenaRoom.tsx#L119)), a falta de `height: 100%; overflow: hidden` fazia o conteúdo do `Leaderboard` esticar a página inteira, obrigando o usuário a rolar a tela e escondendo a `ArenaBar` (cronômetro `15:00`, saldo `T$ 1.000`, prêmio, botão `Simular`) e o `ChartHeader` para fora do topo!
2. **Descompasso de Idioma entre Sidebar (`ES`) e Arena (`PT`) sob HMR ([`i18n/index.tsx`](../../../apps/web/src/i18n/index.tsx))**:
   - Nas Imagens 2 e 3, a Sidebar exibia `Portafolio`, `Historial`, `Torneos` (`ES`) enquanto a Arena exibia `A Arena começa em`, `Valor da ordem`, `ACIMA`, `ABAIXO` (`PT`), porque `useUiLanguage` dependia da flag `isI18nActive` (`explicitSelection`), que sob HMR do Vite ou antes de clique explícito caía no `defaultLang` individual de cada componente (`'es'` na Sidebar vs `'pt'` na Arena).
   - Além disso, o header superior da `ArenaPage` não exibia o `LanguageSelectorDropdown` para troca direta de idioma dentro da Arena, e os nomes das salas (`Sala Bronze`, `Sala Prata`, `Sala Ouro`) não traduziam para Espanhol (`Sala Bronce`, `Sala Plata`, `Sala Oro`).

---

## 2. Passo a Passo de Implementação Cirúrgica
1. **Passo 7.1 — Rota Full-Bleed para `/arena` em [`App.tsx`](../../../apps/web/src/App.tsx)**:
   - Retornar `<ArenaPage />` diretamente quando `currentPath === '/arena' || currentPath === '/sala/arena'` (assim como `/operar` retorna `<TraderoomShell />`), eliminando o `global-demo-banner` duplicado no topo (já que a `ArenaPage` renderiza o `TerminalFooter` oficial na base).
2. **Passo 7.2 — Travamento de Viewport (`100%` sem scroll global na operação) em [`ArenaPage.tsx`](../../../apps/web/src/pages/ArenaPage.tsx) e [`ArenaRoom.tsx`](../../../apps/web/src/arena/ArenaRoom.tsx)**:
   - Em `ArenaRoom.tsx` (`ArenaLive`), usar `h-full max-h-full overflow-hidden` com:
     - `ArenaBar` fixa no topo (`shrink-0`);
     - Coluna esquerda (`ChartHeader` + `PriceChart` + `ArenaTicket`) com `flex-1 min-h-0 overflow-hidden`, garantindo que o gráfico ocupe exatamente a altura restante e a boleta `ArenaTicket` (`shrink-0`) fique sempre visível na base;
     - Coluna direita (`aside` de `380px`) com `h-full min-h-0 overflow-hidden` e `tabpanel` com `flex-1 min-h-0 overflow-y-auto` para rolar apenas o Ranking/Robô/Extrato.
   - Adicionar `LanguageSelectorDropdown` no header da `ArenaPage.tsx` e traduzir `Sala de Trading →` / `Sala de Operación →`.
3. **Passo 7.3 — Sincronia Unificada de Idioma em [`i18n/index.tsx`](../../../apps/web/src/i18n/index.tsx) e Nomes das Salas (`Sala Bronce / Plata / Oro`)**:
   - Em `useUiLanguage(defaultLang)`, sempre que `context` (`I18nContext`) existir, retornar `context.locale.startsWith("pt") ? "pt" : "es"`, usando `defaultLang` exclusivamente quando `context === null` (testes unitários isolados sem `<I18nProvider>`).
   - Adicionar `getRoomLabel(label, isEs)` em `engine.ts` e aplicá-lo em `ArenaLobby.tsx` e `ArenaBar.tsx`.

---

## 3. Bateria de Testes da Subetapa 07
- Testes unitários, estresse, segurança e caos verificando:
  - Sincronia absoluta de idioma entre `SidebarDock`, `ArenaPage`, `ArenaLobby`, `ArenaRoom`, `ArenaTicket` e `Leaderboard` em qualquer cenário (`pt-BR`, `es-ES`, `es-MX`, com ou sem `initialLocale`).
  - Layout full-bleed da `ArenaLive` (`overflow-hidden`, `ArenaBar` visível, `LanguageSelectorDropdown` presente no header da `ArenaPage`).
