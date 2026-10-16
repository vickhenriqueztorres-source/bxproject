# Subetapa 01 — Eliminação Cirúrgica do Falso `"Reconectando..."` no Refresh / Cold-Start

**Agentes Alocados**: `frontend-realtime-agent`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`  
**Skills Ativadas**: `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`  
**Status**: Planejada — Pronta para Execução

---

## 1. Diagnóstico Preciso da Causa Raiz

1. **Atraso no primeiro handshake (`staggered-startup`)**:
   - Em [`TradingFeedManager.ts:135-145`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts#L135-L145), `connect(forceImmediate = false)` agenda a primeira conexão com `getStaggeredDelay(10000, false)` (até 10s de espera antes de abrir o WebSocket).
2. **Staleness imediato no instante `t = 0ms`**:
   - Em [`TradingFeedManager.ts:832-835`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts#L832-L835), ao inscrever um ativo via `onSymbolStaleness(symbol, cb)`, `this.isSymbolStale(symbol)` retorna `true` porque `symbolLastTickAt.get(symbol)` ainda é `undefined`.
   - Em [`MultiChartGrid.tsx:71, 84, 244-245`](file:///d:/brokerproject/apps/web/src/chart/MultiChartGrid.tsx#L71-L86), `isStale` nasce `true` e aciona imediatamente `<ReconnectingOverlay isReconnecting={isStale} />` (`"Reconectando..."`) e `<StalenessOverlay isStale={isStale} />` durante um simples F5 / carregamento inicial.
   - Em [`App.tsx:266, 987`](file:///d:/brokerproject/apps/web/src/App.tsx#L266), `TerminalFooter` recebe `isConnected={feed.connected}` que é `false` nos primeiros milissegundos do boot, exibindo `"Reconectando..."` antes mesmo de ter havido qualquer queda.

---

## 2. Passo a Passo Cirúrgico da Implementação

### Passo 1.1 — Cold-Start Grace Period e Handshake Imediato no Hook de UI (`use-feed.ts` e `TradingFeedManager.ts`)
- Manter **100% intacto** o método `TradingFeedManager.isSymbolStale(symbol)` e o default `connect(forceImmediate = false)` para não quebrar nenhum teste unitário direto de `TradingFeedManager` (`otc-feed-failure-modes.unit.test.tsx`).
- Adicionar em `TradingFeedManager`:
  - Registro `symbolSubscribedAt: Map<string, number>` e `instanceCreatedAt: number = Date.now()`.
  - Método `isSymbolColdStarting(symbol: string, graceMs = 4000): boolean`: retorna `true` apenas se o símbolo nunca recebeu um tick válido (`!this.symbolLastTickAt.has(symbol)`), o circuit breaker não está aberto, e o tempo desde a inscrição do símbolo (ou criação do manager) é menor que `graceMs`.
- Em `useFeed` (`apps/web/src/feed/use-feed.ts`):
  - Chamar `feedManager.connect(true)` no mount quando `feedManager.getState() === 'DISCONNECTED'` para eliminar o atraso de até 10 segundos no carregamento interativo da página.
  - Expor `isColdStarting: boolean` (verdadeiro apenas nos primeiros segundos do boot inicial enquanto aguarda o primeiro handshake/tick, tornando-se `false` assim que `connected` fica `true` ou após o timeout de grace de 3.5s).

### Passo 1.2 — Supressão de Falso `"Reconectando..."` e Loader Minimalista (`MultiChartGrid.tsx` e `ReconnectingOverlay.tsx`)
- Em `MultiChartGrid.tsx` (`GridCell`):
  - Controlar uma janela de cold-start por célula (`isColdStartGrace`) nos primeiros `3500ms` após o mount/troca de símbolo enquanto nenhum tick chegou ainda (`cellTick === null`).
  - Assim que o primeiro tick chegar (`cellTick !== null`) ou o timer de `3500ms` expirar sem conexão, `isColdStartGrace` passa definitivamente para `false`.
  - Enquanto `isColdStartGrace` for `true`, `effectiveIsStale = false` para os overlays de erro (`ReconnectingOverlay` e `StalenessOverlay` **não** são exibidos no F5!).
  - Caso `candlesQuery.isLoading` esteja ativo durante o cold-start e ainda não haja velas em cache, `ReconnectingOverlay` suporta o modo opcional `mode="loading"` (ou `isColdLoading`), renderizando apenas um ícone minimalista e silencioso de carregamento (`data-testid="cold-start-loading-icon"`) sem o texto alarmista `"Reconectando..."`.
- Em `App.tsx`:
  - Passar `isConnected={feed.connected || feed.isColdStarting}` para o `TerminalFooter`, evitando que a barra inferior pisque `"Reconectando..."` em laranja nos primeiros milissegundos de um refresh normal, mas exibindo `"Reconectando..."` imediatamente se a conexão cair de fato ou se o boot exceder a janela de grace.

---

## 3. Plano de Testes (Unitários, Estresse, Segurança e Caos)

Arquivo de teste dedicado: `apps/web/src/feed/subetapa-01-cold-start-reconnecting.unit.test.tsx`

1. **Teste Unitário 1.1 (Zero `"Reconectando..."` no Refresh / Cold-Start)**:
   - Verifica que no mount inicial (`t = 0ms`), `isSymbolColdStarting(symbol)` é `true`, `ReconnectingOverlay` não exibe `"Reconectando..."` e `TerminalFooter` permanece estável sem falso alarme.
2. **Teste Unitário 1.2 (Modo Ícone de Carregamento Silencioso)**:
   - Verifica que `ReconnectingOverlay` com `isLoadingInitial={true}` e `isReconnecting={false}` renderiza apenas o ícone discreto (`data-testid="cold-start-loading-icon"`) sem texto `"Reconectando..."`.
3. **Teste de Caos 1.3 (Queda Real de Conexão Pós-Boot e Timeout de Cold-Start)**:
   - Simula conexão bem-sucedida seguida de queda real (`age > 5000ms`) OU falha total de rede onde o cold-start ultrapassa `4000ms` sem nenhum tick: comprova que `isSymbolColdStarting` vira `false` e o overlay `"Reconectando..."` + bloqueio de boleta (`stale = true`) entram em ação normalmente!
4. **Teste de Segurança 1.4 (Sanitização de Símbolo e Prevenção de Injeção no Overlay)**:
   - Injeta payloads maliciosos no parâmetro `symbol` (ex.: `<script>alert(1)</script>`) em `ReconnectingOverlay` em ambos os modos (`loading` e `reconnecting`) e comprova escape completo no HTML.
5. **Teste de Estresse 1.5 (500 Ciclos de Refresh / Troca Rápida de Símbolo)**:
   - Executa 500 ciclos consecutivos de inscrição/desinscrição e renderização de `ReconnectingOverlay` e `TradingFeedManager.isSymbolColdStarting` em `< 250ms` sem vazamento de timers ou memória.
