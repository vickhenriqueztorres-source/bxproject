# Plano Geral: Isolamento Total e Blindagem do Gráfico TradingView (Lightweight Charts)

**ID da Feature**: `FEAT-CHART-ISOLATION-01`  
**Data**: 2026-10-08  
**Status**: PLANEJAMENTO HOMOLOGADO  
**Responsável**: `tech-lead-orchestrator`  
**Agentes Atribuídos**:
- `broker-architect-agent` (Desenho arquitetural e invariantes de trading)
- `chart-trading-engineer` (Ciclo de vida do Lightweight Charts, 60 FPS rAF e isolamento)
- `surgical-frontend-agent` (Edição cirúrgica com menor diff)
- `qa-resilience-agent` (Bateria de testes de estresse, caos e resiliência)
- `regression-guardian-agent` (Auditoria de regressão e garantia das 33 suítes verdes)
- `financial-correctness-reviewer` (Integridade de preços e strike flags)

---

## 1. Contexto e Diagnóstico do Problema

### O Sintoma
Toda vez que o usuário interage com o frontend (troca de aba, clique no painel de ordens, abertura de drawers, redimensionamento de janela ou atualização periódica de saldo), o gráfico da tela:
1. Pisca ou congela (flicker / tela branca);
2. Dispara erros no console como `Cannot read properties of null (reading 'getContext' / 'priceToCoordinate')`;
3. Desenha duas vezes ou colapsa para altura zero (`height: 0`).

### A Causa Raiz Identificada
O gráfico Lightweight Charts é um motor baseado em Canvas HTML5 e WebGL de baixo nível, com ciclo de vida imperativo próprio fora da árvore virtual do React.

O código atual em `apps/web/src/chart/PriceChart.tsx` (1.135 linhas) viola as 4 regras fundamentais de engenharia gráfica:
1. **Causa 4 (A mais crítica)**: No `useEffect([chartType, resampledCandles, timeframe])`, o gráfico executa `chart.removeSeries()` e `chart.addCandlestickSeries()` a cada atualização dos dados de velas. Destruir e recriar séries em vez de chamar `series.setData()` quebra todos os listeners e overlays dependentes.
2. **Causa 2 (Acoplamento de re-render)**: O `PriceChart` abriga estados de interface (`priceDirection`, `sentimentBulls`, `showAssetSelector`) e atualiza o estado React a cada tick recebido, forçando a re-renderização de toda a árvore JSX a cada milissegundo.
3. **Causa 3 (Dimensões vulneráveis)**: O container possui `style={{ width: '100%', height: '100%' }}` sem altura rígida ou proteção contra colapso temporário (`0px`) durante transições de layout Flexbox/Grid.
4. **Causa 1 (Ponto cego de cleanup)**: Overlays com timers periódicos (`setInterval` a cada 250ms) tentam ler coordenadas de séries destruídas ou em transição.

---

## 2. A Solução Arquitetural: O Padrão "Ilhamento em 3 Camadas"

Para blindar o gráfico de forma definitiva, adotamos a arquitetura de **Isolamento Total**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 1: Traderoom Shell (App.tsx, MultiChartGrid, Header, Sidebar)   │
│  - Controla layout, menus, ordens, carteira e roteamento              │
│  - Pode re-renderizar à vontade sem impactar o gráfico                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Props estáveis
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 2: ChartPresentationWrapper (PriceChart.tsx - Orquestrador UI)  │
│  - Gerencia ferramentas de desenho, seletores e overlays DOM/SVG       │
│  - NÃO instancia nem destrói séries do Lightweight Charts              │
│  - Fornece referências seguras aos overlays                            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Props primitivas / memoizadas
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ CAMADA 3: <IsolatedChartHost /> (ILHADO - NENHUMA UI REATIVA ENTRA)   │
│  - React.memo estrito com comparador de propriedades customizado       │
│  - Container com minHeight seguro (ex: 380px) contra colapso Flexbox   │
│  - Instância do Lightweight Charts 100% mantida em useRef             │
│  - Efeito 1: useEffect([]) instancia o chart e séries UMA ÚNICA VEZ   │
│  - Efeito 2: useEffect([candles]) apenas chama series.setData()        │
│  - Efeito 3: RafChartUpdater canaliza ticks via series.update()       │
│  - Cleanup hermético: cancel rAF, disconnect observer, chart.remove()  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. As 4 Regras de Ouro Invioláveis Desta Implementação

1. **Uma Instância, Uma Série**: O gráfico e as séries candlestick/área são instanciados **uma única vez** no mount. Mudança de velas NUNCA remove a série; apenas chama `series.setData(candles)`.
2. **Separação de Efeitos**: O `useEffect` de boot (criação) tem dependências vazias `[]`. O `useEffect` de alimentação de dados depende exclusivamente dos dados já formatados.
3. **Isolamento de Estado React**: Nenhum `setState` reativo a ticks ou a inputs do usuário é permitido dentro da camada de renderização do canvas. O canvas só escuta refs e canais diretos.
4. **Resiliência Geométrica**: O container possui proteção estrita contra colapso para 0px e o `ResizeObserver` rejeita silenciosamente dimensões inválidas antes de aplicar `applyOptions`.

---

## 4. Divisão em Subetapas

O plano está decomposto em 4 subetapas lineares e verificáveis:

| Subetapa | Título | Objetivo | Agente Líder |
| :--- | :--- | :--- | :--- |
| **01** | `IsolatedChartHost` e Ciclo de Vida Único | Criar o componente de canvas ilhado com criação única de séries e `setData` sem recriação. | `chart-trading-engineer` |
| **02** | Motor rAF e Atualização de Ticks em Tempo Real | Desacoplar a injeção de ticks de novos renders React e estabilizar a linha de preço atual. | `chart-trading-engineer` |
| **03** | Desacoplamento de UI no `PriceChart.tsx` | Isolar toolbars, overlays e seletores, blindando contra re-renders cascateados. | `surgical-frontend-agent` |
| **04** | Bateria de Testes: Estresse, Caos, Segurança e Regressão | Provar estabilidade sob 1.000 ticks/s, colapso de tela, desconexão e 33 testes verdes. | `qa-resilience-agent` |

---

## 5. Matriz de Critérios de Aceite e Homologação

- [ ] **CA-01 (Sem Recriação de Séries)**: Nenhuma chamada a `chart.removeSeries()` ocorre durante atualização de candles ou ticks.
- [ ] **CA-02 (Isolamento de Render)**: Mudança de saldo, abertura de drawer ou clique em botões do shell produz ZERO redesenhos no canvas do gráfico.
- [ ] **CA-03 (Imunidade a Colapso de Layout)**: Redimensionamento da tela ou transições de painel mantêm o gráfico visível e com dimensões válidas sem exceções no console.
- [ ] **CA-04 (60 FPS Sob Carga)**: Injeção de rajadas de 100 ticks em menos de 100ms resulta em coalescência rAF e renderização fluida sem travamento de thread.
- [ ] **CA-05 (Regressão Zero)**: Todas as 33 suítes de teste de `apps/web` passam com sucesso (`205/205 passed`).
