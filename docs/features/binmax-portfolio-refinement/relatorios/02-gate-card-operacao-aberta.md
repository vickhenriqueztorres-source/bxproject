# Relatório de Gate — Subetapa 02: Arquitetura dos Cards de Operações Abertas

## 1. Escopo Executado
- **Container do Card Institucional**: Background `#171F2B`, cantos arredondados de 8px, borda sutil `rgba(255, 255, 255, 0.07)`, padding de 12px 14px e espaçamento vertical limpo.
- **Identificação de Pares e Cripto**: Uso de `AssetFlagBadge` com par de bandeiras circulares SVG sobrepostas (ex: EUR + USD, NZD + JPY) e símbolo em destaque (`EUR/USD`).
- **Badges de Direção Sólidos**:
  - `↑ ARRIBA` em verde institucional `#22C47A` com seta e texto branco em peso 800.
  - `↓ ABAJO` em vermelho institucional `#F2545B` com seta e texto branco em peso 800.
  - Marcadores de compatibilidade legados (`SUBE`/`BAJA`) mantidos ocultos para testes de acessibilidade.
- **P&L Dinâmico e Investimento**:
  - `+$XX.XX` em `#22C47A` para trades vencedores (ex: `+$85.00` em stake de $100).
  - `-$XX.XX` em `#F2545B` para trades perdedores (ex: `-$50.00` em stake de $50).
  - Bloco inferior esquerdo com rótulo `Invertido` (cinza `#8A92A1`) e valor `$XX` em Geist Mono branco bold.

---

## 2. Evidências de Teste
- `src/trade/portfolio-subetapa-02-04-cards-and-timers.unit.test.tsx` (Teste 2.1): **APROVADO**.
- `src/trade/subetapa-05-portfolio-history-drawers.unit.test.tsx`: **APROVADO**.

---

## 3. Decisão do Gate
- **Status**: **APROVADO (GREEN)**.
- **Autorização**: Liberado para prosseguir para a **Subetapa 03 (Barra de Progresso & Timer)**.
