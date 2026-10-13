# Plano Geral de Refinamento Ergonômico, Proporções e Eliminação de Sobreposições

> **Status**: Planejado & Orquestrado  
> **Direção de Arte Escolhida**: *Kinetic Studio Console* (Teenage Engineering TX-6 & Dieter Rams Braun)  
> **Diagnóstico Principal**: A aba de ativos apresentava temporizador comprimido (26px), botão `×` desalinhado e borda verde pesada tipo "glow/card"; a telemetria in-chart continha um card com borda espessa que colidia diretamente com a tag flutuante `EXPIRACION 00:XX` da linha vertical de expiração.  
> **Princípio Supremo**: Proporção áurea, tipografia flutuante no canvas sem caixas artificiais, desobstrução visual e alinhamento milimétrico idêntico à IQ Option.

---

## 1. Problemas Diagnosticados na Captura do Usuário

1. **Temporizador da Aba Pequeno Demais e Mal Encaixado**:
   - O anel SVG tinha 26px de largura com texto de 9px comprimido.
   - O botão `×` não estava posicionado no vértice superior esquerdo como na referência da IQ Option.
   - A aba inteira estava envolvida em uma borda verde sólida pesada com aparência de card genérico.

2. **Sobreposição Grave da Barra de Telemetria sobre a Linha de Expiração**:
   - A telemetria foi inserida dentro de um card com borda espessa que descia verticalmente até a cota `top: 56px`.
   - O componente `TimeLinesOverlay.tsx` renderizava simultaneamente a tag `EXPIRACION 00:XX` na mesma coordenada `top: 56px`, gerando uma sobreposição confusa e antiestética.
   - Na IQ Option real, a linha de expiração não possui tag flutuante no meio do gráfico (apenas a bandeira `🚩` na base), pois o tempo restante já é protagonista na telemetria superior (`HORA DE COMPRA`).

3. **Telemetria com Visual Amador de Card Flutuante com Borda**:
   - A telemetria na IQ Option flutua diretamente no gráfico como tipografia pura separada por divisores verticais sutis de 1px, sem cartão, sem sombra pesada e sem contorno verde.

---

## 2. Mapa de Subetapas

| Subetapa | Escopo | Arquivos Afetados | Teste Específico |
| :--- | :--- | :--- | :--- |
| **01** | Redesenho da Aba do Ativo (Anel de 34px+, `×` no topo esquerdo, visual limpo) | `TerminalHeader.tsx` | `subetapa-refine-01-header-tab-ergonomics.unit.test.tsx` |
| **02** | Eliminação de Sobreposição & Desobstrução da Linha de Expiração | `TimeLinesOverlay.tsx` | `subetapa-refine-02-overlay-anti-collision.unit.test.tsx` |
| **03** | Telemetria In-Chart Pura Sem Card (Tipografia Flutuante & 4 Colunas) | `PriceChart.tsx` | `subetapa-refine-03-telemetry-pure-typography.unit.test.tsx` |
| **04** | Certificação Integrada de Estresse, Caos e Não-Regressão | Suíte `apps/web` | Execução global vitest |
