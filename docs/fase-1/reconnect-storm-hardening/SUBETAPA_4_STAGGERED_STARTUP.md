# Subetapa 4: Staggered Startup (Início Escalonado Anti-Tempestade no Deploy)

**Orquestrador:** `tech-lead-orchestrator`  
**Agente Especialista:** `frontend-realtime-agent` & `backend-implementation-agent`  
**Agente Revisor:** `broker-architect-agent` & `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `05-resilience-patterns`, `06-testing-quality`  
**Invariantes:** V-11 (Connection Management) | Resiliência de Deploy

---

## 1. Escopo e Objetivos da Subetapa
Evitar que reinícios de aplicação, deploys ou atualizações de página em massa criem picos imediatos de handshake no milissegundo zero. Implementar o atraso inicial aleatório:
$$\text{delay\_inicial} = \text{random}(0, 10\text{s})$$
espalhando a primeira conexão de cada cliente/ativo ao longo dos primeiros 10 segundos.

---

## 2. Passos de Execução Obrigatórios (Mínimo de 6)

### Passo 4.1: Modelagem do Staggered Startup
- **Ação:** Criar módulo `apps/web/src/feed/staggered-startup.ts` definindo a política:
  * `MAX_INITIAL_DELAY_MS = 10000` (10 segundos)
  * Suporte a flag de bypass (`forceImmediate?: boolean`) para operações manuais do usuário ou testes pontuais.
- **Critério de Aceite:** Função `getStaggeredDelay(maxDelayMs = 10000, randomFn)` exportada e tipada.

### Passo 4.2: Integração com o Construtor do Feed
- **Ação:** Configurar `TradingFeedManager` para aplicar `getStaggeredDelay` apenas no arranque a frio (`initialConnect`), garantindo que conexões manuais do usuário não sofram atraso desnecessário.
- **Critério de Aceite:** O arranque automático distribui conexões no intervalo $[0, 10\text{s}]$.

### Passo 4.3: Teste de Dispersão no Deploy (100 Clientes Simultâneos)
- **Ação:** Simular 100 instâncias de navegadores abrindo simultaneamente após um deploy.
- **Critério de Aceite:**
  * O instante de conexão de cada cliente deve estar uniformemente distribuído entre 0 e 10 segundos.
  * O número médio de conexões por segundo não deve ultrapassar 15 no pior caso estatístico.

### Passo 4.4: Teste de Bypass Imediato
- **Ação:** Validar que quando o usuário clica expressamente em "Reconectar Agora" ou quando `forceImmediate = true`, o delay é exatamente 0ms.
- **Critério de Aceite:** Ação reativa humana tem latência imediata (< 5ms).

### Passo 4.5: Auditoria de Conflito com Heartbeat
- **Ação:** Assegurar que o delay inicial escalonado não interfira nos temporizadores normais de ping/pong do protocolo RFC 6455.
- **Critério de Aceite:** Nenhuma desconexão espúria por timeout antes do handshake.

### Passo 4.6: Execução Automatizada do Quality Gate
- **Ação:** Executar `node tests/test-subetapa-4-staggered-startup.mjs`.
- **Critério de Aceite:** 100% de aprovação comprovando a dispersão temporal do deploy.
