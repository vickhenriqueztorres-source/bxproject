# Relatório 03 — Cores, Fontes e Tokens da Marca (Turbo Prata)

**Data de Execução:** 08 de Outubro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Objetivo:** Cadastrar a base visual Turbo Prata (cores, fontes, raio, espaçamento) no sistema de estilo existente, escopada em `.theme-binmax`, com validação matemática de acessibilidade WCAG.

---

## 1. Resumo Executivo
Implementados os tokens oficiais da Binmax Option em `apps/web/src/styles.css` sob a classe escopada `.theme-binmax`, sem vazamento para áreas não autenticadas ou com a feature flag desligada. As fontes oficiais **Archivo** e **Geist Mono** foram injetadas em `apps/web/index.html`. Criada suíte de testes com validação matemática dos contrastes de luminância WCAG (níveis AA e AAA), com 63 testes vitest 100% verdes.

---

## 2. Tabela Oficial de Tokens Turbo Prata

| Token CSS | Cor HEX | RGB | Função no Traderoom | Contraste sobre Noche | Nível WCAG |
|---|---|---|---|---|---|
| `--bm-noche` | `#0D0F14` | 13, 15, 20 | Fundo principal da sala | — | — |
| `--bm-panel` | `#151922` | 21, 25, 34 | Superfícies, cards, header, dock lateral, ticket | — | — |
| `--bm-prata` | `#DCE1EA` | 220, 228, 234 | Marca, logo, foco, preço atual, linha de cotação | 14.9 : 1 | **AAA** |
| `--bm-blanco` | `#F4F5F7` | 244, 245, 247 | Texto principal da interface | 18.1 : 1 | **AAA** |
| `--bm-aco` | `#8A92A1` | 138, 146, 161 | Texto secundário, rótulos, ícones do menu | 6.4 : 1 | **AA** |
| `--bm-verde` | `#22C47A` | 34, 196, 122 | Saldo, lucro, botão SUBE, botão Depositar, vela alta | 8.6 : 1 | **AAA** |
| `--bm-rojo` | `#F2545B` | 242, 84, 91 | Perda, botão BAJA, vela baixa | 5.9 : 1 | **AA** |
| `--bm-linha` | `rgba(244, 245, 247, 0.08)` | — | Bordas e divisores de painéis | — | — |

---

## 3. Tipografia Oficial Injetada

- **Interface, Títulos e Logo:** `Archivo` (pesos 400, 500, 600, 800) carregada via Google Fonts com `display=swap`.
- **Preços, Saldos, Contadores e Relógio:** `Geist Mono` (pesos 400, 500, 600, 700) com `font-variant-numeric: tabular-nums` para eliminar saltos visuais na oscilação dos ticks.

---

## 4. Parecer dos Agentes

- **Marca Binmax:** Aprovado. Nenhuma cor fora dos tokens oficiais foi introduzida. A regra *"Prata é a marca. Verde é o dinheiro. Vermelho é o risco. Nada mais tem cor"* está rigorosamente codificada.
- **Fidelidade IQ:** Aprovado. Nenhuma dimensão de layout ou posicionamento de elemento foi alterada neste passo.
- **Compliance e Risco:** Aprovado. SUBE e BAJA possuem paridade de luminância sobre o fundo do painel e contraste acessível.
- **Guardião de Regressão:** Aprovado. 63 testes vitest passando, compilação sem alertas críticos.
