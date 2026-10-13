# Relatório Final — Resolução de Erros de Design/Espaçamento e Expansão Histórica do Gráfico

> **Governança**: `tech-lead-orchestrator`  
> **Workers Especializados**: `broker-architect-agent`, `chart-trading-engineer`, `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
> **Skills Ativas**: `11-chart-trading-tools`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`, `06-testing-quality`, `03-synthetic-market-engine`, `12-tokens-binmax`  
> **Data de Homologação**: 2026-10-08  
> **Status**: **100% HOMOLOGADO E CONCLUÍDO (GATES 1, 2 e 3 APROVADOS)**

---

## 1. Sumário Executivo

Foram endereçados com precisão cirúrgica os dois problemas relatados pelo usuário a partir da evidência da interface:

### Problema 1: Erros de Design, Espaçamento, Bordas e Colisões Visuais
- **Causa Raiz 1 (Tag Flutuante `.price-tag-pulse`)**: Renderizava no topo direito (`top: 12px, right: 16px`), colidindo diretamente com a régua de preços e os rótulos de tempo.
  - **Resolução**: Suprimida no tema Binmax Turbo Prata (`NEW_TRADEROOM = true`). A cotação em tempo real passa a ser exibida unicamente na régua oficial do gráfico e na pílula do ativo no topo, idêntico à IQ Option.
- **Causa Raiz 2 (Duplicidade no Eixo Y de Preço)**: Lightweight Charts desenhava etiquetas cinzas nativas por ter `lastValueVisible` e `priceLineVisible` ativos por padrão na série de velas, enquanto o nosso `createPriceLine` desenhava a etiqueta de cotação colorida.
  - **Resolução**: Configurou-se `lastValueVisible: false` e `priceLineVisible: false` nas séries de velas e de área. Restou unicamente a etiqueta oficial customizada no eixo Y.
- **Causa Raiz 3 (Colisão das Tags de Tempo no `TimeLinesOverlay.tsx`)**: As etiquetas de compra (`HORA DE COMPRA`) e de expiração (`EXPIRACIÓN`) compartilhavam a mesma coordenada `top: 40px`, colidindo no mesmo trilho horizontal quando próximas.
  - **Resolução**: Escalonamento vertical em dois trilhos distintos:
    - `time-tag-purchase`: `top: 24px`
    - `time-tag-expiration`: `top: 56px`
    - Distância vertical mínima comprovada matematicamente: $\Delta Y \ge 8px$.
    - Travamento horizontal com `maxExpirationX = Math.max(80, effectiveWidth - 65)` para impedir qualquer invasão da escala de preços.
- **Causa Raiz 4 (Bordas e Alinhamento do Order Dock)**: Separação limpa com `border-left: 1px solid var(--bm-linha)` mantendo perfeita simetria dos botões SUBE/BAJA.

---

### Problema 2: Gráfico Limitado a Apenas 5 Horas de Histórico
- **Causa Raiz 1 (Corte em 180 Velas)**: Em `client.ts`, o limite de velas estava forçado em `Math.min(safeLimit, 180)`. 180 velas de 1 minuto = 3 horas (ou ~5 horas com amostragem).
  - **Resolução**: Expansão do seed padrão para **2.880 velas de 1 minuto** (48 horas completas e ininterruptas de dados no carregamento inicial).
- **Causa Raiz 2 (Travamento do Lazy Loading Retroativo)**: Ao rolar para o passado, a busca por velas com `beforeTimestamp` recebia array vazio, fazendo o `PriceChart` travar `hasMoreHistoryRef.current = false`.
  - **Resolução**: `generateSeedCandles(symbol, count, endTimestamp)` agora aceita `endTimestamp` e gera blocos determinísticos de 1.000 velas retroativas contíguas, conectadas sem saltos ou gaps temporais. O trader pode agora navegar dias no passado de forma contínua e infinita.

---

## 2. Matriz de Verificação e Evidências

| Teste / Gate | Escopo | Resultado |
| :--- | :--- | :--- |
| **Subetapa 1** (`history-expansion.unit.test.ts`) | Boot de 48h (2.880 velas), lazy load contíguo com `beforeTimestamp`, desduplicação, integridade de $H \ge L$, performance < 45ms | **5/5 APROVADOS (100%)** |
| **Subetapa 2** (`layout-spacing-overlays.unit.test.tsx`) | Escalonamento vertical (24px/56px), não-invasão da escala de preços, supressão de tag flutuante no Binmax, Padrão Duas Portas | **5/5 APROVADOS (100%)** |
| **Regressão Completa** (`apps/web/src/trade/`) | 25 suítes de testes cobrindo catálogo de ativos, layout responsivo mobile/desktop, carteira, sons, tickets, indicadores, stochastic candles | **25/25 SUÍTES PASSANDO (161 TESTES)** |
| **Build de Produção** (`@broker/web`) | `tsc && vite build` | **EXIT CODE 0 (Sucesso)** |
