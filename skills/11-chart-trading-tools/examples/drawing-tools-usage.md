# Exemplos de Uso e Extensão de Ferramentas Gráficas

Este guia demonstra como instanciar ferramentas de desenho, adicionar novos indicadores e renderizar overlays interativos.

---

## 1. Adicionando um Novo Indicador Técnico (Exemplo: MACD)

Para introduzir um novo indicador na plataforma:

### 1.1. Adicionar o Tipo e Configuração Padrão
Em `apps/web/src/chart/drawing-types.ts`:

```typescript
export type IndicatorType = 'SMA' | 'EMA' | 'BOLLINGER' | 'RSI' | 'MACD';

export const DEFAULT_INDICATORS: IndicatorConfig[] = [
  // ... outros indicadores
  { id: 'macd_12_26_9', type: 'MACD', period: 12, color: '#3b82f6', enabled: false },
];
```

### 1.2. Implementar a Função Matemática
Em `apps/web/src/chart/indicator-calculator.ts`:

```typescript
export interface MacdPoint {
  time: UTCTimestamp;
  macd: number;
  signal: number;
  histogram: number;
}

export function calculateMACD(
  candles: CandleInput[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MacdPoint[] {
  const fastEma = calculateEMA(candles, fastPeriod);
  const slowEma = calculateEMA(candles, slowPeriod);
  // Combinar séries e calcular a linha de sinal (EMA de 9 sobre o MACD)
  // ...
  return [];
}
```

---

## 2. Implementando uma Nova Ferramenta Geométrica (Exemplo: Retângulo / Área de Suporte)

### 2.1. Adicionar o Tipo
Em `drawing-types.ts`:
```typescript
export type DrawingToolType = 
  | 'line'
  | 'trend_line'
  | 'horizontal_line'
  | 'vertical_line'
  | 'fibonacci'
  | 'rectangle'
  | null;
```

### 2.2. Renderizar no SVG Overlay
Em `ChartDrawingOverlay.tsx`:
```tsx
if (d.type === 'rectangle' && d.p2) {
  const x1 = getPixelX(d.p1);
  const y1 = getPixelY(d.p1.price);
  const x2 = getPixelX(d.p2);
  const y2 = getPixelY(d.p2.price);

  if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

  const left = Math.min(x1, x2);
  const top = Math.min(y1, y2);
  const width = Math.abs(x2 - x1);
  const height = Math.abs(y2 - y1);

  return (
    <rect
      key={d.id}
      x={left}
      y={top}
      width={width}
      height={height}
      fill={d.color}
      fillOpacity={0.15}
      stroke={d.color}
      strokeWidth={d.lineWidth}
    />
  );
}
```
