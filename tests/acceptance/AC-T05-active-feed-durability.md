# T05 — Feed ativo durável (gate A)

Ambiente: somente PostgreSQL 16 e Redis 7 descartáveis no Docker local, portas
publicadas em `127.0.0.1`. O processo real `scripts/dev-live-feed.mjs` é iniciado
em porta efêmera. O feed já aberto em `127.0.0.1:3001` não é manipulado.

| Critério | Dado / Quando / Então | Oráculo |
|---|---|---|
| AC-ACTIVE-FEED-1 | Dada uma porta efêmera livre, quando o feed real recebe `DEV_FEED_PORT`, então responde `/health` nessa porta e encerra sem afetar 3001. | `active-feed-durability.oracle.test.mjs` |
| AC-ACTIVE-FEED-2 | Dados dois ticks, outbox e um candle confirmados para `VOL_50`, quando o feed inicia e reinicia, então sequência nunca cai abaixo da cabeça gravada, preço/hash da cabeça são preservados, um novo tick encadeia no hash anterior e o candle histórico mantém `open=777.25`, `close=777.50`, `volume=2`. | `active-feed-durability-restart.oracle.test.mjs` |
| AC-ACTIVE-FEED-3 | Dado cliente WebSocket inscrito em `VOL_50`, quando recebe um tick, então a consulta imediata no PostgreSQL encontra exatamente a mesma sequência, preço e hash e um evento de outbox correspondente. | `active-feed-durability-publish.oracle.test.mjs` |
| AC-ACTIVE-FEED-4 | Dada uma trigger real que recusa INSERT da outbox de `VOL_50`, quando o feed tenta gerar ticks por 2,5 s, então a sequence de prova confirma que a falha ocorreu, estado/ticks/outbox do símbolo não mudam e o cliente recebe zero ticks oficiais. | `active-feed-durability-publish.oracle.test.mjs` |
| AC-ACTIVE-FEED-5 | Dadas duas instâncias com PIDs e portas distintos sobre os mesmos PostgreSQL e Redis efêmeros, quando operam por 4 s, então há pelo menos dois ticks persistidos, sequência sem lacuna, um outbox por tick, cadeia de hash contínua, um tick por segundo, fencing epoch positivo e nenhum WS transmite tick ausente do PostgreSQL. | `active-feed-durability-concurrency.oracle.test.mjs` |

Regras: M-02, M-03, M-04, M-05, R-01; decisões D-04, D-05, D-08, D-09,
D-13; qualidade Q-02, Q-05. Cada falha do produto deixa o teste vermelho.

Nível: integração com processos reais e dependências descartáveis.
