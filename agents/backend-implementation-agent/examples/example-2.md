# Exemplo 2 — T05 Tick Engine corrigindo o pseudocódigo do PRD

O PRD explica o algoritmo com um pseudocódigo didático. Ele está certo na **fórmula** e errado
na **operação**. Este exemplo mostra como o agente transforma a explicação em serviço de produção.

## 1. Handoff recebido

```yaml
task_id: T05
agent: backend-implementation-agent
objective: Implementar o Tick Engine do SYNTH_VOL_50 com a fórmula do PRD §8.2.
context:
  - ORCHESTRATOR.md §9.1
  - PRD §8 (fórmula, parâmetros, evento) e anexo "como funciona o algoritmo"
skills: [01-project-context, 03-synthetic-market-engine, 05-resilience-patterns]
acceptance_criteria:
  - 1 tick por segundo gerado com CSPRNG.
  - Tick persistido com hash encadeado antes de qualquer publicação.
  - Um único líder por índice; tick duplicado impossível no banco.
  - Reinício retoma do último tick persistido.
budget: { max_steps: 40, max_tokens: 200000, timeout: 30m }
```

## 2. O que o pseudocódigo do PRD faz e por que não pode ir para produção

```ts
// Como está no anexo (resumido)
let price = config.initialPrice
setInterval(() => {
  price = nextTick(price, config, secureRng)
  publishTick({ indexId: 'SYNTH_VOL_50', price, timestamp: Date.now() })
}, 1000)
```

| Problema | Consequência | Regra violada | Correção |
|----------|--------------|---------------|----------|
| `price` só em memória | Reinício volta ao preço inicial; gráfico "pula" | M-02, 9.1 recuperação | Ler `index_state` do Postgres ao iniciar |
| Publica sem persistir | Tick visto no gráfico pode não existir no banco; settlement diverge do que o usuário viu | D-08, B-07 | Tick + outbox na mesma transação; só o relay publica |
| `setInterval` | Deriva de relógio e sobreposição se o banco ficar lento | D-13 | Laço `await` alinhado ao segundo cheio |
| Sem líder | Duas réplicas geram dois preços para o mesmo segundo | D-09 | Lease no Redis + fencing token em `index_state.lease_epoch` |
| Sem `sequence` nem hash | Impossível detectar lacuna ou adulteração | M-04 | `sequence` + SHA-256 encadeado (serialização da skill 03) |
| `rng` genérico | Se implementado com `Math.random`, o próximo tick é previsível | D-07, B-06 | `crypto.randomBytes` |
| `price` como número no evento | Perda de precisão e hash não reproduzível | skill 03 | String com 6 casas (`NUMERIC(18,6)`) |
| Caracteres soltos (`number;9`, `initialPrice;9`) | Erro de compilação | — | Removidos |

## 3. Código

```ts
// services/tick-engine/src/random.ts
import { randomBytes } from 'node:crypto'

const TWO_POW_48 = 2 ** 48

/** Uniforme no intervalo aberto (0, 1) a partir de 48 bits do CSPRNG. */
export function uniform(): number {
  return (randomBytes(6).readUIntBE(0, 6) + 0.5) / TWO_POW_48
}

/** Normal padrão via Box-Muller. */
export function standardNormal(): number {
  return Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform())
}
```

```ts
// services/tick-engine/src/formula.ts
import { standardNormal, uniform } from './random'

export interface IndexParams {
  driftPerTick: number      // μ = 0
  volatilityPerTick: number // σ = 0.0008
  jumpProbability: number   // 0.002
  jumpSize: number          // 0.03
  floor: number             // 1
}

export function nextPrice(current: number, p: IndexParams): number {
  const normalMove = p.driftPerTick + p.volatilityPerTick * standardNormal()
  const jumpMove = uniform() < p.jumpProbability ? (uniform() < 0.5 ? -1 : 1) * p.jumpSize : 0
  return Math.max(current * (1 + normalMove + jumpMove), p.floor)
}
```

```ts
// services/tick-engine/src/engine.ts
import { createHash } from 'node:crypto'
import { nextPrice, type IndexParams } from './formula'
import type { EngineDeps } from './types'

const SYMBOL = 'SYNTH_VOL_50'
const TICK_MS = 1_000

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export async function runTickEngine(deps: EngineDeps, params: IndexParams): Promise<void> {
  const epoch = await deps.lease.acquire(SYMBOL) // SET lease NX PX 3000 + INCR epoch
  let state = await deps.db.one(
    'SELECT last_sequence, last_price, last_hash, last_ts FROM index_state WHERE symbol = $1',
    [SYMBOL],
  )

  while (!deps.signal.aborted) {
    const nextSecond = Math.ceil(Date.now() / TICK_MS) * TICK_MS
    const ts = new Date(Math.max(state.last_ts.getTime() + TICK_MS, nextSecond))
    await deps.sleepUntil(ts)

    if (!(await deps.lease.renew(SYMBOL, epoch))) {
      deps.metrics.isLeader.set(0)
      return // outro processo assumiu; sair sem escrever
    }

    const sequence = BigInt(state.last_sequence) + 1n
    const price = nextPrice(Number(state.last_price), params).toFixed(6)
    const hash = sha256(`${state.last_hash}|${SYMBOL}|${sequence}|${ts.toISOString()}|${price}`)

    await deps.db.transaction(async (tx) => {
      const fenced = await tx.result(
        `UPDATE index_state
            SET last_sequence = $2, last_price = $3, last_hash = $4, last_ts = $5, lease_epoch = $6
          WHERE symbol = $1 AND last_sequence = $7 AND lease_epoch <= $6`,
        [SYMBOL, sequence, price, hash, ts, epoch, state.last_sequence],
      )
      if (fenced.rowCount !== 1) throw new Error('FENCED_OUT') // líder antigo não escreve

      await tx.query(
        `INSERT INTO ticks (symbol, sequence, ts, price, prev_hash, hash)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [SYMBOL, sequence, ts, price, state.last_hash, hash],
      )
      await tx.query(
        `INSERT INTO outbox (topic, aggregate_id, sequence, payload)
         VALUES ('tick', $1, $2, $3)`,
        [SYMBOL, sequence, JSON.stringify({
          symbol: SYMBOL, sequence: sequence.toString(), ts: ts.toISOString(),
          price, prevHash: state.last_hash, hash,
        })],
      )
    })

    state = { last_sequence: sequence, last_price: price, last_hash: hash, last_ts: ts }
    deps.metrics.ticksTotal.inc()
    deps.metrics.lastTickAge.set(0)
  }
}
```

O relay de outbox (T06) é quem faz `XADD ticks:SYNTH_VOL_50 {sequence}-0` e depois `PUBLISH ticks:SYNTH_VOL_50:live`.

## 4. Testes unitários

```ts
// services/tick-engine/src/formula.unit.test.ts
it('nunca fica abaixo do piso', () => {
  for (let i = 0; i < 10_000; i++) expect(nextPrice(1.0001, PARAMS)).toBeGreaterThanOrEqual(1)
})

it('desvio dos retornos fica próximo de σ sem saltos', () => {
  const returns = Array.from({ length: 50_000 }, () => nextPrice(1000, { ...PARAMS, jumpProbability: 0 }) / 1000 - 1)
  expect(stdDev(returns)).toBeCloseTo(0.0008, 4)
})

it('frequência de saltos fica próxima de 0,2%', () => {
  const jumps = Array.from({ length: 200_000 }, () => Math.abs(nextPrice(1000, PARAMS) / 1000 - 1) > 0.02)
  expect(jumps.filter(Boolean).length / jumps.length).toBeCloseTo(0.002, 3)
})
```

## 5. Saída

```yaml
task_id: T05
agent: backend-implementation-agent
status: BLOCKED
summary: >
  Tick Engine implementado com a fórmula do PRD §8.2 (σ=0.0008, saltos de ±3% com 0,2%),
  CSPRNG via crypto.randomBytes + Box-Muller, laço alinhado ao segundo, lease + fencing,
  tick + outbox na mesma transação e hash encadeado da skill 03. O seed de index_state exige
  o preço inicial, que não está definido; a migration usa um placeholder que falha no deploy
  até a decisão.
artifacts:
  - services/tick-engine/src/random.ts
  - services/tick-engine/src/formula.ts
  - services/tick-engine/src/engine.ts
  - services/tick-engine/src/formula.unit.test.ts
  - db/migrations/0003_index_state_seed.up.sql
evidence:
  - pnpm vitest run services/tick-engine → 7 passed
  - agent health-check → APROVADO; skill 03 health-check → APROVADO
acceptance_criteria_met:
  - criterion: 1 tick por segundo gerado com CSPRNG
    met: true
    evidence: random.ts + laço alinhado em engine.ts
  - criterion: Tick persistido com hash encadeado antes de qualquer publicação
    met: true
    evidence: engine.ts não publica; outbox na mesma transação
  - criterion: Um único líder por índice; tick duplicado impossível
    met: true
    evidence: lease + fencing; PRIMARY KEY (symbol, sequence)
  - criterion: Reinício retoma do último tick persistido
    met: false
    evidence: lógica pronta, mas o seed inicial de index_state depende do preço inicial
confidence_score: 0.5
decisions_cited: [D-07, D-08, D-09, D-13, M-01, M-02, M-03, M-04, B-06, B-07]
pending:
  - Preço inicial do SYNTH_VOL_50 <não definido no contexto> (exemplos do PRD usam 1000)
```
