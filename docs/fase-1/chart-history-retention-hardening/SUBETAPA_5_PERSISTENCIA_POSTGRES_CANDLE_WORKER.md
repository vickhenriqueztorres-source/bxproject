# Subetapa 5: Persistência Duradoura no PostgreSQL & Integração com Candle Worker

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `financial-correctness-reviewer`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `08-database-foundation`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-06 (Conformidade Ticks x Candles) | DB-04 (Índices & Particionamento)

---

## 1. Escopo e Objetivos da Subetapa

Garantir que a retenção histórica não dependa exclusivamente de processos em memória RAM, conectando a esteira duradoura de candles ao **PostgreSQL 16**:
1. **Otimização de Índices na Tabela `candles`:** Assegurar índice composto de cobertura `(symbol, interval, bucket_start DESC)` para responder a queries de paginação retroativa em $< 2\text{ms}$.
2. **Exposição Oficial da Rota `/api/candles` no `services/api`:** Adicionar o endpoint `/api/candles` no Fastify com suporte a `before` e `limit`, lendo do PostgreSQL com credencial somente leitura (`M-05`).
3. **Estratégia Híbrida (Dual Tier):** Em ambientes onde o banco está sendo populado, unir transparentemente as velas duráveis do PostgreSQL com a vela em formação mais recente do Redis, entregando integridade absoluta do passado até o instante presente.

---

## 2. Passos de Execução Obrigatórios

### Passo 5.1: Auditoria e Criação do Índice Otimizado no PostgreSQL
- **Ação:** Verificar a migration ou DDL da tabela `candles`:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_candles_lookup_desc 
  ON candles (symbol, interval, bucket_start DESC);
  ```
- **Critério de Aceite:** O plano de execução `EXPLAIN ANALYZE` confirma `Index Only Scan` ou `Index Scan` na busca por `(symbol, interval, bucket_start < :before)`.

### Passo 5.2: Implementação da Rota `/api/candles` em `services/api/src/routes/chart.ts`
- **Ação:** Adicionar o endpoint Fastify:
  ```typescript
  server.get<{ Querystring: { symbol?: string; interval?: string; limit?: string; before?: string } }>(
    "/api/candles",
    async (request, reply) => {
      const symbol = request.query.symbol || "SYNTH_VOL_50";
      const interval = request.query.interval || "1m";
      const limit = Math.min(Math.max(1, parseInt(request.query.limit || "500", 10)), 1000);
      const beforeSec = request.query.before ? parseInt(request.query.before, 10) : null;

      let query = `
        SELECT bucket_start, open, high, low, close, volume
        FROM candles
        WHERE symbol = $1 AND interval = $2
      `;
      const params: any[] = [symbol, interval];

      if (beforeSec && !isNaN(beforeSec) && beforeSec > 0) {
        query += ` AND bucket_start < $3 ORDER BY bucket_start DESC LIMIT $4;`;
        params.push(new Date(beforeSec * 1000), limit);
      } else {
        query += ` ORDER BY bucket_start DESC LIMIT $3;`;
        params.push(limit);
      }

      const res = await server.pg.query(query, params);
      // Inverte para retornar ASC (da mais antiga para a mais recente)
      const rows = res.rows.reverse();
      return rows.map(r => ({
        time: Math.floor(new Date(r.bucket_start).getTime() / 1000),
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: parseInt(r.volume, 10),
      }));
    }
  );
  ```
- **Critério de Aceite:** A rota responde com array de velas ordenado ascendentemente pelo tempo em formato padronizado.

### Passo 5.3: Sanitização Estrita e Proteção contra SQL Injection
- **Ação:** Uso estrito de parâmetros preparados (`$1, $2, $3, $4`) sem concatenação de strings para valores externos.
- **Critério de Aceite:** 100% das queries parametrizadas.

### Passo 5.4: Política de Retenção e Expurgamento Histórico (Vacuum / Drop Antigo)
- **Ação:** Documentar e configurar rotina para reter até 30 dias de velas de 1 minuto e até 1 ano de velas de 1 hora, impedindo crescimento descontrolado do disco do PostgreSQL.
- **Critério de Aceite:** Política de retenção documentada em ADR.

### Passo 5.5: Compatibilidade com o Script de Reconstrução de Velas (`rebuild-candles.ts`)
- **Ação:** Validar que o comando `npm run rebuild-candles` no `candle-worker` preenche o histórico a partir dos ticks com os mesmos identificadores e precisões.
- **Critério de Aceite:** Rebuild gera velas consistentes e verificáveis pelo endpoint.

### Passo 5.6: Teste de Carga de Leitura no Banco
- **Ação:** Disparar 500 requisições simultâneas contra o PostgreSQL simulando múltiplos traders consultando histórico.
- **Critério de Aceite:** Latência média da query $< 5\text{ms}$.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Concorrência de Leituras e Gravações Simultâneas):**
  - O `candle-worker` executa UPSERTs contínuos a cada segundo enquanto o teste executa 100 leituras/s de histórico. Zero deadlocks ou contenção de locks na tabela `candles`.
- **Segurança (Credencial Somente Leitura):**
  - Validar que o usuário de banco utilizado pela rota `/api/candles` possui estritamente privilégios `SELECT` na tabela `candles`, sem permissão de `UPDATE` ou `DELETE`.
- **Caos (Failover / Restart do Banco de Dados):**
  - Se o PostgreSQL oscilar momentaneamente, a API deve retornar erro 503 com retry automático pelo cliente TanStack Query, recuperando a conexão assim que o banco estiver disponível.

---

## 4. Critérios de Aceite da Subetapa 5
- [ ] Rota `/api/candles` presente no Fastify com paginação retroativa no PostgreSQL.
- [ ] Índice cobrindo `(symbol, interval, bucket_start DESC)` ativo no banco.
- [ ] Latência de consulta p95 $< 10\text{ms}$.
- [ ] Invariantes de idempotência e zero duplicação preservadas.
