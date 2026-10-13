# Subetapa 02: Grade de Multi-Gráficos Separados e Controle no Header

**Responsável:** `chart-trading-engineer` & `broker-architect-agent`  
**Revisor:** `iq-fidelity-reviewer` & `qa-resilience-agent`  
**Executor Cirúrgico:** `surgical-frontend-agent`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS"

---

## 1. Problema Abordado (Problema 1 do Operador)
O operador não consegue abrir nem alternar grades de gráficos separados:
1. O botão `header-grid-layout-btn` no cabeçalho não tem ação de clique, nem menu popup de seleção de layout de grades (1 tela inteira, 2 lado a lado, 4 grade 2x2, 6 institucional 3x2).
2. Na sala nova Turbo Prata, o switcher interno do `MultiChartGrid` está ocultado no modo padrão 1x1.
3. Não há comunicação de estado de layout entre o `TerminalHeader`, o `App.tsx` e o `MultiChartGrid`.

---

## 2. Passo a Passo de Implementação

### Passo 1: Criação da Suíte de Testes Unitários de Interface e Eventos (TDD Primeiro)
- **Arquivo**: `apps/web/src/chart/grid-layout-popover.unit.test.tsx`
- **Casos de Teste Obrigatórios**:
  - `GRID-01`: Renderização do popover com as opções de grade (1x1, 2x1, 2x2, 3x2).
  - `GRID-02`: Disparo do evento `onSelectLayout` ao clicar em uma opção de grade.
  - `GRID-03`: Fechamento automático ao clicar fora ou pressionar a tecla `Escape`.
  - `GRID-04`: Teste de Estresse simulando alternâncias ultrarrápidas de layout (100 cliques seguidos) sem travamento nem desmonte de contexto WebGL.

### Passo 2: Implementação do Popover de Seleção de Layout
- **Arquivo**: `apps/web/src/chart/GridLayoutPopover.tsx`
- Layout elegante estilo Turbo Prata com ícones de distribuição visual:
  - `[ 1 ]` Tela Cheia (1x1)
  - `[ 2 ]` Split Screen Vertical (2x1)
  - `[ 4 ]` Grade Quádrupla (2x2)
  - `[ 6 ]` Grade Institucional (3x2)

### Passo 3: Integração no `TerminalHeader.tsx` e `App.tsx`
- Conectar o botão `header-grid-layout-btn` ao `GridLayoutPopover`.
- Elevar o estado `layout` para o `App.tsx` e passá-lo para `MultiChartGrid`.
- Permitir ao operador clicar em cada janela separada e trocar o ativo individualmente sem interferir nos outros gráficos abertos.

### Passo 4: Execução e Validação dos Testes
- Rodar os testes de `grid-layout-popover.unit.test.tsx`.
- Verificar se a seleção de grade abre gráficos separados perfeitamente divididos.
