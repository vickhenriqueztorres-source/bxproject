# PLANO MESTRE: REFINAMENTO ERGONÔMICO E VISUAL DO GRÁFICO BINMAX

**Feature ID:** `BMR-CHART-UX-REFINEMENT-2026-10-09`  
**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Comitê de Especialistas Convocados:**
- `chart-trading-engineer`: Especialista Chefe em Engenharia Gráfica (Lightweight Charts, Canvas/SVG Overlays, 60 FPS, geometria bidirecional).
- `surgical-frontend-agent` (`cirurgiao`): Implementação cirúrgica com o menor diff possível, mantendo isolamento estrito sob a flag `NEW_TRADEROOM`.
- `qa-resilience-agent`: Criação de testes unitários, testes de estresse de renderização, tolerância a falhas, testes de caos e de regressão.
- `financial-correctness-reviewer`: Preservação incondicional das minor units e integridade do saldo e dados de trading.
- `compliance-risk-reviewer`: Fidelidade ao padrão IQ Option / Turbo Prata e ergonomia de usabilidade para traders institucionais.

**Skills Permanentes Ativadas:**
- `11-chart-trading-tools`: Regras de coordenadas, overlays e ferramentas do gráfico.
- `12-tokens-binmax`: Paleta oficial Turbo Prata (Noche, Panel, Prata, Verde Ganancia, Rojo Baja, Blanco, Aço).
- `17-mudanca-cirurgica`: Protocolo de menor diff e padrão Duas Portas.
- `19-testes-de-regressao-visual`: Verificação rigorosa contra regressões.
- `06-testing-quality`: Padrões e critérios de aceite.
- `01-project-context`: Preservação da arquitetura e contratos.

---

## 1. Visão Geral da Demanda do Usuário

O usuário forneceu 3 capturas de tela reais evidenciando pontos específicos de melhoria estética e ergonômica dentro da área de trading:
1. **Remover a borda verde ao redor do gráfico**: Eliminar o contorno verde brilhante `#00e676` que contorna o container do gráfico em `MultiChartGrid.tsx`.
2. **Remover a logo do TradingView**: Ocultar completamente a marca d'água/link `#tv-attr-logo` injetada pelo motor gráfico no canto inferior esquerdo.
3. **Sofisticar a área de Compra, Expiração e Flags de Ordens**:
   - Redesenhar os badges "HORA DE COMPRA" e "EXPIRACIÓN" no `TimeLinesOverlay.tsx` para um visual sóbrio, institucional e sem halos de neon excessivos.
   - Refinar a cápsula de strike (`OrderFlagsOverlay.tsx`) com tipografia nítida, valores claros e espaçamento equilibrado que não colida com a régua de preços lateral.
4. **Redesenhar o dock flutuante de velas e indicadores**: Substituir emojis e caracteres crus (`🕯️`, `((•))`, `✏️ NEW`) por ícones SVG profissionais, integrados em uma cápsula de vidro fosco minimalista estilo IQ Option.
5. **Ajustar a barra lateral para acomodar 'Promociones'**: Garantir que a palavra "Promociones" nunca toque as bordas ou sofra corte, ajustando largura e tipografia com margem respirável.
6. **Ajustar a 'Temperatura dos Traders' (TradersMoodBar)**: Substituir os 14 diamantes fragmentados por uma barra contínua de sentimento arredondada de alta fidelidade visual (cápsula com preenchimento verde para compradores e vermelho para vendedores).

---

## 2. Invariantes Invioláveis

1. **Lógica de Mercado e Trading 100% Intocada**:
   - Zero modificação nos cálculos de velas (`resampleCandles`), tiques (`ou-generator`, CSPRNG), WebSocket Gateway, feeds de dados ou rotas de ordens.
   - Todas as alterações são estritamente visuais e ergonômicas (UI/UX).
2. **Padrão Duas Portas (Feature Flag `NEW_TRADEROOM`)**:
   - Toda alteração nova aplica-se sob a chave da sala nova (`isNewTraderoomEnabled()`); o modo legado permanece inalterado.
3. **Preservação de 100% dos Testes Verdes (Regressão Zero)**:
   - A base atual de 485 testes em 94 arquivos deve permanecer 100% verde ao final de cada subetapa.
4. **Protocolo de Gates Estrito**:
   - Nenhuma subetapa $N+1$ será iniciada antes do fechamento formal e aprovação dos testes da subetapa $N$.

---

## 3. Divisão em Subetapas Sequenciais e Arquivos de Especificação

```
docs/features/binmax-chart-ux-refinement/
├── PLANO-MESTRE-REFINAMENTO-CHART-UX.md
├── SUBETAPA-01-REMOCAO-BORDA-VERDE-E-LOGO-TV.md
├── SUBETAPA-02-EXPANSAO-MENU-E-AJUSTE-PROMOCIONES.md
├── SUBETAPA-03-TEMPERATURA-TRADERS-MOOD-BAR.md
├── SUBETAPA-04-REDESIGN-FERRAMENTAS-VELAS-INDICADORES.md
├── SUBETAPA-05-SOFISTICACAO-HORA-COMPRA-EXPIRACAO-E-FLAGS.md
├── SUBETAPA-06-CERTIFICACAO-FINAL-INTEGRADA.md
├── ESTADO.md
├── MATRIZ-ACEITACAO.md
└── relatorios/
    ├── RELATORIO-SUBETAPA-01.md
    ├── RELATORIO-SUBETAPA-02.md
    ├── RELATORIO-SUBETAPA-03.md
    ├── RELATORIO-SUBETAPA-04.md
    ├── RELATORIO-SUBETAPA-05.md
    └── 03-CERTIFICACAO-FINAL-INTEGRADA.md
```

| Subetapa | Arquivo | Foco Técnico |
|---|---|---|
| **01** | `SUBETAPA-01-REMOCAO-BORDA-VERDE-E-LOGO-TV.md` | Remoção do `border: 1px solid #00e676` no `MultiChartGrid` e eliminação de `#tv-attr-logo` no CSS e DOM |
| **02** | `SUBETAPA-02-EXPANSAO-MENU-E-AJUSTE-PROMOCIONES.md` | Ajuste de largura (74px) e tipografia (10.5px) para a palavra "Promociones" nunca vazar na lateral |
| **03** | `SUBETAPA-03-TEMPERATURA-TRADERS-MOOD-BAR.md` | Redesign do `TradersMoodBar`: cápsula contínua elegante verde/vermelha com badges de porcentagem |
| **04** | `SUBETAPA-04-REDESIGN-FERRAMENTAS-VELAS-INDICADORES.md` | Redesign completo do `ChartDrawingToolbar`: ícones SVG, cápsula translúcida e menus institucionais |
| **05** | `SUBETAPA-05-SOFISTICACAO-HORA-COMPRA-EXPIRACAO-E-FLAGS.md` | Sofisticação de `TimeLinesOverlay` e `OrderFlagsOverlay`: remoção de halos neon, badges discretos |
| **06** | `SUBETAPA-06-CERTIFICACAO-FINAL-INTEGRADA.md` | Execução completa da suíte de 485+ testes e typecheck com regressão zero |
