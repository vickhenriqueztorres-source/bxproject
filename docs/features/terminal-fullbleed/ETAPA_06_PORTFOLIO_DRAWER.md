# Subetapa 6: Gaveta Inferior de Portfólio & PnL em Tempo Real

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Revisão Financeira:** `financial-correctness-reviewer`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 6 APROVADO)  

---

## 1. Objetivo da Etapa
Construir a **Gaveta Inferior Retrátil (Bottom Drawer)** "Portfólio Total":
- Estado colapsado: barra compacta (altura de 32px) no rodapé exibindo resumo rápido: *"Portfólio: X operações ativas · PnL Flutuante: +$XX.XX [▲ Expandir]"*.
- Estado expandido: gaveta que sobe suavemente (altura de 220px) revelando a lista de contratos:
  - Contratos Abertos: Ativo, Direção (UP/DOWN), Preço de Entrada, Preço Atual, Tempo Restante com barra de progresso regressiva, PnL em tempo real (Verde se estiver ganhando, Vermelho se estiver perdendo).
  - Histórico Recente: Últimos contratos liquidados com badge oficial WIN / LOSS / DRAW e valor creditado.

---

## 2. Especificação de Componentes

### Componente `PortfolioDrawer.tsx`
- Contenção no rodapé com botão de alternância (chevron para cima/baixo).
- Tabela com colunas:
  1. `Ativo / ID`
  2. `Tipo` (CALL verde / PUT vermelho)
  3. `Investimento` (ex: `$10,00`)
  4. `Strike` (preço inicial)
  5. `Cotação Atual`
  6. `Expiração` (ex: `00:23` com barra regressiva de progresso)
  7. `Lucro Esperado / PnL`
- Sincronização em tempo real via eventos WebSocket e atualização a cada tick de mercado.

---

## 3. Matriz de Testes & Validação da Etapa 6

### A. Teste de Estresse (Múltiplas Ordens Simultâneas)
- Executar 5 ordens em sequência:
  - Todas devem aparecer na gaveta com contadores independentes decrescendo a cada segundo.
  - Ao expirar, a ordem deve migrar automaticamente para o histórico com resultado oficial sem recarregar a tela.

### B. Teste de Layout Dinâmico
- Expandir e colapsar a gaveta repetidamente:
  - O gráfico deve adaptar seu tamanho automaticamente via `ResizeObserver` sem perder o foco ou sofrer piscamentos (flicker).

---

## 4. Critérios de Passagem (Quality Gate 6)
- [ ] Gaveta inferior abre e fecha com transição suave.
- [ ] Contratos ativos mostram contagem regressiva viva e PnL flutuante sincronizado com o tick atual.
- [ ] Transição automática para status liquidado (WIN/LOSS) ao receber evento oficial do backend.
