# Subetapa 02: Eliminação de Scrollbar Feio e Integração Multi-Gráfico + Gaveta de Posições

> **Orquestrador**: `tech-lead-orchestrator`  
> **Agente Executor**: `surgical-frontend-agent`  
> **Revisor de Design**: `chief-visual-director` (`designer-senior-binmax`)  
> **Agente de Testes**: `qa-resilience-agent`  
> **Skills**: `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality`, `12-tokens-binmax`  

---

## 1. Objetivo Técnico
Erradicar por completo o aparecimento de barras de rolagem nativas (com setas e fundo cinza claro) no `MultiChartGrid` e no `TerminalLayout`.
Assegurar que, quando o usuário clicar em "Mostrar posiciones" e a tabela de ordens abrir no rodapé, as células dos gráficos mantenham suas boletas 100% integradas, responsivas e sem nenhum artefato de scrollbar.

---

## 2. Passo a Passo de Implementação
1. No arquivo `apps/web/src/chart/MultiChartGrid.tsx`:
   - No container da boleta individual `[data-testid="cell-order-ticket-${symbol}"]`:
     - Adicionar classe `bm-stealth-scroll`.
     - Alterar `overflowY: 'auto'` para `overflow: 'hidden'`.
     - Ajustar padding para `4px 3px` (ganho de 4px verticais preciosos).
2. No arquivo `apps/web/src/styles.css`:
   - Criar regras CSS explícitas de stealth scrollbar para todos os containers de boleta da BINMAX:
     ```css
     .theme-binmax [data-testid^="cell-order-ticket-"],
     .theme-binmax .cell-order-ticket-container,
     .theme-binmax .terminal-order-dock {
       scrollbar-width: none !important;
       -ms-overflow-style: none !important;
     }
     .theme-binmax [data-testid^="cell-order-ticket-"]::-webkit-scrollbar,
     .theme-binmax .cell-order-ticket-container::-webkit-scrollbar,
     .theme-binmax .terminal-order-dock::-webkit-scrollbar {
       display: none !important;
       width: 0 !important;
       height: 0 !important;
     }
     ```
3. No arquivo `apps/web/src/components/drawer/PortfolioDrawer.tsx`:
   - Calibrar a altura do conteúdo expandido da gaveta para `clamp(160px, 20vh, 210px)` (em vez de fixo em 220px), aliviando a compressão vertical dos gráficos acima quando a tabela estiver aberta.
4. Criar a suíte de testes de integração:
   - Arquivo: `apps/web/src/chart/subetapa-02-eliminacao-scroll-grid.unit.test.tsx`
   - Testar a montagem de `MultiChartGrid` nos layouts `1x2` e `2x2` com verificação de aplicação de classes stealth e ausência de scrollbars nativas.

---

## 3. Matriz de Testes da Subetapa 02
| ID | Tipo | Cenário de Teste | Critério de Sucesso |
|---|---|---|---|
| T2.1 | Integração | MultiChartGrid 2x2 com boletas integradas | Todas as 4 células possuem `overflow: hidden` e `bm-stealth-scroll` |
| T2.2 | CSS | Regras de supressão de scrollbar nativa | Scrollbar display: none e scrollbar-width: none presentes |
| T2.3 | Drawer | Altura adaptativa da gaveta de posições | Conteúdo com clamp responsivo e tabela stealth |
| T2.4 | Visual | Layout 1x2 vertical | Ambas as células mantêm proporção sem scrollbar |

---

## 4. Critério de Aceite da Subetapa 02
Apenas avançar para a Subetapa 03 quando:
- `subetapa-02-eliminacao-scroll-grid.unit.test.tsx` estiver 100% verde.
- Nenhuma quebra visual ocorrer nos testes existentes de layout.
