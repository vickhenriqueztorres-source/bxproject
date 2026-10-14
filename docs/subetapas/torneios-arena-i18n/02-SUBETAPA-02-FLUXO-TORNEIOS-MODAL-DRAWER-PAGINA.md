# Subetapa 02 — Correção Completa do Fluxo de Torneios (Modal, Card, Detalhe, Drawer e Página)

> **Agentes Alocados**: `surgical-frontend-agent`, `frontend-realtime-agent`, `financial-correctness-reviewer`, `security-reviewer`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `tournaments-flow.unit.test.tsx` + `tournament-visual-refactor-certification.unit.test.tsx`: 35/35 passed)

---

## 1. Objetivo da Subetapa
Resolver integralmente o problema **"1 - Aba de torneios está quebrada"**:
1. **Conectar a `TournamentModal` à `Arena Blitz`**:
   - Adicionar em [`TournamentListView.tsx`](../../../apps/web/src/components/tournaments/TournamentListView.tsx) o banner/card interativo de acesso imediato à **Arena Blitz · 15 min** (`data-testid="modal-open-arena-blitz"`), permitindo que o trader abra a Arena Blitz diretamente a partir da Modal de Torneios (além do menu lateral e da `TournamentsDrawer`).
2. **Eliminar o Beco sem Saída ("Dead-End") em [`TournamentDetailView.tsx`](../../../apps/web/src/components/tournaments/TournamentDetailView.tsx) e [`TournamentCard.tsx`](../../../apps/web/src/components/tournaments/TournamentCard.tsx)**:
   - Em `TournamentDetailView.tsx`, adicionar barra de ação institucional no cabeçalho do torneio com:
     - Status de inscrição (`Inscrito ✓` / `Inscrever-se gratuitamente` / `Inscrever-se por $X`).
     - Botão primário de ação (`data-testid="tournament-detail-action-btn"`):
       - Para torneios `live`: se ainda não inscrito, realiza a inscrição idempotente (`onJoinTournament(tournament.id)`) com feedback imediato; se já inscrito, botão **"Operar no Torneio →"** (`data-testid="tournament-enter-trading-btn"`) que fecha a modal e leva o usuário para operar (ou abre a Arena Blitz quando aplicável).
       - Para torneios `upcoming`: botão **"Reservar vaga / Inscrever-se"** (`onJoinTournament(tournament.id)`), mudando para **"Vaga Garantida ✓"** após inscrição.
       - Para torneios `ended`: badge **"Torneio Encerrado"** com visualização auditável do resultado final.
3. **Sincronizar Estado de Inscrição entre `TournamentModal`, `TournamentsDrawer` e `TournamentsPage`**:
   - Criar store/helper puro e resiliente em `apps/web/src/components/tournaments/tournament-enrollment.ts` que gerencia as inscrições ativas (`joinedTournamentIds`) em memória + `localStorage` (`binmax:joined-tournaments:v1`) com validação de schema e sincronização por evento customizado (`binmax:tournaments-updated`).
   - Em [`TournamentsPage.tsx`](../../../apps/web/src/pages/TournamentsPage.tsx), se a chamada `getTournaments()` falhar (ou retornar formato `/api/v1/arena/tournaments`), realizar fallback transparente e resiliente para o catálogo de torneios da plataforma (`MOCK_TOURNAMENTS`), garantindo que a página `/tournaments` nunca fique vazia ou quebrada e permita inscrição funcional.

---

## 2. Passo a Passo de Implementação Cirúrgica

### Passo 2.1 — Helper de Inscrição Idempotente e Seguro (`tournament-enrollment.ts`)
- Implementar leitura/escrita segura de IDs de torneios inscritos (`getJoinedTournamentIds()`, `joinTournamentLocal(id)`, `isTournamentJoined(id)`).
- Validar estritamente os IDs permitidos (string alfanumérica/hífen `<= 64` chars) para impedir injeção ou corrupção de storage.
- Prevenir dupla inscrição (idempotência estrita: chamar `joinTournamentLocal('copa-binmax')` $N$ vezes mantém exatamente 1 registro).

### Passo 2.2 — Evolução de `TournamentModal.tsx`, `TournamentListView.tsx`, `TournamentCard.tsx` e `TournamentDetailView.tsx`
- Em [`TournamentModal.tsx`](../../../apps/web/src/components/tournaments/TournamentModal.tsx):
  - Gerenciar `joinedIds` sincronizado com `tournament-enrollment.ts`.
  - Passar `joinedIds`, `onJoin(id)`, `onOpenArena()` e `onStartTrading(id)` para `TournamentListView` e `TournamentDetailView`.
- Em [`TournamentListView.tsx`](../../../apps/web/src/components/tournaments/TournamentListView.tsx):
  - Exibir card destacado **Arena Blitz · 15 min** (`data-testid="modal-open-arena-blitz"`) com botão rápido para entrar nos Sprints Sit & Go.
  - Exibir badge `Inscrito ✓` / `Inscrito` nos cards em que o trader já participa.
- Em [`TournamentDetailView.tsx`](../../../apps/web/src/components/tournaments/TournamentDetailView.tsx):
  - Adicionar barra de ação funcional com botão de Inscrição (`data-testid="tournament-detail-join-btn"`) e botão de Operar (`data-testid="tournament-detail-trade-btn"`), além de refletir o usuário logado/demo na tabela de ranking quando inscrito!

### Passo 2.3 — Sincronização com `TournamentsDrawer.tsx` e `TournamentsPage.tsx`
- Em [`TournamentsDrawer.tsx`](../../../apps/web/src/components/drawer/TournamentsDrawer.tsx), ler `joinedIds` de `tournament-enrollment.ts` e permitir clicar em qualquer torneio para abrir seus detalhes na `TournamentModal`.
- Em [`TournamentsPage.tsx`](../../../apps/web/src/pages/TournamentsPage.tsx), usar fallback resiliente para `MOCK_TOURNAMENTS` caso a API não responda ou retorne lista vazia, e sincronizar inscrições com `tournament-enrollment.ts`.

---

## 3. Especificação de Testes Obrigatórios da Subetapa 02
Arquivo de teste: `apps/web/src/components/tournaments/tournaments-flow.unit.test.tsx`

1. **Testes Unitários e Funcionais**:
   - Abertura da `TournamentModal`, listagem dos 3 torneios (`Copa BINMAX`, `Sprint Semanal`, `Campeonato Mensal`) + card `Arena Blitz · 15 min`.
   - Clicar em `Participar →` abre `TournamentDetailView` contendo o botão funcional de inscrição/operação (`tournament-detail-join-btn` / `tournament-detail-trade-btn`).
   - Clicar em `Inscrever-se` registra a participação, exibe confirmação visual (`Inscrito ✓`), adiciona o trader ao ranking do torneio e sincroniza com `TournamentsDrawer` e `TournamentsPage`.
   - Clicar no card `Arena Blitz` dentro da modal fecha a modal e navega para `/arena`.
2. **Teste de Estresse (Stress Test)**:
   - 500 disparos concorrentes de `joinTournamentLocal('copa-binmax')` e alternância rápida entre lista e detalhes de 3 torneios — garante idempotência absoluta (sem duplicatas no ranking ou no storage).
3. **Teste de Segurança (Security Test)**:
   - Injeção de payload malicioso em `localStorage.setItem('binmax:joined-tournaments:v1', '{"__proto__":{"polluted":true}}')` ou array com scripts `["<img src=x onerror=alert(1)>"]` — o validador rejeita entradas inválidas e limpa/ignora payloads maliciosos.
4. **Teste de Caos e Resiliência (Chaos Test)**:
   - Simulação de falha de rede (`500 Internal Server Error` / `NetworkError`) na API `/api/v1/tournaments` ao carregar `TournamentsPage.tsx` e ao clicar em `joinTournament` — o fallback local garante que os torneios são exibidos e a inscrição demo/local funciona sem travar a UI.
5. **Verificação de Regressão**:
   - Todos os testes unitários existentes da aplicação continuam 100% verdes.
