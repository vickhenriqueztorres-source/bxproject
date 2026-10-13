# Subetapa 01: Componente Ilhado `IsolatedChartHost` e Ciclo de Vida Único

**Feature**: `FEAT-CHART-ISOLATION-01`  
**Responsável**: `chart-trading-engineer`  
**Revisor**: `broker-architect-agent`  
**Status**: PLANEJADO

---

## 1. Objetivo Técnico

Criar um componente puro e isolado (`IsolatedChartHost.tsx`) responsável exclusivamente por gerenciar o ciclo de vida do DOM Canvas do **TradingView Lightweight Charts (v4.2.1)**. 

Este componente elimina completamente a **Causa 4** (recriação de séries) e a **Causa 3** (colapso de dimensões), garantindo que:
- O gráfico e as séries de dados sejam instanciados **uma única vez** (`[]`);
- Atualizações de velas ocorram exclusivamente via `series.setData()`;
- O container nunca colapse para 0px e o `ResizeObserver` rejeite dimensões não-positivas;
- O React nunca force re-renders desnecessários na árvore do Canvas.

---

## 2. Passo a Passo de Implementação

### Passo 1.1: Criação de `IsolatedChartHost.tsx`
Localização: `apps/web/src/chart/IsolatedChartHost.tsx`

**Assinatura de Props**:
```typescript
export interface IsolatedChartHostProps {
  candles: CandlestickData<UTCTimestamp>[];
  chartType: 'candles' | 'line';
  timeframe: Timeframe;
  isBinmax: boolean;
  onChartReady?: (api: {
    chart: IChartApi;
    series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
    timeScale: ITimeScaleApi;
  }) => void;
  onDimensionsChange?: (dimensions: { width: number; height: number }) => void;
}
```

### Passo 1.2: Criação Única de Gráfico e Séries no Mount
O hook de montagem inicial deve ter **dependências vazias** `[]`:
```typescript
useEffect(() => {
  if (!hostRef.current) return;

  const initWidth = Math.max(hostRef.current.clientWidth || 800, 320);
  const initHeight = Math.max(hostRef.current.clientHeight || 500, 300);

  const chart = createChart(hostRef.current, {
    autoSize: false,
    width: initWidth,
    height: initHeight,
    layout: {
      background: { type: ColorType.Solid, color: isBinmax ? '#0D0F14' : 'transparent' },
      textColor: isBinmax ? '#8A92A1' : '#8e9ebc',
      fontSize: 11,
    },
    // ... opções de grid, crosshair e scales
  });

  // Criação antecipada e estável da série
  const candleSeries = chart.addCandlestickSeries({ ... });
  const areaSeries = chart.addAreaSeries({ ... });

  // Controlar visibilidade sem destruir a instância
  if (chartType === 'candles') {
    candleSeries.applyOptions({ visible: true });
    areaSeries.applyOptions({ visible: false });
  } else {
    candleSeries.applyOptions({ visible: false });
    areaSeries.applyOptions({ visible: true });
  }

  chartRef.current = chart;
  candleSeriesRef.current = candleSeries;
  areaSeriesRef.current = areaSeries;

  // Notificar pai com referências seguras
  onChartReady?.({
    chart,
    series: chartType === 'candles' ? candleSeries : areaSeries,
    timeScale: chart.timeScale(),
  });

  return () => {
    resizeObserver.disconnect();
    chart.remove();
    chartRef.current = null;
    candleSeriesRef.current = null;
    areaSeriesRef.current = null;
  };
}, []); // NUNCA reinicia o gráfico por mudança de dado ou prop
```

### Passo 1.3: Efeito de Dados Dedicado (`setData`)
Um `useEffect` separado cuida exclusivamente de alimentar os dados nas séries existentes, **sem nunca chamar `removeSeries`**:
```typescript
useEffect(() => {
  if (!candleSeriesRef.current || !areaSeriesRef.current || candles.length === 0) return;

  if (chartType === 'candles') {
    candleSeriesRef.current.setData(candles);
  } else {
    const lineData: AreaData<UTCTimestamp>[] = candles.map((c) => ({
      time: c.time,
      value: c.close,
    }));
    areaSeriesRef.current.setData(lineData);
  }
}, [candles, chartType]);
```

### Passo 1.4: Blindagem Geométrica no ResizeObserver
O observer deve defender o canvas contra colapsos de flex/grid:
```typescript
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    // REJEIÇÃO DEFENSIVA: Se a tela reportar 0 (ex: transição de painel), não esmaga o canvas
    if (width > 50 && height > 50 && chartRef.current) {
      chartRef.current.applyOptions({ width, height });
      onDimensionsChange?.({ width, height });
    }
  }
});
```

### Passo 1.5: Envelopamento com `React.memo`
Envelopar o export com comparação estrita:
```typescript
export const IsolatedChartHost = React.memo(IsolatedChartHostComponent, (prev, next) => {
  return (
    prev.candles === next.candles &&
    prev.chartType === next.chartType &&
    prev.timeframe === next.timeframe &&
    prev.isBinmax === next.isBinmax
  );
});
```

---

## 3. Matriz de Testes da Subetapa 01

### 3.1. Testes de Unidade e Ciclo de Vida (`isolated-chart-host.unit.test.ts`)
1. **TST-01-01**: Provar que montar o componente e atualizar `candles` 10 vezes consecutivas invoca `setData` 10 vezes e `removeSeries` ZERO vezes.
2. **TST-01-02**: Provar que a alternância entre `chartType = 'candles'` e `chartType = 'line'` altera a visibilidade das séries sem invocar `chart.remove()` ou `chart.removeSeries()`.
3. **TST-01-03**: Provar que desmontar o componente executa o cleanup completo (`chart.remove()` e `resizeObserver.disconnect()`).

### 3.2. Testes de Estresse de Dados
1. **STR-01-01**: Carga instantânea de 10.000 velas no `setData` — verificar que o tempo de execução é inferior a 35ms sem estouro de pilha.

### 3.3. Testes de Caos Geométrico
1. **CHS-01-01**: Simular entrada do `ResizeObserver` com `{ width: 0, height: 0 }` (colapso de layout) — verificar que o método `applyOptions` NÃO é chamado e o gráfico preserva suas dimensões prévias sem crash.
2. **CHS-01-02**: Simular redimensionamento rápido em loop (100 oscilações de 100px a 1920px em 1s) — verificar que o rAF e o observer processam sem travamento.

---

## 4. Critério de Homologação da Subetapa 01

- [ ] Arquivo `IsolatedChartHost.tsx` criado e documentado.
- [ ] Criação do gráfico em `useEffect([])` sem dependências voláteis.
- [ ] Zero chamadas a `removeSeries()` em atualizações de dados.
- [ ] 100% dos testes unitários da subetapa verdes.
