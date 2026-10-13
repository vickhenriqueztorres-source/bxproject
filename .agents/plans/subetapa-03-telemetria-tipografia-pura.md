# Subetapa 03: Telemetria In-Chart Pura Sem Card (Tipografia Flutuante & 4 Colunas)

> **Objetivo**: Substituir o card pesado com borda verde/vermelha por uma barra de telemetria de tipografia pura flutuante diretamente no gráfico, separada por divisores verticais de 1px e perfeitamente integrada no espaço visual.

---

## 1. Alterações Específicas em `PriceChart.tsx`
- **Eliminação do Card Opaco**:
  - Remover `border: 1px solid rgba(34, 196, 122, 0.3)` e `background: rgba(11, 14, 20, 0.92)` espesso.
  - Renderizar a telemetria com fundo transparente ou sutilmente translúcido sem bordas coloridas agressivas.
- **Tipografia Flutuante de Alta Precisão**:
  - 4 colunas bem proporcionadas com espaçamento `gap: 24px` e divisores verticais de linha `1px solid rgba(255, 255, 255, 0.1)`.
  - Números principais: `18px`, bold, `fontFamily: "'Geist Mono', monospace"`, `tabular-nums`.
    - Coluna 1: `⏱ 00:38` (branco `#F4F5F7`) / `HORA DE COMPRA` (aço `#8A92A1`, 9px bold)
    - Coluna 2: `$100.00` (branco `#F4F5F7`) / `INVESTIMENTO TOTAL` (aço `#8A92A1`, 9px bold)
    - Coluna 3: `+$85.00` (verde `#22C47A`) ou `-$10.00` (vermelho `#E5484D`) / `LUCRO ESPERADO` (aço `#8A92A1`, 9px bold)
    - Coluna 4: `+$13.09` (verde `#22C47A`) ou `-$1.36` (vermelho `#E5484D`) / `LUCRO APÓS A VENDA (L/P)` (aço `#8A92A1`, 9px bold)
- **Hierarquia com o Seletor de Ativos Flutuante**:
  - Alinhamento em linha única com o seletor `chart-top-asset-pill` sem nenhuma sobreposição espacial.

## 2. Teste de Validação
- Arquivo: `src/chart/subetapa-refine-03-telemetry-pure-typography.unit.test.tsx`
- Asserções: ausência de bordas opacas de card, 4 colunas tabulares, tipografia Geist Mono 18px.
