# Subetapa 10 — Scroll Interno Confinado na Tabela de Ranking (`Top 10 / 20 / 30`) com Cabeçalho Sticky

**Status**: CONCLUÍDA E VALIDADA (4/4 testes verdes em `arena-substep10-leaderboard-scroll.unit.test.tsx`)  
**Agentes**: `surgical-frontend-agent` (`cirurgiao`), `chief-visual-director` (`designer-senior`), `qa-resilience-agent`  
**Skills**: `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`

---

## 1. Objetivo Cirúrgico

Garantir que, ao selecionar `Top 10`, `Top 20` ou `Top 30` em `Leaderboard.tsx`, a lista de participantes role **internamente** dentro do próprio bloco da tabela (`data-testid="leaderboard-table-scroll"`), mantendo:
1. O cabeçalho `# | TRADER | PUNTOS | PREMIO` fixo no topo da tabela (`position: sticky; top: 0; z-index: 2`).
2. Os cards estratégicos (`Radar de Corte` e `Meta Alpha_Quant`) sempre acessíveis logo abaixo da tabela.
3. O gráfico (`PriceChart`) e a boleta (`ArenaTicket`) **100% imóveis**, sem qualquer deslocamento vertical.

---

## 2. Passo a Passo de Implementação

### Passo 1 — `apps/web/src/arena/Leaderboard.tsx`
- Envolver a `<table>` do ranking no container `data-testid="leaderboard-table-scroll"` com:
  - `maxHeight: viewLimit > 5 ? '320px' : 'none'`
  - `overflowY: viewLimit > 5 ? 'auto' : 'visible'`
  - `overflowX: 'hidden'`
  - Classe `thin-scroll` para barra de rolagem discreta compatível com o tema escuro da Binmax.
- No `<thead>` da tabela, aplicar `style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--surface, #0f1318)' }}` para que os títulos das colunas (`#`, `TRADER`, `PUNTOS`, `PREMIO`) permaneçam visíveis durante a rolagem de `Top 10`, `Top 20` e `Top 30`.
- Garantir `type="button"` e `e.preventDefault()` nos botões de filtro `Top 5`, `Top 10`, `Top 20`, `Top 30` sem disparar `scrollIntoView` ou rolagem na janela.

---

## 3. Plano de Testes (Unitários, Stress, Segurança e Caos)

1. **Teste Unitário de Confinamento da Tabela (`Top 5` vs `Top 10 / 20 / 30`)**:
   - Em `Top 5`: `leaderboard-table-scroll` renderiza 5 linhas sem forçar scroll desnecessário.
   - Em `Top 10`, `Top 20`, `Top 30`: `leaderboard-table-scroll` ativa `overflow-y: auto` e `max-height: 320px`, com `<thead>` sticky (`position: sticky; top: 0`).
2. **Teste de Stress (200 Alternâncias Rápidas de Filtro + 120 Participantes)**:
   - Alterna `Top 5 -> Top 10 -> Top 20 -> Top 30` em loop de 200 iterações com 120 participantes no ranking, verificando que o container do gráfico (`arena-mirrored-chart-wrapper`) e a boleta (`arena-ticket`) não sofrem mutação nem perda de estado.
3. **Teste de Caos (Ranking Vazio / 1 Participante / Empates Massivos)**:
   - Verifica que `Leaderboard` em `Top 30` com listas anômalas não quebra layout nem lança exceções.
