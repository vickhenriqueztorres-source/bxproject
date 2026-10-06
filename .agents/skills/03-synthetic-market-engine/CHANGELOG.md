# Changelog — 03-synthetic-market-engine

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Versionamento semântico: MAJOR (invariante, schema ou protocolo alterado), MINOR (invariante, métrica ou mensagem nova), PATCH (texto/correção).

## [1.0.0] — 2026-03-10

### Adicionado

- Frontmatter com triggers de tick, CSPRNG, sequence, hash, candle e WebSocket.
- Seção **Mentalidade** aplicada ao preço.
- Invariantes `M-01` a `M-06`: CSPRNG, tick sequence, persistir antes de publicar, hash encadeado, candle OHLCV, WebSocket feed.
- Modelo de preço de referência (passo multiplicativo com `z ~ N(0,1)` via CSPRNG).
- Regra de candle derivado de ticks persistidos, com `volume` = quantidade de ticks.
- Modos implementação e revisão com formato de saída por invariante.
- Edge cases (perda de lease, engine parado, relógio voltando, quebra de cadeia).
- `references/api-guide.md` com schema, chaves Redis, protocolo WebSocket e métricas.
- `examples/`, `tests/`, `scripts/validate.sh`, `scripts/health-check.sh`.

### Pendente

- Preço inicial `p_0`, volatilidade `σ` e precisão do preço.
- Intervalos de candle suportados além de `1m`.
- Retenção do Redis Stream de ticks (`MAXLEN`).
- Nome oficial do símbolo do índice (exemplos usam `SYNTH_1`, ilustrativo).
