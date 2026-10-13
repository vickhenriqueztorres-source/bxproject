# Plano Geral — Resolução de Erros de Design/Espaçamento e Expansão Histórica do Gráfico

> **Governança**: `tech-lead-orchestrator`  
> **Workers Especializados**: `broker-architect-agent`, `chart-trading-engineer`, `surgical-frontend-agent`, `iq-fidelity-reviewer`, `binmax-brand-agent`, `qa-resilience-agent`  
> **Skills Ativas**: `11-chart-trading-tools`, `17-mudanca-cirurgica`, `19-testes-de-regressao-visual`, `06-testing-quality`, `03-synthetic-market-engine`, `12-tokens-binmax`  
> **Data**: 2026-10-08  
> **Invariantes Invioláveis**: D-02 (Saldo único no Blnk Ledger), D-18 (Menor fração inteira `*_minor`), CSPRNG/Ornstein-Uhlenbeck em preços, Padrão Duas Portas (`NEW_TRADEROOM = false` preservado 100%).

---

## 1. Diagnóstico Forense dos Problemas Identificados

Com base na evidência do traderoom atual e na inspeção do código-fonte:

### Problema 1: Erros de Design, Espaçamento, Bordas e Colisões Visuais
1. **Colisão da Tag Flutuante de Preço (`.price-tag-pulse`)**:
   - O elemento `.price-tag-pulse` (`• 100.00059 USD ▲`) estava renderizado fixo no topo direito (`top: 12px, right: 16px`).
   - Ele paira exatamente sobre a escala de preços e os marcadores de contagem regressiva (`HORA DE COMPRA` e `EXPIRACIÓN`), causando colisão de texto e poluição visual.
   - Na referência IQ Option / Binmax Turbo Prata, o preço em tempo real deve ficar **exclusivamente na escala do gráfico** (badge na régua de preços) e na pílula do ativo no topo, nunca flutuando solto sobre as velas e rótulos.
2. **Duplicação de Etiquetas de Preço no Eixo Direito (Right Price Scale)**:
   - A série de velas (`addCandlestickSeries`) e de área (`addAreaSeries`) mantinham `lastValueVisible: true` e `priceLineVisible: true` por padrão da biblioteca Lightweight Charts, desenhando uma etiqueta cinza nativa.
   - Concomitantemente, o nosso `createPriceLine` desenhava uma etiqueta verde/vermelha com o preço exato. Resultado: duas etiquetas colidindo e sobrepostas na régua vertical de preços.
3. **Colisão Horizontal das Etiquetas de Tempo (`TimeLinesOverlay.tsx`)**:
   - Tanto a etiqueta de compra (`.time-tag-purchase`) quanto a de expiração (`.time-tag-expiration`) utilizavam a mesma coordenada vertical `top: 40px`.
   - Quando as duas linhas verticais se aproximam (a linha de compra precede a de expiração por ~30s), os dois balões colidem no mesmo nível vertical.
   - Além disso, a etiqueta de expiração transbordava para dentro da régua de preços à direita quando a vela estava próxima do offset direito.
4. **Alinhamento e Bordas do Order Dock (`.terminal-order-dock`)**:
   - O dock de ordens precisa de separação limpa com `border-left: 1px solid var(--bm-linha)` e padding harmonioso sem bordas duplas ou desalinhamento com o header e footer.

---

### Problema 2: Gráfico Limitado a Apenas 5 Horas de Histórico
1. **Corte Artificial em 180 Velas no `getCandles` (`client.ts`)**:
   - No `apps/web/src/api/client.ts`, as linhas 260 e 271 forçavam: `generateSeedCandles(symbol, Math.min(safeLimit, 180))`.
   - 180 velas de 1 minuto equivalem a estritamente 3 horas (ou ~5 horas com amostragem).
   - O gráfico iniciava com apenas 180 velas, tornando impossível visualizar um dia completo ou mais.
2. **Interrupção Prematura do Lazy-Load Retroativo**:
   - Quando o usuário rolava para a esquerda, `PriceChart.tsx` invocava `fetchHistoricalCandlesChunk(symbol, oldestEpoch, 1000)`.
   - Como o mock em memória só continha 180 velas, o filtro `Number(c.time) < before` retornava um array vazio `[]`, o que ativava imediatamente `hasMoreHistoryRef.current = false`.
   - Resultado: o histórico era bloqueado e o usuário nunca conseguia rolar para além de 3–5 horas.

---

## 2. Divisão em Subetapas com Critérios de Aceite Estritos

| Subetapa | Arquivo de Especificação | Foco Técnico | Critério de Aceite |
| :--- | :--- | :--- | :--- |
| **Subetapa 1** | `SUBETAPA_1_EXPANSAO_HISTORICO_CANDLES_48H_E_LAZY_LOAD.md` | Expansão para 2.880 velas (48h) contínuas no seed inicial + geração dinâmica e determinística de blocos retroativos ancorados em `beforeTimestamp`. | Testes unitários com 2.880 velas; teste de rolagem contínua gerando múltiplos lotes de 1.000 velas retroativas sem gaps temporais; 100% dos testes verdes. |
| **Subetapa 2** | `SUBETAPA_2_REFINAMENTO_DESIGN_SPACING_E_OVERLAYS.md` | Ocultar `.price-tag-pulse` no tema Binmax; configurar `lastValueVisible: false` e `priceLineVisible: false` na série para eliminar etiqueta duplicada no eixo Y; escalonar verticalmente etiquetas de compra (24px) e expiração (56px) para garantir zero colisão; travar limite direito contra o eixo de preço. | Testes unitários de layout e geometria; verificação de não sobreposição em qualquer distância horizontal; suíte de testes 100% verde. |
| **Subetapa 3** | `SUBETAPA_3_CERTIFICACAO_FINAL_ESTRESSE_CAOS_REGRESSAO.md` | Bateria completa de testes automatizados, vitest, typecheck, build de produção `@broker/web`, e validação do Padrão Duas Portas (`NEW_TRADEROOM = false`). | Build com exit code 0; todas as 25+ suítes de testes passando; relatório final emitido. |

---

## 3. Matriz de Segurança e Não Regressão
- Nenhuma alteração nos contratos de API do backend ou nas fórmulas financeiras do Blnk.
- O modo legado (`isNewTraderoomEnabled() === false`) preserva a tag legada e dimensões originais intactas.
- Todas as alterações visuais ficam restritas a `apps/web/src/chart/`, `apps/web/src/api/client.ts` e classes escopadas sob `.theme-binmax`.
