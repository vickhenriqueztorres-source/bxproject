# SUBETAPA 3: REDE DE DOMÍNIOS ESPELHO & ROTAÇÃO RESILIENTE A CENSURA DNS

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `backend-implementation-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-REG-03`

---

## 1. Objetivo e Escopo

Construir a infraestrutura e a lógica de **Rotação Dinâmica de Domínios Espelho (Domain Rotation Engine)**:
1. **Resiliência a Ordens Judiciais e Bloqueios de DNS por Teles (ex.: Anatel no Brasil)**:
   - Prover rede de múltiplos domínios espelho por país da Zona Amarela e rotação automática ou administrativa com propagação sub-segundo.
2. **Preservação Contínua de Sessão e Estado do Trader**:
   - Manter banco de dados, Redis, ledger, tokens JWT de autenticação e conexões WebSocket completamente intactos durante a migração para o domínio seguinte.
   - Reconexão transparente do cliente frontend para o próximo espelho saudável, utilizando o mecanismo de catch-up sequencial de ticks (`lastSequence`).
3. **Endpoints de Governança e Descoberta de Espelhos**:
   - `GET /api/v1/geo/mirrors/active`: endpoint leve em CDN/Edge que retorna a lista ordenada de espelhos alternativos para o país do usuário.
   - `POST /api/v1/admin/mirrors/rotate`: endpoint restrito (apenas role `ADMIN`) para acionar rotação imediata de um domínio (marcá-lo como `BLOCKED` e ativar o próximo `STANDBY` da fila de prioridade).
   - `POST /api/v1/admin/mirrors/health-check`: probe em lote para verificar a alcançabilidade e tempo de resposta de cada espelho.

---

## 2. Passo a Passo de Implementação

### 2.1 Serviço de Gerenciamento de Espelhos (`services/api/src/services/mirror-domains.ts`)
- `getActiveMirror(countryCode: string): Promise<MirrorDomain>`: busca o espelho ativo no Redis; se ausente, consulta o Postgres com fallback para o espelho global.
- `rotateDomain(blockedDomain: string, countryCode?: string): Promise<{ previous: string; current: string }>`:
  - Transação atômica no PostgreSQL marcando o domínio anterior como `BLOCKED`.
  - Ativação do domínio `STANDBY` com maior prioridade para aquele país.
  - Atualização instantânea da chave de cache no Redis (`geo:mirrors:{country}`).
  - Publicação de evento de broadcast no canal Redis Pub/Sub `system:domain_rotated` para avisar todos os nós de API e Gateways.
- `registerHealthCheckResult(domainName: string, latencyMs: number, isAlive: boolean): Promise<void>`.

### 2.2 Rotas Administrativas e Públicas de Espelhos (`services/api/src/routes/mirrors.ts`)
- `GET /api/v1/geo/mirrors`: lista pública com cache HTTP rápido dos espelhos saudáveis disponíveis por região.
- `POST /api/v1/admin/mirrors`: cadastro de novos domínios reservas (exclusivo para administradores).
- `POST /api/v1/admin/mirrors/rotate`: execução de rotação forçada (exclusivo para administradores).
- `GET /api/v1/admin/mirrors`: visão operacional de todos os domínios (status, latência, última checagem).

### 2.3 Handler de Catch-up e Resiliência no WebSocket Gateway
- Quando o cliente se reconecta a partir de um novo domínio espelho, ele envia a mensagem `{ "action": "catchup", "symbol": "...", "lastSequence": "..." }`.
- O WebSocket Gateway atende a requisição e devolve os ticks perdidos durante a migração de DNS sem lacuna no gráfico de velas.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários de Rotação
- Validar transição de status: `STANDBY` -> `ACTIVE`, e `ACTIVE` -> `BLOCKED`.
- Validar ordem de prioridade: o domínio de menor índice de prioridade deve ser promovido primeiro.
- Validar invalidação imediata de cache no Redis.

### 3.2 Testes de Segurança (Security Reviewer)
- **S-01 / RBAC Estrito**: Tentar chamar `/api/v1/admin/mirrors/rotate` sem token JWT ou com token de usuário comum (`USER`). Deve retornar `403 Forbidden` ou `401 Unauthorized`.
- **S-02 / Prevenção de SSRF e Open Redirect**: Validar que domínios inseridos pertencem a sufixos autorizados da corretora e rejeitar URLs arbitrárias externas.

### 3.3 Testes de Estresse
- Rotação sob concorrência de 1.000 requisições simultâneas por segundo: nenhuma requisição deve receber erro 500 durante a troca de chaves atômicas.

### 3.4 Testes de Caos
- **Simulação de Censura Anatel / DNS Blackhole**:
  - Derrubar virtualmente o domínio primário brasileiro `app.nomedominio-br1.com`.
  - Disparar a rotação para `app.nomedominio-br2.com`.
  - Validar que o cliente recupera a comunicação, o token JWT continua válido, as ordens pendentes são liquidadas sem interferência e o WebSocket restabelece a subscrição com catch-up de ticks.

---

## 4. Critérios de Aceite para Fechamento do Gate (GATE-REG-03)
1. [ ] Domínios espelho comutados em tempo real via `DomainRotationService` em menos de 100ms.
2. [ ] Evento de rotação publicado via Pub/Sub do Redis para nós distribuídos.
3. [ ] Endpoint de auditoria administrativa protegido por RBAC.
4. [ ] Clientes conseguem consultar espelhos ativos via `/api/v1/geo/mirrors`.
5. [ ] Script de teste `tests/test-reg-subetapa-3-mirror-rotation.mjs` executado e aprovado com 100% de sucesso.
