# Subetapa 4: Centro do Gráfico Full-Bleed & HUD de Trading

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**Especialista em Mercados:** `broker-architect-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 4 APROVADO)  

---

## 1. Objetivo da Etapa
Expandir o canvas do TradingView (`@tradingview/lightweight-charts`) para preencher **100% da área central** disponível (zero margens, zero bordas vazias):
- Fundo dark gradient sofisticado (`#080e1d` para `#050811`).
- **HUD Flutuante Superior Esquerdo**:
  - Seletor de Tipo de Gráfico: Velas Japonesas (`Candlestick`) vs Gráfico de Linha (`Area/Line`).
  - Seletor de Timeframe de Velas: `5s`, `10s`, `30s`, `1m`, `5m`.
  - Indicadores rápidos (ex: SMA/EMA ou Volatilidade).
- **Barra de Sentimento dos Traders (Trader Sentiment Bar)**:
  - Exibição vertical ou horizontal da proporção de ordens ativas da comunidade (% Touros / Verdes vs % Ursos / Vermelhos, ex: 68% Alta vs 32% Baixa).
- **Mira de Preço & Linhas de Entrada de Contrato**:
  - Renderização das linhas horizontais no gráfico para ordens abertas (Strike Price e Target).

---

## 2. Especificação Técnica do Canvas

### Configuração do TradingView Lightweight Charts
```typescript
const chart = createChart(container, {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: 'transparent' },
    textColor: '#8e9db7',
    fontSize: 11,
    fontFamily: "'Space Grotesk', -apple-system, sans-serif",
  },
  grid: {
    vertLines: { color: 'rgba(34, 50, 77, 0.4)', style: LineStyle.Dotted },
    horzLines: { color: 'rgba(34, 50, 77, 0.4)', style: LineStyle.Dotted },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
    vertLine: { color: '#4a658d', width: 1, style: LineStyle.Dashed },
    horzLine: { color: '#4a658d', width: 1, style: LineStyle.Dashed },
  },
  rightPriceScale: {
    borderColor: '#1d2a41',
    scaleMargins: { top: 0.15, bottom: 0.15 },
  },
  timeScale: {
    borderColor: '#1d2a41',
    timeVisible: true,
    secondsVisible: true,
  },
});
```

---

## 3. Matriz de Testes & Validação da Etapa 4

### A. Teste de Estresse (Frequência de Ticks e Framerate)
- Injetar 50 ticks/segundo no canvas:
  - O gráfico deve atualizar a última vela sem travamento e sem acúmulo de garbage collection.
  - O uso de memória deve se manter estável por mais de 5 minutos contínuos.

### B. Teste de Responsividade (Canvas Stretch)
- Ao redimensionar ou recolher a gaveta inferior ou a sidebar:
  - O canvas deve preencher imediatamente a nova área sem deixar faixas pretas ou cinzas vazias.

### C. Teste de Caos (Comutação Instantânea de Timeframes)
- Alternar rapidamente entre 5s, 1m e 5m:
  - O agrupamento de candles deve recalcular corretamente sem perder o histórico.

---

## 4. Critérios de Passagem (Quality Gate 4)
- [ ] O canvas preenche 100% da área central com fundo escuro gradiente.
- [ ] O HUD flutuante permite trocar timeframe e tipo de gráfico sem recriar a página.
- [ ] Barra de sentimento visual ativa e animada.
- [ ] Linha de preço ao vivo e mira (crosshair) operando com suavidade a 60 FPS.
