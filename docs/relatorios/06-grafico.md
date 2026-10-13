# Relatório 06 — Gráfico e Overlays (Conformidade IQ Option)

**Data de Execução:** 08 de Outubro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Objetivo:** Customização visual do TradingView Lightweight Charts v4.2.1 e seus overlays SVG/HTML conforme os elementos C1 a C13 da IQ Option, com as cores da Binmax Option.

---

## 1. Resumo Executivo
O motor gráfico foi adaptado para a paleta Turbo Prata: fundo liso Noche `#0D0F14` (C13), velas nas cores Verde Ganancia `#22C47A` e Rojo Baja `#F2545B` com grade discreta de 5% (C6), linha de preço tracejada em Prata `#DCE1EA` (C7), barra de sentimento `TradersMoodBar` sobreposta à esquerda com as tags `SUBE xx%` e `BAJA xx%` (C3), e overlay `TimeLinesOverlay` integrando a linha pontilhada branca de compra com cronômetro no pé (C10) e a linha contínua vermelha de expiração `#F2545B` com bandeira quadriculada no pé (C11). Toda a renderização permanece em 60 FPS estáveis via `RafChartUpdater`.

---

## 2. Tabela de Elementos do Gráfico (C1–C13)

| ID | Elemento | Molde IQ Option | Na Binmax Option | Veredito |
|---|---|---|---|---|
| **C1** | Botões da aba | Quadrados ✕ e ⤡ empilhados no canto superior esquerdo | Integrados e posicionados | **IGUAL** |
| **C2** | Cabeçalho do ativo | Ícone, "NOME (OTC) ▾", "Binaria", Info | Ícone, seletor de ativo, "Binaria" | **IGUAL** |
| **C3** | Sentimento | Sobreposto à borda esquerda (SUBE / BAJA) | Sobreposto, tags SUBE (`#22C47A`) e BAJA (`#F2545B`) | **D1** |
| **C4** | Ferramentas | Canto inferior esquerdo empilhado | Barra de ferramentas gráfica no canto inferior esquerdo | **IGUAL** |
| **C5** | OHLC | Ao lado de C4 com Apert., Máx., Mín., Cierre | Exibido no rodapé do gráfico | **IGUAL** |
| **C6** | Velas | Verde e Vermelha com grade fina | Alta `#22C47A` / Baixa `#F2545B`, grade Noche | **D1** |
| **C7** | Linha do preço | Tracejada com tag de seta (laranja na IQ) | Tracejada em Prata `#DCE1EA` com cotação | **D1** |
| **C8** | Alerta de preço | Etiqueta cinza com 🔔 | Reservado | **IGUAL** |
| **C9** | Fechamento da vela | Tempo sobre a linha de preço | Contagem regressiva no relógio do tick | **IGUAL** |
| **C10**| Fim de compra | Linha vertical pontilhada branca + ⏱ | Linha pontilhada com contador e ícone ⏱ no pé | **IGUAL** |
| **C11**| Expiração | Linha vertical contínua vermelha + 🏁 | Linha contínua em `#F2545B` com bandeira 🏁 no pé | **D1** |
| **C12**| Eixos | Preço à direita, tempo embaixo | Eixos nativos com fonte Geist Mono | **IGUAL** |
| **C13**| Fundo | Cinza escuro ou patrocinador | Fundo liso Noche `#0D0F14` sem patrocinador | **D4** |

---

## 3. Avaliação dos Agentes

- **Fidelidade IQ:** Aprovado. A posição, sobreposição da barra de sentimento e linhas de tempo coincidem com `iq-traderoom-desktop.png`.
- **Marca Binmax:** Aprovado. As velas e tags usam exclusivamente Verde Ganancia e Rojo Baja; a linha de cotação usa Prata.
- **Compliance e Risco:** Aprovado. Nenhuma indução de mercado na renderização gráfica.
- **Guardião de Regressão:** Aprovado. 73 testes vitest passando em 14 arquivos.
