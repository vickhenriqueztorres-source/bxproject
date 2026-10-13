# SUBETAPA 2: MOTOR DE GEOBLOCKING & FEATURE FLAGS ENGINE (BACKEND)

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `security-reviewer`, `broker-architect-agent`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-02`

---

## 1. Objetivo e Escopo

Construir o motor de borda e middleware centralizado de **Geoblocking** e o serviço de **Feature Flags Dinâmicas por País** em `services/api` e `services/websocket-gateway`, contemplando:
1. Resolução segura de país da requisição via headers de borda autorizados (`CF-IPCountry`, `X-Country-Code`, ou resolução de IP controlada).
2. Validação contra a lista permitida dos 6 países da Fase 2: `BR`, `MX`, `CO`, `AR`, `CL`, `PE`. Países não suportados são interceptados com **HTTP 403 Forbidden** (`code: "GEO_BLOCKED"`).
3. Motor de Feature Flags reativo com cache atômico no Redis (`broker:flags:country:{country_code}`) e persistência no PostgreSQL:
   - Permite ligar/desligar países inteiros (`is_active: false`).
   - Permite ligar/desligar funcionalidades específicas por país (`trading_enabled`, `otc_real_feed`, `demo_wallet`).
   - Comutação em tempo real (< 50ms) sem necessidade de redeploy de serviços.
4. Endpoints REST da API:
   - `GET /api/v1/geo/detect`: Retorna o país inferido, permissão de acesso, locale sugerido e moeda padrão.
   - `GET /api/v1/geo/countries`: Lista pública dos 6 países e respectivos status.
   - `GET /api/v1/flags/:country`: Mapa de flags ativas para o país solicitado.
   - `PUT /api/v1/admin/countries/:country/flags`: Endpoint protegido por RBAC (Admin) para chaveamento de flags em runtime com invalidação de cache via Redis Pub/Sub.

---

## 2. Invariantes e Regras de Segurança Invioláveis

- **S-04 (Anti-Spoofing de Headers)**: Cabeçalhos como `X-Forwarded-For` ou `CF-IPCountry` só podem ser aceitos quando a conexão originar de uma rede confiável de proxy reverso (Nginx/Cloudflare/Caddy configurado em `TRUSTED_PROXIES`). IPs forjados enviados diretamente por clientes maliciosos são ignorados.
- **S-02 / S-03 (Proteção de Endpoints de Alteração de Flags)**: Qualquer rota que modifique flags ou status de país exige autenticação JWT válida emitida pelo Keycloak com role `ADMIN`. Usuários com role `USER` ou não autenticados recebem **HTTP 403 Forbidden**.
- **Resiliência e Fallback (Skill 05)**: Caso o Redis caia ou sofra partição de rede, a verificação de flags recorre com fallback imediato para o pool do PostgreSQL em modo read-only com circuit breaker, mantendo a disponibilidade sem deixar vazar acessos de países proibidos (fail-closed para países não mapeados).

---

## 3. Especificação de Arquitetura

```text
Cliente (Browser / App)
    │ (HTTPS / WSS com headers de país)
    ▼
Fastify Pre-Handler / WebSocket VerifyClient
    │
    ├── 1. Extrai código do país (CF-IPCountry / X-Country-Code / IP)
    ├── 2. O país está na Allowlist [BR, MX, CO, AR, CL, PE]?
    │      ├── NÃO ──► Retorna 403 GEO_BLOCKED imediato (Stop Pipeline)
    │      └── SIM ──► Prossegue
    │
    ├── 3. Checa Feature Flags no Redis (`broker:flags:country:{country}`)
    │      ├── Hit no Redis: flags avaliadas em < 1ms
    │      └── Miss ou Fallback: lê PostgreSQL com fallback gracioso
    │
    └── 4. País e Flags válidos?
           ├── Bloqueado (flag desativada) ──► Retorna 403 COUNTRY_DISABLED
           └── Liberado ──► Injeta `req.geoContext` e encaminha para a rota
```

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-geoblock-flags.test.ts`)
- Validação das regras de parsing de headers (Cloudflare, X-Country-Code, IP).
- Comportamento de negação imediata para países fora da lista (ex: `US`, `FR`, `DE`, `RU`).
- Comportamento de aceitação para os 6 países (`BR`, `MX`, `CO`, `AR`, `CL`, `PE`).
- Avaliação de regras booleanas de feature flags com chaveamento dinâmico.

### 4.2 Testes de Integração (`tests/integration/test-geoblock-api.test.ts`)
- Chamadas completas na API com diferentes cenários de geolocalização.
- Chamada de alteração de flag via rota admin e verificação da invalidação do cache Redis.
- Verificação de handshake do WebSocket Gateway rejeitando conexões de origens bloqueadas com código de close 4403.

### 4.3 Testes de Segurança
- **Bypass Attack**: Envio de headers spoofados (`CF-IPCountry: BR` vindo de IP externo não confiável).
- **IDOR / Escalada**: Usuário comum tentando chamar rota `PUT /api/v1/admin/countries/:country/flags`.
- **Injection Test**: Envio de caracteres especiais no parâmetro `:country` (ex: `BR' OR '1'='1`).

### 4.4 Testes de Estresse
- Carga de 10.000 requisições simultâneas de resolução de geoblocking e flags com verificação de latência p99 < 2ms utilizando cache do Redis.

### 4.5 Testes de Caos
- Derrubada forçada do Redis durante testes contínuos de requisições: o sistema deve efetuar fallback para PostgreSQL sem lançar exceções 500 para o cliente.
- Flap contínuo de flags (ativação e desativação em ciclo rápido a cada 10ms) sem inconsistência de memória ou race condition.

---

## 5. Quality Gate e Critério de Aceite (`GATE-F2-02`)
A Subetapa 2 é considerada HOMOLOGADA exclusivamente se:
1. Requisições dos 6 países passam e todas as demais origens são bloqueadas com 403 `GEO_BLOCKED`.
2. As Feature Flags alteram o comportamento da API em runtime sem necessidade de restart de processo.
3. Testes unitários, de integração, segurança, estresse e caos são executados com 100% de sucesso.
4. Auditoria do `security-reviewer` e do `post-implementation-verifier` aprovam o fechamento do gate.
