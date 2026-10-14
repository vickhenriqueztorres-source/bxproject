# Plano Geral do Orquestrador — Integração Menu Arena, Correção da Aba de Torneios e Tradução Reativa (i18n PT/ES)

> **Orquestrador**: `tech-lead-orchestrator` (conforme [`ORCHESTRATOR.md`](../../../ORCHESTRATOR.md) e [`AGENTS.md`](../../../AGENTS.md))
> **Regra de Ouro**: NUNCA implementar nada sem testes robustos (unitários, estresse, segurança, caos e regressão). NUNCA quebrar nada funcional. Avanço estritamente sequencial (Subetapa $N+1$ só inicia após a Subetapa $N$ estar 100% validada, verde e segura).
> **Status Global**: CONCLUÍDO E CERTIFICADO (100% — 8/8 Subetapas Concluídas · 11 Suítes / 95 Testes Aprovados)

---

## 1. Seleção de Agentes e Skills pelo Orquestrador

### 1.1 Pool de Workers Ativados (`AGENTS.md`)
| Agente | Papel na Operação | Permissão |
|---|---|---|
| **`codebase-mapper-agent` (`mapeador`)** | Mapeamento cirúrgico de evidências (`arquivo:linha`) na Sidebar, Modal/Drawer/Página de Torneios, Arena Blitz e motor i18n, delimitando zonas sensíveis. | `read-only` |
| **`surgical-frontend-agent` (`cirurgiao`)** | Execução de mudanças cirúrgicas com diff mínimo em `apps/web/src/**`, preservando props, `data-testid`s e contratos de estado. | `write-code` (`apps/web/**`) |
| **`frontend-realtime-agent`** | Integração de estado reativo entre `SidebarDock`, `TournamentModal`, `TournamentsDrawer`, `TournamentsPage`, `ArenaPage` e `I18nProvider`. | `write-code` (`apps/web/**`) |
| **`binmax-brand-agent` (`marca-binmax`)** | Auditoria de microcopy institucional em Português (`pt-BR`) e Espanhol Neutro (`es-*`), tipografia `tabular-nums` e tokens Turbo Prata. | `read-only` |
| **`chief-visual-director` (`designer-senior`)** | Validação da arquitetura visual ("Instrumento de Precisão vs Cassino"), alinhamento com a referência do menu lateral (`Arena` + `Torneos`) e hierarquia de superfícies (`--bg-0` a `--bg-3`). | `read-only` / `design-review` |
| **`security-reviewer`** | Revisão de segurança contra XSS em traduções interpoladas, sanitização de parâmetros de URL (`?room=`, `?lang=`), prevenção de double-submit em inscrições e proteção de escopo. | `read-only` |
| **`financial-correctness-reviewer`** | Garantia de que valores monetários (`entryFee`, `prizePool`, `totalPrize`, saldos de torneio `T$`) permanecem íntegros, sem manipulação insegura de saldo real/demo. | `read-only` |
| **`qa-resilience-agent`** | Construção e execução das baterias de testes unitários, estresse (troca rápida de abas/idiomas/inscrições concorrentes), segurança e caos (falha de API, `localStorage` corrompido, fallback de idioma). | `write-tests-only` |
| **`regression-guardian-agent` (`guardiao-regressao`)** | Execução da suíte completa de regressão do projeto, verificação de `typecheck`/`build` e bloqueio de qualquer alteração não autorizada em zonas vermelhas (`docs/zonas-sensiveis.txt`). | `read-only` |

### 1.2 Skills Acionadas
- [`01-project-context`](../../../.agents/skills/01-project-context/SKILL.md) — Contexto arquitetural e separação de responsabilidades.
- [`02-financial-invariants`](../../../.agents/skills/02-financial-invariants/SKILL.md) — Integridade de saldos, taxas de entrada e prêmios.
- [`04-security-iam`](../../../.agents/skills/04-security-iam/SKILL.md) — Segurança de estado, inputs e isolamento.
- [`05-resilience-patterns`](../../../.agents/skills/05-resilience-patterns/SKILL.md) — Fallbacks resilientes quando a API ou `localStorage` falha.
- [`06-testing-quality`](../../../.agents/skills/06-testing-quality/SKILL.md) — Padrões de testes determinísticos, estresse e caos.
- [`09-ai-failure-map`](../../../.agents/skills/09-ai-failure-map/SKILL.md) — Prevenção de alucinações, regressões silenciosas e quebra de testes existentes.
- [`12-tokens-binmax`](../../../.agents/skills/12-tokens-binmax/SKILL.md) — Tokens visuais Turbo Prata da Binmax.
- [`13-textos-es`](../../../.agents/skills/13-textos-es/SKILL.md) — Microcopy em espanhol neutro e paridade bilíngue sem quebrar layout (`text-overflow: ellipsis`, `white-space: nowrap`).
- [`16-mapear-projeto`](../../../.agents/skills/16-mapear-projeto/SKILL.md) — Evidências exatas do código antes de editar.
- [`17-mudanca-cirurgica`](../../../.agents/skills/17-mudanca-cirurgica/SKILL.md) — Orçamento estrito de diff e preservação de contratos.
- [`18-zonas-sensiveis`](../../../.agents/skills/18-zonas-sensiveis/SKILL.md) — Blindagem dos arquivos críticos (`docs/zonas-sensiveis.txt`).
- [`19-testes-de-regressao-visual`](../../../.agents/skills/19-testes-de-regressao-visual/SKILL.md) — Validação de zero regressão.
- [`20-conduzir-etapa`](../../../.agents/skills/20-conduzir-etapa/SKILL.md) — Rito de condução etapa por etapa com validação.
- [`21-designer-senior-binmax`](../../../.agents/skills/21-designer-senior-binmax/SKILL.md) — Diretrizes visuais de precisão institucional.

---

## 2. Diagnóstico Forense de Causa Raiz (Evidências `arquivo:linha`)

### Problema A — Integração da Aba `Arena` e `Torneos` no Menu Lateral
1. **Colisão entre Drawer Lateral e Modal de Torneios ([`SidebarDock.tsx:234-237`](../../../apps/web/src/components/sidebar/SidebarDock.tsx#L234-L237))**:
   - O clique no botão `Torneos` (`data-testid="sidebar-item-tournaments"`) executa simultaneamente `toggleTab('tournaments')` (abrindo a gaveta lateral `TournamentsDrawer` em `z-index: 90`) **e** `setIsTournamentsModalOpen(true)` (abrindo `TournamentModal` em `z-index: 1000` com `backdrop-filter: blur(4px)` por cima da gaveta).
   - Ao fechar a modal (`SidebarDock.tsx:866-871`), `activeTab` é resetado para `null`, tornando a `TournamentsDrawer` (onde ficava o card `Arena Blitz · 15 min`) impossível de interagir.
2. **Integração Visual da `Arena` com o Menu Lateral (`SidebarDock.tsx` + `ArenaPage.tsx` + `App.tsx`)**:
   - Na imagem de referência enviada pelo usuário (`media_1791990970774_497c2832.png`), a aba `Arena` (ícone de diamante `sidebar-item-arena`) está posicionada no menu lateral esquerdo logo abaixo de `Torneos`, e quando o usuário clica em `Arena`, a tela da Arena Blitz (`15 minutos. T$ 1.000. O pódio leva o pote.`) abre **mantendo o menu lateral esquerdo (`SidebarDock`) e o rodapé (`TerminalFooter`) integrados**, permitindo alternar com 1 clique entre `Operar`, `Torneos`, `Arena`, `Análisis`, `Tutoriales` e `Promociones`.
   - Atualmente, `ArenaPage.tsx` renderiza uma página isolada sem `SidebarDock` e sem `TerminalFooter`.

### Problema B — "1 - Aba de torneios está quebrada"
1. **Beco sem saída ("Dead-End") em `TournamentModal` ([`TournamentListView.tsx`](../../../apps/web/src/components/tournaments/TournamentListView.tsx), [`TournamentCard.tsx`](../../../apps/web/src/components/tournaments/TournamentCard.tsx), [`TournamentDetailView.tsx`](../../../apps/web/src/components/tournaments/TournamentDetailView.tsx))**:
   - Na lista da modal (`TournamentListView.tsx`), clicar em `Participar →` (`TournamentCard.tsx:207`) apenas abre a tela de detalhes (`TournamentDetailView.tsx`).
   - Dentro de `TournamentDetailView.tsx` (586 linhas), **não existe nenhum botão de ação** (`Participar agora`, `Inscrever-se`, `Operar no Torneio` ou `Abrir Arena Blitz`)! O usuário fica preso em uma tela estática onde a única ação possível é voltar ou fechar (`✕`).
   - Além disso, o card de acesso rápido à **Arena Blitz · 15 min** não aparece dentro da `TournamentModal`, desconectando os Torneios da Arena.
2. **Incompatibilidade de Rota e Resiliência em [`TournamentsPage.tsx:133`](../../../apps/web/src/pages/TournamentsPage.tsx#L133)**:
   - `TournamentsPage.tsx` chama `getTournaments()` (`/api/v1/tournaments`), mas o backend registra `/api/v1/arena/tournaments` em `services/api/src/routes/arena.ts:150` (retornando `{ tournaments: [...] }`). Quando a chamada falha ou retorna formato diferente, a página ou a ação `Unirse al Torneo` falha sem fallback gracioso para os torneios ativos da plataforma (`Copa BINMAX`, `Sprint Semanal`, `Campeonato Mensal`, `Arena Blitz`).

### Problema C — "2 - Não está ocorrendo tradução"
1. **Seletor de idioma (`LanguageSelectorDropdown.tsx`) altera `locale` no `I18nContext` (`pt-BR`, `es-ES`, `es-MX`, etc.), mas os componentes ignoram o contexto e usam strings fixas (hardcoded)**:
   - **Hardcoded em Espanhol mesmo quando `PT` (`pt-BR`) está selecionado**:
     - [`SidebarDock.tsx`](../../../apps/web/src/components/sidebar/SidebarDock.tsx): `'Operar'`, `'Portafolio'`, `'Historial'`, `'Torneos'`, `'Análisis'`, `'Tutoriales'`, `'Promociones'`, `'Ajustes'`, `'Historial de trading'`, `'Sin operaciones cerradas aún'`, etc.
     - [`TerminalHeader.tsx`](../../../apps/web/src/components/header/TerminalHeader.tsx) & [`AccountSelectorDropdown.tsx`](../../../apps/web/src/components/header/AccountSelectorDropdown.tsx): `'Cuenta de práctica'`, `'Cuenta real'`, `'Recargar práctica'`, `'Depositar'`, `'Iniciar sesión'`, `'Crear cuenta'`, `'Salir'`, `'Cerrar sesión'`.
     - [`TerminalFooter.tsx`](../../../apps/web/src/components/footer/TerminalFooter.tsx): `'Portafolio total'`, `'Ganancia de hoy'`, `'Operaciones abiertas'`, `'Hora actual:'`, `'Soporte 24/7'`.
     - [`PortfolioDrawer.tsx`](../../../apps/web/src/components/drawer/PortfolioDrawer.tsx): `'activas'`, `'Ganancia potencial'`, `'Terminal en espera'`, `'Mostrar posiciones'`.
     - [`OrderTicket.tsx`](../../../apps/web/src/trade/OrderTicket.tsx): `'Monto'`, `'Expiración'`, `'Ganancia'`, `'SUBE'`, `'BAJA'` (precisa respeitar `locale === 'pt-BR'` em tempo real mantendo 100% de compatibilidade com o fallback default `'es-ES'` dos testes unitários legados!).
     - [`SecondaryLayout.tsx`](../../../apps/web/src/components/layout/SecondaryLayout.tsx): itens de navegação e rodapé fixos em espanhol.
   - **Hardcoded em Português mesmo quando `ES` (`es-*`) está selecionado**:
     - [`TournamentListView.tsx`](../../../apps/web/src/components/tournaments/TournamentListView.tsx), [`TournamentCard.tsx`](../../../apps/web/src/components/tournaments/TournamentCard.tsx), [`TournamentDetailView.tsx`](../../../apps/web/src/components/tournaments/TournamentDetailView.tsx), [`tournaments-mock-data.ts`](../../../apps/web/src/components/tournaments/tournaments-mock-data.ts): 100% fixos em português (`Torneios`, `AO VIVO`, `EM BREVE`, `ENCERRADO`, `Prêmio total`, `Participar →`, `Voltar para todos os torneios`, `Regras do torneio`, `Ranking em tempo real`, `Prêmios por posição`).
     - [`ArenaPage.tsx`](../../../apps/web/src/pages/ArenaPage.tsx), [`ArenaRoom.tsx`](../../../apps/web/src/arena/ArenaRoom.tsx), [`ArenaLobby.tsx`](../../../apps/web/src/arena/ArenaLobby.tsx), [`ArenaBar.tsx`](../../../apps/web/src/arena/ArenaBar.tsx), [`ArenaTicket.tsx`](../../../apps/web/src/arena/ArenaTicket.tsx), [`ArenaDialogs.tsx`](../../../apps/web/src/arena/ArenaDialogs.tsx), [`Leaderboard.tsx`](../../../apps/web/src/arena/Leaderboard.tsx), [`GhostAudit.tsx`](../../../apps/web/src/arena/GhostAudit.tsx), [`ArenaLedger.tsx`](../../../apps/web/src/arena/ArenaLedger.tsx): 100% fixos em português (`15 minutos. T$ 1.000. O pódio leva o pote.`, `Escolha sua sala`, `Sala Bronze/Prata/Ouro`, `Entrar por`, `Como funciona`, `Tempo restante`, `Prêmio atual`, `Conta torneio`, `ACIMA`, `ABAIXO`, etc.).
     - [`TournamentsDrawer.tsx`](../../../apps/web/src/components/drawer/TournamentsDrawer.tsx) e [`TournamentsPage.tsx`](../../../apps/web/src/pages/TournamentsPage.tsx): mistura híbrida de português e espanhol na mesma tela!

### Problema D — Bugs Visuais e de Layout nas 3 Capturas de Tela da Arena (`media_1791997457425_55b074dc.png`, `media_1791997476455_140c4a26.png`, `media_1791997512455_2b59159e.png`)
1. **Botões e Inputs com Fundo Branco Nativo do Browser em [`arena.css`](../../../apps/web/src/arena/arena.css), [`ArenaTicket.tsx`](../../../apps/web/src/arena/ArenaTicket.tsx), [`ArenaRoom.tsx`](../../../apps/web/src/arena/ArenaRoom.tsx) e [`Leaderboard.tsx`](../../../apps/web/src/arena/Leaderboard.tsx)**:
   - O projeto não usa Tailwind PostCSS; utiliza o arquivo estático `apps/web/src/arena/arena.css`, que não possuía reset de `<button>` e `<input>` dentro de `.arena-root` nem as classes utilitárias `.bg-transparent`, `.whitespace-nowrap`, `.ring-1`, `.ring-2`, `.ring-border`, `.ring-arena` e variantes `:hover`/`:focus-visible`/`:disabled`.
   - Como resultado, botões sem classe `bg-*` explícita (`-`, `+`, `5%`, `10%`, `20%`, `50%`, `00:30`, `02:00`, abas `Ranking | Robô | Extrato` e filtros `Top 10 | Top 20 | Top 30`) recebiam o fundo branco padrão do navegador (`ButtonFace`), deixando a aba ativa `Ranking` (`text-white` sobre fundo branco) ilegível.
2. **Colisão das Colunas `PONTOS` e `PRÊMIO` (`1.000US$ 218,75`) em [`Leaderboard.tsx:100-105`](../../../apps/web/src/arena/Leaderboard.tsx#L100-L105)**:
   - As células `<th>`/`<td>` de `PONTOS` (`T$ 1.000`) e `PRÊMIO` (`US$ 218,75`) não tinham `whitespace-nowrap` nem espaçamento horizontal (`px-2.5`), fazendo `T$ 1.000` quebrar em duas linhas e colar diretamente em `US$ 218,75`.
3. **Estouro de `100vh` e Corte da `ArenaBar` em [`App.tsx:215`](../../../apps/web/src/App.tsx#L215) e [`ArenaRoom.tsx:177`](../../../apps/web/src/arena/ArenaRoom.tsx#L177)**:
   - `App.tsx` envolvia `/arena` na `div` de páginas secundárias com `.global-demo-banner` (28px) acima de `ArenaPage` (`100vh`), gerando overflow vertical e cortando o topo da `ArenaLive`. Além disso, `ArenaLive` não travava `h-full max-h-full overflow-hidden`, permitindo que a tabela de 20 linhas esticasse a página inteira.
4. **Dessincronia de Idioma entre Sidebar (`ES`) e Arena (`PT`) sob HMR em [`i18n/index.tsx:148-156`](../../../apps/web/src/i18n/index.tsx#L148-L156)**:
   - `useUiLanguage(defaultLang)` dependia de `explicitSelection`, fazendo `SidebarDock` (`useUiLanguage('es')`) e `ArenaRoom` (`useUiLanguage('pt')`) exibirem idiomas diferentes simultaneamente quando `explicitSelection` era `false`/`undefined`.

---

## 3. Divisão em Subetapas Completas (`docs/subetapas/torneios-arena-i18n/`)

Cada subetapa possui seu documento `.md` detalhado com passo a passo cirúrgico, critérios de aceite e suíte própria de testes (unitários, estresse, segurança, caos e regressão):

1. **[`01-SUBETAPA-01-MENU-SIDEBAR-E-INTEGRACAO-ARENA.md`](./01-SUBETAPA-01-MENU-SIDEBAR-E-INTEGRACAO-ARENA.md)**
   - Integração cirúrgica da aba `Arena` (diamante) e `Torneos` (troféu) no `SidebarDock.tsx`.
   - Eliminação da colisão simultânea Drawer + Modal ao clicar em `Torneos`.
   - Integração do layout da `ArenaPage.tsx` com a `SidebarDock` e `TerminalFooter` (idêntico à imagem de referência `media_1791990970774_497c2832.png`), permitindo navegação fluida entre `Operar`, `Torneos`, `Arena` e demais abas sem perder o menu lateral.
   - Bateria de testes da Subetapa 01 (unitários, estresse de navegação rápida, segurança de rotas/parâmetros e caos de estado).

2. **[`02-SUBETAPA-02-FLUXO-TORNEIOS-MODAL-DRAWER-PAGINA.md`](./02-SUBETAPA-02-FLUXO-TORNEIOS-MODAL-DRAWER-PAGINA.md)**
   - Restauração completa da funcionalidade da Aba/Modal/Drawer/Página de Torneios.
   - Adição do banner/card interativo **Arena Blitz · 15 min** dentro de `TournamentListView.tsx` e `TournamentsDrawer.tsx` com navegação direta para a Arena.
   - Implementação do fluxo funcional de inscrição/participação (`Participar agora` / `Inscrito ✓` / `Operar no Torneio`) em `TournamentCard.tsx` e `TournamentDetailView.tsx`, sincronizado com `TournamentsDrawer` e `TournamentsPage` via estado persistido seguro e idempotente (`binmax:joined-tournaments`).
   - Resiliência e fallback em `TournamentsPage.tsx` quando a API estiver offline ou retornar schema de arena.
   - Bateria de testes da Subetapa 02 (unitários, estresse de double-click/concorrência de inscrição, segurança contra adulteração de `localStorage` e caos de falha de rede).

3. **[`03-SUBETAPA-03-TRADUCAO-I18N-SALA-HEADER-SIDEBAR-FOOTER.md`](./03-SUBETAPA-03-TRADUCAO-I18N-SALA-HEADER-SIDEBAR-FOOTER.md)**
   - Internacionalização reativa (`pt-BR` ↔ `es-*`) de toda a casca da Sala de Trading e Layout Secundário:
     - `SidebarDock.tsx` (labels do menu, tooltips, gaveta de Histórico e Portfólio).
     - `TerminalHeader.tsx` & `AccountSelectorDropdown.tsx` (Conta de prática / Cuenta de práctica, Depositar, Entrar / Iniciar sesión, Criar conta / Crear cuenta, Sair / Salir, Recarregar / Recargar).
     - `TerminalFooter.tsx` (Portfólio total, Lucro de hoje, Operações abertas, Hora atual, aviso regulatório D8).
     - `PortfolioDrawer.tsx`, `OrderTicket.tsx` e `SecondaryLayout.tsx`.
   - Preservação estrita do fallback default (`es-ES` quando fora de `I18nProvider` ou quando o locale selecionado for `es-*`) para que 100% dos testes unitários existentes continuem passando sem nenhuma quebra.
   - Bateria de testes da Subetapa 03 (unitários bilíngues PT/ES, estresse de troca de idioma em alta frequência, segurança contra XSS/chaves inválidas e caos de `localStorage` indisponível).

4. **[`04-SUBETAPA-04-TRADUCAO-I18N-TORNEIOS-E-ARENA-BLITZ.md`](./04-SUBETAPA-04-TRADUCAO-I18N-TORNEIOS-E-ARENA-BLITZ.md)**
   - Internacionalização reativa completa (`pt-BR` ↔ `es-*`) de:
     - `TournamentModal.tsx`, `TournamentListView.tsx`, `TournamentCard.tsx`, `TournamentDetailView.tsx` e `tournaments-mock-data.ts` (títulos, descrições, status `AO VIVO`/`EN VIVO`, `EM BREVE`/`PRÓXIMAMENTE`, `ENCERRADO`/`FINALIZADO`, regras, tabela de ranking e prêmios).
     - `TournamentsDrawer.tsx` e `TournamentsPage.tsx` (erradicando qualquer mistura de PT+ES na mesma tela).
     - Todos os componentes da Arena Blitz (`ArenaPage.tsx`, `ArenaRoom.tsx`, `ArenaLobby.tsx`, `ArenaBar.tsx`, `ArenaTicket.tsx`, `ArenaDialogs.tsx`, `Leaderboard.tsx`, `GhostAudit.tsx`, `ArenaLedger.tsx`).
   - Bateria de testes da Subetapa 04 (unitários bilíngues PT/ES em todos os componentes de Torneios e Arena, estresse de troca de idioma durante simulação ativa da Arena sem perder ticks/ordens, segurança e caos).

5. **[`05-SUBETAPA-05-CERTIFICACAO-STRESS-SEGURANCA-CAOS-REGRESSAO.md`](./05-SUBETAPA-05-CERTIFICACAO-STRESS-SEGURANCA-CAOS-REGRESSAO.md)**
   - Suíte integrada de certificação (`qa-resilience-agent` + `regression-guardian-agent` + `security-reviewer` + `financial-correctness-reviewer`).
   - Testes de estresse combinados, auditoria de zonas sensíveis (`git diff` zero em arquivos vermelhos), `typecheck`, `build` de produção (`vite build`) e execução das suítes de testes.

6. **[`06-SUBETAPA-06-CORRECAO-CSS-ARENA-BOTOES-INPUTS-TABELA.md`](./06-SUBETAPA-06-CORRECAO-CSS-ARENA-BOTOES-INPUTS-TABELA.md)**
   - Reset completo de `<button>` e `<input>` dentro de `.arena-root` em `apps/web/src/arena/arena.css` e adição das classes utilitárias ausentes (`.bg-transparent`, `.whitespace-nowrap`, `.ring-*`, `.hover:*`, `.focus-visible:*`, `.disabled:*`).
   - Correção dos botões e input da `ArenaTicket.tsx`, abas `Ranking | Robô | Extrato` da `ArenaRoom.tsx` e espaçamento sem colisão (`whitespace-nowrap` + `px-2.5`) das colunas `PONTOS` e `PRÊMIO` no `Leaderboard.tsx`.

7. **[`07-SUBETAPA-07-LAYOUT-VIEWPORT-100VH-E-SINCRONIA-I18N-UNIFICADA.md`](./07-SUBETAPA-07-LAYOUT-VIEWPORT-100VH-E-SINCRONIA-I18N-UNIFICADA.md)**
   - Eliminação do `.global-demo-banner` duplicado na rota `/arena` em `App.tsx`, contenção de `100vh` (`overflow-hidden`) em `ArenaLive` (`ArenaRoom.tsx`) com `ArenaBar` sempre visível e scroll interno exclusivo no painel direito.
   - Inclusão do `LanguageSelectorDropdown` no header da `ArenaPage.tsx`, unificação de `useUiLanguage` em `apps/web/src/i18n/index.tsx` e localização de `Sala Bronce / Plata / Oro` em `ArenaLobby.tsx` e `ArenaBar.tsx`.

8. **[`08-SUBETAPA-08-CERTIFICACAO-VISUAL-E-REGRESSAO-TOTAL.md`](./08-SUBETAPA-08-CERTIFICACAO-VISUAL-E-REGRESSAO-TOTAL.md)**
   - Certificação completa das 11 suítes de testes (95 testes passando), validação de `tsc --noEmit` (zero erros), `vite build` (sucesso) e auditoria de zonas vermelhas (`git diff` zero em arquivos críticos).

---

## 4. Invariantes e Guardrails de Execução
1. **Zonas Vermelhas Intocáveis**: Nenhum arquivo listado como `VERMELHO` em [`docs/zonas-sensiveis.txt`](../../../docs/zonas-sensiveis.txt) (`apps/web/src/api/client.ts`, `apps/web/src/auth/oidc.ts`, `apps/web/src/feed/**`, `services/**`) será modificado.
2. **Compatibilidade Retroativa Total**: Todos os `data-testid` existentes (`sidebar-item-tournaments`, `sidebar-item-arena`, `tournaments-modal-backdrop`, `btn-open-arena-blitz-drawer`, etc.) são preservados.
3. **Gate de Qualidade por Subetapa**: Nenhuma subetapa é dada como concluída sem que seus próprios testes novos e todos os testes legados passem 100%.
