# Subetapa 04: Pin de Expiração no Gráfico + Áudio Dopaminérgico Refinado

> **Objetivo**: Renderizar o pin de resultado da operação (`RESULTADO (L/P) +$9.02`) diretamente no gráfico no cruzamento da vela com a linha de expiração (cópia fiel da IQ Option), e aperfeiçoar o motor de síntese de áudio Web Audio API para tocar acordes comemorativos refinados em vitórias e cliques amortecidos em derrotas.

---

## 1. Escopo de Alteração
- **Arquivos**:
  - `apps/web/src/chart/ExpirationResultPin.tsx` (novo componente de pin in-chart)
  - `apps/web/src/chart/PriceChart.tsx` (acoplar o pin às coordenadas de expiração)
  - `apps/web/src/lib/sound-engine.ts` (aprimorar acústica dos métodos `playWin()` e `playLoss()`)
  - `apps/web/src/App.tsx` (acionar som ao receber evento de liquidação `contract_settled`)

## 2. Especificação Visual e Sonora
- **Pin de Expiração In-Chart**:
  - Marcador de âncora: círculo branco com borda sutil na coordenada `(xExpiration, ySettlementPrice)`.
  - Balão/Card `RESULTADO (L/P)`:
    - Fundo: Verde Ganancia `#22C47A` para vitória, Vermelho Baja `#E5484D` para derrota.
    - Raio de canto: `6px`.
    - Seta indicadora à esquerda apontando diretamente para o ponto na linha vertical.
    - Cabeçalho: `RESULTADO (L/P)` (branco, 10px, bold) + botão de fechar `×`.
    - Valor principal: `+$9.02` (ou `-$10.00`) em tipografia Geist Mono bold `16px`.
    - Animação de entrada: escala suave de 0.9 para 1.0 com `cubic-bezier(0.16, 1, 0.3, 1)` em 220ms.
- **Áudio Dopaminérgico de Precisão**:
  - **WIN (Vitória)**: Tríade comemorativa expandida com harmônicos cristalinos (C5 523Hz -> E5 659Hz -> G5 784Hz -> C6 1046Hz + ressonador brilhante em 2093Hz) e decaimento estéreo natural de 450ms. Causa liberação de dopamina limpa e satisfatória sem parecer jogo de azar.
  - **LOSS (Derrota)**: Pulso de amortecimento mecânico elegante (240Hz -> 140Hz) com filtro passa-baixa e decaimento exponencial rápido de 140ms. Sensação tátil e honesta sem frustração estridente.

## 3. Testes de Validação (TDD)
- Arquivo de Teste: `apps/web/src/chart/subetapa-04-expiration-winloss-pin-audio.unit.test.tsx`
- **Cenários Cobertos**:
  1. Renderização do pin de vitória com cor `#22C47A`, título `RESULTADO (L/P)` e valor `+$9.02`.
  2. Renderização do pin de derrota com cor `#E5484D` e valor `-$10.00`.
  3. Fechamento manual do pin via clique no botão `×`.
  4. Execução dos métodos de áudio dopaminérgico `playWin()` e `playLoss()` com parâmetros acústicos corretos.
