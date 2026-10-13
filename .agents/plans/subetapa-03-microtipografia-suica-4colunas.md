# Subetapa 03: Microtipografia Suíça, Rótulos Bicolunares & Divisores de Grade

> **Objetivo:** Refinar a tipografia das 4 métricas de telemetria, organizando os rótulos em duas linhas micro-tipográficas e calibrando o peso numérico em Geist Mono SemiBold (600), com divisores verticais de grade técnica.

---

## 1. Alterações Específicas em `PriceChart.tsx`
- **Micro-rótulos Bicolunares (2 Linhas):**
  - Coluna 1: `HORA DE` / `COMPRA`
  - Coluna 2: `INVESTIMENTO` / `TOTAL`
  - Coluna 3: `LUCRO` / `ESPERADO`
  - Coluna 4: `LUCRO APÓS A` / `VENDA (L/P)`
  - Formatação com `font-size: 8.5px`, `color: #8A92A1`, `letter-spacing: 0.05em`, `text-transform: uppercase`, `line-height: 1.15`.
  - Isso garante que a 4ª coluna tenha exatamente a mesma largura das demais (~110px a 125px), eliminando a assimetria desproporcional.
- **Tipografia Numérica de Instrumento Suíço:**
  - Valores em `16px`, `fontFamily: "'Geist Mono', monospace"`, `fontWeight: 600`, `letterSpacing: '-0.3px'`, `tabular-nums`.
  - Elimina o peso "gordo" e agressivo de 800+, adotando a precisão cirúrgica de cockpit.
- **Divisores Verticais Elegantes:**
  - `width: 1px`, `height: 28px`, `background: rgba(255, 255, 255, 0.08)`.

## 2. Teste de Validação
- **Arquivo de Teste:** `src/chart/subetapa-refine-telemetry-metrics-grid.unit.test.tsx`
- **Cenários a Validar:**
  - Rótulos divididos em micro-blocos de duas linhas.
  - Tipografia 16px Geist Mono SemiBold 600 com números tabulares.
  - Divisores sutis de 28px.
  - Simetria de larguras entre as 4 colunas.
