# SUBETAPA 4: CONECTOR & ADAPTER DE FEED REAL PARA OTC DEMO

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agentes Executores:** `backend-implementation-agent`, `broker-architect-agent`  
**Agentes Revisores e Auditores:** `qa-resilience-agent`, `chart-trading-engineer`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-04`

---

## 1. Objetivo e Escopo

Implementar o módulo adaptador de **Feed de Mercado Real para Ativos OTC Demo** em `services/tick-engine`, cobrindo os 4 ativos solicitados na Fase 2:
1. `BTC/USD (OTC)` (`BTCUSD_OTC`)
2. `ETH/USD (OTC)` (`ETHUSD_OTC`)
3. `EUR/USD (OTC)` (`EURUSD_OTC`)
4. `XAU/USD (OTC)` (`XAUUSD_OTC`)

O adapter deve:
- Conectar-se a fontes de mercado real (provedores WebSocket/REST públicos e estáveis como Binance/Coinbase para criptoativos e endpoints de referência Forex/Commodities para EUR/USD e Ouro XAU/USD).
- Normalizar as cotações recebidas para a precisão decimal exata de cada par (5 decimais para `EURUSD_OTC`, 2 decimais para `BTCUSD_OTC`, `ETHUSD_OTC`, `XAUUSD_OTC`).
- Injetar o preço real no pipeline transacional oficial do Tick Engine:
  - Persistência imediata na tabela `ticks` do PostgreSQL.
  - Cálculo do hash criptográfico encadeado SHA-256 (`hash = SHA256(symbol + sequence + price + ts + prev_hash)`).
  - Incremento rigoroso e monotônico de `sequence`.
  - Gravação no Outbox Relay na mesma transação (`D-08`).
  - Fan-out via Redis Streams e WebSocket Gateway.

---

## 2. Invariantes e Padrão de Resiliência (Circuit Breaker & Fallback)

- **D-08 (Persistência antes da Publicação)**: O tick derivado do mercado real NÃO pode ser enviado ao WebSocket antes de ser commitado no PostgreSQL com seu respectivo hash encadeado.
- **D-09 (Líder Único)**: Apenas a instância com o lease do Redis no respectivo símbolo é autorizada a colher o feed e gravar ticks.
- **Resiliência Crítica (Skill 05 — Circuit Breaker com Fallback Estocástico)**: Se o feed real falhar, ficar mudo por mais de 1,5 segundos ou sofrer rate limit:
  1. O Circuit Breaker abre instantaneamente (`OPEN`).
  2. O Tick Engine entra em modo de fallback estocástico Ornstein-Uhlenbeck (Fase 1), mantendo a última cotação real como âncora e simulando micropassos realistas com CSPRNG.
  3. O mercado NUNCA congela para o usuário demo.
  4. Quando o feed externo se restabiliza por 5 amostras consecutivas, o Circuit Breaker fecha (`CLOSED`) e o feed real assume suavemente sem salto desproporcional.

---

## 3. Especificação Técnica dos Ativos

| Ativo | Símbolo no Sistema | Precisão Decimal | Fonte Primária | Modo Fallback Estocástico |
| :---: | :---: | :---: | :---: | :---: |
| Bitcoin / USD (OTC) | `BTCUSD_OTC` | 2 casas (ex: `64230.50`) | Public WebSocket Cripto | Ornstein-Uhlenbeck ($\sigma = 0.00035$) |
| Ethereum / USD (OTC) | `ETHUSD_OTC` | 2 casas (ex: `3450.80`) | Public WebSocket Cripto | Ornstein-Uhlenbeck ($\sigma = 0.00045$) |
| EUR / USD (OTC) | `EURUSD_OTC` | 5 casas (ex: `1.08540`) | Public Forex Feed | Ornstein-Uhlenbeck ($\sigma = 0.00015$) |
| Ouro / USD (OTC) | `XAUUSD_OTC` | 2 casas (ex: `2680.40`) | Public Metals Feed | Ornstein-Uhlenbeck ($\sigma = 0.00020$) |

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-real-feed-adapter.test.ts`)
- Parsing de payloads de mercado real e sanitização de precisão decimal.
- Validação do cálculo de hash SHA-256 encadeado com a cotação real.
- Máquina de estados do Circuit Breaker (`CLOSED`, `OPEN`, `HALF_OPEN`).

### 4.2 Testes de Integração (`tests/integration/test-real-feed-pipeline.test.ts`)
- Ingestão ponta a ponta: conector real -> banco PostgreSQL -> Outbox -> Redis Stream -> Candle Worker agregando candles OHLCV do par.
- Validação de que a cadeia de hashes SHA-256 permanece matematicamente inquebrada (`V-01`, `V-02`).

### 4.3 Testes de Caos
- Corte súbito da conexão de internet / mock de erro 503 na API de mercado real.
- Verificação de acionamento do fallback sem falha de emissão no segundo seguinte (latência inter-tick mantida em 1000ms ± 50ms).
- Restabelecimento do feed externo e convergência limpa de preços.

### 4.4 Testes de Estresse
- Execução de 2.000 ticks contínuos dos 4 ativos OTC reais sob carga concorrente, confirmando ausência de leak de sockets e consumo de memória estável (< 150MB no Node.js).

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-04`)
A Subetapa 4 é considerada HOMOLOGADA exclusivamente se:
1. Os 4 ativos OTC operam recebendo dados de mercado com cotações vivas e precisão decimal correta.
2. A cadeia de hashes SHA-256 no PostgreSQL é 100% íntegra.
3. O fallback estocástico assume sem interrupção caso haja falha externa.
4. Todos os testes são aprovados pelo `post-implementation-verifier`.
