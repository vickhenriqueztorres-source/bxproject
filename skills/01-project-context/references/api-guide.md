# API guide — 01-project-context

Referência carregada sob demanda. Lista as interfaces entre os componentes da Fase 1.
Para detalhes de ledger, ver `02-financial-invariants/references/api-guide.md`.

## API / BFF (própria)

| Método | Rota | Descrição | Auth |
|--------|------|-----------|------|
| `POST` | `/contracts` | Abre contrato UP/DOWN. Exige header `Idempotency-Key` | JWT (USER) |
| `GET` | `/contracts` | Lista contratos do usuário autenticado | JWT (USER) |
| `GET` | `/contracts/{id}` | Detalhe do contrato (autorização por objeto) | JWT (USER) |
| `GET` | `/wallet` | Saldo da carteira `DEMO` do usuário | JWT (USER) |
| `GET` | `/wallet/transactions` | Histórico de transações do usuário | JWT (USER) |
| `GET` | `/candles` | Histórico inicial de candles OHLCV do índice | JWT (USER) |

Regras herdadas da arquitetura:

- `user_id` sempre do claim `sub` do JWT.
- DTO explícito em toda entrada (bloqueia mass assignment).
- Preço de entrada lido do último tick oficial no PostgreSQL.

## WebSocket Gateway (próprio)

```text
Conexão:
  cliente → envia JWT
  gateway → valida assinatura, iss, aud, exp
  cliente → informa symbol e lastSequence
  gateway → snapshot + catch-up + updates ao vivo

Limites:
  5 conexões por usuário
  10 símbolos por conexão
  ping/pong a cada 15s; desconexão após 45s sem pong
```

## Keycloak (OIDC)

| Uso | Endpoint padrão |
|-----|-----------------|
| Discovery | `/realms/{realm}/.well-known/openid-configuration` |
| Authorization (PKCE) | `/realms/{realm}/protocol/openid-connect/auth` |
| Token | `/realms/{realm}/protocol/openid-connect/token` |
| JWKS (validação de assinatura) | `/realms/{realm}/protocol/openid-connect/certs` |
| Logout | `/realms/{realm}/protocol/openid-connect/logout` |

Claims validados no backend: `iss`, `aud`, `exp`, `nbf`, `sub`, roles.

## Blnk

Usado via Wallet Adapter. Mapeamento completo em `02-financial-invariants/references/api-guide.md`.

## Redis

| Estrutura | Uso |
|-----------|-----|
| Stream | Durabilidade e replay de ticks e eventos de expiração (consumer groups, `XAUTOCLAIM`, DLQ) |
| Pub/Sub | Fan-out visual para o WebSocket Gateway |
| Chave com TTL | Leader lease do Tick Engine |
| Cache | Último tick e candles quentes |
| Contadores | Rate limit |

## Observabilidade

Métricas mínimas da Fase 1: ticks por segundo, latência de contrato, contratos abertos, erros 5xx, usuários conectados, divergência de saldo.

## Fontes oficiais

- https://github.com/keycloak/keycloak
- https://github.com/blnkfinance/blnk
- https://github.com/tradingview/lightweight-charts
- https://github.com/marmelab/react-admin
- https://github.com/refinedev/refine
- https://github.com/prometheus/prometheus
- https://github.com/grafana/grafana
- https://github.com/grafana/loki
