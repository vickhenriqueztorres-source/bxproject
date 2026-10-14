# Plano Geral do Orquestrador (Fase 2) — Correção do Scroll Top 10/20/30 e Redesign One-Screen da Arena (`http://localhost:5173/arena`)

**Status**: `EM EXECUÇÃO`
**Orquestrador**: `tech-lead-orchestrator`

---

## 1. Seleção de Agentes e Skills Ativadas

| Papel | Agente Selecionado | Skills Ativadas | Escopo de Atuação |
| :--- | :--- | :--- | :--- |
| **Orquestrador Técnico** | `tech-lead-orchestrator` | `01-project-context`, `20-conduzir-etapa` | Diagnóstico forense dos Problemas 1 e 2, divisão cirúrgica em subetapas e validação de gates. |
| **Diretor Visual Sênior** | `chief-visual-director` (`designer-senior`) | `21-designer-senior-binmax`, `12-tokens-binmax`, `13-textos-es` | Direção de arte executiva ("Instrumento de Precisão, Não um Cassino"), compactação One-Screen do Lobby da Arena (`http://localhost:5173/arena`) e hierarquia tipográfica (`12px/14px/16px/22px`). |
| **Implementação Cirúrgica Frontend** | `surgical-frontend-agent` (`cirurgiao`) | `17-mudanca-cirurgica`, `11-chart-trading-tools` | Correção estrutural do seletor `.arena-root` em `arena.css`, trava de viewport `100vh` em `ArenaPage.tsx` e `ArenaRoom.tsx`, scroll interno isolado em `Leaderboard.tsx` e layout One-Screen em `ArenaLobby.tsx`. |
| **Engenharia de Qualidade, Stress e Caos** | `qa-resilience-agent` | `06-testing-quality`, `09-ai-failure-map` | Testes de estresse (500 alternâncias `Top 5/10/20/30`), testes de segurança, caos e validação de imutabilidade do gráfico. |
| **Guardião de Regressão** | `regression-guardian-agent` | `19-testes-de-regressao-visual`, `06-testing-quality` | Certificação de zero regressão em todas as suítes Vitest e `tsc --noEmit`. |

---

## 2. Diagnóstico Forense dos 2 Problemas Reportados

### Problema 1: "Quando eu coloco Top 10, ou 20 ou 30, ele roda o scroll e joga o gráfico lá pra baixo"
1. **Causa Raiz Primária (Seletor Descendente em `arena.css`)**:
   - Em `apps/web/src/arena/arena.css`, todas as classes utilitárias de layout estavam escritas com seletor descendente (`.arena-root .flex`, `.arena-root .h-full`, `.arena-root .max-h-full`, `.arena-root .min-h-0`, `.arena-root .flex-col`, `.arena-root .overflow-hidden`).
   - Porém, o container raiz da sala (`<div data-testid="arena-live-room" className="arena-root flex h-full max-h-full min-h-0 flex-col overflow-hidden">`) possui a classe `.arena-root` **no próprio elemento**. Logo, nenhuma regra `.arena-root .h-full` ou `.arena-root .overflow-hidden` se aplicava a ele!
   - Resultado: `arena-live-room` ficava com `display: block; height: auto; overflow: visible`.
2. **Causa Raiz Secundária (Propagação de Altura da Tabela para a `<section>` do Gráfico e `<main>`)**:
   - Quando o usuário clicava em `Top 10`, `Top 20` ou `Top 30` em `Leaderboard.tsx`, a tabela renderizava 10, 20 ou 30 linhas (`<tr>`), fazendo a `<aside>` crescer para mais de `1.100px` de altura.
   - Como `arena-live-room` não tinha altura travada em `100%` e `<main>` em `ArenaPage.tsx` tinha `overflowY: 'auto'`, o flex container principal esticava junto com a `<aside>`, empurrando o gráfico (`PriceChart`) e a boleta (`ArenaTicket`) lá para baixo e criando barra de rolagem na página inteira.
3. **Solução Cirúrgica Definitiva**:
   - Em `arena.css`: fazer `.arena-root` aplicar diretamente ou suportar compound selectors (`.arena-root.flex`, `.arena-root.h-full`, `.arena-root.overflow-hidden`, etc.) e adicionar `.lg:shrink-0`.
   - Em `ArenaPage.tsx`: travar `<main>` com `overflow: 'hidden'`.
   - Em `ArenaRoom.tsx`: travar `arena-live-room`, o flex-row central, a `<section>` do gráfico e a `<aside>` lateral com `style={{ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%', overflow: 'hidden' }}`.
   - Em `Leaderboard.tsx`: envolver a tabela de ranking em um container com scroll interno próprio (`data-testid="leaderboard-table-scroll"`, `maxHeight: '240px'`, `overflowY: 'auto'`) e cabeçalho `thead` fixo (`position: 'sticky', top: 0`), além de compactar as linhas (`py-1.5`). Assim, ao clicar em `Top 10`, `Top 20` ou `Top 30`, **apenas a lista de posições rola internamente**, mantendo o gráfico 100% imóvel e mantendo os cards `Radar de Corte` e `Alpha Quant` sempre visíveis logo abaixo!

### Problema 2: "`http://localhost:5173/arena` — Designer arena muito grande, mal feito; tem que deixar mais profissional, tudo resumido e mostrando tudo em uma tela só"
1. **Diagnóstico do `chief-visual-director` (`21-designer-senior-binmax`)**:
   - No Lobby da Arena (`ArenaLobby.tsx`), o card hero superior tinha `p-6 sm:p-10`, `gap-8` e um título gigante `text-4xl sm:text-5xl` (`48px`), ocupando ~75% da tela verticalmente.
   - Os 3 painéis inferiores (`Como funciona`, `Distribuição do pote`, `Desafio Alpha Quant`) ficavam cortados na dobra inferior e o 4º painel (`Regras`) ficava totalmente escondido para baixo.
2. **Solução Cirúrgica One-Screen (`21-designer-senior-binmax`)**:
   - Transformar `ArenaLobby.tsx` em um **Terminal Executivo One-Screen (`100%` da área útil sem scroll em desktop)**:
     - **Bloco Superior Compacto (`Hero + Seleção de Sala + Faixa ITM + CTA`)**:
       - Header enxuto com badge `BINMAX ARENA · BLITZ #492`, título técnico `20px` (`15 minutos. T$ 1.000. O pódio leva o pote.`) e descrição resumida, alinhado à barra de ação rápida (`Faixa de premiação ITM: Top 3 | Top 10 | Top 20 | Top 30` + botão `Entrar por US$ X,XX →`).
       - Grid horizontal compacto com as **3 Salas (`Sala Bronze`, `Sala Prata`, `Sala Ouro`)** lado a lado (`p-3`, tipografia tabular nítida, badge de inscritos e pote em tempo real).
     - **Grid Executivo Inferior de 4 Colunas Resumidas (`lg:grid-cols-4`, visível na mesma tela)**:
       1. `Como funciona` / `Cómo funciona` (4 passos diretos e resumidos).
       2. `Distribuição do pote` / `Distribución del bote` (1º, 2º, 3º lugar + faixa ITM).
       3. `Desafio Alpha Quant` / `Desafío Alpha Quant` (Bônus de 50% + parâmetros auditáveis).
       4. `Regras` / `Reglas` (Regras essenciais resumidas em grid compacto + aviso antifraude).

---

## 3. Divisão em Subetapas

1. **[10-SUBETAPA-10-TRAVA-VIEWPORT-E-SCROLL-ISOLADO-TOP-N.md](./10-SUBETAPA-10-TRAVA-VIEWPORT-E-SCROLL-ISOLADO-TOP-N.md)** — Correção definitiva do Problema 1 (trava `100%` sem scroll de página ao selecionar `Top 10 / 20 / 30` e scroll interno isolado na tabela do ranking).
2. **[11-SUBETAPA-11-REDESIGN-COMPACTO-ONE-SCREEN-ARENA-LOBBY.md](./11-SUBETAPA-11-REDESIGN-COMPACTO-ONE-SCREEN-ARENA-LOBBY.md)** — Correção definitiva do Problema 2 (Redesign executivo compacto One-Screen do Lobby da Arena mostrando tudo em uma única tela).
3. **[12-SUBETAPA-12-CERTIFICACAO-FINAL-REGRESSAO-E-BUILD.md](./12-SUBETAPA-12-CERTIFICACAO-FINAL-REGRESSAO-E-BUILD.md)** — Certificação completa de regressão, stress, segurança, caos, build de produção e atualização do localhost.
