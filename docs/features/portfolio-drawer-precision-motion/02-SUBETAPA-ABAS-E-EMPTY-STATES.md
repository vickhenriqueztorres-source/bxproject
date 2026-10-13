# Subetapa 02: Abas Segmentadas Institucionais & Empty States de Precisão

> **Módulo**: `PortfolioDrawer.tsx` / `apps/web/src/components/drawer/PortfolioDrawer.tsx`  
> **Responsáveis**: `chief-visual-director`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Status**: Aguardando Conclusão da Subetapa 01  

---

## 1. Objetivos de Design e Engenharia

1. **Erradicação de Bordas Verdes Neon nas Abas**:
   - Eliminar `border: 1px solid #22C55E` e fundos fluorescentes que transmitem aspecto de aposta / cassino.
   - Implementar controle segmentado institucional (Segmented Control ou Tabs de Precisão):
     - Superfície inativa: transparente ou sutil `--bg-1` (`#101622`), texto `--text-muted` (`#8A92A1`).
     - Superfície ativa: `--bg-3` (`#1C2738`), texto `--text-strong` (`#FFFFFF`), borda sutil de 1px com `rgba(255, 255, 255, 0.1)`.
     - Contadores em Geist Mono tabular `(N)`.
2. **Empty State de Alta Precisão para Ordens Abertas**:
   - Acabar com o texto jogado no vazio escuro.
   - Criar container centralizado com:
     - Micro-ilustração/ícone vetorial sóbrio de trading (radar de posições ou gráfico de linha em traço de 1.5px dentro de casulo circular sutil).
     - Título em Geist Sans 13.5px com peso 700 (`No tienes operaciones abiertas` ou `Sin operaciones abiertas`).
     - Subtítulo com instrução clara e profissional (`Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.` preservado para compatibilidade).
     - Hint técnico de telemetria ("El terminal actualizará este panel en tiempo real al detectar ejecuciones activas.").
3. **Empty State para Histórico Fechado**:
   - Ícone de histórico auditado (ampulheta / livro contábil minimalista).
   - Título e subtítulo preservando `Aún no tienes operaciones cerradas.`.

---

## 2. Bateria de Testes Exigida

- **Unitário**:
  - Validar remoção de classes e estilos neon nos botões de abas.
  - Verificar presença de estrutura com ícone vetorial, título e subtítulo no Empty State.
  - Conferir preservação dos textos oficiais de i18n em espanhol neutro (`Operaciones abiertas (N)`, `Historial cerrado (N)`, `Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar.`, `Aún no tienes operaciones cerradas.`).
- **Acessibilidade (A11y)**:
  - Validar atributos `role="tab"`, `aria-selected` e `tabIndex`.
- **Caos e Estresse**:
  - Teste de troca rápida e contínua de abas (100 comutações) sem atraso de layout ou inconsistência de render.
