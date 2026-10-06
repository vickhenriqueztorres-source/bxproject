# API guide — 06-testing-quality

Referência carregada sob demanda. Valores e ferramentas marcados **PROPOSTO** não constam em `01-project-context` e devem ser confirmados pelo `tech-lead-orchestrator`.

## Ferramentas

| Nível | Ferramenta | Status |
|-------|------------|--------|
| Unit (TS) | Vitest | PROPOSTO |
| Property-based | fast-check | PROPOSTO |
| Integração | Testcontainers (PostgreSQL/TimescaleDB, Redis, Keycloak, Blnk) com as **mesmas tags de imagem** do Compose | PROPOSTO |
| Injeção de falha de rede | Toxiproxy | PROPOSTO |
| Matar processo/container | `docker kill` / `docker compose kill` no ambiente efêmero | PROPOSTO |
| Carga | k6 (HTTP + WebSocket) | PROPOSTO |
| E2E front-end | Playwright | PROPOSTO |

## Estrutura de pastas

```text
services/<serviço>/
  src/
  test/unit/          *.test.ts         — sem rede, sem banco
  test/integration/   *.int.test.ts     — containers reais
tests/
  chaos/              C-0x-*.test.ts    — ambiente efêmero / staging
  load/               *.k6.js           — staging
  acceptance/         AC-<issue>.md     — critérios Dado/Quando/Então
```

## Matriz regra → nível

| Regra | Unit | Integração | Chaos | Carga |
|-------|------|------------|-------|-------|
| `I-01` Ledger append-only | — | `UPDATE`/`DELETE` em transação negado pela role | — | — |
| `I-02` Double-entry | Property: soma das pernas = 0 | Soma de todos os balances = 0 após o fluxo | Pós-condição | Pós-condição |
| `I-03` Idempotência | Chave derivada é estável | Mesma chave 2× e 20× em paralelo → 1 efeito | `C-02`, `C-04`, `C-08` | Chaves únicas por request |
| `I-04` ACID | Transições válidas/ inválidas | Settlement concorrente do mesmo contrato → 1 liquidação | `C-08` | — |
| `I-05` Reconciliação | Classificação de divergência | Reconciliador detecta divergência plantada | Pós-condição | Pós-condição |
| `I-06` Reversão | Reversão espelha a original | Correção cria transação reversa, original intacta | — | — |
| `M-01` CSPRNG | Gerador com fonte injetada; teste de montagem usa `crypto` | — | — | — |
| `M-02` Tick sequence | Próximo `sequence` = anterior + 1 | `UNIQUE (symbol, sequence)` rejeita duplicata | `C-01` | Tick a 1/s sob carga |
| `M-03` Persistir antes de publicar | — | Commit falha → nada no Stream | `C-06` | — |
| `M-04` Hash encadeado | Vetor conhecido → hash conhecido; adulteração detectada | Cadeia verificada no banco | Pós-condição | — |
| `M-05` Candle OHLCV | Property: `low ≤ open,close ≤ high`; reprocessar = mesmo candle | Candle a partir de ticks gravados | `C-05` | — |
| `M-06` WebSocket feed | — | Catch-up por `lastSequence`; reload quando fora da retenção | `C-05` | Conexões simultâneas |
| `S-02` JWT | — | `alg: none`, `HS256`, `iss`/`aud` errados, expirado → `401` | `C-07` | — |
| `S-03` RBAC | Tabela de permissões | USER em rota admin → `403`; AUDITOR escrevendo → `403` | — | — |
| `S-04` BOLA / IDOR | — | Usuário B → contrato de A → `404` | — | — |
| `S-05` Mass assignment | Schema `.strict()` rejeita campo extra | Body com `user_id`/`entry_price` → `400` | — | — |
| `R-01` Outbox | — | Relay publica 1×; republicação idempotente | `C-05` | Lag do outbox |
| `R-02` Retry + backoff | `backoffDelay` dentro do intervalo; 4xx não repete | — | `C-04` | — |
| `R-03` Timeout | — | Dependência lenta → erro dentro do prazo | `C-04` | — |
| `R-04` Circuit breaker | Transições do breaker | — | `C-03` | — |
| `R-05` DLQ | Classificação `non_retryable`/`poison` | Mensagem envenenada → DLQ com campos completos | `C-03` | — |
| `R-06` Consumer groups | — | `XACK` só após commit | `C-02`, `C-08` | — |

## Catálogo de chaos

| ID | Injeção | Esperado | Regras |
|----|---------|----------|--------|
| `C-01` | `kill -9` no líder do Tick Engine | Novo líder em ≤ TTL do lease (3 s); `sequence` contínua; nenhum tick duplicado | `M-02`, `D-09` |
| `C-02` | Matar Wallet Adapter após a chamada ao Blnk e antes do `XACK` | `XAUTOCLAIM` reentrega; Blnk responde "reference já existe"; 1 transação | `I-03`, `R-06` |
| `C-03` | Blnk indisponível por 3 min | Breaker abre; DLQ não cresce; contratos ficam `CREATED`/`EXPIRING`; após volta, tudo liquida | `R-04`, `R-05`, `I-05` |
| `C-04` | Latência de 5 s no Blnk (acima do timeout) | Timeouts registrados; retry com a mesma `reference`; nenhuma duplicata | `R-02`, `R-03`, `I-03` |
| `C-05` | Reiniciar o Redis | Clientes WS reconectam e fazem catch-up; outbox republica; candles corretos | `M-05`, `M-06`, `R-01` |
| `C-06` | Reiniciar o PostgreSQL | API responde `503` rápido; nenhum contrato parcial; Tick Engine não publica tick não persistido | `M-03`, `I-04` |
| `C-07` | Keycloak indisponível | Tokens válidos continuam aceitos (JWKS em cache); login novo falha sem `500` | `S-02` |
| `C-08` | Matar Settlement Worker no meio do lote | Cada contrato liquidado exatamente 1× | `I-03`, `I-04`, `R-06` |
| `C-09` | Inserir tick com `sequence` repetida, com salto (`+2`) e com `prev_hash` errado, usando a role do Tick Engine | Postgres recusa os três; nada no outbox nem no Stream; `sequence` contínua | `M-02`, `M-03`, `M-04` |
| `C-10` | Reentregar a mesma mensagem N× (`XADD` duplicado) nos streams de settlement, wallet e candle | 1 transação no Blnk por `reference`; candle idêntico ao recalculado dos ticks; contrato liquidado 1× | `I-03`, `R-06`, `M-05` |
| `C-11` | WebSocket: cliente para de responder `pong`; abre 6 conexões; envia 200 mensagens em 1 s; 1.000 ciclos de conectar/desconectar | Fecha em ≤ 45 s; 6ª recusada; excesso limitado sem derrubar o processo; listeners e memória voltam à linha de base | `M-06`, `S-02`, B-16 |
| `C-12` | Pausar o Settlement Worker por mais de 10 s e o relay do outbox por 30 s | Reconciliador acusa contrato `OPEN` vencido e Stream atrás do Postgres; alerta dispara; zera após retomar | `I-05`, `O-04` |

Pós-condições comuns: `SKILL.md`, regra `Q-03`.

## SLOs de carga

| Métrica | Threshold | Status |
|---------|-----------|--------|
| `POST /contracts` p95 / p99 | < 300 ms / < 800 ms | PROPOSTO |
| `GET /candles` p95 | < 200 ms | PROPOSTO |
| Taxa de erro (`5xx` + timeouts) | < 0,1% | PROPOSTO |
| Atraso tick → cliente WS p95 | < 500 ms | PROPOSTO |
| Taxa de ticks | 1/s por índice, sem lacuna (`D-13`) | Decidido |
| Liquidação após `expires_at` | ≤ 10 s (limite do reconciliador, `I-05`) | Decidido |
| Divergência de saldo ao final | 0 | Decidido |
| Usuários simultâneos alvo | `<não definido no contexto>` | — |

```js
// trecho de thresholds k6
export const options = {
  thresholds: {
    'http_req_duration{name:POST /contracts}': ['p(95)<300', 'p(99)<800'],
    http_req_failed: ['rate<0.001'],
    checks: ['rate>0.999'],
  },
}
```

## Template de critério

```text
AC-<issue>-<n> — <título curto>
Dado    <estado inicial mensurável>
Quando  <ação ou falha injetada>
Então   <resultado observável com número/estado exato>
E       <invariante preservada>
Regras: <I-xx, M-xx, S-xx, R-xx>
Nível:  unit | integration | chaos | load | e2e
Teste:  <arquivo>::<"[AC-<issue>-<n>] título">
```

## Definition of Done

- Todos os `AC` com teste automatizado verde no CI.
- Nenhum teste novo marcado `.only`, `.skip` sem issue ou `retry`.
- Regras tocadas presentes na matriz com teste no nível indicado.
- Pendências `<não definido no contexto>` registradas como `it.todo` e na issue.
