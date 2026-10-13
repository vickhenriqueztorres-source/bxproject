# PLANO GERAL: RESOLUÇÃO DEFINITIVA E BLINDAGEM INDUSTRIAL DOS GRÁFICOS (TRADINGVIEW LIGHTWEIGHT CHARTS)

> **Autoridade:** `tech-lead-orchestrator`  
> **Pool de Especialistas:** `chart-trading-engineer`, `broker-architect-agent`, `surgical-frontend-agent`, `qa-resilience-agent`, `security-reviewer`, `financial-correctness-reviewer`  
> **Data:** 09/10/2026  
> **Status:** EM EXECUÇÃO RIGOROSA PASSO A PASSO

---

## 1. Diagnóstico Forense: Por que o gráfico quebra ao mexer no front?

O usuário reportou:
> *"E os gráficos porque toda vez que eu mexo algo no front quebra o front... VEJA SE ISSO AQUI FOI IMPLEMENTADO... erro - Tem erros nos graficos nao estao funcionando corretamente"*

A investigação forense completa identificou que o gráfico quebrava e travava devido a **uma combinação das 4 causas clássicas do TradingView com 4 armadilhas ocultas de ciclo de vida e estado**:

### As 4 Causas Clássicas do TradingView
1. **Falta de Cleanup Adequado de Canvas e Timers:** O ciclo de vida do Lightweight Charts precisa de separação cirúrgica entre a montagem do Canvas (`useRef` + `useEffect` com `[]`) e os hooks de renderização de dados.
2. **Re-render Descontrolado com Criação de Objetos Inline:** Passagem de props não-memoizadas ou chamadas a `chart.removeSeries()` causavam recriação repetida de instâncias de desenho e referências nulas (`Cannot read properties of null (reading 'getContext')`).
3. **Colapso de Dimensões em Flex/Grid:** Quando o layout muda ou abas colapsam, `clientWidth` ou `clientHeight` tornam-se 0 ou <= 50px, fazendo o Lightweight Charts quebrar internamente.
4. **Destruição do Gráfico em Vez de Atualização com `setData()`/`update()`:** Ao trocar de ativo ou timeframe, destruir e recriar o widget gerava flickers, telas pretas e zumbis de memória.

### As 4 Armadilhas Ocultas Detectadas na Análise Forense
5. **Armadilha 1: Bloqueio Monotônico no `RafChartUpdater` ao Trocar de Ativo:**
   - O `RafChartUpdater` guardava uma única `lastSequence: bigint` global.
   - Quando o usuário operava `SYNTH_VOL_50` (sequência ~50.000) e trocava para `EURUSD_OTC` (sequência ~1.000), a verificação `seq <= this.lastSequence` bloqueava **100% dos ticks do novo ativo como se fossem duplicatas desordenadas**.
   - O gráfico congelava completamente ao trocar de ativo!
6. **Armadilha 2: Esmagamento de Escala Vertical por Preços Órfãos:**
   - Ao trocar de um ativo de alto valor (ex: `BTCUSD` a US$ 60.000) para um ativo de baixo valor (ex: `EURUSD` a 1.08), a linha de preço `currentPriceLine` e os `strikeLinesMap` do ativo anterior permaneciam fixados na série.
   - A escala do Lightweight Charts tentava comportar 60.000 e 1.08 ao mesmo tempo, **achatando as velas de EURUSD em uma linha horizontal invisível (gráfico "sumia")**.
7. **Armadilha 3: Indicadores e Lazy Loading Órfãos no Mount:**
   - No `PriceChart.tsx`, os `useEffect` que registravam os indicadores técnicos e o listener de scroll para trás (`subscribeVisibleLogicalRangeChange`) dependiam apenas de `[indicators, resampledCandles]`, omitindo `isChartReady`.
   - No mount inicial, `chartInstance.current` era nulo; os efeitos retornavam sem vincular os indicadores nem o listener de lazy loading.
8. **Armadilha 4: Violação de Segurança e CSPRNG (Auditoria A-07):**
   - O fallback offline de ticks no `TradingFeedManager.ts` usava `Math.random()`, falhando o teste de conformidade de segurança e invariantes financeiras `tests/unit/client-no-simulated-quotes.test.ts`.

---

## 2. Matriz de Subetapas do Plano Geral

O plano foi decomposto em 4 subetapas atômicas com critérios rigorosos de teste antes do avanço:

| Subetapa | Arquivo de Detalhamento | Foco Técnico | Testes Requeridos |
|---|---|---|---|
| **Subetapa 01** | `01-SUBETAPA-01-DESBLOQUEIO-SEQUENCIAL-E-ISOLAMENTO-MULTI-ATIVO.md` | Reset e particionamento de sequência no `RafChartUpdater` por símbolo; limpeza de buffers e `lastPrice`. | Testes de troca rápida de ativo, monotonicidade multissímbolo e teste de estresse de ticks concorrentes. |
| **Subetapa 02** | `02-SUBETAPA-02-OVERLAYS-INDICADORES-E-ESCALA-VERTICAL.md` | Expurgar linhas de preço/strikes órfãs na troca de ativo; auto-rescale de escala de preço e tempo (`scrollToRealTime`); reativação de indicadores com `isChartReady`. | Testes de comutação BTC -> EURUSD sem esmagamento de escala; verificação de renderização dos 10 indicadores nativos. |
| **Subetapa 03** | `03-SUBETAPA-03-CONFORMIDADE-CSPRNG-E-AUDITORIA-SEGURANCA.md` | Remoção total de `Math.random` em `TradingFeedManager.ts` usando CSPRNG Web Crypto; correção da fórmula de Ornstein-Uhlenbeck e Fastify hook. | `client-no-simulated-quotes.test.ts` (0 violações); `ou-generator.unit.test.ts` (100% verde); `contracts.unit.test.ts` (100% verde). |
| **Subetapa 04** | `04-SUBETAPA-04-TESTES-DE-STRESS-CAOS-E-HOMOLOGACAO-TOTAL.md` | Bateria de testes de caos e estresse contínuo: redimensionamento extremo, 10.000 ticks/s, GPU crash/restore, suite completa verde. | 100% das suites de teste do Vitest e Node TAP passando sem regressões. |

---

## 3. Protocolo de Transição entre Subetapas

Nenhuma subetapa será dada por concluída sem a execução completa dos seus testes automatizados dedicados. O avanço ocorre estritamente na ordem sequencial 01 -> 02 -> 03 -> 04.
