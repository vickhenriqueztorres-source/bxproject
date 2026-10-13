# SUBETAPA 3: PIPELINE OTC DEMO COM PROVEDORES, PRICE NORMALIZER E PRICE GUARD

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `qa-resilience-agent`, `chart-trading-engineer`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-ETAPA-3`  

---

## 1. Objetivo e Especificação Técnica

Construir o pipeline robusto de **OTC Demo com Feed Real** em `services/tick-engine`, em estrita observância à Seção 4 da especificação:

### 1.1 Arquitetura do Fluxo de Dados
```text
[Market Data API (Provedores Externos)]
       │
       ▼
[Price Normalizer]
  - normaliza símbolo (ex: BTC-USD / BTCUSDT → BTCUSD_OTC)
  - valida timestamp UTC
  - detecta outlier matemático (desvio z-score)
       │
       ▼
[Price Guard]
  - rejeita preço velho (> 5s em relação ao clock local sincronizado)
  - rejeita salto absurdo (> 10% de variação instantânea em relação à média recente)
       │
       ▼ (Tick Válido)
[Persistência PostgreSQL + Hash Encadeado SHA-256 + Outbox]
       │
       ▼
[Redis Stream + Pub/Sub]
       │
       ▼
[Candle Worker (Agregação OHLCV)]
       │
       ▼
[WebSocket Gateway → Front-end]
```

### 1.2 Provedores de Market Data Suportados
Conector multicamadas com tolerância a falhas e seleção sequencial inteligente:
1. **`biquote.io`**: Provedor primário aberto (grátis, sem exigência de API Key, cotações live).
2. **`RealMarketAPI`**: Provedor de contingência (free tier).
3. **`AllTick`**: Provedor de contingência (free tier).
4. **`FCS API`**: Provedor de contingência Forex/Commodities (free tier).
5. **Fallback Estocástico Ornstein-Uhlenbeck (Fase 1)**: Caso todos os provedores externos falhem ou demorem mais de 1.500ms, o Circuit Breaker abre (`OPEN`) e o motor estocástico Ornstein-Uhlenbeck com CSPRNG assume instantaneamente, assegurando emissão ininterrupta de 1 tick/s e zero paralisia do mercado demo.

### 1.3 Módulo `PriceNormalizer`
- **Normalização de Símbolo**: Mapeia variações de tickers externos para os pares oficiais da plataforma (`BTCUSD_OTC`, `ETHUSD_OTC`, `EURUSD_OTC`, `XAUUSD_OTC`).
- **Validação de Timestamp**: Garante que o timestamp retornado pelo provedor é válido, no padrão ISO 8601 UTC.
- **Detecção de Outlier**: Compara a cotação recebida com a janela móvel de preços recentes, filtrando cotações com anomalias estatísticas grosseiras.

### 1.4 Módulo `PriceGuard`
- **Rejeição de Preço Velho**: Rejeita qualquer cotação cujo timestamp tenha defasagem superior a 5 segundos (`age > 5000ms`).
- **Rejeição de Salto Absurdo**: Rejeita qualquer variação de preço superior a 10% (`abs(new_price - last_price) / last_price > 0.10`).
- Ao rejeitar um tick, aciona o gerador estocástico de transição suave para evitar buracos na série temporal de cotações.

---

## 2. Invariantes do Pipeline e Integridade Criptográfica

- **D-08**: Persistência transacional com Outbox no PostgreSQL antes de qualquer broadcast no Redis.
- **Hash Encadeado SHA-256**: Todo tick persistido carrega o hash SHA-256 matematicamente dependente do `prev_hash` do tick anterior (`V-01`, `V-02`).
- **CSPRNG**: Qualquer micropasso estocástico gerado no fallback utiliza aleatoriedade criptograficamente segura (`crypto.randomBytes` / Box-Muller). Proibido `Math.random()`.

---

## 3. Passo a Passo de Implementação Cirúrgica

1. **Passo 3.1**: Implementar `services/tick-engine/src/engine/price-normalizer.ts` (normalização de símbolo, checagem de timestamp e detecção de outlier).
2. **Passo 3.2**: Implementar `services/tick-engine/src/engine/price-guard.ts` (rejeição de preço velho >5s e salto absurdo >10%).
3. **Passo 3.3**: Implementar `services/tick-engine/src/engine/market-data-providers.ts` com adaptadores para `biquote.io`, `RealMarketAPI`, `AllTick` e `FCS API`.
4. **Passo 3.4**: Integrar em `services/tick-engine/src/engine/real-feed-adapter.ts` o fluxo completo:
   `Provedor` → `Normalizer` → `PriceGuard` → `CircuitBreaker` → `Postgres` → `Redis`.
5. **Passo 3.5**: Criar testes unitários e de integração exaustivos cobrindo o Price Normalizer e o Price Guard.

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-price-guard-normalizer.test.ts`)
- Normalização de símbolos de diferentes fontes para o padrão OTC.
- Rejeição de timestamp com mais de 5 segundos de atraso.
- Rejeição de salto abrupto de preço > 10%.
- Aceitação de variações normais de mercado (< 10%).

### 4.2 Testes de Caos
- Injeção de cotação com salto de 50%: o Price Guard deve barrar o tick e manter a série íntegra.
- Injeção de preço com 10 segundos no passado: o Price Guard deve rejeitar e acionar transição segura.
- Queda simulada de todos os provedores externos: o Circuit Breaker deve abrir (`OPEN`) e o fallback Ornstein-Uhlenbeck manter a emissão sem travar o Candle Worker.

### 4.3 Testes de Estresse
- Processamento de 10.000 cotações por segundo no pipeline com latência média do Normalizer + Guard < 0.2ms.

---

## 5. Critério de Homologação do Gate (`GATE-F2-ETAPA-3`)
A Subetapa 3 está HOMOLOGADA quando:
- O pipeline completo (Provedor → Normalizer → Guard → Redis) funciona.
- Rejeição de preços velhos e saltos absurdos é comprovada por testes automatizados.
- O fallback estocástico garante 100% de disponibilidade.
- `post-implementation-verifier` homologa o gate.
