# Subetapa 06 — Correção Cirúrgica de CSS da Arena (Botões/Inputs Brancos, Abas Invisíveis e Colisão na Tabela de Ranking)

> **Agentes Alocados**: `surgical-frontend-agent`, `chief-visual-director`, `binmax-brand-agent`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `arena-css-table-buttons-fix.unit.test.tsx`: 5/5 passed)

---

## 1. Diagnóstico Forense das Imagens 1, 2 e 3
1. **Botões e Inputs com Fundo BRANCO Sólido (`media_1791997476455_140c4a26.png` e `media_1791997512455_2b59159e.png`)**:
   - Na boleta inferior ([`ArenaTicket.tsx`](../../../apps/web/src/arena/ArenaTicket.tsx)): os botões `-` e `+`, o `<input value="100">`, os botões rápidos `5%` e `20%` e os botões de expiração `00:30` e `02:00` aparecem com **fundo branco sólido** e borda nativa do navegador.
   - Nas abas do painel direito ([`ArenaRoom.tsx:157-182`](../../../apps/web/src/arena/ArenaRoom.tsx#L157-L182)): os botões `Ranking`, `Robô` e `Extrato` aparecem com **fundo branco sólido**, deixando o texto ativo `Ranking` (branco `#f2f4f7`) invisível sobre fundo branco.
   - Nos filtros do ranking ([`Leaderboard.tsx:160-184`](../../../apps/web/src/arena/Leaderboard.tsx#L160-L184)): os botões `Top 10`, `Top 20`, `Top 30` aparecem com **fundo branco sólido**.
   - **Causa Raiz**: [`apps/web/src/arena/arena.css`](../../../apps/web/src/arena/arena.css) não possuía reset de `button, input, select, textarea` (`background-color: transparent; color: inherit; border-width: 0; border-style: solid; appearance: none;`) nem definia `.bg-transparent`, `.ring-1`, `.ring-2`, `.ring-border`, `.ring-arena`, `.ring-arena-border`, `.whitespace-nowrap`, `.hover\:*`, `.focus-visible\:*` e `.disabled\:*`.
2. **Colisão de Colunas na Tabela de Ranking (`1.000US$ 218,75`) (`media_1791997512455_2b59159e.png`)**:
   - Em [`Leaderboard.tsx:92-101, 194-209`](../../../apps/web/src/arena/Leaderboard.tsx#L92-L101), as células de `PONTOS` (`T$ 1.000`) e `PRÊMIO` (`US$ 218,75`) não tinham `whitespace-nowrap` nem espaçamento horizontal entre si, fazendo `T$ 1.000` quebrar em duas linhas e colidir com `US$ 218,75` (`1.000US$ 218,75`).
   - O rótulo `Premiados: Top 3` também quebrava em duas linhas (`Premiados: Top\n3`).

---

## 2. Passo a Passo de Implementação Cirúrgica
1. **Passo 6.1 — Blindagem Completa de [`apps/web/src/arena/arena.css`](../../../apps/web/src/arena/arena.css)**:
   - Adicionar reset escopado para `.arena-root button, .arena-root input, .arena-root optgroup, .arena-root select, .arena-root textarea` garantindo `background-color: transparent; color: inherit; border: 0 solid var(--border); padding: 0; margin: 0; font: inherit; appearance: none;`.
   - Adicionar todas as classes utilitárias usadas nos componentes da Arena (`bg-transparent`, `bg-surface`, `bg-raised`, `bg-arena`, `bg-arena-surface`, `bg-arena-surface/70`, `bg-border`, `whitespace-nowrap`, `pointer-events-none`, `ring-1`, `ring-2`, `ring-border`, `ring-arena`, `ring-arena-border`, `border-b-2`, `border-b-arena/60`, `border-muted-foreground`, `hover:*`, `focus-visible:*`, `disabled:*`, `animate-spin`, `animate-pulse`).
2. **Passo 6.2 — Correção da Tabela e Filtros em [`Leaderboard.tsx`](../../../apps/web/src/arena/Leaderboard.tsx)**:
   - Adicionar `whitespace-nowrap` no badge `Premiados: Top 3`.
   - Adicionar `whitespace-nowrap px-3` na coluna `PONTOS` (`<th>` e `<td>`) e `whitespace-nowrap pl-3 pr-3` na coluna `PRÊMIO` (`<th>` e `<td>`).
   - Garantir classes explícitas de superfície escura nos botões de filtro `Top 5 / Top 10 / Top 20 / Top 30`.
3. **Passo 6.3 — Refinamento Explícito de Superfícies em [`ArenaTicket.tsx`](../../../apps/web/src/arena/ArenaTicket.tsx), [`ArenaRoom.tsx`](../../../apps/web/src/arena/ArenaRoom.tsx) e [`ArenaLobby.tsx`](../../../apps/web/src/arena/ArenaLobby.tsx)**:
   - Garantir que os botões `-` / `+`, `<input>`, percentuais rápidos (`5%`, `10%`, `20%`), expirações (`00:30`, `01:00`, `02:00`) e abas (`Ranking`, `Robô`, `Extrato`) tenham contraste escuro perfeito e zero fundo branco.

---

## 3. Bateria de Testes da Subetapa 06
- Verificação estática e de renderização garantindo:
  - Presença das regras de reset `.arena-root button, .arena-root input` e `.bg-transparent` em `arena.css`.
  - Ausência de colisão entre `PONTOS` e `PRÊMIO` (`whitespace-nowrap` e padding horizontal separados em `Leaderboard.tsx`).
  - Estresse de 200 renderizações da tabela de ranking e boleta da Arena.
