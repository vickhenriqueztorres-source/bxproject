# Subetapa 2: Motor de Coalescing Temporal (Janela de 50ms)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent` & `broker-architect-agent`  
**Agente Revisor:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** M-02 (Monotonicidade de Sequence) | Redução de Volume de Fan-Out

---

## 1. Escopo e Objetivos da Subetapa
Implementar o motor de **Coalescing** no gateway: se múltiplos ticks do mesmo ativo chegam dentro de uma janela de 50ms, o motor retém o tick mais fresco (maior `sequence` e `event_time`) e descarta com segurança os intermediários acumulados.
- Regra fixa: a cada 50ms por símbolo, despacha o tick mais recente e descarta os anteriores.
- Preserva o estado de preço sem distorcer o valor corrente de mercado para o trader.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 2.1: Modelagem da Classe `TickCoalescer`
- **Ação:** Desenvolver o módulo `TickCoalescer` com buffer de retenção por símbolo:
  * `coalesceWindowMs = 50` (50 milissegundos)
  * Mapa `symbol -> { pendingTick, timer, droppedCount }`
- **Critério de Aceite:** O módulo exporta métodos `push(tick, dispatchCallback)` e `flushAll()`.

### Passo 2.2: Lógica de Substituição de Ticks Mais Frescos
- **Ação:** Quando um novo tick chega antes do término da janela de 50ms do símbolo:
  * O tick anterior é descartado e o contador `droppedCount` é incrementado.
  * O novo tick assume o lugar no buffer garantindo `newTick.sequence > oldTick.sequence`.
- **Critério de Aceite:** Apenas o tick de maior sequência é transmitido quando o temporizador expira.

### Passo 2.3: Despacho e Agendamento Timer-Free / Microtask Eficiente
- **Ação:** O timer de 50ms é agendado uma única vez por janela e desarmado assim que o lote é entregue, evitando overhead de timers concorrentes.
- **Critério de Aceite:** Zero vazamento de timers no Node.js.

### Passo 2.4: Teste de Rajada Intensa (Burst de 20 Ticks em 30ms)
- **Ação:** Injetar uma rajada de 20 ticks do ativo `BTCUSD_OTC` com intervalos de 1.5ms (total 30ms < 50ms).
- **Critério de Aceite:** Exatamente 1 mensagem é despachada ao final da janela com o 20º tick (preço e sequence mais recentes), e exatamente 19 ticks intermediários são contabilizados como descartados.

### Passo 2.5: Teste de Fluxo Normal a 1Hz (Sem Atraso Artificial)
- **Ação:** Injetar ticks com intervalo de 1000ms (1Hz normal).
- **Critério de Aceite:** Cada tick é entregue ao término de seus 50ms sem acúmulo nem perda indevida.

### Passo 2.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-2-coalescing.mjs`.
- **Critério de Aceite:** 100% dos testes aprovados com contabilidade exata de descarte.
