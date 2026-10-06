# Subetapa 3: Agregador de Velas & API REST Multi-Símbolos (Candle Worker & Chart API)

**Orquestrador:** `tech-lead-orchestrator`  
**Implementação:** `backend-implementation-agent`  
**QA & Resiliência:** `qa-resilience-agent`  
**Verificador Independente:** `post-implementation-verifier` (Skill 10: V-05, V-06, V-13)  
**Status:** HOMOLOGADO E APROVADO (GATE 3 PASS)

---

## 1. Objetivo da Subetapa
Habilitar a esteira de agregação de velas (OHLCV) e a API de gráficos (`GET /candles`) para operar transparentemente com os 36 ativos cadastrados:
- **Agregador Zero RAM (`M-05`)**: Consome ticks do Redis Stream via Consumer Groups (`cg:candles`) e executa UPSERT idempotente na tabela `candles` do PostgreSQL por `(symbol, interval, bucket_start)`.
- **Chart API Multi-Ativos**: `GET /candles?symbol=:symbol&interval=:interval&from=:from&to=:to` validando se o símbolo existe e está ativo na tabela `indices`.
- **Consistência Matemática**: Garantir `low <= open, close <= high` para todos os 36 símbolos sem aberrações de ponto flutuante.

---

## 2. Os 6 Passos de Execução da Subetapa 3

1. **Passo 1 (Particionamento Temporal UTC Padronizado)**:
   Implementar a função de discretização de tempo `bucketStart(ts, interval)` alinhada ao segundo zero do minuto UTC (`date_bin` equivalente), garantindo sincronia perfeita com o TradingView.
2. **Passo 2 (Módulo de Agregação OHLCV Pura `core.mjs`)**:
   Implementar função pura `deriveCandle(ticks, symbol, interval, bucketStart, precision)` que extrai `open`, `high`, `low`, `close` e `volume` mantendo a precisão exata do ativo como string textual imutável.
3. **Passo 3 (UPSERT Idempotente no PostgreSQL)**:
   Construir a consulta SQL com `ON CONFLICT (symbol, interval, bucket_start) DO UPDATE` para garantir que o reprocessamento de ticks ou reentregas de mensagens do Redis Stream não dupliquem o volume ou corrompam os extremos da vela.
4. **Passo 4 (Filtro e Validação Segura na Chart API)**:
   Implementar validação estrita de parâmetros na rota `GET /candles`: sanitizar `symbol` contra lista autoritativa de ativos, validar `interval` permitido (`1s`, `5s`, `1m`, `5m`) e limitar a janela máxima para prevenir DoS/exaustão de memória.
5. **Passo 5 (Proteção contra Injeção de Queries)**:
   Rejeitar caracteres de SQL injection, strings nulas ou consultas com símbolos desconhecidos com HTTP `400 Bad Request`.
6. **Passo 6 (Suíte de Testes Automatizada do Gate 3)**:
   Executar `tests/test-multi-03-candles-api.mjs`, validando particionamento UTC, agregação dos 36 ativos, query validator e proteção de injeção.

---

## 3. Testes de Estresse, Segurança e Caos

- **Estresse (Reentrega Idempotente e Concorrência)**:
  - Injetar 5.000 ticks reentregues em loop no agregador para o mesmo bucket. O volume final e os valores OHLCV gravados no banco devem ser matematicamente idênticos aos da primeira entrega.
- **Segurança (Isolamento BOLA/IDOR de Ativos)**:
  - Disparar requisições concorrentes `GET /candles?symbol=EURUSD_OTC` e `GET /candles?symbol=BTCUSD_OTC`. Provar que nenhuma vela de EURUSD vaza na resposta de BTCUSD e vice-versa.
  - Testar injeção de caracteres especiais no parâmetro `symbol`: rejeição imediata com HTTP 400.
- **Caos (Recuperação de Crash do Worker)**:
  - Matar o `candle-worker` durante a agregação de uma vela ativa e reiniciá-lo. O worker deve ler o Stream a partir de `lastSequence` (`XAUTOCLAIM`) e reconstruir a vela sem lacunas ou duplicatas.

---

## 4. Garantias Pós-Implementação (Skill 10)

- **`V-05`**: Outbox publicado em $\le 5$ s e Stream Redis sincronizado com PostgreSQL.
- **`V-06`**: Candles fechados gravados no PostgreSQL rigorosamente iguais ao recálculo canônico a partir dos ticks (`0 linhas divergentes`).
- **`V-13`**: Integridade da suíte; testes originais preservados sem enfraquecimento.

---

## 5. Critérios de Passagem do Quality Gate 3
- Executar `node tests/test-multi-03-candles-api.mjs` $\to$ Exit Code 0 (4/4 asserções aprovadas).
- Homologação do `post-implementation-verifier` confirmando `V-05`, `V-06` e `V-13` em **`PASS`**.
