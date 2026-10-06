# Subetapa 6: Seletor de Grade Multi-Gráficos & Overlays Oficiais de Ordem

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação Frontend:** `frontend-realtime-agent`  
**Ergonomia & Design:** `broker-architect-agent`  
**Segurança (Auditoria de Bundle):** `security-reviewer`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-11 cliente, V-13)  
**Status:** HOMOLOGADO E APROVADO (GATE 6 PASS)

---

## 1. Objetivo da Subetapa
Construção do layout flexível de múltiplos gráficos no Trading Terminal (`apps/web`):
- **Modos de Visualização Responsivos**:
  - `1x1` (Modo Padrão Full-Bleed 100% de tela).
  - `2x1` (Split Screen Vertical ou Lado a Lado).
  - `2x2` (Grade com 4 Gráficos Simultâneos independentes).
- **Foco e Ordem Ativa**:
  - Clicar sobre qualquer célula da grade define aquele gráfico como o **Ativo Ativo** para o Order Ticket operacional à direita.
- **Isolamento de Overlays de Ordem**:
  - As linhas de strike, bandeirinhas de entrada (verde para UP, vermelha para DOWN) e linhas de expiração derivam estritamente dos contratos retornados pelo backend, filtrados pelo símbolo da célula.
- **Auditoria de Bundle Limpo**:
  - Garantia de que o frontend não contém geradores de preços, ticks artificiais ou cotações simuladas baseadas em `Math.random` (`A-07`).

---

## 2. Os 6 Passos de Execução da Subetapa 6

1. **Passo 1 (Componente `MultiChartGrid.tsx`)**:
   Implementar a casca responsiva com suporte dinâmico a 1, 2 ou 4 células, com grid CSS dinâmico e auto-redimensionamento via `ResizeObserver`.
2. **Passo 2 (Componente `ChartCell.tsx` com Lightweight Charts)**:
   Encapsular cada viewport com seletor independente de símbolo (dropdown entre os 36 ativos), seletor de tempo gráfico (5s, 1m, 5m) e botão de maximização.
3. **Passo 3 (Isolamento de Overlays de Contrato)**:
   Implementar `ContractOverlay.tsx` em cada célula: renderizar a linha de strike e a bandeira de direção apenas se `contract.symbol == cell.symbol`.
4. **Passo 4 (Sincronização Bidirecional com o Order Ticket)**:
   Ao focar ou alterar o símbolo de qualquer célula, propagar evento de foco para sincronizar o Order Ticket lateral (atualizando saldo, payout e parâmetros).
5. **Passo 5 (Auditoria Estática de Zero Simulação no Cliente)**:
   Remover qualquer mock em memória (`mockQuote`, `Math.random` gerando ticks). O componente só atualiza com eventos oficiais vindos do `TradingWebSocketClient`.
6. **Passo 6 (Suíte de Testes Automatizada do Gate 6)**:
   Executar `tests/test-multi-06-multi-grid.mjs` e `tests/unit/client-no-simulated-quotes.test.ts`.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Performance de Renderização 60 FPS)**:
  - Renderizar a grade 2x2 com 4 gráficos Lightweight Charts recebendo 36 ticks/s agregados. Provar que a CPU do navegador permanece abaixo de 30% e a taxa de renderização dos canvas sustenta 60 FPS sem congelamentos.
- **Segurança (Auditoria AST do Bundle sem Cotações Simuladas)**:
  - Varredura automatizada no diretório `apps/web/src` via `client-no-simulated-quotes.test.ts`: provar que inexistem chamadas a `Math.random()` para geração de preços, candles ou strikes (`A-07`).
- **Caos (Troca Rápida de Layout sob Fluxo Contínuo de Ticks)**:
  - Alternar em alta frequência entre os layouts 1x1, 2x1 e 2x2 enquanto ticks chegam a cada segundo. Provar que nenhum gráfico sofre memory leak ou cria inscrições órfãs no WebSocket.

---

## 4. Garantias Pós-Implementação (Skill 10)

- **`V-11 (Lado Cliente)`**: Conexão única mantida pelo singleton; 1 subscrição no servidor quando o mesmo par está em 2 gráficos; strikes renderizados exclusivamente por eventos oficiais do servidor.
- **`V-13`**: Integridade da suíte; testes originais preservados sem enfraquecimento.

---

## 5. Critérios de Passagem do Quality Gate 6
- Executar `node tests/test-multi-06-multi-grid.mjs` $\to$ Exit Code 0.
- Executar `npx tsx --test tests/unit/client-no-simulated-quotes.test.ts` $\to$ Exit Code 0.
- Homologação do `security-reviewer` e do `post-implementation-verifier` emitindo veredito **`APROVADO`**.
