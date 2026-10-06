# Versões fixadas e documentação oficial

As **majors** abaixo são decisão. A versão exata e o digest de imagem saem do `scripts/pin-versions.sh`
para `versoes.lock.md`. Os workers usam só o lock e a doc de `docs/vendor/`.

## Majors

| Componente | Major | Observação que a IA costuma errar (F-01) |
|---|---|---|
| Node.js | LTS ativa | `node:<major>-alpine` nas imagens dos serviços |
| pnpm | a instalada (`packageManager`) | Lockfile commitado |
| TypeScript | 5 | `strict: true` |
| PostgreSQL | 16 | Imagem com digest; Blnk com **banco próprio** |
| Redis | 7 | Blnk com **instância/DB lógico próprio**; AOF ligado para Streams |
| Keycloak | 26.0 | Health em `/health/ready` na porta de **management 9000**; admin bootstrap por `KC_BOOTSTRAP_ADMIN_*` |
| Blnk | última estável (vista: 0.15.4 — conferir em releases) | Valores com `precision`; `reference` determinística; endpoints só da doc anexada |
| lightweight-charts | 5 (vista: 5.2.1 — conferir) | v5 usa `chart.addSeries(CandlestickSeries, …)`; `addCandlestickSeries` é v4. Tempo em **segundos** UTC |
| oidc-client-ts | 3 | `InMemoryWebStorage` para o token |
| jose | a estável | `createRemoteJWKSet` + `jwtVerify` com `algorithms` fixo |
| zod | a estável | `.strict()` nos DTOs |
| Cliente Redis | `ioredis` 5 | Streams + Lua para o lease |
| Cliente Postgres | `pg` 8 | Transação com cliente dedicado do pool (`BEGIN` no mesmo cliente) |
| React / Vite | React 19 / Vite estável | StrictMode monta effects 2× (cleanup do WebSocket) |
| React Admin (D-16) | 5 | Recursos somente leitura por padrão |
| Vitest / Playwright | estáveis | — |
| k6 | estável | Thresholds no script |
| Toxiproxy | 2 | `ghcr.io/shopify/toxiproxy` |
| Prometheus / Grafana / Loki | estáveis | Alertas testados com `promtool` |
| Mailpit | estável | SMTP de dev para confirmação de e-mail (US-01) |

## Documentação anexada (`docs/vendor/`)

| Pasta | Obrigatória para |
|---|---|
| `blnk/` | T04, T09, T10, T11 |
| `keycloak/` | T01, T02 |
| `lightweight-charts/` | T13 |
| `oidc-client-ts/` | T13, T14 |
| `redis/` | T05 a T11 |
| `react-admin/` (ou `refine/`) | T14 |

## Configuração da corrida

Preencha na Fase 0, antes da tag.

| Chave | Valor |
|---|---|
| IDE e comando headless | `<preencher>` |
| `REMOTE_PUSH` | `<sim \| não>` |
| Conta ADMIN (e-mail) | `admin@demo.local` |
| Conta AUDITOR (e-mail) | `auditor@demo.local` |
| Conta USER (e-mail) | `aluno@demo.local` |
| Senhas | Só no `.env` (nunca aqui) |
| Máquina da demo | `<notebook \| VPS>` |
