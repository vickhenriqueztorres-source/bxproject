# Subetapa 02: Anel Temporizador, PnL ao Vivo e Cor Dinâmica nas Abas do Cabeçalho

> **Objetivo**: Implementar na aba de cada ativo aberto no cabeçalho a contagem regressiva em anel vetorial SVG (`:56`, `:34`), o lucro/perda em tempo real (`+$8.61` verde ou `-$10.00` vermelho) e a mudança de cor da aba (esmeralda translúcido quando ITM, carmesim translúcido quando OTM).

---

## 1. Escopo de Alteração
- **Arquivos**:
  - `apps/web/src/components/header/TerminalHeader.tsx`
  - `apps/web/src/App.tsx` (repassar contratos e ticks para o cabeçalho)

## 2. Especificação Visual e Funcional
- **Props**: Receber `contracts?: Contract[]` e `currentPrices?: Record<string, number>`.
- **Lógica de Trade Ativo por Símbolo**:
  - Localizar contrato aberto (`status === 'OPEN'`) para o símbolo da aba.
  - Se houver contrato aberto:
    - Calcular segundos restantes até `expires_at`.
    - Renderizar micro-anel SVG (`<svg viewBox="0 0 32 32">`) com `strokeDasharray` e `strokeDashoffset` proporcional ao tempo restante, com o número centralizado (`:34` ou `:56`).
    - Comparar `currentPrice` com `strike_price` / `entry_price` e direção (`UP` / `DOWN`):
      - Se no lucro (ITM): badge `+$XX.XX` em `#22C47A` e fundo da aba com tint `rgba(34, 196, 122, 0.16)` e borda inferior `#22C47A`.
      - Se no prejuízo (OTM): badge `-$XX.XX` em `#E5484D` e fundo da aba com tint `rgba(229, 72, 77, 0.16)` e borda inferior `#E5484D`.
  - Se contrato recém-liquidado (`status === 'SETTLED'` nos últimos 5 segundos):
    - Exibir ícone de bandeira quadriculada (`🏁`) e o valor final apurado.

## 3. Testes de Validação (TDD)
- Arquivo de Teste: `apps/web/src/trade/subetapa-02-tab-trade-countdown-pnl.unit.test.tsx`
- **Cenários Cobertos**:
  1. Renderização da aba neutra (sem ordens abertas) com o payout padrão `+85%`.
  2. Aba com trade aberto e vencendo (ITM): anel SVG `:34`, valor `+$8.61` e classe/cor esmeralda.
  3. Aba com trade aberto e perdendo (OTM): anel SVG `:12`, valor `-$10.00` e classe/cor carmesim.
  4. Transição dinâmica de ITM para OTM quando o tick oscila.
  5. Contrato liquidado com flag `🏁` e badge de lucro.
