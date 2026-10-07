# Subetapa 4: NTP & Sincronização de Relógio entre Servidores

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Líder:** `backend-implementation-agent`  
**Agente de Infra/Ops:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `07-production-operations`, `05-resilience-patterns`  
**Invariantes:** O-01 a O-03 (Observabilidade e integridade operacional)

---

## 1. Escopo e Objetivos da Subetapa
Garantir que todos os componentes do ecossistema (Tick Engine, WebSocket Gateway, API Server, Candle Worker e Settlement Worker) operem sobre uma base de tempo rigorosamente sincronizada via NTP (Network Time Protocol) com 3 ou mais servidores upstream. Monitorar continuamente o clock offset do nó e emitir alarmes imediatos caso o desvio temporal ultrapasse o limite de tolerância ($\text{offset} > 100\text{ms}$), impedindo "atrasos fantasmas" decorrentes de clock drift.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 4.1: Módulo de Verificação de Drift de Relógio (Clock Sync Monitor)
- **Ação:** Criar serviço utilitário no backend que consulta servidores NTP upstream (ou mede offset em relação ao relógio de consenso do cluster/banco PostgreSQL):
  $$\text{clock\_offset\_ms} = T_{server} - T_{reference}$$
- **Critério de Aceite:** Resolução periódica (a cada 30s) sem impacto na latência de trading.

### Passo 4.2: Limiar de Tolerância Estrito (100ms)
- **Ação:** Definir `MAX_CLOCK_OFFSET_MS = 100`.
  * Se $|\text{clock\_offset\_ms}| > 100$, ativar estado `CLOCK_SKEW_WARNING`.
  * Se $|\text{clock\_offset\_ms}| > 500$, ativar estado crítico `CLOCK_SKEW_CRITICAL`.
- **Critério de Aceite:** Detecção proativa antes que o desvio afete timestamps de ticks ou expirações.

### Passo 4.3: Exportação da Métrica de Offset para Prometheus
- **Ação:** No endpoint `/metrics`, exportar:
  * `node_clock_offset_ms`: Gauge com o desvio em milissegundos.
  * `node_clock_skew_alert`: Gauge binário (0 = calibrado, 1 = desviado).
- **Critério de Aceite:** Monitoramento padrão OpenMetrics.

### Passo 4.4: Sincronização de Relógio de Banco (PostgreSQL `NOW()` vs Node.js)
- **Ação:** No health check `/readyz`, medir o delta entre `SELECT clock_timestamp()` e `Date.now()`.
- **Critério de Aceite:** Diferença entre a aplicação e o banco não pode exceder 50ms.

### Passo 4.5: Calibração de Timestamp no Frontend (Client-to-Server Clock Delta)
- **Ação:** No [`TradingFeedManager.ts`](file:///D:/brokerproject/apps/web/src/feed/TradingFeedManager.ts):
  * Durante o handshake ping/pong, calcular o offset do relógio local do usuário:
    $$\text{rtt} = t_{pong} - t_{ping}$$
    $$\text{client\_offset\_ms} = t_{server\_ts} - (t_{ping} + \text{rtt}/2)$$
  * Usar o offset para exibir timestamps calibrados na interface do usuário.
- **Critério de Aceite:** Gráfico e contagens regressivas sincronizados com o servidor mesmo se o relógio do computador do usuário estiver adiantado/atrasado.

### Passo 4.6: Log de Alerta para Clock Skew Crítico
- **Ação:** Registrar no logger estruturado sempre que ocorrer drift relevante.
- **Critério de Aceite:** Auditoria forense de sincronismo.

---

## 3. Testes Obrigatórios da Subetapa
1. **Teste de Medição de Offset:** Simular servidor perfeitamente sincronizado ($< 5\text{ms}$) com status saudável.
2. **Teste de Disparo de Alerta de Skew:** Injetar desvio artificial de $150\text{ms}$ e validar disparo de `node_clock_skew_alert = 1`.
3. **Teste de Calibração Cliente-Servidor:** Validar cálculo de RTT e offset no cliente via ping/pong.

---

## 4. Critérios Formais de Aceite (Quality Gate)
- Monitoramento contínuo de clock offset implementado.
- Alerta disparado para desvios $> 100\text{ms}$.
- Testes automatizados executados e 100% aprovados.
