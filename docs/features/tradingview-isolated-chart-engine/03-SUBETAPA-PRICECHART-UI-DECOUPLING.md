# Subetapa 03: Desacoplamento de UI e Overlays no `PriceChart.tsx`

**Feature**: `FEAT-CHART-ISOLATION-01`  
**Responsável**: `surgical-frontend-agent`  
**Revisor**: `chart-trading-engineer`  
**Status**: PLANEJADO

---

## 1. Objetivo Técnico

Refatorar cirurgicamente o arquivo `apps/web/src/chart/PriceChart.tsx` para convertê-lo em um **Orquestrador de Apresentação (Camada 2)**, removendo a lógica imperativa do Canvas que foi encapsulada no `IsolatedChartHost`.

Esta subetapa resolve a **Causa 2** (o gráfico re-renderiza com o resto da tela) e a **Causa 1** (erros de overlay com referências nulas), garantindo que:
- O `PriceChart` apenas orquestra overlays SVG, toolbars e seletores;
- Toda interação de UI (abrir drawer, clicar em ferramenta de desenho, mudar timeframe) não reinicia o Canvas nem recria séries;
- Os overlays recebem instâncias estáveis e verificam defensivamente a prontidão do gráfico antes de projetar coordenadas;
- O diff seja cirúrgico e mantenha compatibilidade total com os testes existentes.

---

## 2. Passo a Passo de Implementação

### Passo 3.1: Integração do `IsolatedChartHost` no `PriceChart.tsx`
Substituir o elemento `<div className="chart-host" ref={host} />` e os efeitos de canvas dentro do `PriceChart` pelo componente ilhado:

```tsx
<div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '380px' }}>
  {/* Camada 3 Ilhada: Canvas PURO do Lightweight Charts */}
  <IsolatedChartHost
    candles={resampledCandles}
    chartType={chartType}
    timeframe={timeframe}
    isBinmax={isBinmax}
    onChartReady={handleChartReady}
    onDimensionsChange={setDimensions}
  />

  {/* Overlays DOM/SVG sobrepostos com verificação de prontidão */}
  {isChartReady && (
    <>
      <TimeLinesOverlay ... />
      <OrderFlagsOverlay ... />
      <ChartDrawingOverlay ... />
    </>
  )}

  {/* Barras e Toolbars Laterais Flutuantes */}
  <ChartDrawingToolbar ... />
  <TradersMoodBar bullsPercentage={sentimentBulls} />
</div>
```

### Passo 3.2: Guarda de Prontidão Defensiva para Overlays
Evitar qualquer chamada a `priceToCoordinate` ou `timeToCoordinate` antes do canvas estar computado e com dimensões válidas:
```typescript
const [chartApi, setChartApi] = useState<{
  chart: IChartApi;
  series: ISeriesApi<'Candlestick'> | ISeriesApi<'Area'>;
} | null>(null);

const handleChartReady = useCallback((api: { chart: IChartApi; series: any }) => {
  setChartApi(api);
}, []);
```

### Passo 3.3: Sanitização Defensiva do LocalStorage
Garantir que a carga de desenhos não gere exceções ao mudar de ativo:
```typescript
const [drawings, setDrawings] = useState<DrawingItem[]>(() => {
  try {
    const raw = localStorage.getItem('broker_drawings_' + symbol);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});
```

### Passo 3.4: Memoização Estrita de Props no `MultiChartGrid`
No `MultiChartGrid.tsx` (`GridCell`), memoizar o objeto de contratos e props repassadas para evitar que o React dispare renders redundantes no `PriceChart`:
```typescript
const relevantContracts = useMemo(
  () => contracts.filter((c) => c.status === 'OPEN' && c.symbol === symbol),
  [contracts, symbol]
);
```

---

## 3. Matriz de Testes da Subetapa 03

### 3.1. Testes de Unidade de Orquestração (`pricechart-decoupling.unit.test.tsx`)
1. **TST-03-01**: Renderizar `PriceChart` e acionar toggle de ferramentas de desenho — verificar que o estado da toolbar atualiza sem desmontar o `IsolatedChartHost`.
2. **TST-03-02**: Simular `activeContracts` adicionados e removidos dinamicamente — verificar que o `OrderFlagsOverlay` atualiza bandeirinhas sem afetar o canvas de velas.
3. **TST-03-03**: Provar que os overlays permanecem inertes e não lançam exceções quando `isChartReady === false`.

### 3.2. Testes de Regressão Visual e Estrutural
1. **REG-03-01**: Confirmar que a paleta de cores Turbo Prata (#0D0F14, #22C47A, #F2545B, #DCE1EA) permanece 100% idêntica.
2. **REG-03-02**: Confirmar que todos os 10 indicadores técnicos nativos continuam sincronizando corretamente com a nova arquitetura.

---

## 4. Critério de Homologação da Subetapa 03

- [ ] `PriceChart.tsx` refatorado e limpo de imperativos de criação de canvas.
- [ ] Overlays protegidos por flags de prontidão (`isChartReady`).
- [ ] Zero erros de `null` em callbacks de coordenadas.
- [ ] 100% dos testes unitários da subetapa verdes.
