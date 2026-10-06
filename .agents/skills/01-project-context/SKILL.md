---
name: 01-project-context
description: >
  Trigger: "stack", "arquitetura", "escopo da Fase 1", "decisão já tomada", "qual serviço faz", "onde fica". Ativar antes de planejar, implementar ou revisar qualquer tarefa da Plataforma de Índices Sintéticos.
version: 1.0.0
---

# 01-project-context

Contexto permanente da **Plataforma de Índices Sintéticos — Fase 1 (MVP Demo)**.
Fonte de verdade para **stack**, **arquitetura**, **escopo da Fase 1** e **decisões já tomadas**.
Lida pelo `tech-lead-orchestrator` e pelos 5 agentes especializados antes de qualquer tarefa.

## Mentalidade

Assumir que tudo pode falhar, que todo cliente pode mentir e que todo erro pode custar dinheiro.
Projetar para falhar de forma segura, detectar cedo e recuperar sem corromper estado.

| # | Regra | Pergunta mental | Regra prática |
|---|-------|-----------------|---------------|
| 1 | O cliente sempre mente | Se eu enviar um JSON malicioso, um preço falso ou um ID de outra pessoa, o que acontece? | Preço, resultado, saldo e `user_id` nunca vêm do cliente. Autorização e validação no servidor. |
| 2 | Falhar é normal | Se esse serviço morrer agora, o que acontece com o dinheiro? | Timeout, retry limitado, circuit breaker, fila, DLQ e fallback. Nenhuma chamada espera infinito. |
| 3 | Toda operação pode repetir | Se essa ação rodar 10 vezes, o saldo muda 10 vezes? | Idempotência em contrato, pagamento, webhook e settlement. Mesma chave, mesmo resultado. |
| 4 | Dinheiro é estado, não número solto | Como eu reconstruo esse saldo se o banco corromper? | Ledger append-only; saldo derivado; correção é transação reversa. |
| 5 | Menor privilégio sempre | Esse usuário/serviço precisa mesmo disso? | USER não vê admin; AUDITOR não escreve; leitura usa credencial read-only. |
| 6 | Segurança é camada, não promessa | Se o token vazar, o que limita o dano? | Token curto, MFA, RBAC, rate limit, auditoria, criptografia e monitoramento juntos. |
| 7 | Se não é observável, não é confiável | Se isso quebrar às 3h, eu descubro antes do usuário? | Métricas, logs estruturados, traces, alertas acionáveis e dashboards. |
| 8 | Deploy precisa ter volta | Como eu volto em 5 minutos? | CI/CD, migrations reversíveis, feature flag, canary e rollback testado. |
| 9 | Backup não testado não existe | Se o banco sumir agora, quanto eu perco e quanto tempo levo para voltar? | PITR, backup externo, RPO/RTO definidos e restore mensal. |
| 10 | Regra de negócio vem antes de feature | Onde está o dinheiro? Quem pode movê-lo? O que acontece se falhar? | Modelar ledger, contratos, estados e invariants antes da UI. |

## Regras de ativação

**Ativar quando o pedido contém:**

- "qual stack", "qual ferramenta", "qual repositório", "usar o quê para"
- "arquitetura", "qual serviço faz", "onde fica", "quem é responsável por"
- "escopo da Fase 1", "isso entra na Fase 1", "está no MVP"
- "decisão já tomada", "por que usamos", "posso trocar X por Y"
- Início de qualquer issue/spec recebida pelo `tech-lead-orchestrator`

**Não ativar quando:**

- Pergunta genérica de programação sem relação com o projeto
- Revisão detalhada de ledger, saldo ou settlement — usar `02-financial-invariants`
- Configuração detalhada de Keycloak, JWT ou RBAC — usar `04-security-iam`
- Escrita de testes — usar `06-testing-quality`

## Quem usa

| Consumidor | O que lê desta skill |
|------------|----------------------|
| `tech-lead-orchestrator` | Escopo, decisões e arquitetura para montar plano e critérios de aceite |
| `backend-implementation-agent` | Stack, componentes e responsabilidades de cada serviço |
| `frontend-realtime-agent` | Stack de front-end, fluxo REST + WebSocket |
| `financial-correctness-reviewer` | Decisões de ledger (Blnk) e fluxo de contrato |
| `security-reviewer` | Decisões de identidade (Keycloak) e fronteiras de serviço |
| `qa-resilience-agent` | Escopo e componentes para cobertura de testes |

## Instruções

1. Carregar as seções **Stack**, **Arquitetura**, **Escopo da Fase 1** e **Decisões já tomadas**.
2. Classificar o pedido em uma das três categorias:
   - **Dentro do escopo** — responder indicando componente responsável e ferramenta.
   - **Fora do escopo** — responder `FORA DO ESCOPO DA FASE 1` e indicar o item de escopo mais próximo.
   - **Conflita com decisão** — não implementar; citar a decisão (`D-xx`) e devolver ao orquestrador para aprovação humana.
3. Nunca inventar informação ausente: responder `<não definido no contexto>`.
4. Responder no **Formato de saída**.

## Stack

| Item da Fase 1 | Ferramenta | Repositório | Construir? |
|----------------|------------|-------------|------------|
| Login e carteira demo | Keycloak + Blnk | `keycloak/keycloak`, `blnkfinance/blnk` | Só integra |
| Índice sintético | Próprio | — | **Sim** |
| Tick engine com CSPRNG | Próprio | — | **Sim** |
| Contrato subir/descer | Próprio | — | **Sim** |
| Ledger simples | Blnk | `blnkfinance/blnk` | Integra e adapta |
| Histórico e gráfico | Lightweight Charts + API própria | `tradingview/lightweight-charts` | Só integra |
| Painel admin básico | React Admin ou Refine | `marmelab/react-admin`, `refinedev/refine` | Configura telas |
| Monitoramento básico | Prometheus + Grafana + Loki + Sentry | `prometheus/prometheus`, `grafana/grafana`, `grafana/loki` | Configura dashboards |
| Tempo real | Redis (Streams + Pub/Sub) | — | Integra |
| Dados | PostgreSQL / TimescaleDB | — | Integra |
| Front-end | React + Vite + TypeScript, oidc-client-ts, TanStack Query | — | **Sim** |

## Arquitetura

```text
FRONT-END (React + Vite + TS + Lightweight Charts)
  │ HTTPS / WSS
EDGE (Cloudflare / Nginx / Caddy: TLS, WAF, rate limit, CORS, headers)
  ├── Keycloak (OIDC, MFA, RBAC)
  └── API / BFF (JWT, autorização, REST)
        ├── Contract Service  ◄──► Wallet Adapter ──► Blnk Ledger
        └── Chart API (histórico e candles)
                 │
            PostgreSQL (estado forte)
                 │
  ┌──────────────┼──────────────────┐
Tick Engine   Candle Worker     Settlement Worker
(líder único) (consumer group)  (consumer group + lock)
  └──────────────┴──────────────────┘
                 │
Redis: Streams (durabilidade/replay) • Pub/Sub (fan-out visual)
       Cache (último tick, candles quentes) • rate limit • leader lease
                 │
WebSocket Gateway (autentica JWT, fan-out, catch-up por lastSequence)
```

| Componente | Responsabilidade |
|------------|------------------|
| Tick Engine | Gera 1 tick/s com CSPRNG, persiste no Postgres + outbox, líder único por índice |
| Outbox Relay | Publica eventos confirmados no Redis Stream e no Pub/Sub |
| Candle Worker | Consome Stream e agrega ticks em OHLCV |
| Contract Service | Abre, cancela e liquida contratos UP/DOWN |
| Wallet Adapter | Traduz operações de contrato em transações Blnk |
| Settlement Worker | Liquida contratos vencidos com lock e idempotência |
| WebSocket Gateway | Autentica, faz fan-out e catch-up |
| Chart API | Serve `GET /candles` para histórico inicial |

## Escopo da Fase 1

**Dentro:**

- Login e carteira demo
- Um índice sintético
- Tick engine com CSPRNG
- Contrato subir/descer com expiração fixa
- Ledger simples
- Histórico e gráfico
- Painel admin básico
- Monitoramento básico

**Fora:** qualquer item não listado acima (ex.: dinheiro real, mais de um índice, outros tipos de contrato).

## Decisões já tomadas

| ID | Decisão | Status |
|----|---------|--------|
| D-01 | Keycloak para cadastro, login, MFA/TOTP, sessões, tokens, RBAC e recuperação de senha | Tomada |
| D-02 | Blnk para carteira demo e ledger de dupla entrada | Tomada |
| D-03 | TradingView Lightweight Charts para gráfico | Tomada |
| D-04 | Redis Streams = fonte de trabalho confiável; Pub/Sub = apenas fan-out visual | Tomada |
| D-05 | PostgreSQL = estado forte | Tomada |
| D-06 | Tick engine, contrato UP/DOWN e settlement são construídos internamente | Tomada |
| D-07 | Gerador de preço usa CSPRNG | Tomada |
| D-08 | Tick é persistido antes de ser publicado (outbox na mesma transação) | Tomada |
| D-09 | Um líder por índice via lease no Redis com TTL | Tomada |
| D-10 | Contrato com expiração de 60 segundos e payout de 85% | Tomada |
| D-11 | Carteira `DEMO` com saldo inicial de 10.000 | Tomada |
| D-12 | `POST /contracts` exige `Idempotency-Key` | Tomada |
| D-13 | 1 tick por segundo por índice | Tomada |
| D-14 | Prometheus + Grafana + Loki + Sentry para monitoramento | Tomada |
| D-15 | Docker Compose; ambientes dev, staging e prod | Tomada |
| D-16 | Painel admin: React Admin **ou** Refine | Pendente |
| D-17 | PostgreSQL gerenciado (AWS RDS Multi-AZ) em staging e prod; Docker Compose só em dev — detalhes em `08-database-foundation` | Pendente |
| D-18 | Moeda da carteira demo: **USD**, inteiro em centavos (`1_000_000` = US$ 10.000,00); exibição `pt-BR` (PRD US-03) | Tomada |
| D-19 | Arredondamento do lucro de 85% no WIN — preenchido na Fase 0 (`docs/fase-1/00-preparacao-humana.md`) | Pendente |

## Formato de saída

```text
CLASSIFICAÇÃO: DENTRO DO ESCOPO | FORA DO ESCOPO DA FASE 1 | CONFLITA COM DECISÃO
COMPONENTE: <serviço responsável>
FERRAMENTA: <ferramenta/repositório ou "Próprio">
DECISÕES RELACIONADAS: <D-xx, ...>
RESPOSTA: <resposta objetiva>
PENDÊNCIAS: <itens <não definido no contexto> ou "nenhuma">
```

## Exemplos

Exemplo curto:

```text
Entrada: "Onde eu gero os candles?"

CLASSIFICAÇÃO: DENTRO DO ESCOPO
COMPONENTE: Candle Worker
FERRAMENTA: Próprio (consome Redis Stream, grava no PostgreSQL)
DECISÕES RELACIONADAS: D-04, D-05
RESPOSTA: O Candle Worker consome o Stream de ticks via consumer group e agrega OHLCV.
          A Chart API serve GET /candles; o WebSocket atualiza a última vela.
PENDÊNCIAS: nenhuma
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Decisão pendente (D-16):** apresentar as opções sem escolher; devolver ao orquestrador.
- **Pedido de outra fase:** classificar como `FORA DO ESCOPO DA FASE 1`.
- **Termo ambíguo** ("carteira" pode ser saldo no Blnk ou tela no front): pedir ao orquestrador qual dos dois antes de responder.
- **Informação ausente:** responder `<não definido no contexto>` em vez de inventar.
- **Pedido de troca de ferramenta** (ex.: Kafka no lugar de Redis): `CONFLITA COM DECISÃO` + decisão citada.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers explícitos no `description` e em Regras de ativação |
| Ativação espúria | Lista "Não ativar quando" com skill alternativa |
| Execução parcial | Formato de saída com campos obrigatórios |
| Deriva de instrução | Decisões numeradas (`D-xx`) citáveis |
| Conflito de tools | Fronteiras com `02`, `04` e `06` declaradas |
| Context overflow | Detalhes de API em `references/`, exemplos em `examples/` |
| Feedback loop negativo | Proibição de inventar; uso de `<não definido no contexto>` |

## Recursos

- Referência de APIs e endpoints: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Verificação do projeto: `scripts/health-check.sh`
