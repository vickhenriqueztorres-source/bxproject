# Subetapa 11 — Redesign Executivo Compacto One-Screen do Lobby da Arena (`http://localhost:5173/arena`)

**Status**: `PENDENTE`
**Agentes**: `chief-visual-director` + `surgical-frontend-agent` + `qa-resilience-agent`
**Skills**: `21-designer-senior-binmax`, `17-mudanca-cirurgica`, `13-textos-es`, `06-testing-quality`

---

## 1. Objetivo Cirúrgico
Resolver definitivamente o **Problema 2**:
- Redesenhar `ArenaLobby.tsx` (e seu wrapper em `ArenaRoom.tsx`) para que `http://localhost:5173/arena` seja um **painel executivo de alta precisão, resumido, profissional e 100% visível em uma única tela (`100%` da altura útil, sem precisar rolar a página)**.
- Preservar 100% dos `data-testid`, props, callbacks (`onJoin(room, tier)`), cálculos financeiros (`splitEntry`, `podiumPrizes`, `tierPrizes`) e suporte bilíngue (`pt`/`es`).

---

## 2. Diretrizes do `chief-visual-director` (`21-designer-senior-binmax`)
1. **Proporção e Escala Tipográfica**:
   - Substituir o título exagerado `text-4xl sm:text-5xl` (`48px`) por tipografia executiva de terminal (`20px` / `text-xl font-bold tracking-tight`).
   - Reduzir paddings gigantes (`p-6 sm:p-10`, `py-8`, `gap-8`) para escala cirúrgica (`p-4`, `gap-3`).
2. **Estrutura One-Screen em 2 Faixas Horizontais**:
   - **Faixa 1 — Comando e Seleção de Sala (`arena-lobby-hero`)**:
     - Topo integrado: Esquerda com Badge `BINMAX ARENA · BLITZ #492`, Título (`15 minutos. T$ 1.000. O pódio leva o pote.`) e subtítulo resumido; Direita com seletor `Faixa de premiação (ITM)` (`Top 3 | Top 10 | Top 20 | Top 30`) e CTA `Entrar por US$ X,XX →` com microcopy de rateio.
     - Base da Faixa 1: Grid de 3 colunas com os cards compactos `Sala Bronze`, `Sala Prata` e `Sala Ouro` (`arena-room-card-0/1/2`).
   - **Faixa 2 — Grid Executivo Resumido de 4 Colunas (`Como funciona`, `Distribuição do pote`, `Desafio Alpha Quant`, `Regras`)**:
     - Todos os 4 painéis lado a lado em desktop (`grid-Template-Columns: repeat(4, minmax(0, 1fr))`), compactos, legíveis e visíveis simultaneamente na mesma tela sem scroll!

---

## 3. Testes Obrigatórios (Unitário, Stress, Segurança e Caos)
- **Unitário**: Verificar que todos os 4 painéis (`Como funciona`, `Distribuição do pote`, `Desafio Alpha Quant`, `Regras`), os 3 cards de sala e os 4 botões de tier ITM renderizam na mesma view compacta com todos os `data-testid` preservados.
- **Stress**: 200 trocas rápidas de sala (`Bronze/Prata/Ouro`) + tier (`Top 3/10/20/30`) + idioma (`pt/es`).
- **Segurança & Caos**: Garantir que os valores de buy-in e pote continuam vindo estritamente de `BUY_INS` e `splitEntry`.
