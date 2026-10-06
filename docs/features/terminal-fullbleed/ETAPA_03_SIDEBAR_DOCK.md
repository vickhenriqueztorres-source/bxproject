# Subetapa 3: Sidebar Dock de Ícones & Drawers Laterais

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `frontend-realtime-agent`  
**UX & Ergonomia:** `broker-architect-agent`  
**QA & Caos:** `qa-resilience-agent`  
**Status:** CONCLUÍDO E HOMOLOGADO (GATE 3 APROVADO)  

---

## 1. Objetivo da Etapa
Implementar a **Sidebar Dock Vertical Esquerda** (`48px` de largura fixa):
- Acesso rápido por ícones vetoriais modernos:
  1. **Portfólio / Posições Abertas** (com contador badge de contratos ativos).
  2. **Histórico de Trading** (operações liquidadas recentes, Win/Loss/Draw).
  3. **Alertas & Sinais** (notificações do mercado e oscilação de volatilidade).
  4. **Configurações** (controle de efeitos sonoros, fuso horário UTC-3 vs UTC, tema escuro).
- Fly-out Drawer lateral suave (painel deslizante de 320px sem cobrir o gráfico de forma intrusiva).

---

## 2. Especificação de Componentes

### Componente `SidebarDock.tsx`
- Container fixo `width: 48px`, `border-right: 1px solid #1a263d`, `background: #090e1b`.
- Botões de ícones com tooltips posicionados à direita (`left: 56px`).
- Estado de seleção (`activeTab: 'portfolio' | 'history' | 'alerts' | 'settings' | null`).
- Painel Drawer deslizante à esquerda com animação CSS fluida (`transform: translateX()`).
- Fechamento com tecla `ESC` ou clique fora (backdrop suave).

---

## 3. Matriz de Testes & Validação da Etapa 3

### A. Teste de Ergonomia e Foco
- Abertura e fechamento rápido do drawer não devem provocar perda de foco no canvas do gráfico.
- Atalhos de teclado (ex: `H` para histórico, `P` para portfólio) responsivos e sem interferir nos inputs de digitação de stake.

### B. Teste de Caos (Flapping de Drawer sob Alta Carga)
- Abrir e fechar repetidamente o drawer enquanto ticks estão chegando a 20 ticks/segundo:
  - O gráfico deve continuar atualizando suavemente sem saltos de frames (mantendo 60fps).

---

## 4. Critérios de Passagem (Quality Gate 3)
- [ ] Sidebar renderiza corretamente na borda esquerda com largura precisa de 48px.
- [ ] Fly-out Drawer abre e fecha suavemente sem quebrar o layout.
- [ ] Tooltips com design de alta definição e z-index controlado.
