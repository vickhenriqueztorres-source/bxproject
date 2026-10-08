# Subetapa 2: Pre-Cache e Agregação Multi-Timeframe na API REST (1m, 5m, 15m, 1h)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `backend-implementation-agent`  
**Agente Revisor:** `chart-trading-engineer` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `03-synthetic-market-engine`, `05-resilience-patterns`  
**Invariantes:** V-04 (OHLCV Idempotente) | V-05 (Isolamento de Ativos)

---

## 1. Escopo e Objetivos da Subetapa

Capacitar o backend a entregar fatias agregadas de **5m (2.016 barras)**, **15m (672 barras)** e **1h (168 barras)** diretamente pela rota `/candles`:
- Quando o frontend ou o trader solicitar `interval=5m`, o backend não precisa enviar 10.080 barras de 1 minuto para o cliente processar. Ele realiza a compressão em memória e envia apenas as **2.016 barras de 5 minutos**.
- **Redução de Payload:** O volume de dados trafegado cai de $\approx 850\text{ KB}$ para míseros $\approx 160\text{ KB}$ (ou $\approx 32\text{ KB}$ comprimido com gzip), chegando ao navegador em **$< 8\text{ms}$**.

---

## 2. Passos de Execução Obrigatórios

### Passo 2.1: Módulo de Agregação Rápida no Backend (`aggregateMinutesToInterval`)
- **Ação:** Implementar função pura de alta velocidade em `scripts/dev-live-feed.mjs`:
  ```javascript
  function aggregateCandlesToInterval(baseBars, intervalSec) {
    if (intervalSec <= 60) return baseBars;
    const map = new Map();
    for (const b of baseBars) {
      const bucket = Math.floor(b.time / intervalSec) * intervalSec;
      const existing = map.get(bucket);
      if (!existing) {
        map.set(bucket, {
          time: bucket,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          volume: b.volume
        });
      } else {
        const curHigh = parseFloat(existing.high);
        const curLow = parseFloat(existing.low);
        const bHigh = parseFloat(b.high);
        const bLow = parseFloat(b.low);
        if (bHigh > curHigh) existing.high = b.high;
        if (bLow < curLow) existing.low = b.low;
        existing.close = b.close;
        existing.volume += b.volume;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.time - b.time);
  }
  ```
- **Critério de Aceite:** Agregação de 10.080 barras para 2.016 barras de 5m executada em $< 1.8\text{ms}$.

### Passo 2.2: Suporte a `interval` no Endpoint `/candles`
- **Ação:** No handler de `/candles`:
  * Extrair `interval = parsedUrl.searchParams.get('interval') || '1m'`.
  * Mapear para segundos: `1m -> 60s`, `5m -> 300s`, `15m -> 900s`, `1h -> 3600s`.
  * Se `interval > 1m`, executar a agregação sobre o subset filtrado.
- **Critério de Aceite:** `GET /candles?symbol=EURUSD_OTC&interval=5m&limit=2016` retorna exatamente a semana inteira condensada em 2.016 barras.

### Passo 2.3: Cache LRU de Velas Agregadas Fechadas
- **Ação:** Manter em memória cache das barras fechadas para evitar reprocessamento repetitivo a cada milissegundo.
- **Critério de Aceite:** Consultas repetidas de 5m respondem em $< 0.5\text{ms}$.

### Passo 2.4: Headers de Resposta e Compressão Gzip
- **Ação:** Emitir headers `Content-Type: application/json` e `Cache-Control: public, max-age=5`.
- **Critério de Aceite:** Resposta aceita compressão gzip transparente via Nginx.

### Passo 2.5: Teste de Consistência Matemática entre 1m e 5m
- **Ação:** Validar que para qualquer barra de 5 minutos, o `open` é idêntico ao `open` do primeiro minuto do bloco, e o `close` é idêntico ao `close` do último minuto do bloco.
- **Critério de Aceite:** 100% de coincidência matemática.

### Passo 2.6: Teste Automatizado da Subetapa 2
- **Ação:** Criar e executar teste automatizado comprovando o retorno de 5m, 15m e 1h para os 36 ativos.
- **Critério de Aceite:** Suíte 100% aprovada.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Throughput Agregado):**
  - 200 requisições simultâneas de `interval=5m`. CPU do servidor deve se manter abaixo de 15%.
- **Segurança (Intervalos Maliciosos):**
  - Requisições com `interval=invalid` ou `interval=999999999h` devem ser sanitizadas para o padrão `1m`.
- **Caos (Mudança de Fuso UTC):**
  - Garantir que todos os buckets de 5m e 1h iniciam no segundo zero alinhado ao UTC (`date_bin` determinístico).

---

## 4. Critérios de Aceite da Subetapa 2
- [ ] Endpoint `/candles` entrega fatias de 5m (2.016 barras) e 15m (672 barras) cobrindo os 7 dias completos.
- [ ] Tempo de resposta do backend $< 5\text{ms}$.
- [ ] Invariantes de OHLC matematicamente perfeitas nas barras agregadas.
