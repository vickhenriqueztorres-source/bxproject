# Subetapa 01: Barra de Controle & Motion de Deslize Mecânico

> **Módulo**: `PortfolioDrawer.tsx` / `apps/web/src/components/drawer/PortfolioDrawer.tsx`  
> **Responsáveis**: `chief-visual-director`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Status**: Pronto para Execução  

---

## 1. Objetivos de Design e Engenharia

1. **Eliminação do Emoji `💼`**: Substituir por ícone SVG minimalista de precisão (pasta de ordens ou radar operacional, stroke 1.5px, proporção 14x14px).
2. **Badge de Ativas Institucional**: Pílula neutra com dot indicador verde `#22C55E` quando houver operações, com numerais em Geist Mono `tabular-nums` (`${openContracts.length} activas`).
3. **Métricas de Ganho Potencial**: Formatação em Geist Mono com verde institucional, sem ruído visual.
4. **Acionador Retrátil com Chevron Rotativo**:
   - Manter os rótulos contratuais para não quebrar testes legados (`Mostrar posiciones ⌵` quando fechado, `Mostrar posiciones ⌃` quando aberto).
   - Chevron em SVG vetorial discreto ao lado do rótulo, com transição de rotação mecânica (180ms cubic-bezier).
5. **Motion de Deslize Físico (`--bm-ease`)**:
   - A gaveta deve abrir e fechar com transição mecânica suave de altura e opacidade (260ms), acabando com o salto de layout abrupto.
   - Aplicação de `overflow: hidden` e aceleração por GPU (`will-change: max-height, opacity`).

---

## 2. Bateria de Testes Exigida

- **Unitário**:
  - Testar presença do ícone vetorial SVG (não conter caractere unicode de emoji).
  - Testar renderização do badge institucional de ativas com Geist Mono.
  - Testar presença do chevron animado e rótulos de controle (`Mostrar posiciones ⌵` / `Mostrar posiciones ⌃`).
- **Estresse**:
  - Teste de renderização contínua de 100 ciclos do componente montado/desmontado em < 150ms.
- **Caos**:
  - Alternância rápida de estado `isOpen` (simulação de 30 cliques por segundo no botão de toggle) sem quebrar o estado interno ou vazar memória.
- **Não-Regressão**:
  - Validar compatibilidade total com os testes já existentes em `apps/web/src/trade/subetapa-18-04-ticket-portfolio.unit.test.tsx` (TC-02 e TC-03).
