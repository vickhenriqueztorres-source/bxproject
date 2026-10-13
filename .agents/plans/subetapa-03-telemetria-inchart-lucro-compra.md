# Subetapa 03: Barra de Telemetria In-Chart (4 Métricas da Operação em Tempo Real)

> **Objetivo**: Renderizar no topo do gráfico (`PriceChart.tsx`) a barra de telemetria com as 4 colunas essenciais mostradas nas referências da IQ Option (`HORA DE COMPRA`, `INVESTIMENTO TOTAL`, `LUCRO ESPERADO`, `LUCRO APÓS A VENDA (L/P)`), atualizadas tick a tick com tipografia tabular Geist Mono.

---

## 1. Escopo de Alteração
- **Arquivo**: `apps/web/src/chart/PriceChart.tsx` (ou componente dedicado `TradeTelemetryOverlay.tsx` integrado no gráfico)

## 2. Especificação Visual e Funcional
- Exibir a barra apenas quando houver contrato aberto para o ativo em exibição.
- Estrutura de 4 colunas horizontais com alinhamento milimétrico:
  1. **Coluna 1 (Hora de Compra)**:
     - Ícone `⏱` vetorial.
     - Tempo decorrido ou tempo restante da ordem no formato `MM:SS` (ex: `00:26` ou `00:04`).
     - Sub-rótulo: `HORA DE COMPRA` (cinza `#8A92A1`, 9px, uppercase).
  2. **Coluna 2 (Investimento Total)**:
     - Valor do stake formatado: `$10.00` (branco `#F4F5F7`, Geist Mono, 13px, bold).
     - Sub-rótulo: `INVESTIMENTO TOTAL` (cinza `#8A92A1`, 9px, uppercase).
  3. **Coluna 3 (Lucro Esperado)**:
     - Valor esperado: `+$8.61` em verde `#22C47A` se ITM, ou `-$10.00` em vermelho `#E5484D` se OTM.
     - Sub-rótulo: `LUCRO ESPERADO` (cinza `#8A92A1`, 9px, uppercase).
  4. **Coluna 4 (Lucro Após a Venda / Early Close)**:
     - Estimativa de recompra/resgate antecipado: `+$1.33` (verde) ou `-$1.36` (vermelho).
     - Sub-rótulo: `LUCRO APÓS A VENDA (L/P)` (cinza `#8A92A1`, 9px, uppercase).
- Fundo semitransparente discreto com efeito de profundidade sem glow: `rgba(13, 17, 24, 0.88)` com backdrop-filter sutil.

## 3. Testes de Validação (TDD)
- Arquivo de Teste: `apps/web/src/chart/subetapa-03-inchart-telemetry-overlay.unit.test.tsx`
- **Cenários Cobertos**:
  1. Gráfico sem contratos abertos não exibe a barra de telemetria.
  2. Gráfico com contrato ativo exibe as 4 colunas com rótulos e valores corretos.
  3. Comportamento ITM: lucro esperado e após venda em verde.
  4. Comportamento OTM: lucro esperado e após venda em vermelho.
  5. Atualização precisa conforme o preço do tick oscila.
