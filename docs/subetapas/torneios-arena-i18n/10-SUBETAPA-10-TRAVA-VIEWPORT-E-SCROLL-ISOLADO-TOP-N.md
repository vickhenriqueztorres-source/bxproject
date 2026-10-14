# Subetapa 10 — Trava de Viewport e Scroll Isolado no Ranking (`Top 5 / 10 / 20 / 30`)

**Status**: `CONCLUÍDA E VALIDADA (100%)`
**Agentes**: `surgical-frontend-agent` + `qa-resilience-agent`
**Skills**: `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`

---

## 1. Objetivo Cirúrgico
Resolver definitivamente o **Problema 1**:
- Ao clicar em `Top 10`, `Top 20` ou `Top 30` no `Leaderboard.tsx`, a página **NÃO PODE** rolar nem empurrar o gráfico (`PriceChart`) e a boleta (`ArenaTicket`) para baixo.
- O container `arena-live-room`, a `<section>` do gráfico e a `<aside>` lateral devem permanecer estritamente travados em `100%` da altura útil (`min-height: 0`, `max-height: 100%`, `overflow: hidden`).
- A tabela de posições dentro do `Leaderboard.tsx` deve possuir seu próprio container de rolagem interna (`data-testid="leaderboard-table-scroll"`, `max-height: 230px`, `overflow-y: auto`) com `thead` fixo (`sticky top-0`), mantendo os cards **Radar de Corte** e **Alpha Quant** visíveis logo abaixo na coluna lateral.

---

## 2. Passo a Passo de Implementação

1. **`apps/web/src/arena/arena.css`**:
   - Adicionar suporte a classes utilitárias no próprio elemento `.arena-root` (`.arena-root.flex`, `.arena-root.flex-col`, `.arena-root.h-full`, `.arena-root.max-h-full`, `.arena-root.min-h-0`, `.arena-root.overflow-hidden`, `.arena-root.flex-1`).
   - Adicionar `.arena-root .lg\:shrink-0` no `@media (min-width: 1024px)`.
2. **`apps/web/src/pages/ArenaPage.tsx`**:
   - Em `<main>`, alterar `overflowY: 'auto'` para `overflow: 'hidden'`, garantindo que nem a sala ao vivo nem o lobby gerem barra de rolagem na janela principal.
3. **`apps/web/src/arena/ArenaRoom.tsx`**:
   - Adicionar `style={{ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}` em `data-testid="arena-live-room"`.
   - Adicionar `style={{ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%', overflow: 'hidden' }}` no wrapper flex central, na `<section>` do gráfico e na `<aside>` do painel do torneio.
   - Compactar levemente o `ChartHeader` (`py-1.5`) e o padding do `#panel-ranking` (`p-3`) para maximizar a área útil.
4. **`apps/web/src/arena/Leaderboard.tsx`**:
   - Compactar o espaçamento vertical das linhas (`py-1.5` em vez de `py-2.5`) e dos cards inferiores (`gap-2.5`, `p-2.5`).
   - Envolver a `<table>` em um `<div data-testid="leaderboard-table-scroll" className="thin-scroll" style={{ maxHeight: '220px', overflowY: 'auto', overflowX: 'hidden' }}>` com `thead` `style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--surface, #0f1318)' }}`.

---

## 3. Testes Obrigatórios (Unitário, Stress, Segurança e Caos)
- **Unitário**: Verificar que `arena-live-room`, `<section>` do gráfico, `<aside>` e `leaderboard-table-scroll` possuem `overflow: hidden` / `overflowY: auto` e `maxHeight` corretos.
- **Stress**: Alternar 200 vezes consecutivas entre `Top 5`, `Top 10`, `Top 20` e `Top 30` validando que o container do gráfico (`arena-mirrored-chart-wrapper`) permanece intacto e que `leaderboard-table-scroll` contém as linhas sem estourar o layout pai.
- **Caos/Segurança**: Dados de ranking com 30 participantes e nomes longos não quebram colunas nem vazam altura.
