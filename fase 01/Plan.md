Fase 01

Login e carteira demo.
- Um índice sintético.
- Tick engine com CSPRNG.
- Contrato subir/descer com expiração fixa.
- Ledger simples.
- Histórico e gráfico.
- Painel admin básico.
- Monitoramento básico.

Vamos usar que Repositórios e api aqui

Para essa Fase 1, a divisão é clara: **Keycloak** para login, **Blnk** para carteira/ledger, **TradingView Lightweight Charts** para gráfico, **Redis** para tempo real e **PostgreSQL** para dados. Você constrói apenas o tick engine sintético, o contrato UP/DOWN e o settlement.[1]

## Mapa: o que usar em cada item

| Item da Fase 1 | O que usar | Repositório / ferramenta | Você constrói? |
|---|---|---|---|
| Login e carteira demo | Keycloak + Blnk | `keycloak/keycloak`, `blnkfinance/blnk` | Só integra |
| Índice sintético | Você constrói | — | **Sim** |
| Tick engine com CSPRNG | Você constrói | — | **Sim** |
| Contrato subir/descer | Você constrói | — | **Sim** |
| Ledger simples | Blnk | `blnkfinance/blnk` | Integra e adapta |
| Histórico e gráfico | Lightweight Charts + sua API | `tradingview/lightweight-charts` | Só integra |
| Painel admin básico | React Admin / Refine | `marmelab/react-admin` ou `refinedev/refine` | Configura telas |
| Monitoramento básico | Prometheus + Grafana + Loki | `prometheus/prometheus`, `grafana/grafana`, `grafana/loki` | Configura dashboards |

## 1. Login e carteira demo

### Keycloak
Use o Keycloak para:

- Cadastro;
- Login;
- MFA/TOTP;
- Sessões;
- Tokens;
- RBAC;
- Recuperação de senha.

Repo oficial: `github.com/keycloak/keycloak`. 

No seu backend, você só valida o JWT emitido pelo Keycloak e extrai `sub`/`user_id`.

### Blnk
Use o **Blnk** para carteira demo e ledger de dupla entrada:

- Saldo por usuário;
- Transações;
- Histórico;
- Snapshots de saldo;
- Reconciliação;
- Ledger imutável.

Repo oficial: `github.com/blnkfinance/blnk`. 

No MVP demo, você cria uma carteira `DEMO` com saldo inicial de $ 10.000 e registra cada movimento como transação no ledger. O Blnk é justamente um ledger de dupla entrada para fintechs, com monitoramento de saldo, snapshots e transações.

## 2. Índice sintético + tick engine

Aqui **não use API pronta**. Esse é o núcleo do seu produto.

Você constrói:

```text
CSPRNG
  → gera retorno normal
  → aplica volatilidade
  → aplica salto opcional
  → calcula próximo preço
  → persiste tick
  → publica no Redis
```

Stack:

- Node.js/TypeScript ou Python/FastAPI;
- `crypto.randomInt` / `crypto.getRandomValues` / `secrets` do Python;
- Redis Streams para durabilidade;
- Redis Pub/Sub para broadcast ao vivo;
- PostgreSQL/TimescaleDB para histórico.

O tick engine é pequeno, mas é o coração: gera um tick por segundo, grava `sequence`, `price`, `previous_hash` e `hash`, e publica para o WebSocket.

## 3. Contrato subir/descer

Também é seu. Nenhum repositório resolve isso do jeito que você precisa.

Você constrói:

- `POST /contracts`;
- Validação de saldo;
- Reserva do stake;
- Preço de entrada;
- Expiração em 60 segundos;
- Busca do tick de saída;
- Cálculo de `WIN`, `LOSS` ou `DRAW`;
- Payout de 85%;
- Liquidação transacional;
- Idempotência por `Idempotency-Key`.

## 4. Ledger simples

Use o **Blnk** como ledger.

Fluxo:

```text
Abrir contrato:
available --debit--> reserved

Ganhar:
reserved --debit--> available
house_payout --credit--> available

Perder:
reserved --debit--> house_revenue

Empatar:
reserved --debit--> available
```

O Blnk já fornece primitivas de ledger, saldos, transações e reconciliação — então você não precisa modelar isso do zero.[2][3]

## 5. Histórico e gráfico

Use **TradingView Lightweight Charts**.

- Repo oficial: `github.com/tradingview/lightweight-charts`.[1]
- É client-side, feito para gráficos financeiros interativos.[1]
- Suporta candles, linha, área, volume e atualização em tempo real.[4]

Fluxo:

```text
REST /candles → histórico inicial
WebSocket /ticks → atualização da última vela
```

A biblioteca recebe candles prontos; seu candle worker transforma ticks em OHLCV.

## 6. Painel admin básico

Use **React Admin** ou **Refine**.

- `marmelab/react-admin`: painel admin em React com CRUD, filtros e autenticação.
- `refinedev/refine`: framework admin/internal tools para React.

No MVP, o painel precisa apenas de:

- Lista de usuários;
- Lista de contratos;
- Consulta de ledger;
- Pausar índice;
- Bloquear usuário;
- Ver alertas.

## 7. Monitoramento básico

Use:

- **Prometheus** para métricas;
- **Grafana** para dashboards;
- **Loki** para logs;
- **Sentry** free tier para erros de aplicação.

Repos oficiais:

- `prometheus/prometheus`;
- `grafana/grafana`;
- `grafana/loki`.

Métricas mínimas:

- Ticks por segundo;
- Latência de contrato;
- Contratos abertos;
- Erros 5xx;
- Usuários conectados;
- Divergência de saldo.

## Docker Compose mínimo

```yaml
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
  blnk:
    image: blnkfinance/blnk
  api:
    build: ./api
  tick-engine:
    build: ./tick-engine
  websocket:
    build: ./websocket
  frontend:
    build: ./frontend
```

## Resposta direta

> “Para a Fase 1, uso Keycloak para login/MFA/RBAC, Blnk para carteira demo e ledger, TradingView Lightweight Charts para gráfico, Redis para tempo real e Postgres para dados. Construo apenas o tick engine sintético, o contrato UP/DOWN e o settlement. Isso reduz muito o trabalho sem terceirizar o núcleo do produto.”








ARQUITETURA COMPLETA DA FASE 1
MVP Demo de Índices Sintéticos — resiliente por padrão

Objetivo: mesma Fase 1, mas com resposta explícita para cada ponto de falha:
prevenção, detecção, contenção e recuperação.

1. Princípios

Nenhuma operação financeira depende do front-end.
Nenhuma mensagem crítica depende apenas de Redis Pub/Sub.
Nenhuma operação pode ser executada duas vezes com efeito diferente.
Nenhuma falha pode deixar saldo inconsistente silenciosamente.
Toda falha crítica gera métrica, log, alerta e caminho de recuperação.
Toda dependência externa tem timeout, retry limitado, circuit breaker e fallback.
O estado financeiro correto é sempre reconstruível a partir do ledger e dos ticks.


2. Arquitetura final

┌──────────────────────────────────────────────────────────────┐
│                         FRONT-END                             │
│ React + Vite + TypeScript                                     │
│ TradingView Lightweight Charts                                │
│ oidc-client-ts + TanStack Query + WebSocket client            │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / WSS
                            v
┌──────────────────────────────────────────────────────────────┐
│                       EDGE                                    │
│ Cloudflare / Nginx / Caddy                                    │
│ TLS • WAF • bot protection • rate limit • CORS • headers      │
└───────────────────────────┬──────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────────┐
        v                                        v
┌──────────────────────┐              ┌──────────────────────────┐
│ Keycloak             │              │ API / BFF                │
│ OIDC • MFA • RBAC    │              │ JWT • autorização • REST │
└──────────────────────┘              └────────────┬─────────────┘
                                                   │
              ┌────────────────────────────────────┼────────────────────────────┐
              v                                    v                            v
┌──────────────────────────┐          ┌──────────────────────┐        ┌──────────────────────┐
│ Contract Service         │          │ Wallet Adapter       │        │ Chart API            │
│ Abre / cancela / liquida │◄────────►│ Blnk Ledger          │        │ Histórico e candles  │
└────────────┬─────────────┘          └──────────┬───────────┘        └──────────────────────┘
             │                                   │
             └────────────────┬──────────────────┘
                              v
                   ┌─────────────────────┐
                   │ PostgreSQL          │
                   │ estado forte        │
                   └──────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────────────┐
        v                     v                             v
┌──────────────────┐ ┌────────────────────┐       ┌──────────────────────────┐
│ Tick Engine      │ │ Candle Worker      │       │ Settlement Worker        │
│ Líder único      │ │ consumer group     │       │ consumer group + lock    │
│ CSPRNG           │ │ ticks → OHLCV      │       │ expiração + resultado    │
└────────┬─────────┘ └─────────┬──────────┘       └────────────┬─────────────┘
         │                     │                               │
         └─────────────────────┴───────────────┬───────────────┘
                                               v
                          ┌───────────────────────
───────────────┐
                          │ Redis                                │
                          │ Streams: durabilidade e replay       │
                          │ Pub/Sub: fan-out visual              │
                          │ Cache: último tick e candles quentes │
                          │ Rate limit / leader lease            │
                          └──────────────────┬───────────────────┘
                                             v
                          ┌──────────────────────────────────────┐
                          │ WebSocket Gateway                    │
                          │ autentica JWT e faz fan-out          │
                          └──────────────────┬───────────────────┘
                                             v
                                        [Front-end]
3. Componentes e responsabilidades
4. Fluxo de tick à prova de falha
1. Tick Engine adquire lease de líder no Redis.
2. Lê último tick persistido.
3. Gera próximo preço com CSPRNG.
4. Persiste tick no Postgres dentro de transação.
5. Grava evento no outbox dentro da mesma transação.
6. Commit.
7. Outbox relay publica no Redis Stream.
8. Outbox relay publica no Redis Pub/Sub para visual.
9. Candle Worker consome Stream e atualiza OHLCV.
10. WebSocket Gateway consome Pub/Sub e envia ao front.
11. Se Pub/Sub falhar, front reconecta e pede catch-up por lastSequence.

4.1 Prevenção de tick duplicado
Constraint: UNIQUE(index_id, sequence).
eventId único.
Leader lease no Redis com TTL.
Apenas um processo por índice escreve.
Se a lease expirar, novo líder assume somente após confirmar último tick.

4.2 Recuperação de tick
Worker reinicia
  → SELECT último tick por index_id
  → lê sequence e price
  → espera próximo intervalo
  → gera próximo tick
Se Redis cair:
Tick continua sendo persistido no Postgres.
UI marca feed como STALE.
Ao voltar, Stream republisha a partir do último evento confirmado.

5. Fluxo de contrato à prova de falha

5.1 Abertura
POST /contracts
  → valida JWT, role e Idempotency-Key
  → verifica idempotência existente
  → valida stake, saldo e limites
  → lê último tick oficial do Postgres
  → cria contrato em transação
  → cria outbox: RESERVE_STAKE
  → commit
  → outbox relay chama Blnk
  → Blnk reserva stake com idempotência
  → contrato permanece OPEN

5.2 Estados
CREATED
  → OPEN
  → EXPIRING
  → SETTLED

CREATED
  → FAILED_COMPENSATION

OPEN
  → CANCELLED

EXPIRING
  → SETTLED
  → FAILED_RETRYABLE

5.3 Compensação
Se Blnk falhar depois do contrato ser criado:

1. Contrato permanece CREATED ou PENDING_RESERVE.
2. Outbox tenta novamente com backoff.
3. Após N tentativas, vai para DLQ.
4. Reconciliador compara contrato × ledger.
5. Se reserva não existir, contrato é cancelado.
6. Se reserva existir, contrato é promovido para OPEN.
6. Settlement à prova de falha
1. Scheduler encontra contratos vencidos.
2. Publica evento em stream:contracts:expiry.
3. Settlement Worker consome com consumer group.
4. Faz SELECT ... FOR UPDATE no contrato.
5. Se SETTLED: ACK e retorna.
6. Busca primeiro tick oficial >= expires_at.
7. Se não existir: NACK e retry.
8. Calcula WIN / LOSS / DRAW.
9. Chama Blnk com chave idempotente.
10. Atualiza contrato para SETTLED.
11. ACK na Stream.
12. Publica notificação via outbox.

6.1 Idempotência
Chave do settlement:
settlement:{contract_id}
Chave do crédito:
credit:{contract_id}:{result}
Mesmo que o worker rode 10 vezes, o Blnk registra apenas um efeito financeiro.

6.2 Falhas

7. Redis: Streams + Pub/Sub

7.1 Streams

7.2 Pub/Sub

7.3 Regras
Stream é fonte de trabalho confiável.
Pub/Sub é apenas fan-out visual.
Todo consumer é idempotente.
Todo consumer usa consumer group.
Mensagem pendente é monitorada.
Após timeout, XAUTOCLAIM transfere para outro consumer.
Mensagem permanentemente inválida vai para DLQ.

8. WebSocket resiliente
8.1 Conexão
Cliente conecta
  → envia JWT
  → gateway valida assinatura, issuer, audience e exp
  → cliente informa symbol e lastSequence
  → gateway assina Pub/Sub
  → gateway busca dados faltantes
  → envia snapshot + updates ao vivo

8.2 Reconexão
WebSocket cai
  → front reconecta com backoff
  → envia lastSequence
  → gateway busca eventos faltantes no Stream/Postgres
  → envia catch-up
  → retoma updates ao vivo

8.3 Limites
Máximo 5 conexões por usuário.
Máximo 10 símbolos por conexão.
Ping/pong a cada 15 segundos.
Desconexão após 45 segundos sem pong.
Rate limit de reconexão.

9. Segurança completa

9.1 Identidade
Keycloak OIDC + PKCE.
Argon2id.
MFA/TOTP.
Access token curto.
Refresh token rotativo.
Revogação de sessão.
Clock sincronizado via NTP.
Validação de iss, aud, exp, nbf, sub e roles.

9.2 Autorização
RBAC no backend.
user_id sempre do JWT.
Autorização por objeto em todo endpoint.
BOLA/IDOR bloqueado.
Mass assignment bloqueado por DTO.
Admin sem alteração direta de saldo.

9.3 Infra
HTTPS obrigatório.
WAF e bot protection.
Rate limit por IP, usuário e rota.
CORS restrito.
CSP e headers de segurança.
Segredos em KMS/Vault.
Banco sem exposição pública.
Scan de dependências e segredos no CI.

9.4 Auditoria
audit_logs append-only.
Hash encadeado nos ticks.
Log de login, falha, permissão, contrato e settlement.
Nenhum token, senha ou PII sensível em log.

10. Observabilidade

10.1 Métricas

tick_engine_is_leader
tick_engine_last_tick_age_seconds
tick_engine_ticks_total
tick_engine_errors_total
redis_stream_lag
redis_stream_pending_messages
redis_stream_oldest_pending_age_seconds
websocket_connections_active
websocket_reconnects_total
contract_created_total
contract_open_total
contract_settlement_failed_total
contract_settlement_latency_ms
contract_pending_expiry_total
ledger_reconciliation_errors_total
api_http_5xx_total
api_request_latency_p95_ms

10.2 Alertas
11. Reconciliação contínua
11.1 Job a cada 1 minuto
1. Contratos OPEN cujo expires_at passou?
2. Contratos EXPIRING há mais de 10s?
3. Cada contrato OPEN tem reserva no ledger?
4. Cada contrato SETTLED tem settlement no ledger?
5. Saldo projetado = soma dos eventos do ledger?
6. Último tick do Stream = último tick do Postgres?
7. Candle fecha corretamente a partir dos ticks?
11.2 Ações automáticas

12. Deploy

12.1 Docker Compose
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
  blnk:
    image: blnkfinance/blnk
  api:
    build: ./services/api
  tick-engine:
    build: ./services/tick-engine
  candle-worker:
    build: ./services/candle-worker
  settlement-worker:
    build: ./services/settlement-worker
  websocket-gateway:
    build: ./services/websocket-gateway
  frontend:
    build: ./apps/web
  prometheus:
    image: prom/prometheus
  grafana:
    image: grafana/grafana
  loki:
    image: grafana/loki
12.2 Ambientes

dev: local.
staging: igual à produção, dados sintéticos.
prod: acesso restrito, backups e monitoramento.

12.3 CI/CD
Lint.
Testes unitários.
Testes de integração.
Scan de segredos.
Scan de CVE.
Build de imagem.
Deploy em staging.
Smoke tests.
Deploy em produção com health check e rollback.

13. Plano de testes
13.1 Unitários
Cálculo de próximo tick.
Cálculo de payout.
Empate.
Máquina de estados.
Validação de stake.
Autorização por objeto.

13.2 Integração
Login + carteira demo.
Abrir contrato.
Repetir requisição com mesma chave.
Expiração automática.
Settlement único.
Vitória, derrota e empate.

13.3 Caos
Matar tick engine.
Matar candle worker.
Matar settlement worker.
Derrubar Redis.
Derrubar Postgres.
Duplicar mensagem do Stream.
Enviar tick fora de ordem.
Reusar refresh token.

13.4 Carga
300 WebSockets.
50 contratos/minuto.
1 tick/segundo por índice.
p95 < 200ms na abertura.
Zero settlement duplicado.
Zero divergência de saldo.

14. Definição de pronto
A Fase 1 está pronta quando:
�Tick engine tem líder único.
�Tick é persistido antes de distribuído.
�Tick duplicado é impossível no banco.
�Candle é reconstrutível a partir dos ticks.
�WebSocket reconecta e faz catch-up.
�Contrato tem idempotência.
�Settlement tem idempotência.
�Ledger é append-only.
�Reconciliação roda continuamente.
�Falha de Redis não corrompe dinheiro.
�Falha de worker não perde settlement.
�Falha de Keycloak não quebra contratos já abertos.
�Alertas cobrem todos os pontos críticos.
�Testes de caos e carga passam.
