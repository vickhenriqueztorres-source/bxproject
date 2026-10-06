# Example 1 — Orquestrador montando plano a partir de uma issue

## Entrada

```text
Agente: tech-lead-orchestrator
Issue #3: "Implementar o fluxo de tick do índice sintético até o gráfico."
```

## Raciocínio esperado

1. Trigger: início de issue recebida pelo orquestrador.
2. Classificação: **dentro do escopo** ("Um índice sintético", "Tick engine com CSPRNG", "Histórico e gráfico").
3. Componentes envolvidos, conforme a Arquitetura: Tick Engine, Outbox Relay, Candle Worker, Chart API, WebSocket Gateway, front-end.
4. Decisões que restringem a implementação: `D-04`, `D-05`, `D-07`, `D-08`, `D-09`, `D-13`, `D-03`.

## Saída

```text
CLASSIFICAÇÃO: DENTRO DO ESCOPO
COMPONENTE: Tick Engine, Outbox Relay, Candle Worker, Chart API,
            WebSocket Gateway, front-end
FERRAMENTA: Próprio (tick/candle/gateway), Redis, PostgreSQL,
            Lightweight Charts (tradingview/lightweight-charts)
DECISÕES RELACIONADAS: D-03, D-04, D-05, D-07, D-08, D-09, D-13
RESPOSTA:
  Fluxo previsto pela arquitetura:
  1. Tick Engine adquire lease de líder no Redis (D-09).
  2. Lê último tick persistido, gera próximo preço com CSPRNG (D-07), 1 tick/s (D-13).
  3. Persiste tick + outbox na mesma transação do PostgreSQL (D-05, D-08).
  4. Outbox Relay publica no Redis Stream (confiável) e no Pub/Sub (visual) (D-04).
  5. Candle Worker consome o Stream e agrega OHLCV.
  6. Chart API serve GET /candles; WebSocket Gateway envia updates ao vivo.
  7. Front-end renderiza com Lightweight Charts (D-03) e faz catch-up por lastSequence.
  Agentes: backend-implementation-agent (1–6), frontend-realtime-agent (7),
           qa-resilience-agent (testes), financial-correctness-reviewer e
           security-reviewer (revisão).
PENDÊNCIAS: nenhuma
```
