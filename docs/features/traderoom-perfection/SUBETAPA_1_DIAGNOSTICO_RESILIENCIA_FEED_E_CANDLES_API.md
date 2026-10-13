# SUBETAPA 1: DIAGNÓSTICO, RESILIÊNCIA DO FEED E CARREGAMENTO DE CANDLES DA API

> **Orquestrador:** `tech-lead-orchestrator`  
> **Agentes Envolvidos:** `codebase-mapper-agent`, `chart-trading-engineer`, `qa-resilience-agent`, `surgical-frontend-agent`  
> **Skills Aplicadas:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `11-chart-trading-tools`

---

## 1. Problema Identificado & Causa Raiz
No screenshot submetido pelo usuário:
1. O banner central exibe: `FEED DESATUALIZADO — COTAÇÃO CONGELADA (SYNTH_VOL_50) Sem cotações oficiais há 100s. Abertura de novos contratos bloqueada pela governança de risco.`
2. A tela do gráfico fica preta/vazia porque o componente `PriceChart.tsx` não renderiza velas históricas quando o feed de ticks não sincroniza ou quando a API remota de candles não responde prontamente.
3. Se o WebSocket gateway estiver instável ou em ambiente dev/offline, o cliente entra em pânico de staleness (`isStale = true`) e bloqueia a UI inteira, transformando a tela em um visual deserto e pouco profissional.

---

## 2. Escopo Cirúrgico da Subetapa

### 2.1 Lista Fechada de Arquivos Impactados
- `apps/web/src/feed/TradingFeedManager.ts` (Resiliência do loop de conexão, heartbeat, fallback de reconexão adaptativa).
- `apps/web/src/api/client.ts` (Garantia de carregamento de candles históricos via `/api/candles` com retry exponencial e buffer local resiliente).
- `apps/web/src/chart/PriceChart.tsx` (Preservação e renderização de velas mesmo durante oscilação temporária de feed; overlay de staleness discreto sem cobrir a tela).
- `apps/web/src/chart/StalenessOverlay.tsx` (Refinamento do banner de staleness para um pill discreto no topo, idêntico à IQ Option, sem bloquear o canvas gráfico).
- `apps/web/src/trade/feed-resilience.unit.test.ts` (Novo arquivo de testes unitários e de caos do feed).

### 2.2 O que Muda
- Adição de fallback de reconexão suave com re-tentativa imediata em caso de perda de WebSocket.
- O gráfico NUNCA mais fica preto: se a conexão com o WebSocket demorar mais de 4 segundos, o gráfico mantém a última série de velas carregadas pela API em visualização nítida, alterando apenas a badge de status para âmbar/cinza e desativando a boleta de compra.
- O banner de staleness deixa de ser um card gigante de 500px no meio da tela e passa a ser uma notificação moderna, compacta e discreta na parte superior da escala do gráfico.
- Suporte a semente de candles prévios para evitar renderização vazia em inicializações rápidas.

### 2.3 O que NÃO Muda (Invariantes Intocáveis)
- **PROIBIDO** gerar preços aleatórios ou cotações simuladas no frontend (Regra inviolável A-07 / Menor 8).
- **PROIBIDO** alterar a assinatura dos endpoints `/api/candles`, `/api/wallet` ou `/api/contracts`.
- Toda ordem aberta continua exigindo confirmação oficial do backend e idempotência.

---

## 3. Matriz de Testes Rigorosos

### 3.1 Testes Unitários
- Validação de que `getCandles` parseia corretamente arrays de velas OHLCV e lida com respostas 500/503 com retry sem lançar exceções não tratadas.
- Validação de que `TradingFeedManager` transiciona entre estados `CONNECTED`, `STALE` e `DISCONNECTED` de forma determinística.

### 3.2 Testes de Estresse
- **Simulação de Rajada:** Injeção de 500 ticks sintéticos em 1 segundo no `TradingFeedManager` comprovando que o `RafChartUpdater` coalesce para no máximo 60 atualizações no canvas.
- **Carga de Velas:** Carregamento de 3.500 velas históricas sem travamento da thread principal (tempo de montagem do gráfico < 120ms).

### 3.3 Testes de Caos
- **Simulação de Queda de Rede:** Fechamento abrupto do socket WebSocket (`socket.close(1006)`) — o cliente deve entrar em circuit breaker defensivo, exibir o pill discreto e reconectar com backoff e jitter sem disparar reconnect storm.
- **Reconstrução por Snapshot:** Envio de gap de sequência (`tick.sequence = 10` após `tick.sequence = 1`) forçando re-sincronização via REST snapshot e drenagem do buffer sem perda de monotonicidade.

### 3.4 Testes de Segurança
- Verificação de que nenhum tick forjado injetado via console cliente afeta o ledger ou a precificação oficial de liquidação.
- Validação de que o bloqueio de abertura de ordens durante `isStale = true` é mantido rigorosamente no botão SUBE/BAJA.

### 3.5 Testes de Regressão
- Com a feature flag `NEW_TRADEROOM` ativada ou desativada, a lógica de recebimento de ticks opera com 100% de paridade.

---

## 4. Critérios de Aceite (Gate de Saída)
1. `pnpm vitest run apps/web/src/trade/feed-resilience.unit.test.ts` executando 100% verde.
2. O gráfico renderiza velas imediatamente ao abrir a aplicação, sem tela preta.
3. Se o WebSocket for desconectado, o gráfico permanece visível com o histórico e o aviso de cotação pausada é elegante e discreto.
4. Nenhuma regressão nos 46 testes existentes.
