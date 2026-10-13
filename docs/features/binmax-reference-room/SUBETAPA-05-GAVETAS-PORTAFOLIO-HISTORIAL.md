# SUBETAPA 05: GAVETAS DE PORTAFOLIO & HISTORIAL (SESSÕES 5, 5B & 6)

**Objetivo:** Implementar as gavetas laterais retráteis de `Portafolio` (com estados de ordens abertas e estado vazio ilustrado) e de `Historial` (com filtro de resultados e agrupamento por data), acionadas pelos botões do Sidebar Dock, exatamente como demonstrado nas Sessões 5, 5b e 6.

---

## 1. Escopo e Fronteiras

- **Arquivos Abrangidos:**
  * `apps/web/src/components/drawer/PortfolioDrawer.tsx`
  * `apps/web/src/history/HistoryDrawer.tsx` (ou componente equivalente)
  * `apps/web/src/components/sidebar/SidebarDock.tsx`
  * `apps/web/src/trade/portfolio.unit.test.ts`
  * `apps/web/src/trade/history-expansion.unit.test.ts`
- **Fronteira Proibida:** O histórico de transações e a lista de ordens abertas devem refletir fielmente o estado das queries de contratos sem mockar dados estáticos falsos.

---

## 2. Detalhamento das Gavetas (Sessões 5, 5b & 6)

### 2.1 Gaveta Portafolio (Sessão 5 & 5b):
- **Largura e Posição:** Gaveta deslizante lateral (~320px) posicionada à esquerda do gráfico sem empurrar o layout.
- **Cabeçalho:** Título `Portafolio` e botão de fechar `×`.
- **Abas:** `Abiertas (N)` (ativa) e `Cerradas`.
- **Estado Ativo (Sessão 5):**
  * Lista de operações em andamento.
  * Para cada operação:
    - Bandeira do par de moedas + nome do ativo (`EUR/USD`, `NZD/JPY`).
    - Pílula direcional: `SUBE` (fundo verde suave) ou `BAJA` (fundo vermelho suave).
    - Valor investido (`$102`, `$50`).
    - P&L flutuante em tempo real: `+$27.60` (verde) ou `-$12.50` (vermelho).
- **Estado Vazio (Sessão 5b):**
  * Quando não há operações abertas (`Abiertas (0)`):
  * Ilustração vetorial minimalista de pasta aberta.
  * Texto principal: `No tienes operaciones abiertas`.
  * Texto secundário: `Abre una operación con SUBE o BAJA.`.

### 2.2 Gaveta Historial (Sessão 6):
- **Cabeçalho:** Título `Historial` e botão de fechar `×`.
- **Filtro:** Dropdown estilizado `Resultado: Todos` (opções: `Todos`, `Ganadas`, `Perdidas`).
- **Seção Temporal:** Agrupador `Hoy`.
- **Cards de Histórico:**
  * Linha do ativo com bandeira e horário: `EUR/USD 02:14`.
  * Direção e montante: `▲ SUBE $100` ou `▼ BAJA $50`.
  * Resultado financeiro: `+$85.00` em Verde Ganancia ou `-$50.00` em Vermelho Risco.

---

## 3. Passo a Passo de Execução

1. **Ajuste e Modularização do `PortfolioDrawer.tsx`:**
   Implementar a alternância perfeita entre a lista de ordens ativas e o estado vazio elegante da Sessão 5b.
2. **Implementação do `HistoryDrawer.tsx`:**
   Criar a gaveta lateral de histórico conectada à listagem oficial de contratos liquidados, com filtro por status e formatação da Prancha 6.
3. **Conexão com o `SidebarDock.tsx`:**
   Ao clicar em `Portafolio`, abre a gaveta de portfólio; ao clicar em `Historial`, abre a gaveta de histórico; ao clicar novamente ou no `×`, fecha a gaveta.
4. **Execução de Testes Automatizados:**
   Testar renderização com 0 contratos, 1 contrato e 50 contratos.

---

## 4. Testes Rigorosos e Critérios de Aceite

### 4.1 Testes Unitários:
- Verificar transição entre estado vazio (5b) e lista com operações abertas (5).
- Testar filtragem do histórico por `Ganadas` e `Perdidas`.

### 4.2 Teste de Estresse (Atualização em Massa de P&L):
- Atualizar o preço de mercado 50 vezes por segundo: o cálculo do P&L flutuante das ordens abertas deve se manter leve sem travamento de UI.

### 4.3 Teste de Caos:
- Fechar e abrir a gaveta rapidamente durante a expiração de uma ordem: nenhum estado desatualizado ou erro de desassociação de componente (unmounted setState).

---

## 5. Critério de Gate
- **Status:** [ ] PENDENTE
- Gaveta Portafolio abre exibindo operações ativas ou estado vazio ilustrado.
- Gaveta Historial exibe operações liquidadas com filtro funcional.
