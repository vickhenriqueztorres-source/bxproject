# Subetapa 04 — Arena Blitz / Torneios: Trava de Segurança de Sessão Ativa, Persistência e Correção do Botão Voltar (Imagens 3 e 4)

**Agentes Alocados**: `frontend-realtime-agent`, `compliance-risk-reviewer`, `surgical-frontend-agent`, `qa-resilience-agent`, `regression-guardian-agent`  
**Skills Ativadas**: `01-project-context`, `02-financial-invariants`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`  
**Status**: Planejada — Execução após validação 100% da Subetapa 03

---

## 1. Diagnóstico Preciso da Causa Raiz (Imagens 3 e 4)

1. **Perda / Reset da Sessão do Torneio ao Sair ou Atualizar (`use-arena.ts:206-209`)**:
   - Em [`use-arena.ts:206-209`](file:///d:/brokerproject/apps/web/src/arena/use-arena.ts#L206-L209), o estado completo da partida (`store.current = emptyStore(options)`) fica apenas em memória volátil (`useRef`) dentro da instância montada de `ArenaPage`.
   - Se o cliente clicar em qualquer item da barra lateral (`Torneios`, `Operar`, etc.), clicar no botão voltar ou atualizar a página, o componente desmonta, o `store.current` é destruído e o torneio do cliente reinicia ou acaba!
2. **Ausência de Trava de Segurança em Torneio Ativo (`ArenaPage.tsx`)**:
   - Na Imagem 3, o cliente está dentro da Arena Blitz e pode clicar livremente em `"Torneios"` na barra lateral esquerda (`SidebarDock`), em `"← Torneios"` no topo esquerdo, na logo ou em `"Sala de Trading →"` sem nenhum bloqueio ou confirmação, saindo acidentalmente da partida em andamento.
3. **Redirecionamento Incorreto do Botão `"← Voltar / Torneios"` (`ArenaPage.tsx:84`)**:
   - Na linha 84 de `ArenaPage.tsx`:
     ```tsx
     onClick={() => navigate('/torneos')}
     ```
   - Clicar no botão superior esquerdo redireciona incondicionalmente para `/torneos` (`TournamentsPage.tsx` — Imagem 4, uma página externa com layout institucional `SecondaryLayout`), o que:
     - Durante uma partida ativa (`countdown`, `running`, `settling`), arranca o usuário da sala sem trava;
     - Quando o usuário veio da Sala de Trading (`/operar`) ou quer sair de uma partida para o Lobby da própria Arena (`/arena`) ou voltar para a Sala de Trading (`/operar`), joga-o na tela errada (Imagem 4).

---

## 2. Passo a Passo Cirúrgico da Implementação

### Passo 4.1 — Persistência Automática e Reidratação Segura da Sessão Ativa (`use-arena.ts`)
- Criar uma camada de persistência resiliente em `sessionStorage` (`ARENA_SESSION_STORAGE_KEY = 'binmax_arena_active_session_v1'`):
  - Quando `useArena(options)` é inicializado **sem overrides estáticos de teste** (`!options?.initialStage`), verificar se existe uma sessão ativa válida (`stage === 'countdown' || stage === 'running' || stage === 'settling'`) salva em `sessionStorage` cujo tempo de término (`startsAt + ARENA.durationMs + 60_000`) ainda seja válido.
  - Validar rigorosamente o schema do JSON salvo (proteção contra dados corrompidos ou adulteração no storage: validar `stage`, `roomIndex`, `tier`, `points`, `startsAt`, `rivals`, `bot`, `positions`, `trades`, `ledger`).
  - Se válido, reidratar `store.current` preservando exatamente o saldo `T$`, posições abertas, histórico de ordens, ranking de rivais, bot e cronômetro oficial!
  - A cada `commit()` enquanto `stage` for `'countdown' | 'running' | 'settling'` (e quando não for modo de teste estático `options?.initialStage`), sincronizar o snapshot sanitizado no `sessionStorage`.
  - Quando `leave()` for chamado explicitamente pelo usuário (abandono confirmado) ou quando uma nova partida for iniciada no lobby, limpar/atualizar a chave no `sessionStorage`.

### Passo 4.2 — Trava de Segurança de Torneio Ativo (`ArenaExitLockDialog` em `ArenaPage.tsx`)
- Quando o torneio estiver ativo (`const isLive = arena.s.stage === 'countdown' || arena.s.stage === 'running' || arena.s.stage === 'settling'`):
  1. **Interceptação de Tentativas de Saída**:
     - Clique no botão superior esquerdo (`data-testid="arena-back-to-tournaments"`), clique na logo (`BinmaxLogo`), clique em `"Sala de Trading →"` (`data-testid="arena-go-traderoom"`), ou clique nos itens de saída da `SidebarDock` (`Operar`, `Torneios`) **NÃO** tiram o usuário da partida imediatamente.
     - Em vez disso, abrem o modal de trava **`ArenaExitLockDialog` (`data-testid="arena-exit-lock-dialog"`)**.
     - Registrar também listener `beforeunload` enquanto `isLive === true` para proteger contra fechamento acidental da aba do navegador.
  2. **Opções Claras e Seguras no Modal de Trava (`ArenaExitLockDialog`)**:
     - Exibe o status atual da partida (Sala, Saldo `T$` atual, Tempo Restante e Posição no Ranking) e avisa:
       *"Você está em um torneio ativo na Arena Blitz. Para não prejudicar sua disputa, sua sessão está protegida."*
     - **Botão Primário (`data-testid="arena-lock-stay-btn"`)**: **"Continuar no Torneio"** — fecha o modal e mantém o cliente operando na Arena.
     - **Botão Secundário (`data-testid="arena-lock-pause-navigate-btn"`)**: **"Ir para Sala de Trading (Manter Torneio Salvo)"** — navega para `/operar` (ou destino solicitado) **sem destruir a sessão**, mantendo o estado salvo em `sessionStorage` para que o cliente possa voltar à `/arena` e retomar a mesma partida!
     - **Botão Destrutivo Discreto (`data-testid="arena-lock-abandon-btn"`)**: **"Encerrar e Voltar ao Lobby da Arena"** — chama `arena.leave()` (limpando a sessão ativa) e retorna ao Lobby da Arena Blitz (`/arena`) sem jogar o usuário para a tela externa da Imagem 4.

### Passo 4.3 — Correção Cirúrgica do Botão Voltar (`data-testid="arena-back-to-tournaments"`)
- Em `ArenaPage.tsx`:
  - **Quando `isLive` (`countdown`, `running`, `settling`)**:
    - O botão `data-testid="arena-back-to-tournaments"` aciona a **Trava de Segurança (`requestProtectedExit('lobby')`)**, impedindo saída acidental e permitindo voltar ao Lobby da Arena se confirmado, em vez de redirecionar para `/torneos` (Imagem 4).
  - **Quando no Lobby (`stage === 'lobby'`) ou Encerrado (`stage === 'ended'`)**:
    - Se `stage === 'ended'`, clicar em voltar chama `arena.leave()` e retorna ao Lobby da Arena Blitz (`stage = 'lobby'`).
    - Se `stage === 'lobby'`, clicar no botão voltar retorna de forma limpa para a **Sala de Trading (`/operar`)** (ou executa `arena.leave()`), evitando enviar o trader para a página institucional externa `/torneos` (Imagem 4).
    - Nota: Mantemos o texto traduzido e o `data-testid="arena-back-to-tournaments"` compatíveis com os testes de i18n existentes (`tournaments-arena-i18n.unit.test.tsx`).

---

## 3. Plano de Testes (Unitários, Estresse, Segurança e Caos)

Arquivo de teste dedicado: `apps/web/src/arena/__tests__/subetapa-04-arena-session-lock-persistence.unit.test.tsx`

1. **Teste Unitário 4.1 (Persistência e Reidratação de Sessão Ativa no `sessionStorage`)**:
   - Inicia um torneio (`join(1, 'TOP_10')`), executa ordens, desmonta o componente (simulando refresh/navegação acidental) e monta uma nova instância de `useArena()`: comprova que a sessão reidrata em `stage === 'countdown' / 'running'` com o mesmo `roomIndex`, `tier`, `points`, `positions` e `ledger` sem perder nem reiniciar a partida!
2. **Teste Unitário 4.2 (Trava de Segurança `ArenaExitLockDialog` e Bloqueio de Saída Acidental)**:
   - Comprova que em `stage === 'running'`, acionar saída abre a trava `data-testid="arena-exit-lock-dialog"` com os botões `arena-lock-stay-btn`, `arena-lock-pause-navigate-btn` e `arena-lock-abandon-btn`, e que o cliente não perde a sessão ao clicar por engano em Torneios / Voltar.
3. **Teste Unitário 4.3 (Correção do Botão Voltar sem Redirecionar para Imagem 4 `/torneos`)**:
   - Verifica que o botão `arena-back-to-tournaments` em partida ativa aciona a trava de segurança (e se confirmado volta ao Lobby da Arena), e no Lobby retorna para `/operar` (Sala de Trading), nunca jogando o cliente na página externa `/torneos` (Imagem 4).
4. **Teste de Segurança 4.4 (Anti-Tampering e Validação de Schema do `sessionStorage`)**:
   - Injeta payloads adulterados/corrompidos em `sessionStorage` (`points: 999999999`, `points: NaN`, JSON inválido, tipos trocados, `roomIndex: 999`, XSS em IDs) e comprova que o validador rejeita ou sanitiza limites inválidos sem quebrar a aplicação e sem permitir inflação ilegal de pontos além dos limites matemáticos da engine.
5. **Teste de Caos & Estresse 4.5 (200 Ciclos de Reidratação + Falha de Quota de Storage)**:
   - Simula `sessionStorage.setItem` lançando `QuotaExceededError` / `SecurityError` e executa 200 ciclos rápidos de persistência/reidratação em `< 200ms`, garantindo resiliência total (zero crash mesmo com storage bloqueado pelo navegador).
