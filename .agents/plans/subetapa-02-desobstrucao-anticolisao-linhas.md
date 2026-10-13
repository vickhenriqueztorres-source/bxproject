# Subetapa 02: Eliminação de Sobreposição & Desobstrução da Linha de Expiração

> **Objetivo**: Desobstruir o campo de visão do gráfico eliminando a tag concorrente `EXPIRACION 00:XX` no topo da linha de expiração e alinhando a fidelidade com a IQ Option.

---

## 1. Alterações Específicas em `TimeLinesOverlay.tsx`
- **Diagnóstico da Colisão**:
  - Em `TimeLinesOverlay.tsx`, a tag superior `EXPIRACION 00:XX` ficava posicionada na cota `top: 56px`.
  - Ao mesmo tempo, a barra de telemetria superior estendia-se nessa mesma faixa vertical, fazendo com que qualquer passagem da linha de expiração pela área superior colidisse diretamente com a barra de telemetria.
- **Solução de Alta Fidelidade (IQ Option Reference)**:
  - No modo Binmax (`isBinmax`), ocultar a tag superior redundante `EXPIRACION 00:XX` e a tag redundante `HORA DE COMPRA` no topo da linha pontilhada.
  - O indicador de contagem e hora de compra já é o protagonista absoluto na barra de telemetria superior.
  - Manter rigorosamente a linha contínua vermelha de expiração e a linha pontilhada de hora de compra, bem como os respectivos ícones circulares de base (`⏱` e `🚩`) na borda inferior do gráfico (`bottom: 12px`).
  - No modo legado (`!isBinmax`), preservar as tags originais para compatibilidade retroativa.

## 2. Teste de Validação
- Arquivo: `src/chart/subetapa-refine-02-overlay-anti-collision.unit.test.tsx`
- Asserções: no modo Binmax, `time-tag-expiration` não é renderizada no topo e nenhuma sobreposição com a telemetria ocorre.
