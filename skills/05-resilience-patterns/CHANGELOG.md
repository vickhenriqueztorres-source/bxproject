# Changelog — 05-resilience-patterns

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (padrão, stream ou contrato de DLQ alterado), MINOR (padrão, parâmetro ou métrica nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de outbox, retry, backoff, timeout, circuit breaker, DLQ, consumer group e XACK.
- Seção **Mentalidade** aplicada à falha.
- Padrões `R-01` a `R-06`: outbox, retry + backoff, timeout, circuit breaker, DLQ, consumer groups.
- Regra de um relay por símbolo para eventos com ordem obrigatória (ticks).
- Tabela de comportamento com breaker aberto por fluxo.
- Modos implementação e revisão com formato de saída por padrão e cenário de falha.
- `references/api-guide.md` com parâmetros propostos, erros repetíveis, streams, DLQ e métricas.
- `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- Confirmar os valores propostos de timeout, tentativas, backoff e breaker com métricas reais.
- Comportamento de `POST /contracts` e `GET /wallet` com breaker do Blnk aberto.
- Retenção dos streams de trabalho e do outbox publicado.
