# Plano Mestre: Debug Forense e Blindagem Definitiva do Motor Gráfico

## 1. Identificação Forense a partir das Evidências Visuais (Imagens Fornecidas)

### Imagem 1: AUD/USD Turbo em ~100.00 com Linhas Deslocadas
- **Sintoma 1 (Preço Anômalo)**: O ativo `AUD/USD` é cotado em `100.00000`, `99.99982`, `99.99943` em vez da sua cotação fiduciária real (~`0.65820`), gerando uma vela vermelha gigante de anomalia até 100.07.
- **Sintoma 2 (Linhas de Tempo no Vácuo)**: A linha vermelha de expiração e a linha branca pontilhada de compra são desenhadas 15 a 25 velas (~3 a 5 minutos) à frente no vazio, descoladas da duração real da rodada de 60s.

### Imagem 2: USD/JPY em ~151.20 com Escala Esmagada e Linhas Fantasma
- **Sintoma 3 (Dezenas de Price Lines Acumuladas)**: Dezenas de linhas horizontais pontilhadas empilhadas em `~100.00000` (`99.99835` a `100.00040`) vazadas da aba anterior (ex: Vol 50 ou guest fallback).
- **Sintoma 4 (Escala de Preço Distorcida)**: O eixo Y foi forçado a exibir o intervalo de 99.80 até 151.40 ao mesmo tempo, reduzindo as velas reais do USD/JPY a uma linha minúscula sem corpo.

---

## 2. Diagnóstico da Causa Raiz (Root Cause Analysis)

### Causa Raiz A: Vazamento e Acúmulo de Linhas de Preço (`PriceChart.tsx`)
1. No `useEffect` de linhas de preço (`lines 206-232`), a dependência escutava `[chartType, isBinmax, priceDirection]`.
2. A cada oscilação de direção do preço (`UP` <-> `DOWN`), o efeito executava:
   ```typescript
   const prevSeries = chartType === 'candles' ? areaSeries.current : candleSeries.current;
   if (prevSeries) prevSeries.removePriceLine(currentPriceLine.current);
   ```
3. Quando em modo velas (`candles`), `prevSeries` era atribuído como `areaSeries.current`!
4. A linha foi criada em `candleSeries.current`, mas a tentativa de remoção era feita na `areaSeries.current`!
5. O Lightweight Charts lançava um erro silencioso engolido pelo `catch {}`. A linha antiga **nunca** era removida da `candleSeries`!
6. `currentPriceLine.current` era setado como `null` e uma **nova linha** era criada na `candleSeries` a cada tick ou oscilação de direção!
7. Ao alternar de ativo (de Vol 50 para USD/JPY), as dezenas de linhas órfãs já gravadas no canvas permaneciam na memória da série, distorcendo toda a escala Y.

### Causa Raiz B: Cotações Base Incompletas no Catálogo (`assets.ts`)
1. O método `getAssetBasePrice(symbol)` possuía apenas 13 símbolos mapeados.
2. 23 dos 36 ativos (incluindo `AUDUSD_OTC`, `USDCAD_OTC`, `USDCHF_OTC`, etc.) caíam no fallback:
   ```typescript
   return 100.0;
   ```
3. O gerador de velas semente (`generateSeedCandles`) e o modo visitante usavam `100.0` para AUD/USD, gerando velas em 100.00 em vez de 0.65820.

### Causa Raiz C: Projeção Pixel Arbitrária das Linhas de Tempo (`TimeLinesOverlay.tsx`)
1. O cálculo de posição horizontal usava a fórmula arbitrária:
   ```typescript
   const forwardSpace = Math.min(220, Math.max(70, (effectiveWidth - xCandle) * 0.85));
   xExpiration = Math.min(maxExpirationX, xCandle + forwardSpace);
   ```
2. Essa fórmula jogava a linha de expiração a 85% do espaço vazio à direita da tela, ignorando o timeframe selecionado (ex: 5s) e o tempo real restante (1 minuto = 12 velas de 5s, ou 1 vela de 1m).

---

## 3. Matriz de Subetapas e Critérios de Aceite

| Subetapa | Escopo | Arquivo Alvo | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **01** | Eliminação Total do Vazamento de Price Lines | `PriceChart.tsx` | Referência da série proprietária mantida em ref. Efeito isolado. Zero linhas órfãs após 1.000 oscilações de tick. Escala Y sem distorção. |
| **02** | Catálogo Completo dos 36 Ativos com Preço Base e Precisão | `assets.ts` | 100% dos 36 ativos mapeados com preços idênticos ao `dev-live-feed.mjs` e `0010_seed_multi_assets.up.sql`. Zero ativos com fallback indevido de 100.0. |
| **03** | Ancoragem Geométrica das Linhas de Tempo | `TimeLinesOverlay.tsx` | Projeção temporal baseada no espaçamento real de barras (`barSpacing`) e segundos restantes. Linha de expiração cravada no horizonte da rodada. |
| **04** | Bateria de Testes de Estresse, Caos e Regressão | Testes Automatizados | Testes cobrindo comutação de ativos, 1.000 oscilações de preço, ausência de vazamento de memória e integridade dos 363+ testes. |
| **05** | Build, Homologação e Deploy com Restart na VPS | `scripts/deploy-to-vps.mjs` | Build do monorepo, upload via SSH, recarga do Nginx, restart do PM2 e smoke tests remotos 100% verdes. |
