# Subetapa 05 — Hora de Compra, Expiração e Sentimento

**Agentes:** chart-trading-engineer · chief-visual-director · binmax-brand-agent
**Skills:** 11-chart-trading-tools, 21-designer-senior-binmax, 14-teste-de-sobreposicao
**Problema:** P7

## Arquivos (lista fechada)
`chart/TimeLinesOverlay.tsx`, `chart/TradersMoodBar.tsx`, `chart/subetapa-polish-05-time-mood.unit.test.tsx` (novo)

## O que muda (chave ligada)
1. "HORA DE / COMPRA" em 2 linhas 10px Geist Aço **à esquerda** da linha pontilhada, contador 20px Geist Mono Blanco à direita do rótulo (como C10 do alvo). Sem caixa.
2. Expiração: só a linha vermelha contínua e o ícone 🏁 no pé; a pílula "EXPIRACIÓN 00:08" sai do topo (evita a colisão). Os últimos 5 s pulsam opacidade (única pulsação permitida).
3. Sentimento como C3: "SUBE / 52%" em cima, coluna de 12 losangos (verde/vermelho na proporção), "BAJA / 48%" embaixo; 12px Geist, número 14px 600. Coluna limitada a 28%–62% da altura para **nunca** sobrepor a barra de ferramentas.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | 52% → 6 losangos verdes + 6 vermelhos (arredondamento estável); 0% e 100% não quebram |
| Unidade | tag de expiração ausente com chave ligada; presente com chave desligada |
| Anticolisão | bounding box da coluna de sentimento não intersecta a da barra de ferramentas em 1920×1000, 1366×768 e 1280×720 |
| Caos | relógio do servidor atrasado 30 s / adiantado; `bullsPercentage` `NaN`, −5, 140 → limitado 0–100 |
| Estresse | 1000 atualizações de sentimento sem vazamento de timers |
| A11y | `prefers-reduced-motion` desliga a pulsação |
| Regressão | `subetapa-ux-03-mood-bar`, `subetapa-ux-05-timelines-flags`, `subetapa-03-timelines-overlay-anchoring` |
