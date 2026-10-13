# Subetapa 04 — Posições no Gráfico (linhas de strike, flags, telemetria)

**Agentes:** chart-trading-engineer · chief-visual-director · compliance-risk-reviewer
**Skills:** 11-chart-trading-tools, 21-designer-senior-binmax
**Problemas:** P2, P6 (telemetria)

## Objetivo
Muitas posições não podem virar uma faixa verde nem uma pilha de etiquetas cortadas.

## Arquivos (lista fechada)
`chart/OrderFlagsOverlay.tsx`, `chart/PriceChart.tsx` (bloco da telemetria :1095-1146), `chart/subetapa-polish-04-positions.unit.test.tsx` (novo)

## O que muda (chave ligada)
1. **Agrupamento por strike**: contratos com o mesmo strike (tolerância de 1 tick) viram **uma** linha 1px tracejada + **uma** etiqueta "▲ 3 × $100" no eixo.
2. Etiquetas: no máximo 3 visíveis; o resto vira "+N" que abre o portafolio.
3. Anticolisão vertical entre etiquetas (mínimo 18px) e a etiqueta nunca é desenhada atrás da linha de expiração.
4. Linha verde se a posição está ganhando, vermelha se perdendo (estado provisório), opacidade 0.7; nada de faixa sólida.
5. Telemetria: rótulos 11px Geist Aço (não mono, não 9px), valores 14px Geist Mono; número de resultado usa a função da Subetapa 03.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | 6 contratos em 2 strikes → 2 linhas, 2 etiquetas |
| Unidade | 12 strikes distintos → 3 etiquetas + "+9" |
| Unidade | etiquetas a 2px de distância são separadas ≥ 18px |
| Estresse | 200 contratos abertos, 100 ticks → render < 16 ms/frame médio, sem crescimento de nós no DOM |
| Caos | contrato liquida no meio do frame; strike `NaN`; troca de ativo com posições abertas (linhas do outro ativo não aparecem) |
| Segurança | texto da etiqueta só com números formatados (sem HTML injetado do símbolo) |
| Regressão | `strike-lines-precision`, `subetapa-7-2-strike-lines-svg` continuam verdes |
| Visual | 1, 6 e 20 posições, on/off |
