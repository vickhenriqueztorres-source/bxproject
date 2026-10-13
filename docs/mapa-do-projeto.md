# Mapa do projeto — Gate 01 Binmax Reference Room

Data: 2026-10-09. HEAD consultado: `d67aeaf926588e4acac63aa106a0c40593183aca`.
Autoria: mapeador, handoff T13, etapa 01, skills 01/16/18. Levantamento estático do workspace com alterações preexistentes; HEAD não identifica sozinho todos os arquivos lidos. Nenhum build, teste ou integração foi executado pelo mapeador.

## Stack e localização

| Item | Valor observado | Evidência |
|---|---|---|
| Monorepo | pnpm 10.5.2; services, apps, packages | `package.json:5`, `pnpm-workspace.yaml:2` |
| Sala | React 18, Vite 6, TypeScript 5, Lightweight Charts 4 | `apps/web/package.json:16`, `apps/web/package.json:24`, `apps/web/package.json:23`, `apps/web/package.json:14` |
| TypeScript | strict ligado | `apps/web/tsconfig.json:14` |
| Página | App compõe Dashboard; callback OIDC tratado em /callback | `apps/web/src/App.tsx:25`, `apps/web/src/App.tsx:221`, `apps/web/src/App.tsx:263` |
| Estado | React hooks e TanStack Query; saldo/contratos/index/candles | `apps/web/src/App.tsx:26`, `apps/web/src/App.tsx:36` |
| Backend | API Fastify, Blnk, serviços de preço/candles/settlement e gateway | `services/api/src/index.ts:12`, `services/api/src/routes/wallet.ts:2`, `ORCHESTRATOR.md` |

## Comandos existentes e uso no gate

| Ação | Script existente / invocação | Evidência e limite |
|---|---|---|
| Desenvolvimento web | `pnpm --filter @broker/web run dev` → `vite` | `apps/web/package.json:7` |
| Build web | `pnpm --filter @broker/web run build` → `tsc && vite build` | `apps/web/package.json:8` |
| Preview | `pnpm --filter @broker/web run preview` → `vite preview` | `apps/web/package.json:9` |
| Testes web | `pnpm exec vitest run --dir apps/web` | Seleção do gate; configuração inclui `apps/web/src/**/*.test.{ts,tsx}` em `vitest.config.ts:6` |
| Testes raiz | `test:unit`, `test:int`, `test:chaos`, `test:load` | `package.json:11`; não são scripts próprios do pacote web |
| Lint raiz | `pnpm run lint` → `eslint . --ext .ts,.tsx` | `package.json:15`; resultado não verificado |
| Typecheck isolado / E2E web | Não existe script dedicado no manifesto web | `apps/web/package.json:6`; build inclui tsc |
| Gate amplo Fase 1 | `docs/fase-1/scripts/gate.ps1` | Builds de shared/serviços/web/admin em `:11`; validar ambiente antes de executar |

## Estilo, idioma e flag

- CSS nativo em `apps/web/src/styles.css:1`, tokens escopados `.theme-binmax` em `:216`, Archivo/Geist Mono em `:227`; vários componentes também usam style inline. Fontes carregadas em `apps/web/index.html:11`.
- Tradução própria via React Context (`apps/web/src/i18n/index.tsx:27`), dicionários pt-BR/es-ES (`:2`), persistência `broker_locale` (`:31`), padrão conforme idioma do navegador (`:34`) e fallback pt-BR (`:63`). Há textos hardcoded em português e espanhol na sala.
- `NEW_TRADEROOM`: override em memória (`apps/web/src/lib/feature-flags.ts:14`), query theme/ui/new_traderoom (`:22`), localStorage (`:35`), ambiente (`:41`). Fallback atual **true** (`:49`), divergente do padrão desligado descrito pela skill chave-sala-nova. Componentes consultam a flag individualmente; não existe uma página nova integralmente separada.

## Elementos e estados da sala

| Estado / elemento | Dono e evidência | Situação estática |
|---|---|---|
| Sala A–F | `App.tsx:119`, `components/layout/TerminalLayout.tsx:25` sob `apps/web/src/` | Header/sidebar/chart/ticket/drawer/footer por slots |
| Seletor de ativos | `apps/web/src/components/header/TerminalHeader.tsx:64`, `:318` | AssetCatalogModal; catálogo local |
| Operação aberta | `apps/web/src/trade/OrderTicket.tsx:44`, `:67`, `:736`; `App.tsx:158` | Recibo, polling, overlays de contratos |
| Resultados | `apps/web/src/trade/OrderTicket.tsx:752`, `App.tsx:50` | WIN/LOSS/DRAW e anúncio; modal fiel à nova referência não comprovado |
| Portfólio inferior | `apps/web/src/App.tsx:176`; `components/drawer/PortfolioDrawer.tsx:21`, `:29` | Abas ACTIVE/HISTORY, filtros e contratos recebidos |
| Portfólio lateral | `apps/web/src/components/sidebar/SidebarDock.tsx:35`, `:550`; `App.tsx:138` | App não fornece portfolioContent; fallback vazio mesmo com ordens |
| Histórico | `apps/web/src/App.tsx:146`, `history/History.tsx:9` | Consulta getContracts e exibe tabela |
| Torneios | `apps/web/src/components/sidebar/SidebarDock.tsx:560` | Card estático com prazo/prêmio fixos em :572/:580 |
| Conta demo/real | `apps/web/src/components/header/TerminalHeader.tsx:67` | accountType local; não seleciona outra carteira operacional |
| Depósito | `apps/web/src/components/header/TerminalHeader.tsx:760`, `wallet/BilleteraModal.tsx:18` | Modal e abas depósito/métodos/histórico; fluxo simulado |
| Reconexão | `apps/web/src/chart/StalenessOverlay.tsx:19`, `feed/use-feed.ts:41` | UI de stale/circuit breaker e estado do feed |
| Mobile | `apps/web/src/components/layout/MobileTraderoomLayout.tsx:20`, `styles.css:366` | Componente mobile existe, mas busca de uso na produção só achou sua definição; App monta TerminalLayout |
| Onboarding visual | Busca onboarding/Onboarding em apps/web/src | Não encontrado no código de produção; distinto de provisionamento Blnk |

## Dados: integração e simulação

| Dado | Origem, dono e evidência | Limite |
|---|---|---|
| Sessão | OIDC; App ativa guest sem sessão ou em erro (`apps/web/src/App.tsx:232`, `:237`) | Abrir a sala não prova sessão autenticada |
| Saldo guest | Store sessionStorage (`apps/web/src/api/client.ts:39`, `:59`, `:134`) | Saldo local, inicial 1.000.000 minor (:51) |
| Saldo autenticado | Front /api/wallet (`client.ts:108`, `:139`); Fastify /api/v1/wallet e Blnk (`services/api/src/routes/wallet.ts:9`, `:22`) | Falha Blnk devolve saldo fictício com HTTP 200 (:41) |
| Contratos guest | Store e timer locais (`apps/web/src/api/client.ts:362`, `:395`, `:431`) | Resultado/entrada/saída/reserva/payout calculados no browser |
| Contratos autenticados | Front /api/contracts espera array/objeto (`client.ts:368`, `:379`, `:466`); Fastify /api/v1/contracts (`routes/contracts.ts:15`, `:88`, `:105`) | Backend responde envelopes em :99/:121; compatibilidade precisa de reprodução |
| Ambiente dev padrão | `apps/web/vite.config.ts:4`, `:16`; `scripts/dev-live-feed.mjs:187`, `:188`, `:464`, `:495`, `:524` | Proxy :3001; devWallet/devContracts em memória compatíveis com paths do front, não Blnk |
| Preço e candles | useFeed (`apps/web/src/App.tsx:81`), manager (`feed/TradingFeedManager.ts:97`), getCandles (`App.tsx:44`) | Guest possui fallback de candles/mercado local; histórico público /api/candles existe em `services/api/src/routes/chart.ts:236` |
| Payout mostrado | Catálogo (`apps/web/src/catalog/assets.ts:13`), ticket (`trade/OrderTicket.tsx:115`), drawer (`PortfolioDrawer.tsx:35`) | Calculado localmente; não demonstrar como quote autoritativa do backend |
| Payout liquidado | Campo de contrato (`apps/web/src/api/client.ts:14`), guest calcula em :442 | Origem depende do modo ativo |
| Depósito e transações | Timer (`apps/web/src/wallet/DepositForm.tsx:51`), reset demo (:54), histórico seed (`TransactionHistoryTable.tsx:13`) | Não há crédito de pagamento real; modal cria transação local (`BilleteraModal.tsx:37`) |
| Métricas | `apps/web/src/App.tsx:130`, `:192`, `:193` | Latência 16/88 e totais $0.00 fixos |

## Abrir operação e tempo

`apps/web/src/trade/OrderTicket.tsx:135` chama openContract com symbol, direction, stakeMinor, key, durationSeconds, targetExpiresAt e mode (:151). Cliente envia POST /contracts com Idempotency-Key (`apps/web/src/api/client.ts:466`). Trava síncrona executingRef, busy e blocked em :136; preserve parsing, limites e handlers. Gate estático não comprova idempotência ponta a ponta.
Expiração é calculada com Date.now em `OrderTicket.tsx:147`; contador atualiza com hora local (:77). Drawer também usa Date.now (`PortfolioDrawer.tsx:22`). Endpoint de hora existe (`services/api/src/routes/chart.ts:29`); uso desse endpoint para sincronizar estes contadores não foi comprovado.

## Testes, referências e lacunas

- Suíte útil: `apps/web/src/trade/subetapa-01-shell-layout.unit.test.tsx:13`, subetapas 02–06 de fidelidade, asset-catalog-modal, portfolio, billetera, responsive-perfection, feed-resilience e final-certification. `final-certification.unit.test.tsx:112`/:159 cobre flags; `responsive-perfection.unit.test.tsx:3` usa renderToString, que não prova viewport, interação nem integração do mobile em App.
- Referências existentes: `docs/referencias/iq-traderoom-desktop.png`, `binmax-mockup-marca.png`, `alvo-binmax-principal.png`, `alvo-binmax-variante.png`, `atual-ticket.png`, `atual-historial-drawer.png`. Não foi identificado contrato de 12 imagens/estados nesta pasta; fidelidade por pixels não foi medida.
- Busca de analytics em apps/web/src (gtag/dataLayer/fbq/mixpanel/amplitude/analytics.track/ttq/hotjar/clarity) não confirmou SDK/evento de produção; ocorrência amplitude era comentário de cálculo. Integrações externas fora desse escopo não verificadas. Preservar IDs/data-testid existentes.
- O relatório antigo `docs/relatorios/01-mapa-do-sistema.md` descreve 51 testes e outra sala; não usar essa contagem como resultado atual. Arquivo do agente mapeador específico não existe no caminho agents/codebase-mapper-agent/AGENT.md.
- Sequência: congelar referências e modo/flag; executar baseline atual; separar gaps funcionais; tratar shell/seletor, portfólio/histórico, ticket/resultados, reconexão, mobile/onboarding em passos delimitados; verificar screenshots e regressão. Ver classificação comportamental em `docs/features/binmax-reference-room/ZONAS-SENSIVEIS.md`.
