# Subetapa 04 — Tradução Reativa Completa (i18n PT-BR ↔ ES) de Torneios e Arena Blitz

> **Agentes Alocados**: `surgical-frontend-agent`, `frontend-realtime-agent`, `binmax-brand-agent`, `chief-visual-director`, `qa-resilience-agent`, `regression-guardian-agent`
> **Skills**: `01-project-context`, `12-tokens-binmax`, `13-textos-es`, `17-mudanca-cirurgica`, `21-designer-senior-binmax`
> **Status**: CONCLUÍDA E VALIDADA (100% — `tournaments-arena-i18n.unit.test.tsx`: 10/10 passed)

---

## 1. Objetivo da Subetapa
Resolver a segunda metade do problema **"2 - Não está ocorrendo tradução"**:
Garantir que **todos os componentes de Torneios e da Arena Blitz** respondam em tempo real ao idioma selecionado (`pt-BR` ↔ `es-*`), eliminando 100% dos textos fixos em um único idioma ou misturados (PT+ES na mesma tela).

---

## 2. Componentes Cobertos Passo a Passo

### Passo 4.1 — Tradução de `TournamentModal`, `TournamentListView`, `TournamentCard`, `TournamentDetailView` e `tournaments-mock-data`
- Em [`tournaments-mock-data.ts`](../../../apps/web/src/components/tournaments/tournaments-mock-data.ts):
  - Fornecer helper `getLocalizedTournaments(locale)` (mantendo `MOCK_TOURNAMENTS` exportado para compatibilidade retroativa) que retorna descrições e regras em Português (`pt-BR`) ou Espanhol (`es-*`).
- Em [`TournamentListView.tsx`](../../../apps/web/src/components/tournaments/TournamentListView.tsx):
  - `Torneios` ↔ `Torneos`
  - `Compita com outros traders por prêmios em dinheiro real` ↔ `Compite con otros traders por premios en dinero real`
  - `Torneios semanais` ↔ `Torneos semanales`
  - `Cada torneio tem duração, regras e premiação próprias. Escolha o seu e opere normalmente — cada trade conta para o ranking.` ↔ `Cada torneo tiene su propia duración, reglas y premios. Elige el tuyo y opera normalmente — cada operación cuenta para el ranking.`
  - `Fechar torneios` ↔ `Cerrar torneos`
- Em [`TournamentCard.tsx`](../../../apps/web/src/components/tournaments/TournamentCard.tsx):
  - Badges: `AO VIVO` ↔ `EN VIVO`, `EM BREVE` ↔ `PRÓXIMAMENTE`, `ENCERRADO` ↔ `FINALIZADO`
  - Labels: `Termina em` ↔ `Termina en`, `Começa em` ↔ `Comienza en`, `Prêmio total` ↔ `Premio total`, `Entrada` ↔ `Entrada`, `GRÁTIS` ↔ `GRATIS`, `Participantes` ↔ `Participantes`
  - CTAs: `Participar →` ↔ `Participar →`, `Ver detalhes` ↔ `Ver detalles`, `Ver resultado` ↔ `Ver resultado`, `Inscrito ✓` ↔ `Inscrito ✓`
- Em [`TournamentDetailView.tsx`](../../../apps/web/src/components/tournaments/TournamentDetailView.tsx):
  - `Voltar para todos os torneios` ↔ `Volver a todos los torneos`
  - `Prêmio total` ↔ `Premio total`, `Entrada` ↔ `Entrada`, `Saldo inicial` ↔ `Saldo inicial`, `Recompra` ↔ `Recompra`, `Duração` ↔ `Duración`, `Participantes` ↔ `Participantes`
  - `Regras do torneio` ↔ `Reglas del torneo`
  - `Ranking em tempo real` ↔ `Ranking en tiempo real`, `Resultado final` ↔ `Resultado final`, `Traders ativos` ↔ `Traders activos`, `Finalizado` ↔ `Finalizado`
  - `Prêmios por posição` ↔ `Premios por posición`, `Posições` ↔ `Posiciones`, `Prêmio` ↔ `Premio`, `do pool` ↔ `del fondo`
  - Botões de ação: `Inscrever-se agora` ↔ `Inscribirse ahora`, `Inscrito ✓` ↔ `Inscrito ✓`, `Operar no Torneio →` ↔ `Operar en el Torneo →`

### Passo 4.2 — Tradução de [`TournamentsDrawer.tsx`](../../../apps/web/src/components/drawer/TournamentsDrawer.tsx) e [`TournamentsPage.tsx`](../../../apps/web/src/pages/TournamentsPage.tsx)
- Em `TournamentsDrawer.tsx`:
  - Padronizar 100% dos textos conforme `locale` (`Torneios` ↔ `Torneos`, `Abrir Hub de Torneios` ↔ `Abrir Hub de Torneos`, `Sprints Sit & Go · 15 min · Top 3 levam o pote` ↔ `Sprints Sit & Go · 15 min · Top 3 se llevan el bote`, `AO VIVO` ↔ `EN VIVO`, `EM BREVE` ↔ `PRÓXIMAMENTE`, `Prêmio total` ↔ `Premio total`, `Inscrito` ↔ `Inscrito`).
- Em `TournamentsPage.tsx`:
  - Traduzir todo o cabeçalho, filtros (`Todos os torneios` ↔ `Todos los torneos`, `Ao vivo` ↔ `En vivo`, `Em breve` ↔ `Próximos`, `Encerrados` ↔ `Finalizados`), cards de métricas (`Fundo de prêmios` ↔ `Fondo de premios`, `Taxa de entrada` ↔ `Cuota de entrada`, `Participantes`, `Tempo restante` ↔ `Tiempo restante`), regras e botões (`Inscrever-se no Torneio` ↔ `Unirse al Torneo`, `Inscrito — Operando` ↔ `Inscrito — Operando`).

### Passo 4.3 — Tradução Completa da Arena Blitz (`ArenaPage`, `ArenaRoom`, `ArenaLobby`, `ArenaBar`, `ArenaTicket`, `ArenaDialogs`, `Leaderboard`, `GhostAudit`, `ArenaLedger`)
- Criar dicionário tipado `apps/web/src/arena/arena-i18n.ts` com suporte completo a `pt-BR` e `es-*`:
  - [`ArenaPage.tsx`](../../../apps/web/src/pages/ArenaPage.tsx): `Torneios` ↔ `Torneos`, `Sala de Trading` ↔ `Sala de Trading`.
  - [`ArenaLobby.tsx`](../../../apps/web/src/arena/ArenaLobby.tsx): `15 minutos. T$ 1.000. O pódio leva o pote.` ↔ `15 minutos. T$ 1.000. El podio se lleva el bote.`, `Escolha sua sala` ↔ `Elige tu sala`, `Sala Bronze / Prata / Ouro` ↔ `Sala Bronce / Plata / Oro`, `Pote Total` ↔ `Bote Total`, `Vagas` ↔ `Cupos`, `Início` ↔ `Inicio`, `Faixa de premiação (ITM)` ↔ `Zona de premios (ITM)`, `Entrar por` ↔ `Entrar por`, `Como funciona` ↔ `Cómo funciona`, `Distribuição do pote` ↔ `Distribución del bote`, `Desafio Alpha Quant` ↔ `Desafío Alpha Quant`.
  - [`ArenaBar.tsx`](../../../apps/web/src/arena/ArenaBar.tsx): `Trocar sala` ↔ `Cambiar sala`, `Tempo restante` ↔ `Tiempo restante`, `Sua posição` ↔ `Tu posición`, `Prêmio atual` ↔ `Premio actual`, `Fora da faixa` ↔ `Fuera de premios`, `Conta torneio` ↔ `Cuenta torneo`, `Simular` ↔ `Simular`.
  - [`ArenaRoom.tsx`](../../../apps/web/src/arena/ArenaRoom.tsx): `Ranking` ↔ `Ranking`, `Robô` ↔ `Robot`, `Extrato` ↔ `Extracto`, `Na faixa de prêmio` ↔ `En zona de premios`, `Ordens na rodada` ↔ `Órdenes en la ronda`, `Ordem aberta` ↔ `Orden abierta`.
  - [`ArenaTicket.tsx`](../../../apps/web/src/arena/ArenaTicket.tsx): `Boleta de torneio` ↔ `Boleta de torneo`, `Ativo` ↔ `Activo`, `Valor da ordem` ↔ `Monto de la orden`, `Disponível` ↔ `Disponible`, `Rápido` ↔ `Rápido`, `Expiração` ↔ `Expiración`, `Retorno` ↔ `Retorno`, `Se acertar` ↔ `Si aciertas`, `Ordem em curso` ↔ `Orden en curso`, `Restam` ↔ `Quedan`, `Entrada` ↔ `Entrada`, `Atual` ↔ `Actual`, `ACIMA` ↔ `SUBE`, `ABAIXO` ↔ `BAJA`.
  - [`Leaderboard.tsx`](../../../apps/web/src/arena/Leaderboard.tsx), [`GhostAudit.tsx`](../../../apps/web/src/arena/GhostAudit.tsx), [`ArenaLedger.tsx`](../../../apps/web/src/arena/ArenaLedger.tsx), [`ArenaDialogs.tsx`](../../../apps/web/src/arena/ArenaDialogs.tsx): 100% traduzidos.

---

## 3. Especificação de Testes Obrigatórios da Subetapa 04
Arquivo de teste: `apps/web/src/arena/tournaments-arena-i18n.unit.test.tsx`

1. **Testes Unitários Bilíngues (PT-BR e ES-ES)**:
   - Verificar que `TournamentModal` (Lista, Card e Detalhe), `TournamentsDrawer`, `TournamentsPage` e `ArenaPage` (`ArenaLobby`, `ArenaRoom`, `ArenaBar`, `ArenaTicket`, `Leaderboard`, `GhostAudit`, `ArenaLedger`, `ArenaDialogs`) renderizam 100% em Português quando `locale="pt-BR"` e 100% em Espanhol quando `locale="es-ES"`.
2. **Teste de Estresse com Estado Ativo (Stress Test)**:
   - Iniciar uma rodada na `ArenaRoom`, abrir uma ordem `T$ 100` e alternar o idioma 100 vezes entre `pt-BR` e `es-ES` no meio da rodada — verificar que o saldo `T$`, o cronômetro, a ordem aberta e o ranking permanecem 100% intactos sem perda de ticks ou reset da partida!
3. **Teste de Segurança e Integridade Financeira (Security & Financial Test)**:
   - Verificar que a mudança de idioma nunca altera os valores numéricos de `entryFee`, `prizePool`, `virtualBalance` (`T$ 1.000,00`) ou `payoutRate` (85%).
4. **Teste de Caos (Chaos Test)**:
   - Renderização sob locale desconhecido (`fr-FR` ou `de-DE`) — cai suavemente para o idioma padrão sem quebrar nenhum componente da Arena ou de Torneios.
