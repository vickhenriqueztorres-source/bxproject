# Subetapa 3: Frontend Staleness por Símbolo & Banner Visual no Gráfico

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder de Implementação:** `frontend-realtime-agent`  
**Agente Revisor de Segurança:** `security-reviewer`  
**Agente de Testes:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `09-ai-failure-map`  
**Invariantes Protegidas:** M-06 (Isolamento de feeds), A-07 (Proteção contra preços fantasmas)

---

## 1. Escopo e Objetivos da Subetapa
Eliminar o verificador global ingênuo (`anyRecent`) no frontend e substituí-lo por **rastreamento de frescor rigoroso e independente por símbolo**. Se um par parar de receber ticks por mais de 4 segundos (ex: `BTCUSD_OTC`), apenas o gráfico daquele par exibirá o banner visual destacado *"⚠️ FEED DESATUALIZADO — COTAÇÃO CONGELADA"*, a tag de preço ficará cinza opaca e a boleta de negociação bloqueará imediatamente as ordens com aviso sonoro e visual, enquanto os outros ativos ativos continuam funcionando perfeitamente sem falso alarme.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 3.1: Refatoração do `TradingFeedManager` para Staleness Granular por Símbolo
- **Ação:** No [`TradingFeedManager.ts`](file:///D:/brokerproject/apps/web/src/feed/TradingFeedManager.ts):
  * Substituir o método `onStatusChange(callback: (connected, stale) => void)` por:
    `onSymbolStalenessChange(symbol: string, callback: (isStale: boolean, tickAgeMs: number) => void)`
  * Manter um mapa reativo `symbolStaleMap: Map<string, boolean>`.
  * No loop de 1000ms, calcular $\Delta t = \text{Date.now()} - \text{lastTickAt}(symbol)$. Se $\Delta t > 4000\text{ ms}$, disparar evento `isStale = true` especificamente para os ouvintes daquele símbolo.
- **Critério de Aceite:** O congelamento de um símbolo não altera o estado de frescor de nenhum outro símbolo.

### Passo 3.2: Exposição do Estado de Staleness na Célula da Grade (`GridCell`)
- **Ação:** No [`MultiChartGrid.tsx`](file:///D:/brokerproject/apps/web/src/chart/MultiChartGrid.tsx), a célula assina o evento de staleness do seu símbolo via `tradingFeedManager.onSymbolStaleness(symbol, ...)`.
- **Critério de Aceite:** Cada célula do grid (seja em layout 1x1, 2x1 ou 2x2) conhece seu próprio estado de frescor com re-renderização isolada.

### Passo 3.3: Criação do Componente de Alerta Visual `StalenessOverlay`
- **Ação:** Criar o componente visual [`StalenessOverlay.tsx`](file:///D:/brokerproject/apps/web/src/chart/StalenessOverlay.tsx):
  * Posicionado de forma flutuante sobre o canvas do Lightweight Charts.
  * Faixa destacada com fundo âmbar/vermelho translúcido com efeito de pulso e texto:  
    `⚠️ COTAÇÃO CONGELADA (Último tick há X segundos) — Abertura de ordens suspensa`
- **Critério de Aceite:** O banner aparece instantaneamente ao atingir 4s de atraso e desaparece no milissegundo em que o próximo tick chega.

### Passo 3.4: Desativação Visual e Bloqueio na Boleta Operacional (`OrderTicket`)
- **Ação:** No [`OrderTicket.tsx`](file:///D:/brokerproject/apps/web/src/trade/OrderTicket.tsx), vincular a prop `stale` ao staleness estrito do `symbol` atualmente focado.
  * Quando `stale = true`:
    * Os botões `▲ ACIMA (CALL)` e `▼ ABAIXO (PUT)` ficam desabilitados com cursor `not-allowed`.
    * Exibe mensagem informativa: *"Cotação pausada ou atrasada pela operação. Aguarde atualização oficial."*
- **Critério de Aceite:** Impossível submeter clique de ordem enquanto o ativo estiver marcado como stale.

### Passo 3.5: Indicador de Frescor na Barra de Status Superior (`TerminalHeader`)
- **Ação:** No [`TerminalHeader.tsx`](file:///D:/brokerproject/apps/web/src/components/header/TerminalHeader.tsx), atualizar o badge de status para exibir:
  * 🟢 **AO VIVO (16ms)** — quando o símbolo focado está fresco.
  * 🟡 **ATRASADO (+4s)** — quando o símbolo focado ultrapassa 4s.
  * 🔴 **DESCONECTADO** — quando a conexão WebSocket caiu.
- **Critério de Aceite:** A informação de latência e status reflete fielmente o ativo atualmente visualizado.

### Passo 3.6: Feedback Sonoro de Alerta de Silêncio de Mercado
- **Ação:** No [`sound-engine.ts`](file:///D:/brokerproject/apps/web/src/lib/sound-engine.ts), criar tom suave de aviso caso o usuário tente clicar nos botões desabilitados enquanto o ativo estiver congelado.
- **Critério de Aceite:** Prevenção de frustração do usuário com feedback sonoro tátil de trava de risco.

---

## 3. Testes Obrigatórios da Subetapa

### 3.1 Teste de Isolamento Multi-Gráficos (Grid 2x2)
* Abrir 4 gráficos simultâneos: `EURUSD_OTC`, `BTCUSD_OTC`, `XAUUSD_OTC`, `SYNTH_VOL_50`.
* Interromper a geração de ticks exclusivamente de `BTCUSD_OTC`.
* Verificar que **apenas** a célula de `BTCUSD_OTC` exibe o banner de staleness; as outras 3 permanecem 100% ativas e sem banner.

### 3.2 Teste de Recuperação Instantânea (De-staleness)
* Retomar os ticks de `BTCUSD_OTC`.
* No primeiro tick recebido, verificar que o banner de alerta desaparece e a boleta é desbloqueada no mesmo frame (0ms de atraso perceptual).

### 3.3 Teste de Resolução de Bloqueio em Troca de Ativo
* Trocar a aba ativa de um ativo stale (`BTCUSD_OTC`) para um ativo ativo (`EURUSD_OTC`).
* Verificar que a boleta atualiza imediatamente para o estado do ativo focado sem reter estado obsoleto.

---

## 4. Critérios Formais de Aceite (Quality Gate)
1. Detecção e alerta visual disparados em exatamente 4 segundos de silêncio de um ativo.
2. Zero interferência cruzada entre ativos na grade multi-gráficos.
3. Teste aprovado pelo `frontend-realtime-agent` e `qa-resilience-agent`.
