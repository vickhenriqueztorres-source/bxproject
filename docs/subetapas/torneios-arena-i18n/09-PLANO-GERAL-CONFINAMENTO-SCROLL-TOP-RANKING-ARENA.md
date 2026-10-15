# Plano Geral do Orquestrador — Correção Cirúrgica do Scroll e Confinamento de Altura no Ranking (`Top 10 / 20 / 30`) da Arena Blitz

**Orquestrador**: `tech-lead-orchestrator`  
**Status**: CONCLUÍDO E VALIDADO (Subetapas 09, 10 e 11 certificadas — 47/47 testes verdes, `tsc --noEmit` 0 erros)  
**Escopo**: Correção definitiva do Problema 1 reportado pelo usuário: ao clicar em `Top 10`, `Top 20` ou `Top 30` no painel de Ranking da Arena Blitz, o container crescia verticalmente, acionava barra de rolagem na página e empurrava o gráfico e a boleta (`SUBE`/`BAJA`) para baixo da dobra da tela.

---

## 1. Seleção de Agentes e Skills Ativadas

| Papel | Agente Selecionado | Skills Ativadas | Responsabilidade na Missão |
| :--- | :--- | :--- | :--- |
| **Mapeamento Forense** | `codebase-mapper-agent` (`mapeador`) | `01-project-context`, `16-mapear-projeto`, `18-zonas-sensiveis` | Diagnóstico exato da cadeia de altura (`100vh -> flex-1 -> min-h-0 -> h-full`) entre `ArenaPage.tsx`, `ArenaRoom.tsx`, `Leaderboard.tsx` e `arena.css`. |
| **Direção Visual & Ergonomia** | `chief-visual-director` (`designer-senior`) | `21-designer-senior-binmax`, `12-tokens-binmax` | Garantia de imutabilidade espacial do terminal (`100vh` travado, gráfico + boleta imóveis em `0px` de deslocamento e rolagem confinada ao painel lateral/tabela). |
| **Execução Cirúrgica** | `surgical-frontend-agent` (`cirurgiao`) | `17-mudanca-cirurgica`, `12-tokens-binmax`, `13-textos-es` | Aplicação de travas CSS e inline `style` na cadeia flex de `ArenaPage.tsx`, `ArenaRoom.tsx`, `Leaderboard.tsx` e seletores compostos em `arena.css`. |
| **Qualidade, Stress, Caos e Regressão** | `qa-resilience-agent` + `regression-guardian-agent` | `06-testing-quality`, `19-testes-de-regressao-visual` | Testes unitários, stress (200 trocas rápidas `Top 5/10/20/30`), segurança, caos e validação geométrica real em navegador headless + abertura do preview. |

---

## 2. Diagnóstico Forense da Causa Raiz (`arquivo:linha`)

1. **Seletores descendentes em `apps/web/src/arena/arena.css` (`linhas 109–300`) não casavam com o próprio elemento `.arena-root`**:
   - Em `apps/web/src/arena/ArenaRoom.tsx:120-122`, o container raiz da sala ao vivo é:
     ```tsx
     <div
       data-testid="arena-live-room"
       className="arena-root flex h-full max-h-full min-h-0 flex-col overflow-hidden"
     >
     ```
   - Porém, em `apps/web/src/arena/arena.css`, as regras utilitárias foram escritas apenas com espaço descendente (`.arena-root .flex`, `.arena-root .h-full`, `.arena-root .max-h-full`, `.arena-root .min-h-0`, `.arena-root .flex-col`, `.arena-root .overflow-hidden`).
   - Como `div[data-testid="arena-live-room"]` **é** o próprio elemento `.arena-root` (e não filho de `.arena-root`), nenhuma dessas classes tinha efeito sobre ele. Ele ficava com `display: block; height: auto; max-height: none; overflow: visible`.
2. **`<main>` em `apps/web/src/pages/ArenaPage.tsx` (`linhas 176–186`) permitia expansão vertical (`overflowY: 'auto'`)**:
   - Sem trava `height: 100%; max-height: 100%; overflow: hidden` em `arena-live-room`, ao selecionar `Top 10`, `Top 20` ou `Top 30` em `Leaderboard.tsx`, a tabela de ranking expandia de 5 linhas (~220px) para 20 ou 30 linhas (~900px–1.300px).
   - Essa altura esticava o `<aside aria-label="Painel do torneio">`, que por sua vez esticava a linha flex (`<section aria-label="Gráfico e boleta">` + `<aside>`), jogando o fundo do gráfico `<PriceChart />` e a boleta `<ArenaTicket />` (`SUBE`/`BAJA`) para fora da tela e criando scroll na página inteira.
3. **Ausência de scroll interno dedicado na tabela de `Leaderboard.tsx` (`linha 210`)**:
   - Quando `viewLimit` passa para `10`, `20` ou `30`, a tabela crescia livremente empurrando também os cards `Radar de Corte` e `Meta Alpha_Quant` para muito abaixo.

---

## 3. Divisão em Subetapas Completas

1. **[Subetapa 09 — Blindagem CSS `.arena-root` e Cadeia Flex 100vh em `ArenaPage` e `ArenaRoom`](./10-SUBETAPA-09-BLINDAGEM-CSS-ROOT-E-FLEX-CHAIN-ARENA-LIVE.md)**
   - Corrige seletores compostos `.arena-root.flex`, `.arena-root.h-full`, etc. em `arena.css`.
   - Trava inline `style` em `ArenaPage.tsx` (`<main>`) e `ArenaRoom.tsx` (`arena-live-room`, row central, `<section>` do gráfico, `<aside>` lateral e `tabpanel` com `overflowY: 'auto'`), mantendo o `arena-lobby-view` rolável quando no estágio de lobby.
   - Suíte de testes de unidade, stress, segurança e caos da Subetapa 09.
2. **[Subetapa 10 — Scroll Interno Confinado na Tabela de Ranking (`Top 10 / 20 / 30`) com Cabeçalho Sticky](./11-SUBETAPA-10-SCROLL-INTERNO-TABELA-RANKING-TOP-10-20-30.md)**
   - Confina a tabela de `Leaderboard.tsx` em um container com scroll interno suave (`data-testid="leaderboard-table-scroll"`), cabeçalho `<thead>` sticky e preservação da linha `Tú / Você` + cards de `Radar de Corte` e `Alpha_Quant`.
   - Suíte de testes de unidade, stress (200 alternâncias `Top 5/10/20/30`), segurança e caos da Subetapa 10.
3. **[Subetapa 11 — Certificação Geométrica Real (0px Shift no Gráfico/Boleta) e Abertura do Preview](./12-SUBETAPA-11-CERTIFICACAO-E2E-LAYOUT-LOCK-E-PREVIEW.md)**
   - Verificação automatizada de regressão total + medição real de `getBoundingClientRect()` em navegador comprovando que o gráfico e a boleta permanecem 100% imóveis ao alternar entre `Top 5`, `Top 10`, `Top 20` e `Top 30`, seguida da abertura do preview local.
