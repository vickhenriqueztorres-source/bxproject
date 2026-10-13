# Subetapa 02 — Arquitetura dos Cards de Operações Abertas

## 1. Objetivo Técnico
Refatorar a estrutura visual e os componentes dos cards de operações ativas em `BinmaxPortfolioDrawer.tsx`, espelhando com precisão o topo do card da imagem de referência:
- **Container do Card**:
  - Superfície `#171F2B`, cantos arredondados (8px), borda discreta `rgba(255, 255, 255, 0.07)`, padding interno de `12px 14px`.
- **Identificação do Ativo**:
  - `AssetFlagBadge`: círculos de bandeiras sobrepostos em SVG com dimensão de 20px.
  - Símbolo formatado (ex: `EUR/USD`, `NZD/JPY`) em caixa alta, fonte Archivo 13px, cor `#FFFFFF`, peso 700.
- **Badges de Direção Sólidos**:
  - `↑ ARRIBA`: Fundo verde `#22C47A`, texto branco bold 10px, border-radius 3px, padding `2px 6px`.
  - `↓ ABAJO`: Fundo vermelho `#F2545B`, texto branco bold 10px, border-radius 3px, padding `2px 6px`.
  - Marcadores de acessibilidade/compatibilidade legados (`SUBE`/`BAJA`) preservados de forma não obstrutiva.
- **P&L Dinâmico**:
  - Operação com lucro projetado: `+$XX.XX` em `#22C47A`, fonte Geist Mono bold 14px.
  - Operação com prejuízo projetado: `-$XX.XX` em `#F2545B`, fonte Geist Mono bold 14px.
  - Cálculo em tempo real reagindo às mudanças no preço de tick atual vs. strike price.
- **Seção Inferior Esquerda**:
  - Rótulo `Invertido` em cinza `#8A92A1` (10.5px).
  - Valor investido formatado em dólares (ex: `$100`, `$50`) em Geist Mono bold 13px `#FFFFFF`.

---

## 2. Arquivos Impactados
- `apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`

---

## 3. Testes Requeridos
- Teste de renderização do par de bandeiras para diferentes ativos (Forex e Cripto).
- Teste de exibição dos badges `↑ ARRIBA` e `↓ ABAJO`.
- Teste de cálculo dinâmico de P&L com base na variação de preço.
- Teste de preservação de `data-testid="portfolio-card-${id}"` e `data-testid="portfolio-pnl-${id}"`.
