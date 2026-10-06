# Exemplo 2 — T13 boleta UP/DOWN, carteira e histórico

## 1. Handoff recebido

```yaml
task_id: T13
agent: frontend-realtime-agent
objective: Boleta UP/DOWN com valor, carteira demo no header e histórico de contratos paginado.
context:
  - agents/backend-implementation-agent/references/api-guide.md (DTO, erros, estados)
  - ORCHESTRATOR.md §9.2
skills: [01-project-context, 03-synthetic-market-engine, 04-security-iam]
acceptance_criteria:
  - Duplo clique em "Subir" abre um único contrato.
  - Saldo exibido é sempre o do servidor; atualiza após abrir e após liquidar.
  - Resultado só aparece depois que a API devolve SETTLED.
  - Histórico mostra só contratos do usuário logado, paginado.
budget: { max_steps: 40, max_tokens: 200000, timeout: 30m }
```

## 2. Validação e classificação

```text
Handoff válido: T13; 4 critérios testáveis; budget definido.
01-project-context → DENTRO DO ESCOPO (D-10 60 s / 85%, D-11 carteira demo, D-12 Idempotency-Key).
Pendências conhecidas: arredondamento do lucro (só exibição) e regra de cancelamento (botão oculto).
```

## 3. Plano

| Arquivo | Conteúdo |
|---------|----------|
| `apps/web/src/lib/money.ts` | `formatMinor`, `parseStakeInput` |
| `apps/web/src/trade/use-open-contract.ts` | Mutation com chave por intenção e retry com a mesma chave |
| `apps/web/src/trade/order-ticket.tsx` | Boleta: valor, UP/DOWN, estados desabilitados |
| `apps/web/src/trade/contract-status.tsx` | Poll de `/contracts/:id` até `SETTLED` |
| `apps/web/src/wallet/wallet-summary.tsx` | `available` e `reserved` do servidor |
| `apps/web/src/history/contracts-table.tsx` | Paginação por cursor |
| `apps/web/src/trade/use-open-contract.unit.test.ts` | Duplo clique, retry, erros |

## 4. Código

### `trade/use-open-contract.ts`

```ts
import { useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/api/http'

type Direction = 'UP' | 'DOWN'
type OpenInput = { symbol: string; direction: Direction; stake_minor: number }
export type OpenedContract = { id: string; status: string; expires_at: string; entry_price: string }

export function useOpenContract() {
  const queryClient = useQueryClient()
  const intentRef = useRef<{ key: string; body: string } | null>(null)

  const mutation = useMutation({
    mutationFn: async (input: OpenInput) => {
      const body = JSON.stringify({ symbol: input.symbol, direction: input.direction, stake_minor: input.stake_minor })
      if (!intentRef.current || intentRef.current.body !== body) {
        intentRef.current = { key: crypto.randomUUID(), body }        // nova intenção = nova chave
      }
      return api<OpenedContract>('/contracts', {
        method: 'POST',
        headers: { 'Idempotency-Key': intentRef.current.key },
        body,
      })
    },
    retry: (count, error) => count < 2 && !(error instanceof ApiError),   // só falha de rede repete
    onSuccess: () => {
      intentRef.current = null
      queryClient.invalidateQueries({ queryKey: ['wallet'] })            // F-03
      queryClient.invalidateQueries({ queryKey: ['contracts'] })
    },
    onError: (error) => {
      if (error instanceof ApiError) intentRef.current = null            // erro definitivo encerra a intenção
    },
  })

  return mutation
}
```

O retry do TanStack chama `mutationFn` de novo com o **mesmo** corpo, então a chave é reaproveitada (F-10).
Outro valor ou outra direção = outra intenção = outra chave.

### `trade/order-ticket.tsx`

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/http'
import { errorMessage } from '@/api/errors'
import { formatMinor, parseStakeInput } from '@/lib/money'
import { useOpenContract } from './use-open-contract'

const MIN_STAKE = 100
const MAX_STAKE = 10_000

export function OrderTicket({ symbol, feedState }: { symbol: string; feedState: string }) {
  const [stakeText, setStakeText] = useState('5,00')
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api<{ available_minor: number; reserved_minor: number }>('/wallet') })
  const index = useQuery({ queryKey: ['index', symbol], queryFn: () => api<{ status: 'ACTIVE' | 'PAUSED' }>(`/indices/${symbol}`), refetchInterval: 30_000 })
  const openContract = useOpenContract()

  const stakeMinor = parseStakeInput(stakeText)
  const available = wallet.data?.available_minor ?? 0

  const blockedReason =
    index.data?.status === 'PAUSED' ? 'Índice pausado pela operação.'
    : feedState !== 'live' ? 'Cotação indisponível no momento.'
    : stakeMinor === null || stakeMinor < MIN_STAKE || stakeMinor > MAX_STAKE ? 'Valor deve estar entre US$ 1,00 e US$ 100,00.'
    : stakeMinor > available ? 'Saldo insuficiente.'
    : null

  const submit = (direction: 'UP' | 'DOWN') => {
    if (blockedReason || stakeMinor === null || openContract.isPending) return
    openContract.mutate({ symbol, direction, stake_minor: stakeMinor })
  }

  const disabled = Boolean(blockedReason) || openContract.isPending

  return (
    <form aria-labelledby="ticket-title" className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
      <h2 id="ticket-title" className="text-lg font-semibold">Nova operação</h2>

      <label className="flex flex-col gap-1 text-sm">
        Valor (US$)
        <input inputMode="decimal" value={stakeText} onChange={(event) => setStakeText(event.target.value)}
          aria-describedby="ticket-hint" className="rounded-md border px-3 py-2" />
      </label>
      <p id="ticket-hint" className="text-sm text-muted-foreground">
        Retorno de 85% sobre o valor em caso de acerto. Expira em 60 segundos.
      </p>

      <div className="flex gap-2">
        <button type="button" disabled={disabled} onClick={() => submit('UP')} className="flex-1 rounded-md py-2">Subir</button>
        <button type="button" disabled={disabled} onClick={() => submit('DOWN')} className="flex-1 rounded-md py-2">Descer</button>
      </div>

      <p role="status" aria-live="polite" className="text-sm">
        {openContract.isPending && 'Enviando ordem…'}
        {openContract.isError && errorMessage(openContract.error)}
        {!openContract.isPending && !openContract.isError && blockedReason}
      </p>
      <p className="text-sm text-muted-foreground">Disponível: {formatMinor(available)}</p>
    </form>
  )
}
```

### `trade/contract-status.tsx`

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/http'
import { formatMinor } from '@/lib/money'
import { Countdown } from './countdown'

type Contract = { id: string; status: string; expires_at: string; result?: 'WIN' | 'LOSS' | 'DRAW'; payout_minor?: number }
const RESULT_TEXT = { WIN: 'Ganhou', LOSS: 'Perdeu', DRAW: 'Empate' } as const

export function ContractStatus({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const contract = await api<Contract>(`/contracts/${id}`)
      if (contract.status === 'SETTLED') {
        queryClient.invalidateQueries({ queryKey: ['wallet'] })
        queryClient.invalidateQueries({ queryKey: ['contracts'] })
      }
      return contract
    },
    refetchInterval: (query) => (query.state.data?.status === 'SETTLED' ? false : 1_000),
  })

  if (!data) return null
  if (data.status === 'SETTLED' && data.result) {
    return (
      <p role="status" aria-live="polite">
        {RESULT_TEXT[data.result]} — {formatMinor(data.payout_minor ?? 0)}
      </p>
    )
  }
  if (data.status === 'OPEN') return <Countdown expiresAt={data.expires_at} />
  if (data.status === 'FAILED_COMPENSATION') return <p role="status">Não foi possível abrir. O valor não foi debitado.</p>
  if (data.status === 'CREATED' || data.status === 'PENDING_RESERVE') return <p role="status">Confirmando reserva…</p>
  return <p role="status">Liquidando…</p>                                  // EXPIRING, FAILED_RETRYABLE
}
```

O front nunca compara `entry_price` com o preço atual para decidir resultado (F-09).

### `history/contracts-table.tsx` (trecho)

```tsx
const contracts = useInfiniteQuery({
  queryKey: ['contracts'],
  queryFn: ({ pageParam }) => api<{ items: Contract[]; next_cursor: string | null }>(
    pageParam ? `/contracts?cursor=${encodeURIComponent(pageParam)}` : '/contracts'),   // sem user_id
  initialPageParam: null as string | null,
  getNextPageParam: (last) => last.next_cursor,
})
```

## 5. Testes unitários

```ts
it('duplo clique envia uma requisição', ...)                    // isPending trava o segundo
it('retry de rede reutiliza a mesma Idempotency-Key', ...)       // 2 chamadas, mesmo header
it('nova direção gera nova chave', ...)
it('INSUFFICIENT_FUNDS mostra texto fixo e revalida wallet', ...)
it('não exibe resultado enquanto status != SETTLED', ...)
it('parseStakeInput("5,5") === 550 e rejeita "5.5.5"', ...)
it('corpo de POST /contracts tem só symbol, direction e stake_minor', ...)
```

## 6. Saída

```yaml
task_id: T13
agent: frontend-realtime-agent
status: DONE
summary: >
  Boleta com chave de idempotência por intenção (retry reusa a chave), botão travado em voo e
  bloqueio por índice pausado, feed parado, limite e saldo. Saldo e histórico sempre do servidor,
  revalidados ao abrir e ao liquidar. Resultado só com SETTLED. Retorno exibido como "85%" até a
  regra de arredondamento existir; botão Cancelar oculto até a regra de cancelamento.
artifacts:
  - apps/web/src/lib/money.ts
  - apps/web/src/trade/use-open-contract.ts
  - apps/web/src/trade/order-ticket.tsx
  - apps/web/src/trade/contract-status.tsx
  - apps/web/src/wallet/wallet-summary.tsx
  - apps/web/src/history/contracts-table.tsx
  - apps/web/src/trade/use-open-contract.unit.test.ts
evidence:
  - pnpm --filter web test use-open-contract.unit → 7 passed
  - bash agents/frontend-realtime-agent/scripts/health-check.sh → 0 FAIL
acceptance_criteria_met:
  - { criterion: "Duplo clique abre um contrato", met: true, evidence: "teste de duplo clique + mesma chave" }
  - { criterion: "Saldo sempre do servidor", met: true, evidence: "invalidate ['wallet'] em onSuccess e SETTLED" }
  - { criterion: "Resultado só após SETTLED", met: true, evidence: "ContractStatus + teste" }
  - { criterion: "Histórico do usuário, paginado", met: true, evidence: "useInfiniteQuery por cursor, sem user_id" }
confidence_score: 0.9
decisions_cited: [D-10, D-11, D-12, S-04, S-05, F-01, F-02, F-03, F-09, F-10, F-11]
pending:
  - Regra de arredondamento do lucro <não definido no contexto> (só exibição)
  - Regra de cancelamento <não definido no contexto> (botão oculto)
```
