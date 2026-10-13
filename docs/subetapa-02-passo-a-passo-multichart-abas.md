# Subetapa 02: Sincronização Dinâmica de Abas com a Grade de Múltiplos Gráficos

**Responsável:** `iq-fidelity-reviewer` & `chart-trading-engineer`  
**Revisor:** `compliance-risk-reviewer` & `qa-resilience-agent`  
**Executor Cirúrgico:** `surgical-frontend-agent`  
**Garantia:** "NUNCA IMPLEMENTAR NADA SEM TESTES ROBUSTOS"

---

## 1. Escopo Técnico da Subetapa 02

1. **Vincular Células da Grade às Abas Abertas (`openTabs`)**:
   - Em vez de uma lista estática de 6 células fixas, `MultiChartGrid` mapeia as abas abertas pelo operador (`openTabs`).
   - Se o operador tem 2 abas abertas (`EURUSD_OTC` e `BTCUSD_OTC`) e seleciona layout `2x1`, a tela esquerda exibe `EURUSD_OTC` e a direita exibe `BTCUSD_OTC`.
   - Se o operador clica no botão `[+]` e abre um 3º ativo, o novo ativo se integra ordenadamente à grade.

2. **Foco e Interação Bidirecional**:
   - Clicar em uma janela da grade define o `activeSymbol` e destaca a aba no topo.
   - Clicar na aba no topo foca e destaca a janela correspondente na grade.
   - Se o operador fechar uma aba (`onCloseTab`), a janela correspondente é removida ou substituída suavemente.

3. **Controles Independentes por Célula na Grade Dividida**:
   - Cada janela possui seu próprio seletor rápido de ativo e indicador de latência/cotação em tempo real.

---

## 2. Passo a Passo de Execução

### Passo 1: Criação dos Testes de Sincronização de Abas e Grade
- **Arquivo**: `apps/web/src/chart/subetapa-02-tabs-grid-sync.unit.test.tsx`
- **Casos de Teste**:
  - `SYNC-01`: MultiChartGrid preenche células com os símbolos exatos de `openTabs`.
  - `SYNC-02`: Layout 2x1 com 2 abas renderiza os 2 gráficos correspondentes sem duplicação.
  - `SYNC-03`: Foco de célula dispara `onActiveSymbolChange` e sincroniza a aba ativa.
  - `SYNC-04`: Teste de estresse com 50 abas abertas e fechadas sucessivamente sem falhas.

### Passo 2: Refatoração do `MultiChartGrid.tsx` e `App.tsx`
- Receber `openTabs` como prop em `MultiChartGridProps`.
- Sincronizar o array de células dinamicamente a partir de `openTabs`.

### Passo 3: Execução e Validação dos Testes
- Rodar vitest e certificar aprovação de 100% dos testes.
