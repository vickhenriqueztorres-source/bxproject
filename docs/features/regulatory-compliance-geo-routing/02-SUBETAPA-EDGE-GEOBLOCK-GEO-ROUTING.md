# SUBETAPA 2: EDGE GEOBLOCKING & MOTOR DE GEO-ROUTING REGIONAL

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-REG-02`

---

## 1. Objetivo e Escopo

Construir o middleware e os serviços de borda para:
1. **Detecção e Classificação de Risco Regulatória no Edge/Middleware**:
   - Extração confiável e higienização estrita de `CF-IPCountry`, `X-Country-Code`, `CF-Connecting-IP`, ASN (`CF-IPASN`).
   - Classificação imediata na primeira requisição HTTP ou no handshake do WebSocket Gateway em uma das 3 Zonas: `RED`, `YELLOW`, `GREEN`.
2. **Hard Geo-block Imediato para a Zona Vermelha**:
   - Para requisições originadas de países da Zona Vermelha (`US`, `CA`, `GB`, `AU`, `IL`, `JP` e membros da `EU` como `DE`, `FR`, `IT`, `ES`, `NL`, etc.):
     - Resposta HTTP imediata: `403 Forbidden` com payload padronizado:
       ```json
       {
         "error": "GEO_BLOCKED_RED_ZONE",
         "message": "Access prohibited due to strict regulatory restrictions in your jurisdiction.",
         "country": "US",
         "zone": "RED",
         "regulatory_authority": "CFTC/SEC"
       }
       ```
     - Rejeição imediata no Handshake do WebSocket com código de encerramento seguro `4403` e razão `"Red zone regulatory block"`.
3. **Geo-Routing Dinâmico para Zona Amarela e Verde**:
   - Se o IP é Brasil (`BR`), calcula o domínio espelho preferencial ativo (ex.: `app.nomedominio-br1.com`).
   - Se o IP é Índia (`IN`), calcula o domínio espelho preferencial ativo (ex.: `app.nomedominio-in.com`).
   - Se o IP é Zona Verde/Outro permitido, aponta para o domínio espelho global (`app.nomedominio-global.com`).
   - Injeção de headers de controle de rota: `X-Regulatory-Zone`, `X-Target-Mirror`, `X-Country-Code`.
   - Endpoint de detecção de rota: `GET /api/v1/geo/route-check`.

---

## 2. Passo a Passo de Implementação

### 2.1 Serviço de Classificação Regulatória (`services/api/src/services/regulatory-zones.ts`)
- Carrega e mantém em cache Redis (com fallback in-memory) o catálogo de jurisdições regulatórias.
- Método `classifyCountry(code: string): RegulatoryClassification`.
- Método `isHardBlocked(code: string): boolean`.
- Método `getPreferredMirrorForCountry(countryCode: string): Promise<string>`.

### 2.2 Middleware / Plugin Fastify de Geo-Routing (`services/api/src/plugins/regulatory-routing.ts`)
- Substitui/estende o hook de entrada do Fastify.
- Aplica o Hard Geo-block para rotas operacionais e públicas caso o país pertença à Zona Vermelha (com isenção de rotas de documentação pública ou health check).
- Injeta `request.regulatoryContext` contendo zona, país, autoridade reguladora e espelho sugerido.

### 2.3 Hard Geo-block no WebSocket Gateway (`services/websocket-gateway/src/index.ts`)
- Durante o evento de conexão/upgrade WebSocket:
  - Extrai os cabeçalhos de país.
  - Verifica se o país é Zona Vermelha.
  - Se for Zona Vermelha, aborta a conexão imediatamente com `socket.close(4403, "Red zone regulatory block")`.

### 2.4 Endpoint de Checagem de Rota (`services/api/src/routes/geo.ts`)
- `GET /api/v1/geo/route-check`: retorna a classificação da conexão do usuário, a zona de risco e a URL espelho sugerida para redirecionamento.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários de Classificação
- Testar que cada um dos países da Zona Vermelha (`US`, `CA`, `GB`, `DE`, `FR`, `IT`, `ES`, `AU`, `IL`, `JP`) é classificado como `RED` e `isHardBlocked == true`.
- Testar que os países da Zona Amarela (`BR`, `MX`, `IN`, `ID`, `TH`, `ZA`, `NG`, `TR`, `PH`) são classificados como `YELLOW` e `isHardBlocked == false`.
- Testar que os países da Zona Verde (`KM`, `VC`, `SC`, `VU`, `CO`, `AR`, `CL`, `PE`) são classificados como `GREEN` e `isHardBlocked == false`.

### 3.2 Testes de Segurança (Security Reviewer)
- **Anti-Spoofing de Headers**: Enviar headers contendo payloads de injeção (`US; SELECT 1`, espaços em branco, tags HTML). O sistema deve sanitizar e classificar de forma segura.
- **Bypass de Proxy**: Testar cabeçalhos múltiplos `X-Forwarded-For`. Garantir que a extração priorize cabeçalhos confiáveis da CDN (`cf-ipcountry`).
- **Validação de Handshake WS**: Conectar cliente WebSocket simulando IP dos Estados Unidos e Reino Unido, comprovando que o socket é fechado com código 4403 em < 10ms.

### 3.3 Testes de Estresse
- Carga de 10.000 requisições simultâneas de resolução de rota com latência P99 < 2ms graças ao cache Redis / LRU.

### 3.4 Testes de Caos
- Derrubada simulada do Redis: comprovar que o `RegulatoryZoneService` não falha (não dá erro 500) e realiza fallback síncrono para a base PostgreSQL mantendo o bloqueio da Zona Vermelha ativo.

---

## 4. Critérios de Aceite para Fechamento do Gate (GATE-REG-02)
1. [ ] Requisições da Zona Vermelha recebem HTTP 403 `GEO_BLOCKED_RED_ZONE` imediatamente.
2. [ ] Handshake WebSocket de clientes de Zona Vermelha é encerrado com código 4403.
3. [ ] Requisições de Zona Amarela recebem headers `X-Regulatory-Zone: YELLOW` e espelho regional mapeado.
4. [ ] Requisições de Zona Verde operam normalmente com rota global.
5. [ ] Script de teste `tests/test-reg-subetapa-2-edge-georoute.mjs` executado com 100% de aprovação.
