# SUBETAPA 5: INTEGRAÇÃO FRONTEND, FAILOVER DE ESPELHOS & PAINEL ADMIN

**Orquestrador Chefe:** `tech-lead-orchestrator`  
**Agente Executor:** `frontend-realtime-agent`  
**Agentes Revisores e Auditores:** `broker-architect-agent`, `security-reviewer`, `qa-resilience-agent`, `post-implementation-verifier`  
**Quality Gate:** `GATE-REG-05`

---

## 1. Objetivo e Escopo

Implementar a camada visual e de resiliência no cliente (`apps/web`) e no painel administrativo (`apps/admin`):
1. **Interceptor de Rede Resiliente e Failover de Domínios Espelho no Web Client**:
   - Mecanismo cliente que detecta falhas de rede / bloqueio de DNS (ex.: erro `ERR_NAME_NOT_RESOLVED`, timeout de conexão ao domínio primário).
   - Consulta a lista local ou endpoint de bootstrap de espelhos alternativos para o país do usuário e comuta automaticamente as chamadas REST e o WebSocket para o próximo espelho saudável sem deslogar o usuário ou perder os gráficos.
2. **Tela Informativa de Bloqueio por Zona Vermelha (Geoblocked Compliance Modal/Screen)**:
   - Exibição de aviso claro de conformidade regulatória para acessos detectados da Zona Vermelha (`US`, `CA`, `GB`, `EU`, `AU`, `IL`, `JP`), informando a autoridade reguladora local e impedindo qualquer interação com a plataforma.
3. **Fluxo de KYC Progressivo na UI**:
   - Indicador de Tier atual do usuário (`Tier 0` com barra de limite restante de $300).
   - Modal de upgrade para `Tier 1` com envio de documento e feedback imediato de aprovação ou rejeição regulatória.
4. **Painel Admin de Domínios Espelho e Zonas Regulatórias (`apps/admin`)**:
   - Visualização do status da rede de espelhos por país (`ACTIVE`, `STANDBY`, `BLOCKED`).
   - Botão de ação rápida para rotação forçada de domínio em caso de notificação ou bloqueio por órgão regulador.

---

## 2. Passo a Passo de Implementação

### 2.1 Módulo de Resiliência de Conexão no Frontend (`apps/web/src/services/mirror-client.ts`)
- Mantém lista ordenada de domínios espelho por país no `localStorage` como fallback offline.
- Interceptor do `fetch` que, ao detectar erro de conexão persistente com o endpoint atual, rotaciona a `baseURL` para o próximo espelho da lista e retenta a requisição.
- Atualiza o endereço do WebSocket (`ws://` / `wss://`) disparando reconexão transparente com catch-up.

### 2.2 Componente de Bloqueio de Zona Vermelha (`apps/web/src/components/RegulatoryBlockedScreen.tsx`)
- Detecta resposta de erro `GEO_BLOCKED_RED_ZONE`.
- Renderiza interface polida e institucional informando o bloqueio por razões de compliance internacional.

### 2.3 Componente de Status de KYC e Upgrade (`apps/web/src/components/KYCTierBadge.tsx`)
- Exibe o badge de nível de verificação e formulário simples de envio de documento para Tier 1 com validação no cliente e tratamento de erros.

### 2.4 Painel Administrativo de Espelhos (`apps/admin/src/pages/RegulatoryMirrorsPage.tsx`)
- Tabela com todos os domínios registrados, status, latência e país alvo.
- Botão "Rotacionar Domínio" que dispara `POST /api/v1/admin/mirrors/rotate` e atualiza a interface via polling ou WebSocket.

---

## 3. Matriz de Testes

### 3.1 Testes Unitários de Componentes
- Testar que `RegulatoryBlockedScreen` renderiza o nome do país e autoridade reguladora corretamente.
- Testar que o cliente de espelhos seleciona o domínio prioritário e sabe comutar em caso de erro de rede.

### 3.2 Testes de Resiliência de UI
- Simular simulação de bloqueio da rede durante sessão ativa de trading:
  - O cliente deve realizar a transição para o espelho reserva em < 2 segundos.
  - O gráfico deve solicitar catch-up e continuar plotando velas sem congelar.

### 3.3 Testes de Segurança de UI
- Garantir que o modal de bloqueio da Zona Vermelha não pode ser fechado por manipulação simples de CSS ou clique fora do modal.

---

## 4. Critérios de Aceite para Fechamento do Gate (GATE-REG-05)
1. [ ] Telas e mensagens de bloqueio de Zona Vermelha renderizam sem falhas.
2. [ ] Cliente Web suporta failover para domínios espelhos sem perda de credenciais ou estado.
3. [ ] Painel Admin exibe a lista de domínios espelho e permite rotação em runtime.
4. [ ] Script de validação `tests/test-reg-subetapa-5-frontend-admin.mjs` executado com 100% de aprovação.
