# Plano Geral do Orquestrador (`tech-lead-orchestrator`) — 4 Subetapas Cirúrgicas de Alta Precisão

**Data**: 16/10/2026  
**Orquestrador**: `tech-lead-orchestrator` (`ORCHESTRATOR.md`)  
**Regra de Ouro**: Execução **100% sequencial subetapa por subetapa**. Nenhuma subetapa avança sem validação 100% verde (testes unitários, estresse, segurança, caos e regressão). Zero quebras funcionais. Diff mínimo e cirúrgico.

---

## 1. Seleção de Agentes Especializados e Skills Ativadas

| Subetapa | Escopo Técnico | Agentes Selecionados (`ORCHESTRATOR.md`) | Skills Ativadas (`.agents/skills/`) |
| :--- | :--- | :--- | :--- |
| **Subetapa 01** | Eliminar falso alarme `"Reconectando..."` no refresh (`F5` / Cold-Start) sem quebrar detecção real de queda pós-conexão; indicador silencioso de inicialização quando aplicável. | `frontend-realtime-agent`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent` | `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`, `21-designer-senior-binmax` |
| **Subetapa 02** | Corrigir abertura de nova aba de gráfico (ex.: `EUR/USD`) que nasce espremida no canto esquerdo e leva segundos para normalizar (Imagem 1). | `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent` | `01-project-context`, `03-synthetic-market-engine`, `06-testing-quality`, `11-chart-trading-tools`, `17-mudanca-cirurgica` |
| **Subetapa 03** | Transformar a Linha de Ponto de Entrada (Strike Line) de pontilhada/opaca para **reta sólida (`solid`) e altamente destacada** (Imagem 2). | `chart-trading-engineer`, `chief-visual-director`, `surgical-frontend-agent`, `qa-resilience-agent` | `11-chart-trading-tools`, `12-tokens-binmax`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`, `06-testing-quality` |
| **Subetapa 04** | Trava de segurança de saída em torneio ativo na Arena Blitz + persistência de sessão (`sessionStorage`) contra perda/reset + correção do redirecionamento do botão Voltar (Imagens 3 e 4). | `frontend-realtime-agent`, `compliance-risk-reviewer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent` | `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`, `21-designer-senior-binmax` |

---

## 2. Diagnóstico Forense de Causa Raiz (Evidência `arquivo:linha`)

### Problema 1 — `"Reconectando..."` ao atualizar a página (`F5` / Cold-Start)
- **Evidência**:
  1. [`TradingFeedManager.ts:135-145`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts#L135-L145): `connect(forceImmediate = false)` aplica `getStaggeredDelay(10000, false)`, postergando a primeira conexão WebSocket em até **10 segundos** (`0–10.000ms`) quando chamado sem `forceImmediate = true`.
  2. [`TradingFeedManager.ts:832-835`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts#L832-L835) e [`888-899`](file:///d:/brokerproject/apps/web/src/feed/TradingFeedManager.ts#L888-L899): No instante do mount (`t = 0ms`), `symbolLastTickAt.get(symbol)` é `undefined`. `isSymbolStale(symbol)` retorna `true` imediatamente e `onSymbolStaleness` dispara `callback(true, 99999)` sincronamente no ato da inscrição!
  3. [`MultiChartGrid.tsx:71, 84, 244-245`](file:///d:/brokerproject/apps/web/src/chart/MultiChartGrid.tsx#L71-L86) e [`App.tsx:266, 987`](file:///d:/brokerproject/apps/web/src/App.tsx#L266): Como `isStale` nasce `true` antes mesmo do handshake inicial do WebSocket terminar, o gráfico exibe `<ReconnectingOverlay isReconnecting={isStale} />` (`"Reconectando..."`), `<StalenessOverlay isStale={isStale} />` (`"Feed desconectado — aguardando reconexão..."`) e o `TerminalFooter` exibe `"Reconectando..."` durante o boot normal da página.
- **Solução Cirúrgica**:
  - Preservar intacto o contrato público de `TradingFeedManager.isSymbolStale(symbol)` (exigido pelos testes unitários de falha de feed `otc-feed-failure-modes.unit.test.tsx`).
  - Adicionar em `TradingFeedManager` o controle explícito de ciclo de vida de boot (`isColdStarting(symbol?: string, graceMs?: number)` e `connect(true)` imediato quando invocado pelo hook de UI `useFeed` ou inscrição de primeiro símbolo ativo quando ainda não houve tentativa prévia), diferenciando **"Inicializando conexão (Cold-Start Grace Window)"** de **"Queda de conexão / Reconectando (pós-conexão ou após expirar janela de boot)"**.
  - Em `MultiChartGrid.tsx` e `use-feed.ts`, suprimir o disparo prematuro de `"Reconectando..."` durante a janela de warm-up inicial (~4.000ms do mount/troca de ativo antes do 1º tick) e, enquanto os candles iniciais carregam no cold-start, exibir apenas um indicador discreto e silencioso de carregamento (`data-testid="chart-cold-start-loader"`) sem alarmar o usuário com `"Reconectando..."`.

### Problema 2 — Novo gráfico abre espremido no canto esquerdo e demora segundos para normalizar (Imagem 1)
- **Evidência**:
  1. [`IsolatedChartHost.tsx:620-663`](file:///d:/brokerproject/apps/web/src/chart/IsolatedChartHost.tsx#L620-L663): Ao abrir uma nova aba (ex.: `EUR/USD` -> `EURUSD_OTC`), no Render 1 (`t = 0ms`), `candlesQuery.data` ainda está carregando (`candles = []`). `symbolChanged` é `true`, `prevSymbolRef.current` é atualizado para `'EURUSD_OTC'` e `hadBarsRef.current = false`.
  2. No Render 2 (`t = 50ms`), chega **1 único tick** do WebSocket (ou 1 barra observada em `observed.current.bars`) antes do término do HTTP `getCandles('EURUSD_OTC', '1m')`. `cleanBars` passa a ter `length === 1`. Nesse momento, `wasEmpty` era `true` e `cleanBars.length > 0`, logo `hadBarsRef.current` vira `true` e o gráfico faz `scrollToRealTime()` para um dataset de 1 única barra (`logicalRange` ancorado no índice `0..1`).
  3. No Render 3 (`t = 250ms`), o HTTP `getCandles` resolve com **1.440 / 2.880 velas históricas**. `candleSeries.setData(cleanBars)` substitui 1 barra por 1.440 barras. Porém, na linha 656:
     `if (symbolChanged || timeframeChanged || (wasEmpty && cleanBars.length > 0))`
     Todas as 3 condições são **FALSAS** (`symbolChanged = false`, `timeframeChanged = false`, `wasEmpty = false` pois o Render 2 tinha 1 barra!). O Lightweight Charts mantém a janela lógica próxima ao índice `0`, espremendo as velas no extremo esquerdo do canvas até que segundos depois um redimensionamento ou pan acione re-escala!
  4. Adicionalmente, em [`PriceChart.tsx:314-350`](file:///d:/brokerproject/apps/web/src/chart/PriceChart.tsx#L314-L350), quando `candles` HTTP está vazio (`candles.length === 0`) e há apenas 1 barra em `observed.current.bars`, passar 1 única barra isolada antes do histórico chegar causa escala degenerada.
- **Solução Cirúrgica**:
  - Em `IsolatedChartHost.tsx`, rastrear `prevBarCountRef` e `historyHydratedRef` por `symbol + timeframe`. Sempre que o histórico completo hidratar (transição de `prevBarCount <= 2` para `cleanBars.length > 2`, ou primeiro carregamento real de histórico para o par `symbol:timeframe`), executar imediatamente `priceScale('right').applyOptions({ autoScale: true })`, `timeScale().scrollToRealTime()` e enquadramento explícito das últimas `N` velas visíveis (`setVisibleLogicalRange({ from: cleanBars.length - 65, to: cleanBars.length + 4 })`), garantindo renderização instantânea na escala correta no exato frame em que os dados entram.

### Problema 3 — Linha de Ponto de Entrada pontilhada e pouco destacada (Imagem 2)
- **Evidência**:
  1. [`OrderFlagsOverlay.tsx:189-201`](file:///d:/brokerproject/apps/web/src/chart/OrderFlagsOverlay.tsx#L189-L201) (modo `TRADEROOM_POLISH = true`) e [`348-356`](file:///d:/brokerproject/apps/web/src/chart/OrderFlagsOverlay.tsx#L348-L356) (modo legado):
     A linha SVG `strike-line-*` está com `strokeDasharray="4 4"`, `strokeWidth={1}` (ou `1.5`) e `strokeOpacity={0.7}`.
  2. Em fundos escuros com velas densas, um traço pontilhado de `1px` com `0.7` de opacidade perde contraste visual.
- **Solução Cirúrgica**:
  - Em `OrderFlagsOverlay.tsx`, remover `strokeDasharray` da linha de ponto de entrada (`strike-line-*`), tornando-a uma **linha reta contínua (sólida)** com `strokeWidth={2}` (`stroke-width="2"`), `strokeOpacity={0.95}` e marcador de âncora nítido (`strike-entry-dot-*`), destacando com precisão cirúrgica a taxa exata de entrada do contrato.
  - Atualizar os testes correspondentes (`subetapa-polish-04-positions.unit.test.tsx` e `subetapa-7-2-strike-lines-svg.unit.test.tsx`) para validar a nova invariante visual exigida pelo usuário (linha sólida reta e destacada).

### Problema 4 — Arena Blitz / Torneios: Saída sem trava, perda de sessão e botão Voltar redirecionando errado (Imagens 3 e 4)
- **Evidência**:
  1. [`use-arena.ts:206-209`](file:///d:/brokerproject/apps/web/src/arena/use-arena.ts#L206-L209): O estado do torneio (`store.current`) vive apenas em memória local (`useRef`) do componente `ArenaPage`. Qualquer clique acidental na navegação lateral (`SidebarDock`), botão voltar ou refresh destrói a sessão do torneio em andamento.
  2. [`ArenaPage.tsx:84, 103, 133, 187-191`](file:///d:/brokerproject/apps/web/src/pages/ArenaPage.tsx#L84-L191):
     - Não há nenhuma trava (`Navigation Guard / Exit Lock Modal`) quando o usuário está com torneio ativo (`stage === 'countdown' || stage === 'running' || stage === 'settling'`).
     - O botão `data-testid="arena-back-to-tournaments"` (`← Torneios` / `← Voltar`) chama incondicionalmente `navigate('/torneos')`, jogando o usuário para a página externa institucional `TournamentsPage.tsx` (Imagem 4) mesmo quando ele está no meio de uma partida na Arena ou veio da Sala de Trading (`/operar`).
- **Solução Cirúrgica**:
  1. **Persistência de Sessão Ativa (`sessionStorage`)**: Em `use-arena.ts`, persistir automaticamente o estado da sessão ativa (`binmax_arena_active_session_v1`) quando `stage` está em `'countdown' | 'running' | 'settling'` (e quando não for instanciado com overrides estáticos de teste como `initialStage`), reidratando-o automaticamente se o usuário recarregar a página ou retornar à `/arena`. Limpar o storage ao encerrar (`ended`) ou abandonar explicitamente (`leave()`).
  2. **Trava de Segurança de Torneio Ativo (`ArenaExitLockDialog`)**: Em `ArenaPage.tsx`, quando `isLive` (`countdown`, `running`, `settling`), qualquer tentativa de sair (clicar no botão voltar do topo, clicar na logo, clicar em `"Sala de Trading →"`, clicar em `"Torneios"`, `"Operar"` ou itens da `SidebarDock`, ou `beforeunload` do navegador) é interceptada pela **Trava de Segurança (`data-testid="arena-exit-lock-dialog"`)**, que informa que o torneio está em andamento e oferece:
     - **Continuar no Torneio** (mantém o jogador na partida sem perder 1 segundo);
     - **Voltar à Sala de Trading mantendo sessão salva em segundo plano** (navega para `/operar` preservando a sessão ativa no `sessionStorage` para que possa retomar);
     - **Sair e Abandonar Torneio** (encerra a sessão ativa e volta ao Lobby da Arena).
  3. **Correção do Botão Voltar**:
     - Quando o usuário está em partida ativa (`isLive`), o botão superior esquerdo exibe `← Sair da Partida` / `← Voltar ao Lobby` e aciona a **Trava de Segurança** (nunca redireciona direto para a Imagem 4 `/torneos`).
     - Quando o usuário está no Lobby da Arena (`stage === 'lobby'`), o botão superior esquerdo permite voltar diretamente para a **Sala de Trading (`/operar`)** (ou para a origem interna da sala), evitando cair na página institucional externa da Imagem 4 sem intenção.

---

## 3. Documentos de Subetapas (Passo a Passo + Testes de Estresse, Segurança e Caos)

1. [SUBETAPA-01-COLD-START-SEM-RECONECTANDO.md](./SUBETAPA-01-COLD-START-SEM-RECONECTANDO.md)
2. [SUBETAPA-02-NOVO-GRAFICO-ESCALA-IMEDIATA.md](./SUBETAPA-02-NOVO-GRAFICO-ESCALA-IMEDIATA.md)
3. [SUBETAPA-03-LINHA-ENTRADA-RETA-DESTACADA.md](./SUBETAPA-03-LINHA-ENTRADA-RETA-DESTACADA.md)
4. [SUBETAPA-04-ARENA-TRAVA-PERSISTENCIA-VOLTAR.md](./SUBETAPA-04-ARENA-TRAVA-PERSISTENCIA-VOLTAR.md)
