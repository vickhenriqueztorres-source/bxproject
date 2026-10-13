# Subetapa 01: Redesenho Ergonômico da Aba do Ativo no Cabeçalho

> **Objetivo**: Elevar a aba de ativos no cabeçalho ao padrão visual e ergonômico da IQ Option, com anel temporizador ampliado (34px-36px), tipografia nítida (11px-12px Geist Mono), botão `×` fixado no vértice superior esquerdo e eliminação de bordas genéricas tipo glow.

---

## 1. Alterações Específicas em `TerminalHeader.tsx`
- **Dimensões da Aba**:
  - Altura: `44px` (proporção balanceada no header).
  - Posicionamento relativo com `position: relative`.
- **Botão de Fechar (`×`)**:
  - Posicionado no vértice superior esquerdo: `position: absolute; top: 3px; left: 5px;` com tamanho `14px × 14px`, cor `#8A92A1` e hover `#F4F5F7`.
- **Anel Temporizador SVG**:
  - Diâmetro ampliado para `34px × 34px`.
  - Raio `r=14`, circunferência `2 * Math.PI * 14 = 87.96`.
  - Espessura de traço: `2.5px`.
  - Tipografia interna: `11px` Geist Mono com peso 800 e números tabulares, perfeitamente legíveis sem compressão.
- **Hierarquia de Texto**:
  - Título do ativo: Geist Sans 13px bold `#F4F5F7` com espaçamento limpo.
  - Subtítulo de Lucro/Perda: Geist Mono 11px bold (`+$85.00` em `#22C47A` ou `-$10.00` em `#E5484D`).
- **Superfície & Borda**:
  - Eliminar qualquer borda completa colorida (`border: 1px solid rgba(34, 196, 122, 0.4)` removida).
  - Borda discreta neutra (`border: 1px solid rgba(244, 245, 247, 0.06)`).
  - Fundo translúcido refinado (`rgba(20, 60, 40, 0.4)` no win, `rgba(75, 20, 24, 0.4)` no loss).
  - Borda indicadora exclusivamente na linha inferior (`border-bottom: 2px solid #22C47A` ou `#E5484D`).

## 2. Teste de Validação
- Arquivo: `src/trade/subetapa-refine-01-header-tab-ergonomics.unit.test.tsx`
- Asserções de dimensão (34px+), posição do botão `×`, textos e cores.
