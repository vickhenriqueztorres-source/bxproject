# SUBETAPA 3: Modal Completo de Catálogo de Ativos IQ Option

> **Data:** 08/10/2026  
> **Status:** PLANEJADO  
> **Responsáveis:** `iq-fidelity-reviewer`, `binmax-brand-agent`, `surgical-frontend-agent`, `qa-resilience-agent`  

---

## 1. Problema Abordado e Objetivos

### Diagnóstico Fático:
Na IQ Option, a seleção e abertura de ativos é uma das áreas mais refinadas do traderoom:
O usuário clica no botão `[+]` e tem acesso a um catálogo completo com abas verticais ou horizontais, payouts destacados em verde neon (`+85%`), pesquisa rápida, filtro de favoritos `★`, e listagem limpa de todas as moedas e índices.
Atualmente, no `TerminalHeader.tsx`, o botão `+` abre um pequeno menu flutuante básico, que carece da sofisticação e fidelidade visual da IQ Option.

### Objetivos da Subetapa:
1. Criar o componente institucional `AssetCatalogModal.tsx` com a estética **Turbo Prata**:
   - Cabeçalho com abas de categoria: `Todos`, `Turbo OTC`, `Forex`, `Criptomonedas`, `Commodities` e `Favoritos ★`.
   - Campo de pesquisa inteligente ("Buscar por activo o par, ej: EUR, BTC, Vol, Oro...").
   - Tabela com colunas:
     * **Activo:** Bandeira circular SVG oficial + código formatado (`NZD/JPY`, `EUR/USD`, `SYNTH_VOL_50`) + tag `Turbo`.
     * **Rendimiento:** Payout em destaque (`+85%` ou `+90%`) com fundo verde translúcido.
     * **Tipo de Mercado:** Indicador OTC / 24/7.
     * **Favoritos:** Botão de estrela interativo salvo no `localStorage`.
   - Clique em qualquer linha: se já estiver em uma aba, foca imediatamente nela; se não estiver aberta, adiciona uma nova aba e foca nela.
2. Integrar o novo modal tanto ao botão `[+]` das abas do cabeçalho quanto como opção expandida do in-chart pill.
3. Garantir acessibilidade com tecla `Escape` para fechar e backdrop escuro com desfoque de fundo (`backdrop-filter: blur(6px)`).

---

## 2. Estrutura do Componente e Props

```tsx
export interface AssetCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAsset: (symbol: string) => void;
  openTabs: string[];
  activeSymbol: string;
}
```

---

## 3. Matriz de Testes e Validação Obrigatória

Os testes serão implementados em `apps/web/src/trade/asset-catalog-modal.unit.test.tsx`:

| Código | Descrição do Teste | Critério de Aceite |
|---|---|---|
| **AC-01** | **Renderização do Catálogo:** Modal renderiza todos os ativos do catálogo institucional com bandeiras circulares e payouts. | 36 ativos listados corretamente. |
| **AC-02** | **Navegação por Categorias:** Alternância entre abas filtra a lista instantaneamente (ex: aba `Cripto` lista apenas pares com BTC, ETH, SOL, etc.). | Filtragem exata por categoria. |
| **AC-03** | **Persistência de Favoritos:** Clicar na estrela adiciona/remove do `localStorage` e exibe na aba de Favoritos. | Salvo e recuperado com sucesso. |
| **AC-04** | **Abertura/Foco de Aba:** Selecionar um ativo dispara `onSelectAsset` e fecha o modal. | Ação concluída com fechamento imediato. |
| **AC-05** | **Responsividade e Fechamento:** Fecha ao clicar fora ou pressionar ESC. | Modal desmonta graciosamente. |

---

## 4. Critérios de Homologação da Subetapa 3

1. Todos os 5 testes da suíte `asset-catalog-modal.unit.test.tsx` aprovados.
2. Suíte global de trading (`apps/web/src/trade/`) continua 100% verde sem regressões.
3. Relatório de homologação formal registrado em `docs/relatorios/RELATORIO_SUBETAPA_3_CATALOGO_ATIVOS.md`.
