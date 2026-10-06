# API guide — frontend-realtime-agent

Referência carregada sob demanda. Quando este arquivo e uma skill divergirem, **a skill vence**.
O contrato do servidor (rotas, DTOs, erros) é o de `agents/backend-implementation-agent/references/api-guide.md`;
este arquivo só descreve como o front o consome.

## Mapa de subtasks

| # | Subtask | Skills | O que "pronto" exige deste agente |
|---|---------|--------|-----------------------------------|
| T13 | Front-end: login OIDC, carteira demo, histórico, gráfico, WebSocket | 01, 03, 04 | Login PKCE; gráfico com histórico + ao vivo; reconexão sem buraco; boleta idempotente; carteira e histórico do próprio usuário |
| T14 | Painel admin | 01, 04 | Telas da seção 9.8; `AUDITOR` só leitura; nenhuma edição de saldo; framework depende de `D-16` |

## Stack

| Item | Escolha | Origem |
|------|---------|--------|
| Base | React + Vite + TypeScript | `01-project-context` |
| Auth | `oidc-client-ts` (client `frontend`; `admin-panel` no admin) | D-01, `04-security-iam` |
| Dados do servidor | TanStack Query | `01-project-context` |
| Gráfico | TradingView Lightweight Charts (API v5 nos exemplos) | D-03 |
| Tempo real | `WebSocket` nativo via provider único | 9.6 |
| Admin | React Admin **ou** Refine | D-16 — pendente |

## Estrutura de pastas

```text
apps/web/src/
  auth/        user-manager.ts, auth-provider.tsx, callback-page.tsx, use-access-token.ts
  api/         http.ts (fetch com token + timeout), errors.ts (mapa de códigos)
  feed/        feed-provider.tsx, use-tick-feed.ts, backoff.ts
  chart/       price-chart.tsx, candle-adapter.ts
  trade/       order-ticket.tsx, use-open-contract.ts, countdown.tsx
  wallet/      wallet-summary.tsx, use-wallet.ts
  history/     contracts-table.tsx, transactions-table.tsx
  lib/         money.ts (formatMinor), clock.ts (offset do servidor)
apps/admin/src/
  data/        api-client.ts, types.ts, role-guard.tsx
  screens/     users, contracts, ledger, indices, alerts
```

## Rotas consumidas

| Rota | Uso no front | Query key (TanStack) | Revalidar quando |
|------|--------------|----------------------|------------------|
| `GET /wallet` | Header e boleta | `['wallet']` | Após `POST /contracts`, contrato `SETTLED`, foco na janela |
| `GET /wallet/transactions?cursor=` | Aba "Transações" | `['wallet','transactions']` | Contrato `SETTLED` |
| `GET /indices/:id` | Status `ACTIVE`/`PAUSED` | `['index', id]` | A cada 30 s ou erro `INDEX_PAUSED` |
| `GET /candles?symbol&interval&from&to` | Carga inicial e `resync_required` | `['candles', symbol, interval]` | `resync_required` |
| `POST /contracts` | Boleta | mutation | — |
| `GET /contracts?cursor=` | Aba "Contratos" | `['contracts']` | Após abrir; contrato `SETTLED` |
| `GET /contracts/:id` | Acompanhar contrato aberto | `['contract', id]` | Poll a cada 1 s a partir de `expires_at` até `SETTLED` |

Nenhuma rota recebe `user_id` do front: o servidor usa o `sub` do JWT (S-04).

## Cliente HTTP

```ts
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()                       // memória; renova se necessário
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: init.signal ?? AbortSignal.timeout(8_000),
  })
  if (!response.ok) throw await ApiError.from(response)      // nunca exibir body cru
  return response.json() as Promise<T>
}
```

`401` → tentar renovação silenciosa uma vez; falhou → `signinRedirect()`. `403`/`404` → tela de "não encontrado".

## Protocolo WebSocket (lado cliente)

Fonte: `03-synthetic-market-engine` (mensagens) e `04-security-iam` (handshake).

```text
1. new WebSocket(WS_URL)                         ← sem token na URL
2. onopen  → send { type: "auth", token }        ← até 5 s
3.         → send { type: "subscribe", symbol, lastSequence? }
4. recebe snapshot  → lastSequence = sequence
5. recebe tick      → sequence <= last: descarta | = last + 1: aplica | > last + 1: gap → subscribe com lastSequence
6. recebe candle    → substitui a vela ao vivo do mesmo bucketStart
7. recebe ping      → send { type: "pong" }
8. recebe resync_required → refetch /candles, apagar lastSequence, subscribe sem lastSequence
9. onclose (não intencional) → backoff e volta ao passo 1 com lastSequence
```

| Parâmetro | Valor |
|-----------|-------|
| Backoff | `min(30 s, 500 ms × 2^tentativa)` com jitter total (`random × teto`) |
| Jitter | `crypto.getRandomValues` não é obrigatório aqui (não é segurança); `Math.random` permitido **só** em `backoff.ts` |
| Feed parado | Nenhum tick há mais de 5 s → estado `stale` |
| Erro `SYMBOL_LIMIT` / limite de conexões | Parar reconexão e mostrar mensagem |
| Logout / unmount do provider | `close(1000)` e não reconectar |

## Gráfico

| Item | Regra |
|------|-------|
| Série | Candlestick, intervalo `1m` |
| Tempo | `bucketStart` → segundos UTC (`UTCTimestamp`) |
| Preço | String decimal da API → `Number()` **somente** dentro de `candle-adapter.ts` |
| Carga inicial | `setData()` com `/candles` da última hora |
| Ao vivo | `update()` com a vela montada dos ticks do bucket atual |
| Vela oficial | Mensagem `candle` substitui a vela ao vivo do mesmo `bucketStart` |

## Estados do contrato na UI

| Status da API | Texto | Boleta | Observação |
|---------------|-------|--------|------------|
| `CREATED`, `PENDING_RESERVE` | "Confirmando reserva…" | Livre | Saldo revalidado ao confirmar |
| `OPEN` | Contagem regressiva | Livre | Contagem usa offset do servidor |
| `EXPIRING`, `FAILED_RETRYABLE` | "Liquidando…" | Livre | Nunca mostrar resultado aqui |
| `SETTLED` | "Ganhou", "Perdeu" ou "Empate" + `payout_minor` | Livre | Notificação `aria-live="polite"` |
| `FAILED_COMPENSATION` | "Não foi possível abrir. O valor não foi debitado." | Livre | Revalidar `['wallet']` |
| `CANCELLED` | "Cancelado" | Livre | Regra de cancelamento pendente: botão oculto |

## Mapa de erros

| Código | Texto exibido | Ação do front |
|--------|---------------|---------------|
| `IDEMPOTENCY_KEY_REQUIRED` | "Não foi possível enviar a ordem." | Bug: logar e reportar |
| `INVALID_STAKE` | "Valor deve estar entre US$ 1,00 e US$ 100,00." | Destacar campo |
| `UNKNOWN_FIELD` | "Não foi possível enviar a ordem." | Bug: logar e reportar |
| `INVALID_TOKEN` | — | Renovar sessão |
| `INDEX_PAUSED` | "Índice pausado pela operação." | Desabilitar boleta |
| `IDEMPOTENCY_KEY_REUSED` | "Não foi possível enviar a ordem." | Bug: chave reaproveitada |
| `INSUFFICIENT_FUNDS` | "Saldo insuficiente." | Revalidar `['wallet']` |
| `RATE_LIMITED` | "Muitas ordens em sequência. Aguarde alguns segundos." | Travar botão por `Retry-After` |
| `FEED_STALE` | "Cotação indisponível no momento." | Desabilitar boleta |
| Rede / timeout | "Sem conexão. Tentando de novo…" | Repetir com a **mesma** chave |

## Dinheiro

```ts
const usd = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' })   // D-18 → "US$ 10.000,00"
export const formatMinor = (minor: number | bigint) => usd.format(Number(minor) / 100)

export function parseStakeInput(text: string): number | null {
  const match = /^(\d{1,3})(?:,(\d{1,2}))?$/.exec(text.trim())   // "5" | "5,5" | "5,50"
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}
```

Limites da boleta: `100 ≤ stake_minor ≤ 10000` (US$ 1,00 a US$ 100,00) e `≤ available`.
A validação no front é UX; o servidor revalida.

## Painel admin (T14)

| Tela | `ADMIN` | `AUDITOR` | Rota |
|------|---------|-----------|------|
| Usuários | Ler + bloquear (com motivo) | Ler | `GET /admin/users`, `POST /admin/users/:id/block` |
| Contratos | Ler | Ler | `GET /admin/contracts` |
| Ledger | Ler | Ler | `GET /admin/ledger` |
| Índices | Ler + pausar (com motivo) | Ler | `POST /admin/indices/:id/pause` |
| Alertas | Ler | Ler | `<não definido no contexto>` (rota não especificada) |

Login pelo client `admin-panel` (MFA obrigatório no Keycloak). Nenhuma tela de ajuste de saldo (B-14).
