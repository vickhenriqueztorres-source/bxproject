# Subetapa 01: Erradicação do Card Neon na Aba de Ativo do Header

> **Objetivo:** Remover qualquer fundo fluorescente ou contorno agressivo fechado na aba ativa de `TerminalHeader.tsx`, adotando um padrão sóbrio de cockpit com foco na linha indicadora inferior e no anel de precisão.

---

## 1. Alterações Específicas em `TerminalHeader.tsx`
- **Fundo Institucional Sóbrio:**
  - Substituir `tabBg` condicional (`#14251e` e `#261418`) por um fundo neutro consistente com a barra superior (`#151922` para aba ativa, `rgba(21, 25, 34, 0.45)` para abas inativas).
  - A cor de vitória/derrota é delegada exclusivamente:
    1. Ao texto numérico do PnL (`+$85.00` em `#22C47A`, `-$10.00` em `#E5484D`).
    2. Ao anel do cronômetro de 34px (`stroke="#22C47A"` ou `stroke="#E5484D"`).
    3. À linha linear inferior de 2px (`border-bottom: 2px solid #22C47A` ou `#E5484D`).
- **Eliminação de Bordas Fechadas:**
  - Garantir que as bordas laterais e superiores sejam sutis e uniformes (`1px solid rgba(244, 245, 247, 0.06)`), sem qualquer halo luminoso ou efeito de card fechado de cassino.

## 2. Teste de Validação
- **Arquivo de Teste:** `src/trade/subetapa-refine-tab-anti-neon.unit.test.tsx`
- **Cenários a Validar:**
  - Aba ativa com trade vencedor NÃO renderiza fundo verde `#14251e`.
  - Renderiza fundo sóbrio `#151922` e borda inferior limpa `#22C47A`.
  - Teste de estresse: renderização suave de múltiplas abas sem degradação.
