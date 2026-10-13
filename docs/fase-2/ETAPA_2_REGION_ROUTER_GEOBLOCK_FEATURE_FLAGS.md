# SUBETAPA 2: REGION ROUTER, GEOBLOCKING E FEATURE FLAGS ENGINE

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `security-reviewer`, `broker-architect-agent`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-F2-ETAPA-2`  

---

## 1. Objetivo e Especificação Técnica

Implementar o **Region Router** e o **Feature Flags Engine Centralizado** em `services/api` e `services/websocket-gateway`, em estrito cumprimento da Seção 3 da especificação:

### 1.1 Region Router
1. **Detecção Segura de Origem**:
   - Cabeçalho `CF-IPCountry` (Cloudflare).
   - Cabeçalho `X-Country-Code` (Reverse Proxy verificado).
   - Resolução de IP GeoIP / allowlist em ambiente local (`x-test-country` exclusivo para testes controlados).
2. **Validação e Geoblocking**:
   - Se o país não estiver na lista permitida (`BR`, `MX`, `CO`, `AR`, `CL`, `PE`), intercepta imediatamente com **HTTP 403 Forbidden** (`code: "GEO_BLOCKED"`).
   - Se o país estiver na lista permitida, mas a flag específica do país estiver desligada (`country_{code}_enabled === false`), intercepta com **HTTP 403 Forbidden** (`code: "COUNTRY_DISABLED"`).
3. **Resolução de Contexto Regional (`GeoContext`)**:
   - Define automaticamente `locale` padrão e `moeda` padrão conforme a matriz:
     - `BR` → `pt-BR`, `BRL`, timezone `America/Sao_Paulo`
     - `MX` → `es-MX`, `MXN`, timezone `America/Mexico_City`
     - `CO` → `es-CO`, `COP`, timezone `America/Bogota`
     - `AR` → `es-AR`, `ARS`, timezone `America/Argentina/Buenos_Aires`
     - `CL` → `es-CL`, `CLP`, timezone `America/Santiago`
     - `PE` → `es-PE`, `PEN`, timezone `America/Lima`

### 1.2 Feature Flags Engine
Catálogo oficial das 10 Feature Flags globais e regionais com persistência PostgreSQL e cache atômico Redis:
```json
{
  "payments_enabled": false,
  "kyc_required": false,
  "otc_enabled": true,
  "synthetic_enabled": true,
  "country_br_enabled": true,
  "country_mx_enabled": true,
  "country_co_enabled": true,
  "country_ar_enabled": true,
  "country_cl_enabled": true,
  "country_pe_enabled": true
}
```
- **Endpoints REST na API**:
  - `GET /api/v1/geo/resolve`: Detecta o país da requisição, valida status e retorna contexto (`country`, `allowed`, `defaultCurrency`, `defaultLocale`, `timezone`, `flags`).
  - `GET /api/v1/flags`: Retorna o mapa consolidado das 10 feature flags do sistema.
  - `PUT /api/v1/admin/flags/:flagKey`: Atualiza o valor de uma flag em runtime com autenticação RBAC de administrador e invalidação instantânea de cache no Redis via Pub/Sub.

---

## 2. Invariantes e Regras de Segurança (S-01 a S-06)

- **Anti-Spoofing Estrito (S-04)**: Headers de geolocalização não confiáveis são desconsiderados se não provierem de redes de proxy autorizadas.
- **Fail-Closed**: Se ocorrer falha simultânea de Redis e banco de dados, o sistema nega acesso a regiões desconhecidas para proteger a integridade do broker.
- **Zero Dinheiro Real**: A flag `payments_enabled` é mantida travada como `false` por padrão.

---

## 3. Passo a Passo de Implementação Cirúrgica

1. **Passo 2.1**: Estender o schema e migrations no PostgreSQL (`db/migrations/`) para suportar a tabela de flags centralizadas com as 10 chaves oficiais da especificação.
2. **Passo 2.2**: Atualizar `services/api/src/services/feature-flags.ts` para gerenciar as 10 chaves com cache Redis (`broker:system:feature_flags`) e TTL de 60s + invalidação atômica via canal Pub/Sub.
3. **Passo 2.3**: Atualizar `services/api/src/services/geoblock.ts` e `services/api/src/plugins/geoblock.ts` integrando a checagem das flags `country_{code}_enabled`.
4. **Passo 2.4**: Atualizar `services/websocket-gateway/src/index.ts` para verificar o handshake de conexão rejeitando origens desabilitadas com código 4403.
5. **Passo 2.5**: Criar rota `GET /api/v1/geo/resolve` e `GET /api/v1/flags`.

---

## 4. Bateria de Testes Mandatórios

### 4.1 Testes Unitários (`tests/unit/test-geoblock-flags.test.ts`)
- Resolução correta para cada um dos 6 países autorizados.
- Bloqueio imediato para países não autorizados (ex: `US`, `FR`, `DE`, `JP`, `CN`).
- Validação das 10 flags padrão.
- Chaveamento dinâmico de flag e leitura atualizada.

### 4.2 Testes de Segurança
- Anti-spoofing: Rejeição de tentativa de bypass com header malformado.
- RBAC: Usuário comum bloqueado ao tentar alterar flags.

### 4.3 Testes de Caos
- Queda de conexão com o Redis: o motor deve continuar operando com fallback resiliente para o PostgreSQL sem erros 500.
- Flap contínuo de flags em rajada de 1.000 requisições concorrentes sem inconsistência de estado.

---

## 5. Critério de Homologação do Gate (`GATE-F2-ETAPA-2`)
A Subetapa 2 está HOMOLOGADA quando:
- As 10 feature flags funcionam e comutam sem deploy.
- O geoblocking bloqueia países não suportados e países desativados via flag.
- Todos os testes unitários, de integração, segurança e caos passam com 100% de sucesso.
