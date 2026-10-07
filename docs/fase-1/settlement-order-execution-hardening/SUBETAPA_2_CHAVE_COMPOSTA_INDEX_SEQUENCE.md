# Subetapa 2 — Chave Composta Única (symbol, sequence) e Isolamento Estrito de Ticks

## 1. Objetivo
Garantir que cada tick gerado ou persistido no sistema seja identificado de forma unívoca pelo par ordenado `(symbol, sequence)`, prevenindo colisões ou confusões entre ativos concorrentes.

## 2. Implementação
1. **Modelagem de Chave Composta no Banco de Dados:**
   - A tabela `ticks` possui constraint `UNIQUE (symbol, sequence)` e índice ordenado `(symbol, event_time ASC, sequence ASC)`.
2. **Identificação Rigorosa no Tick Engine:**
   - Cada tick emitido carrega `symbol`, `sequence`, `price`, `event_time`, `arrival_time` e `hash` encadeado.
3. **Isolamento de Streams:**
   - Redis Streams e Pub/Sub canais particionados por ativo (`ticks:{symbol}`) para evitar contaminação cruzada.

## 3. Critérios de Aceite e Testes
- Ticks de símbolos distintos com mesmo valor de sequência (ex: `BTCUSD sequence=10` e `ETHUSD sequence=10`) jamais colidem.
- O índice composto garante recuperação do tick em menos de 1 milissegundo no PostgreSQL.
