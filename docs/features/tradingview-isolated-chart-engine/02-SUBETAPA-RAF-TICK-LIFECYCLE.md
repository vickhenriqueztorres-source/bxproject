# Subetapa 02: Motor rAF e Atualização de Ticks em Tempo Real

**Feature**: `FEAT-CHART-ISOLATION-01`  
**Responsável**: `chart-trading-engineer`  
**Revisor**: `qa-resilience-agent`  
**Status**: PLANEJADO

---

## 1. Objetivo Técnico

Desacoplar completamente a injeção de ticks em tempo real do ciclo de vida do React. 

Atualmente, toda chegada de tick executa `setPriceDirection` e `setSentimentBulls`, forçando um re-render na árvore JSX inteira. Esta subetapa garante que:
- Os ticks chegam diretamente no `RafChartUpdater` via canal de alta velocidade;
- A vela atual e a linha de cotação (`currentPriceLine`) são atualizadas exclusivamente via `series.update()` e `priceLine.applyOptions()`;
- Nenhuma chamada a `setState` ocorre na frequência de ticks dentro da camada gráfica;
- O frame rate é travado a 60 FPS (16.6ms), coalescendo rajadas de ticks sem sobrecarregar a GPU ou o DOM.

---

## 2. Passo a Passo de Implementação

### Passo 2.1: Desacoplamento do Tick Stream no Canvas
Em vez de receber `tick` como prop reativa que dispara `useEffect([tick])` com cancelamento contínuo, o `IsolatedChartHost` expõe um método imperativo via `ref` ou consome um canal desacoplado:

```typescript
export interface IsolatedChartHandle {
  pushTick: (tick: Tick) => void;
  setData: (candles: CandlestickData<UTCTimestamp>[]) => void;
  scrollToRealTime: () => void;
}
```

### Passo 2.2: Ciclo de Coalescência no RafChartUpdater
O `RafChartUpdater` agenda no máximo 1 desenho por quadro de animação:
```typescript
rafUpdater.push(tick, (targetTick) => {
  const price = Number(targetTick.price);
  if (!Number.isFinite(price) || price <= 0) return;

  // 1. Atualizar a vela atual na série ativa
  const activeSeries = candleSeriesRef.current;
  if (activeSeries) {
    const nextCandle = candleFromTick(targetTick, latestCandleRef.current, timeframe);
    if (nextCandle) {
      activeSeries.update(nextCandle);
      latestCandleRef.current = nextCandle;
    }
  }

  // 2. Atualizar a linha de cotação atual SEM recriar a linha
  if (currentPriceLineRef.current) {
    currentPriceLineRef.current.applyOptions({
      price,
      title: price.toFixed(5),
    });
  } else if (activeSeries) {
    currentPriceLineRef.current = activeSeries.createPriceLine({
      price,
      color: '#DCE1EA',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: price.toFixed(5),
    });
  }
});
```

### Passo 2.3: Eliminação de `setState` no Fluxo de Ticks
Remover a chamada a `setPriceDirection` e `setSentimentBulls` de dentro do ciclo do gráfico. A direção do preço para fins de estilização da cotação passa a ser calculada internamente na ref imperativa (`lastPriceRef.current`).

### Passo 2.4: Ciclo de Vida sob Background (Tab Inativa)
Quando a aba fica oculta ou o gráfico sai do viewport:
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      rafUpdaterRef.current.pause();
    } else {
      rafUpdaterRef.current.resume((lastPendingTick) => {
        // Renderiza apenas o último tick consolidado ao voltar
      });
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

---

## 3. Matriz de Testes da Subetapa 02

### 3.1. Testes de Unidade de Throttle (`raf-tick-lifecycle.unit.test.ts`)
1. **TST-02-01**: Injetar 100 ticks sequenciais no mesmo microsegundo — verificar que o `RafChartUpdater` executa exatamente 1 chamada ao callback de render no próximo frame.
2. **TST-02-02**: Verificar que `currentPriceLine.applyOptions()` é chamado sucessivamente sem disparar `createPriceLine` mais de uma vez.
3. **TST-02-03**: Provar que o descarte de ticks atrasados ou repetidos (`sequence <= lastSequence`) ocorre antes de tocar o canvas.

### 3.2. Testes de Estresse Operacional (60 FPS Benchmark)
1. **STR-02-01**: Carga contínua de 500 ticks por segundo durante 10 segundos no ambiente de teste — confirmar que zero frames são perdidos e o heap de memória permanece estável (sem vazamento de referências em closures).

### 3.3. Testes de Caos de Rede e Feed
1. **CHS-02-01 (Tick Malformado)**: Injeção de ticks com `price: "NaN"`, `price: null`, `price: -100` — o motor deve descartar silenciosamente sem gerar `Uncaught TypeError` no canvas.
2. **CHS-02-02 (Buraco Temporal)**: Salto de timestamp de 1 hora sem ticks intermediários — o motor deve alinhar a vela ao novo bucket de tempo sem corromper as velas anteriores.

---

## 4. Critério de Homologação da Subetapa 02

- [ ] Zero re-renders React disparados pela chegada de novos ticks.
- [ ] Linha de cotação atualizada por mutação de opções (`applyOptions`), sem recriação.
- [ ] Coalescência a 60 FPS comprovada por teste unitário de estresse.
- [ ] Pausa automática de renderização quando em segundo plano.
