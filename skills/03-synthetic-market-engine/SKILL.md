---
name: 03-synthetic-market-engine
description: >
  Trigger: "tick", "CSPRNG", "preço sintético", "sequence", "hash encadeado", "candle", "OHLCV", "WebSocket feed". Ativar antes de gerar, persistir, agregar ou transmitir preços do índice sintético.
version: 1.0.0
---

# 03-synthetic-market-engine

Motor de mercado sintético da **Plataforma de Índices Sintéticos — Fase 1**.
Cobre a vida de um preço: **gerado** (Tick Engine) → **persistido** (PostgreSQL + outbox) → **publicado** (Redis Stream + Pub/Sub) → **agregado** (Candle Worker) → **transmitido** (WebSocket Gateway).
Decisões herdadas de `01-project-context`: `D-04`, `D-05`, `D-07`, `D-08`, `D-09`, `D-13`.

## Mentalidade

| Regra | Pergunta mental aplicada ao preço |
|-------|-----------------------------------|
| O cliente sempre mente | O preço que liquida um contrato pode vir de qualquer lugar além do PostgreSQL? |
| Falhar é normal | Se o líder morrer no meio do tick, sobra tick publicado e não persistido? |
| Toda operação pode repetir | Se o relay publicar o mesmo tick 2 vezes, o candle muda 2 vezes? |
| Dinheiro é estado, não número solto | Consigo provar que nenhum tick foi alterado depois de gravado? |
| Se não é observável, não é confiável | Eu sei, em segundos, que o índice parou de gerar ticks? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "tick", "tick engine", "gerador de preço", "random walk", "volatilidade"
- "CSPRNG", "Math.random", "aleatoriedade", "seed"
- "sequence", "lastSequence", "gap de tick", "líder", "leader lease"
- "hash encadeado", "prev_hash", "integridade dos ticks", "auditoria de preço"
- "candle", "OHLCV", "vela", "agregação", "Chart API", `GET /candles`
- "WebSocket", "feed", "catch-up", "fan-out", "snapshot"

**Não ativar quando:**

- Settlement, payout ou saldo — usar `02-financial-invariants` (esta skill só fornece o tick de saída)
- Validação de JWT, roles ou Keycloak do WebSocket — usar `04-security-iam`
- Retry, DLQ, `XAUTOCLAIM` e circuit breaker genéricos — usar `05-resilience-patterns`
- Estilo visual do gráfico no front-end — fora desta skill

## Invariantes

### M-01 — CSPRNG

- **Definição:** toda aleatoriedade do preço vem de gerador criptográfico (`crypto.randomInt`, `crypto.getRandomValues`, `crypto.randomBytes`). Estado do gerador nunca é exposto.
- **Pergunta mental:** alguém que observa 1.000 ticks consegue prever o próximo?
- **Modelo de referência (proposto):** `p_n = p_{n-1} · exp(σ · z)`, com `z ~ N(0,1)` via Box-Muller sobre uniformes do CSPRNG.
- **Parâmetros:** `p_0`, `σ` e precisão do preço — `<não definido no contexto>`.
- **Violação típica:** `Math.random()`, seed fixa em produção, seed logada.

### M-02 — Tick sequence

- **Definição:** cada índice tem `sequence` monotônica, sem buracos e única (`UNIQUE (symbol, sequence)`). Apenas o líder (lease com TTL, `D-09`) gera ticks; 1 tick/s (`D-13`).
- **Pergunta mental:** se dois líderes existirem por 2 segundos, o banco aceita dois ticks com a mesma sequence?
- **Como verificar:** `sequence = last_sequence + 1` lido com `FOR UPDATE` em `index_state`; constraint única; lease renovado antes de cada tick.
- **Violação típica:** sequence derivada do relógio, contador em memória, ausência de constraint única.

### M-03 — Persistir antes de publicar

- **Definição:** tick, `index_state` e evento de outbox são gravados na mesma transação; só o relay publica, e só depois do `COMMIT` (`D-08`).
- **Pergunta mental:** existe algum tick que o usuário viu e que não está no PostgreSQL?
- **Como verificar:** nenhum `XADD`/`PUBLISH`/`ws.send` no Tick Engine antes do commit; ID do Stream = `{sequence}-0` (XADD repetido é rejeitado pelo Redis).
- **Violação típica:** `redis.publish(tick)` seguido de `db.insert(tick)`.

### M-04 — Hash encadeado

- **Definição:** `hash_n = SHA-256(hash_{n-1} | symbol | sequence | ts | price)`, com serialização canônica e `price` como string decimal. Gênese: `hash_0 = SHA-256("genesis|" + symbol)`.
- **Pergunta mental:** se alguém editar um preço antigo no banco, eu descubro?
- **Como verificar:** colunas `prev_hash` e `hash`; job de verificação recalcula a cadeia; divergência gera alerta crítico.
- **Violação típica:** hash sobre `JSON.stringify` (ordem de chaves instável) ou sobre `number` em ponto flutuante.

### M-05 — Candle OHLCV

- **Definição:** candle é derivado dos ticks persistidos, nunca de estado em memória. Bucket `[início, início + intervalo)` em UTC pelo `ts` do servidor.
  - `open` = preço do menor `sequence` do bucket; `close` = do maior; `high`/`low` = máximo/mínimo.
  - `volume` = quantidade de ticks no bucket (índice sintético não tem volume negociado).
- **Pergunta mental:** se o worker processar o mesmo tick 3 vezes, ou fora de ordem, o candle sai igual?
- **Como verificar:** upsert idempotente por `(symbol, interval, bucket_start)` recalculado a partir de `ticks`.
- **Intervalos suportados:** `<não definido no contexto>` (exemplos usam `1m`).
- **Violação típica:** `volume += 1` e `close = tick.price` em memória a cada mensagem.

### M-06 — WebSocket feed

- **Definição:** feed somente leitura. Autentica no handshake (`04-security-iam`), envia snapshot, faz catch-up por `lastSequence` via Stream e então ao vivo via Pub/Sub. Pub/Sub é só fan-out visual (`D-04`).
- **Pergunta mental:** um cliente que perdeu 20 segundos de rede recebe os 20 ticks na ordem, sem duplicar?
- **Como verificar:** toda mensagem tem `sequence`; gap detectado → catch-up; fora da retenção → `resync_required`; preço trafega como string; limites de `01-project-context` aplicados.
- **Violação típica:** feed só por Pub/Sub sem catch-up; gateway aceita mensagem do cliente que altera estado.

## Instruções

**Modo implementação** (`backend-implementation-agent` / `frontend-realtime-agent`):

1. Identificar quais etapas do fluxo a tarefa toca: geração, persistência, publicação, agregação ou feed.
2. Aplicar as invariantes da etapa (tabela em `references/api-guide.md`, seção "Etapa × invariante").
3. Usar o schema e os nomes de chave/canal de `references/api-guide.md`; não criar nomes novos.
4. Preço sempre `numeric` no banco e `string` no JSON; nunca `float`.
5. Toda métrica nova segue a lista de `references/api-guide.md`, seção "Métricas".

**Modo revisão** (`qa-resilience-agent` / `security-reviewer`, somente leitura):

1. Para cada invariante M-01 a M-06, marcar `PASS`, `FAIL` ou `N/A`.
2. Todo `FAIL` cita arquivo e linha.
3. Severidade: `CRÍTICO` (preço manipulável, previsível ou não persistido), `ALTO` (gap, duplicação, candle errado), `MÉDIO` (falta de detecção), `BAIXO` (melhoria).
4. Não sugerir código; descrever o problema e a invariante violada.

## Formato de saída

```text
SKILL: 03-synthetic-market-engine
MODO: IMPLEMENTAÇÃO | REVISÃO
ETAPAS: GERAÇÃO | PERSISTÊNCIA | PUBLICAÇÃO | AGREGAÇÃO | FEED
ESCOPO ANALISADO: <arquivos / componentes>

M-01 CSPRNG              : PASS | FAIL | N/A — <evidência>
M-02 Tick sequence       : PASS | FAIL | N/A — <evidência>
M-03 Persistir→publicar  : PASS | FAIL | N/A — <evidência>
M-04 Hash encadeado      : PASS | FAIL | N/A — <evidência>
M-05 Candle OHLCV        : PASS | FAIL | N/A — <evidência>
M-06 WebSocket feed      : PASS | FAIL | N/A — <evidência>

ACHADOS:
- [CRÍTICO|ALTO|MÉDIO|BAIXO] <arquivo:linha> — <problema> — viola <M-xx>

PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO
```

## Exemplos

Exemplo curto:

```text
Entrada: "revisar o gerador" — trecho:
  const delta = (Math.random() - 0.5) * 0.002

M-01 CSPRNG : FAIL — tick-engine/generator.ts:14 usa Math.random()
ACHADOS:
- [CRÍTICO] tick-engine/generator.ts:14 — PRNG não criptográfico torna o preço previsível — viola M-01
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Líder perde o lease no meio do tick:** a transação falha pela constraint única ou pelo `lease_epoch`; nenhum tick é publicado.
- **Engine parado por 5 s:** não inventar ticks retroativos; a sequence continua sem buraco, o `ts` mostra o intervalo. Alerta `tick_gap_seconds > 3`.
- **Tick de saída do contrato:** primeiro tick com `ts >= expires_at`; se ainda não existe, o settlement espera (ver `02-financial-invariants`).
- **Relay publica duas vezes:** `XADD` com ID `{sequence}-0` repetido retorna erro → tratar como já publicado.
- **Cliente com `lastSequence` fora da retenção do Stream:** responder `resync_required`; o cliente recarrega `GET /candles` e assina sem `lastSequence`.
- **Relógio do servidor volta no tempo:** `ts` nunca menor que o do tick anterior; usar `max(now, last_ts + 1ms)` e alertar.
- **Quebra da cadeia de hash:** congelar settlement do índice e escalar ao orquestrador; nunca "recalcular para consertar".

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de tick, candle e feed no `description` |
| Ativação espúria | Fronteiras com `02`, `04` e `05` em "Não ativar quando" |
| Execução parcial | Saída exige status para as 6 invariantes e etapas tocadas |
| Deriva de instrução | Schema, chaves e canais fixos em `references/api-guide.md` |
| Conflito de tools | Pub/Sub só visual; Stream é a fonte de trabalho (`D-04`) |
| Context overflow | Schema e protocolo em `references/`, código completo em `examples/` |
| Feedback loop negativo | Quebra de cadeia congela o índice em vez de "corrigir" |

## Recursos

- Schema, chaves Redis, protocolo WebSocket e métricas: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Varredura de invariantes no código: `scripts/health-check.sh`
