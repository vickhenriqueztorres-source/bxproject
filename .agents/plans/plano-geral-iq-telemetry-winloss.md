# Plano Geral: Telemetria em Tempo Real, Anéis de Contagem, Pin de Expiração e Áudio Dopaminérgico

> **Status**: Planejado & Orquestrado  
> **Arquitetura**: Frontend Único (`apps/web/**`) — Zero Alteração em Backend  
> **Direção de Arte Escolhida**: *Kinetic Telemetry Monolith* (Teenage Engineering Field & Dieter Rams Braun)  
> **Diretriz Suprema**: Instrumento de Precisão Cirúrgica — Sem Cassino, Sem Neons, Sem Glow, Sem 3D Genérico.

---

## 1. Diagnóstico dos 4 Problemas Identificados

1. **Problema 1: Remoção do Header Repetido nas Células da Grade de Gráficos**
   - **Causa Raiz**: Em `MultiChartGrid.tsx`, as células filhas recebiam `showHeader={true}` forçado nos layouts em grade (`2x1`, `2x2`, etc.), exibindo uma barra azul desajeitada com dropdown `<select>` nativo e texto `ATIVO ⚡ 0ms`.
   - **Solução de Precisão**: Unificar `showHeader={!isBinmax}` em todos os layouts e preservar a borda de foco sutil das células ativas/inativas (`border: 1px solid rgba(244, 245, 247, 0.08)` e foco ativo `#22C47A`). O seletor de ativo já é fornecido com perfeição pela pílula flutuante in-chart.

2. **Problema 2: Notificação de Win / Loss Ancorada no Gráfico (Pin de Expiração) + Áudio Dopaminérgico**
   - **Causa Raiz**: O resultado era exibido apenas num toast lateral convencional ou no announcement, sem presença visual ancorada no ponto exato onde a vela cruzou a linha de expiração no gráfico, como na IQ Option.
   - **Solução de Precisão**: Criar o componente `ExpirationResultPin` acoplado geometricamente na coordenada `(xExpiration, yPrice)` da vela de fechamento:
     - Header `RESULTADO (L/P)` com botão de fechar `×`.
     - Valor do lucro/perda em destaque (`+$9.02` em verde `#22C47A` ou `-$10.00` em vermelho `#E5484D`).
     - Ponteiro triangular apontando para o ponto da cotação final.
     - Síntese de áudio Web Audio API: acorde harmônico cristalino em 3 estágios (528Hz / 792Hz / 1056Hz) com shimmer para WIN, e pulso tátil amortecido (180Hz com decaimento exponencial seco de 120ms) para LOSS.

3. **Problema 3: Temporizador no Card/Aba da Operação com Mudança Dinâmica de Cor**
   - **Causa Raiz**: As abas do cabeçalho em `TerminalHeader.tsx` mostravam apenas o nome estático do ativo e o payout fixo (`+85%`), sem refletir se havia contrato aberto, tempo restante ou estado da operação.
   - **Solução de Precisão**: Renderizar na aba do ativo correspondente:
     - Micro-anel vetorial SVG de contagem regressiva (`:56` ou `:34`) com progresso circular animado.
     - Transição dinâmica de superfície: fundo esmeralda translúcido (`rgba(34, 196, 122, 0.18)`) quando no lucro (ITM) e carmesim translúcido (`rgba(229, 72, 77, 0.18)`) quando no prejuízo (OTM).
     - Ícone de bandeira quadriculada (`🏁`) quando liquidado com sucesso.

4. **Problema 4: Lucro em Tempo Real (Live PnL) nas Abas e Barra de Telemetria In-Chart**
   - **Causa Raiz**: O trader precisava abrir a gaveta de portfólio para ver o lucro flutuante em tempo real.
   - **Solução de Precisão**:
     - No cabeçalho: badge de PnL em tempo real (`+$8.61` verde ou `-$10.00` vermelho) dentro da aba do ativo.
     - No gráfico (`PriceChart`): barra superior de telemetria de 4 colunas idêntica aos prints da IQ Option:
       - Coluna 1: `⏱ 00:26` — `HORA DE COMPRA`
       - Coluna 2: `$10.00` — `INVESTIMENTO TOTAL`
       - Coluna 3: `+$8.61` (ou `-$10.00`) — `LUCRO ESPERADO`
       - Coluna 4: `+$1.33` (ou `-$1.36`) — `LUCRO APÓS A VENDA (L/P)`

---

## 2. Mapa de Subetapas

| Subetapa | Escopo | Arquivos Afetados | Teste Específico |
| :--- | :--- | :--- | :--- |
| **01** | Remoção do cabeçalho repetido da grade | `MultiChartGrid.tsx` | `subetapa-01-remove-gridcell-header.unit.test.tsx` |
| **02** | Anel temporizador, PnL ao vivo e cor dinâmica nas abas | `TerminalHeader.tsx`, `App.tsx` | `subetapa-02-tab-trade-countdown-pnl.unit.test.tsx` |
| **03** | Barra de Telemetria In-Chart (4 métricas de operação) | `PriceChart.tsx` | `subetapa-03-inchart-telemetry-overlay.unit.test.tsx` |
| **04** | Pin de Expiração no Gráfico + Áudio Dopaminérgico Refinado | `ExpirationResultPin.tsx`, `sound-engine.ts`, `App.tsx` | `subetapa-04-expiration-winloss-pin-audio.unit.test.tsx` |

---

## 3. Protocolo de Execução
- Cada subetapa segue TDD estrito (teste escrito primeiro, falha comprovada, implementação cirúrgica, teste verde).
- Execução de suite de regressão a cada passo para garantir zero quebras.
- Certificação final integrada com todas as 4 soluções em funcionamento harmônico.
