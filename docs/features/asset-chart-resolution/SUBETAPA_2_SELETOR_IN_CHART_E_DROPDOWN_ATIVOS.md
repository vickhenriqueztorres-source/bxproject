# SUBETAPA 2: Seletor Interativo In-Chart & Troca Rápida de Ativos

> **Data:** 08/10/2026  
> **Status:** PLANEJADO  
> **Responsáveis:** `chart-trading-engineer`, `iq-fidelity-reviewer`, `qa-resilience-agent`  

---

## 1. Problema Abordado e Objetivos

### Diagnóstico Fático:
No print enviado pelo usuário, no canto superior esquerdo do gráfico, há uma pílula preta com borda suave:
`[ SYNTH_VOL_50 Turbo ▾ | ⓘ 🔔 ★ ]`.
O usuário clica na seta `Turbo ▾` ou no nome do ativo para escolher outro mercado e **nada acontece**.
Além disso, no layout 1x1 da Binmax, os seletores da grade ficam ocultos, deixando o usuário sem nenhum meio intuitivo de trocar de ativo dentro da área de trabalho do gráfico.

### Objetivos da Subetapa:
1. Tornar o componente `chart-top-asset-pill` em `apps/web/src/chart/PriceChart.tsx` 100% interativo.
2. Adicionar a prop `onSelectSymbol?: (symbol: string) => void` em `PriceChartProps` e propagar a seleção até o `MultiChartGrid` e `App.tsx`.
3. Criar o dropdown/popover flutuante integrado ao pill com:
   - Campo de busca instantâneo ("Buscar activo...");
   - Filtro de categorias: `Todos`, `Sintéticos`, `Forex`, `Cripto`, `Commodities`;
   - Lista rolante com bandeiras circulares SVG, payouts em verde neon (`+85%`), e indicador de ativo atual;
   - Fechamento gracioso com tecla `ESC` ou clique externo (backdrop sutil).
4. Ao clicar em um novo ativo, o gráfico deve:
   - Trocar imediatamente o ativo da visualização;
   - Cancelar a subscrição do ativo anterior e subscrever o novo via `tradingFeedManager`;
   - Carregar as velas do novo ativo;
   - Sincronizar a aba ativa no cabeçalho superior e atualizar a boleta de ordens lateral para o novo ativo.

---

## 2. Especificação de Interface e Componentes

```tsx
export interface PriceChartProps {
  candles: Candle[];
  tick: Tick | null;
  symbol: string;
  activeContracts: Contract[];
  isStale?: boolean;
  isVisible?: boolean;
  onSelectSymbol?: (symbol: string) => void; // NOVO: Callback de troca de ativo in-chart
}
```

### Comportamento do Dropdown In-Chart:
- Âncora: Posicionado logo abaixo do `chart-top-asset-pill` (`top: 42px`, `left: 16px`).
- Estilo: Fundo `#151922`, borda `1px solid rgba(244, 245, 247, 0.08)`, sombra institucional, `zIndex: 100`.
- Busca: Filtra instantaneamente por símbolo e nome (ex: `EUR`, `BTC`, `Vol`, `Oro`).
- Troca Instantânea: O clique executa `onSelectSymbol(asset.symbol)` e fecha o menu imediatamente.

---

## 3. Matriz de Testes e Validação Obrigatória

Os testes serão implementados em `apps/web/src/trade/in-chart-asset-selector.unit.test.tsx`:

| Código | Descrição do Teste | Critério de Aceite |
|---|---|---|
| **IS-01** | **Interatividade do Pill:** Verifica se o pill `chart-top-asset-pill` possui cursor pointer e abre o seletor ao ser clicado. | Estado de abertura alternado com sucesso. |
| **IS-02** | **Busca e Filtragem em Tempo Real:** Digitar no campo de busca filtra corretamente os ativos do catálogo. | Apenas ativos correspondentes são exibidos. |
| **IS-03** | **Disparo do Callback de Troca:** Clicar em um ativo (`BTCUSD_OTC`) dispara `onSelectSymbol('BTCUSD_OTC')` e fecha o popover. | Callback chamado com argumento correto exatamente 1 vez. |
| **IS-04** | **Fechamento Gracioso:** Testar fechamento via clique fora (backdrop) e tecla `Escape`. | Dropdown fechado sem efeito colateral. |
| **IS-05** | **Isolamento de Eventos Gráficos:** Clicks dentro do dropdown não disparam ferramentas de desenho do Lightweight Charts. | `stopPropagation` ativo em todos os controles do menu. |

---

## 4. Critérios de Homologação da Subetapa 2

1. Todos os 5 testes da suíte `in-chart-asset-selector.unit.test.tsx` aprovados.
2. Suíte global de trading (`apps/web/src/trade/`) continua 100% verde sem regressões.
3. Relatório de homologação formal registrado em `docs/relatorios/RELATORIO_SUBETAPA_2_SELETOR_IN_CHART.md`.
