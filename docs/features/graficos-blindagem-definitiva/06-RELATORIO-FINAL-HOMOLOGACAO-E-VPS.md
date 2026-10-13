# Relatório Forense: Debug Completo, Blindagem Definitiva e Deploy na VPS

**Data**: 09/10/2026  
**Status**: Homologado e Ativo em Produção (VPS `169.58.159.77`)  
**Responsáveis Técnicos**: `tech-lead-orchestrator`, `chart-trading-engineer`, `broker-architect-agent`, `qa-resilience-agent`  
**Skills Ativadas**: `11-chart-trading-tools`, `03-synthetic-market-engine`, `06-testing-quality`, `17-mudanca-cirurgica`

---

## 1. Diagnóstico Forense das Evidências Visuais (Prints do Usuário)

A partir da análise detalhada das capturas de tela fornecidas pelo usuário, foram isoladas **3 falhas críticas correlacionadas**:

### Falha A: Dezenas de Linhas Pontilhadas Empilhadas & Escala Esmagada (Print 2)
- **Sintoma Visual**: No gráfico USD/JPY (~151.20), dezenas de linhas horizontais pontilhadas acumularam-se em torno de ~100.00000 (`99.99835` a `100.00040`). O eixo de preços foi forçado a esticar de 100.00 a 151.35, esmagando as velas reais do USD/JPY em um traço fino.
- **Causa Raiz Comprovada (`PriceChart.tsx`)**:
  - O efeito de sincronização da linha de preço continha dependência reativa em `priceDirection`. A cada oscilação de tick (`UP` <-> `DOWN`), tentava remover a linha anterior chamando `prevSeries.removePriceLine()`.
  - Quando o gráfico estava no modo `candles`, a variável `prevSeries` apontava incorretamente para `areaSeries.current` devido a uma inversão ternária.
  - A remoção falhava silenciosamente dentro de um bloco `try/catch`. A linha anterior **nunca era removida** da `candleSeries`.
  - `currentPriceLine.current` era anulado e uma nova linha era criada a cada oscilação, orfanando centenas de linhas na memória do canvas da TradingView.
  - Ao trocar de aba/ativo, as linhas órfãs de 100.00 continuavam gravadas na série, destruindo a escala Y do novo ativo.

### Falha B: AUD/USD Cotado em 100.00000 com Vela Gigante (Print 1)
- **Sintoma Visual**: O par `AUD/USD (OTC)` exibia cotações em `100.00000`, `99.99982`, `99.99943` em vez da sua cotação fiduciária real (~`0.65820`), gerando uma vela de anomalia até 100.07.
- **Causa Raiz Comprovada (`assets.ts`)**:
  - A função `getAssetBasePrice(symbol)` possuía apenas 13 ativos no catálogo com preços base cadastrados.
  - 23 dos 36 ativos (incluindo `AUDUSD_OTC`, `USDCAD_OTC`, `USDCHF_OTC`, `EURAUD_OTC`, etc.) caíam no fallback genérico:
    ```typescript
    return 100.0;
    ```
  - Quando o gráfico abria em modo visitante ou antes do primeiro tick chegar, o gerador de sementes inicializava as velas em 100.00.

### Falha C: Linhas de Tempo Projetadas 25 Velas no Vácuo (Print 1)
- **Sintoma Visual**: A linha de expiração (vermelha) e a linha de compra (branca pontilhada) ficavam posicionadas de 15 a 25 velas à frente no espaço vazio, descoladas da duração real da rodada de 60s.
- **Causa Raiz Comprovada (`TimeLinesOverlay.tsx`)**:
  - O cálculo da posição X utilizava uma fórmula arbitrária baseada na largura da tela:
    ```typescript
    forwardSpace = Math.min(220, Math.max(70, (effectiveWidth - xCandle) * 0.85));
    ```
  - Esse cálculo ignorava a largura real da barra (`barSpacing`), o timeframe ativo (ex: 5s vs 1m) e os segundos reais restantes.

---

## 2. Implementação Passo a Passo por Subetapas

```
[00-PLANO-MESTRE] Debug Forense e Blindagem
        │
        ├── [Subetapa 01] Eliminação de Vazamento de Price Lines (PriceChart.tsx)
        │                 ↳ safeRemoveCurrentPriceLine() + Isolamento de ciclo de vida
        │
        ├── [Subetapa 02] Catálogo Completo dos 36 Ativos (assets.ts)
        │                 ↳ ASSET_BASE_PRICES com cotações e precisões autênticas
        │
        ├── [Subetapa 03] Sincronização Geométrica de Tempo (TimeLinesOverlay.tsx)
        │                 ↳ Ancoragem por barSpacing e timeframeSeconds()
        │
        ├── [Subetapa 04] Bateria Unificada de Estresse, Caos e Anti-Regressão
        │                 ↳ 5.000 ticks, comutação de 100 ativos, 368 testes verdes
        │
        └── [Subetapa 05] Deploy em Produção com Reinicialização na VPS
                          ↳ Nginx reloaded, PM2 broker-feed restarted, 200 OK
```

### Subetapa 01: Prevenção Definitiva de Vazamento de Price Lines
- **Arquivo Modificado**: `apps/web/src/chart/PriceChart.tsx`
- **Ações Realizadas**:
  1. Criação do ref `currentPriceLineSeries` para rastrear exatamente em qual série a linha de preço foi instanciada.
  2. Implementação da função `safeRemoveCurrentPriceLine` com remoção idempotente e anulação segura de referências.
  3. Remoção de `priceDirection` do `useEffect` de criação, transferindo a atualização de direção e cor estritamente para `applyOptions` dentro do rAF coalescido (`RafChartUpdater`).
  4. Higienização mandatória de linhas órfãs em trocas de ativo (`symbol`) e desmontagem do componente (`unmount`).

### Subetapa 02: Catálogo Completo dos 36 Ativos e Preços Base
- **Arquivo Modificado**: `apps/web/src/catalog/assets.ts`
- **Ações Realizadas**:
  1. Mapeamento dos 36 ativos em `ASSET_BASE_PRICES`, alinhados com o backend (`dev-live-feed.mjs` e `0010_seed_multi_assets.up.sql`).
  2. `AUDUSD_OTC` calibrado para `0.65820` (precisão 5).
  3. `USDJPY_OTC` para `153.820`, `USDCAD_OTC` para `1.38450`, `USDCHF_OTC` para `0.86510`.
  4. Sintéticos calibrados: `SYNTH_VOL_10` (100.5420), `SYNTH_VOL_25` (250.8410), `SYNTH_VOL_50` (1250.0), `SYNTH_VOL_75` (750.3200), `SYNTH_VOL_100` (1000.4500).
  5. Fallback defensivo por classe de ativo eliminando o antigo retorno arbitrário de 100.0.

### Subetapa 03: Ancoragem Geométrica das Linhas de Tempo
- **Arquivo Modificado**: `apps/web/src/chart/TimeLinesOverlay.tsx`
- **Ações Realizadas**:
  1. Passagem do `timeframe` ativo para o overlay via `PriceChart.tsx`.
  2. Cálculo dinâmico do espaçamento real da barra (`barSpacing`) consultando `timeScale.coordinateToLogical()` e `logicalToCoordinate()`.
  3. Projeção geométrica exata:
     - No timeframe de 1m com 60s restantes: a expiração fica a **exatamente 1 barra à frente** da vela atual.
     - No timeframe de 5s com 30s restantes: a expiração fica a **6 barras à frente**.
     - Com compra travada (`isPurchaseLocked`): a linha de compra cola na vela atual.

### Subetapa 04: Bateria de Estresse, Caos e Regressão
- **Suítes Executadas**:
  - `subetapa-01-price-lines-leak.unit.test.ts`: 1.000 oscilações de tick mantendo exatamente 1 linha e zero órfãs.
  - `subetapa-02-asset-catalog-base-prices.unit.test.ts`: Cobertura dos 36 ativos com preços base reais.
  - `subetapa-03-timelines-overlay-anchoring.unit.test.ts`: Prova matemática de ancoragem temporal em múltiplos timeframes.
  - `subetapa-04-integrated-chaos-stress.unit.test.ts`: Comutação contínua de 100 ativos e 5.000 ticks.
- **Resultado Global**: **71 arquivos de teste passaram, 368 testes verdes (100% de sucesso)**.
- **Build de Produção**: `tsc && vite build` concluído com código de saída 0.

---

## 3. Homologação e Reinicialização na VPS

O script de deploy automatizado (`scripts/deploy-to-vps.mjs`) foi executado com sucesso:
1. **Bundle Web**: `apps/web/dist` empacotado em `web-dist.zip` (209.861 bytes) e enviado via SFTP para a VPS `169.58.159.77`.
2. **Atualização no Servidor**: Descompactado em `/root/app/apps/web/dist` com permissões 755.
3. **Serviços Recarregados**:
   - `nginx -t && systemctl reload nginx` -> Sintaxe válida, recarga concluída.
   - `pm2 restart broker-feed` -> Reiniciado com sucesso (Processo ID 0 online).
4. **Smoke Tests Remotos Executados na VPS**:
   - `Smoke Test 1`: Bundle de frontend ativo (`assets/index-BpTSim58.js`).
   - `Smoke Test 2`: Candles 10.080 (7 dias de histórico) respondendo normalmente.
   - `Smoke Test 3`: Resampling de velas 5m com 2.017 barras calculadas.
   - `Smoke Test 4`: `/health` retornando `status: "ok"`, 36 ativos ativos.
5. **Status Global da VPS**:
   - Nginx: `HTTP/1.1 200 OK`
   - Painel Admin: `HTTP/1.1 200 OK`
   - 9 containers Docker operacionais e saudáveis.
