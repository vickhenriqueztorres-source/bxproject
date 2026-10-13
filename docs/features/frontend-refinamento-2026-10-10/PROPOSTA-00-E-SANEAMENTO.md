# Proposta 00-E — saneamento técnico do frontend

Estado: AUTORIZADO para execução delimitada pelo usuário ao pedir "continue" após a pergunta específica de autorização nesta conversa,10/10/2026. Não implementar em conjunto com redesign.

O lint inicial executado pela raiz revelou172erros em79arquivos. Após alteração concorrente de idiomas, o checkpoint registra178erros nos mesmos79arquivos:111no-explicit-any,66no-unused-vars e1prefer-const; i18n/index.tsx passou de2para8erros. Evidências preservadas: evidencias/lint-00C.json e lint-concorrencia.json. Não reverter o trabalho de tradução.

A correção00-B autorizou somente o modal demo. Não autoriza editar auth, API, feed, gráfico, ticket ou flags. Esta proposta pede autorização separada apenas para saneamento de tipos/declarações sem mudar comportamento nos arquivos enumerados abaixo. Backend, endpoints, permissões, saldo/payout, parse, relógio, motor, CSS e NEW_TRADEROOM ficam fora.

## Procedimento obrigatório em CADA lote

1. Ler integralmente os arquivos; localizar consumidores e classificar cada declaração. Congelar handoff exato e copiar/hash da base local. Até5arquivos/150linhas; dividir mais se necessário.
2. Rodar lint dos arquivos para reproduzir suas violações. Executar antes a suíte frontend528testes e o benchmark10amostras sem concorrência; registrar qualquer FAIL sem tentar até verde.
3. Mapear casos de regressão existentes para cada símbolo. Se faltar proteção de comportamento, escrever e executar teste antes de editar; prova browser para eventos/efeitos. Casos malformados intencionais dos testes de segurança devem continuar malformados.
4. Trocar any somente por contrato que o código já demonstra; preservar chamadas/efeitos de imports/hooks mesmo se a ligação local não for usada. Não inserir casts cegos, non-null assertions, skips, regrasoff, ignorações ou branches novas para agradar lint. Se exigir lógica nova ou alteração pública, interromper esse lote e propor patch causal separado.
5. Executar types, lint do lote, testes dirigidos, suítefrontend completa e benchmark, buildisolado e T01–T07 aplicáveis. Para auth/API/feed/ticket: casos de falha/expiração/duplicação/payload em fixture local; nenhuma transação ou ataque externo. Para gráfico: sanitização, isolation, math e lifecycle existentes; manter cadência/coords. Não substituir esses testes por SSR.
6. Guardião independente compara com cópia local; segurança revisa auth/API/segredos; chartengineer revisa gráfico; compliance revisa qualquer financeiro. Lote só PASS com0erro nos arquivos e sem nova falha ou ampliação de acesso. Dívida restante do lint integral deve diminuir; gate00global continua fechado até0erro e demais critérios atendidos.
7. Gravar relatório com comandos/cwd/exitcodes, teste vermelho/verde, arquivos, diff, hash, amostras, capturas e limites. Só depois iniciar lote seguinte. Rollback restaura SOMENTE o lote a partir do backup, sem reset/restore amplo.

## Lotes fechados candidatos

Cada lote abaixo é uma subetapa técnica completa, com os sete passos acima. A autorização não permite ultrapassar orçamento nem mudar runtime. Linhas de erro e regras estão no JSON integral; nenhum arquivo fora da lista entra silenciosamente.

### 00-E-01

- apps/web/src/api/client-cache-invalidation.unit.test.ts — 1 erro(s).
- apps/web/src/api/client.ts — 3 erro(s).
- apps/web/src/App.tsx — 5 erro(s).
- apps/web/src/auth/auth-service.ts — 3 erro(s).
- apps/web/src/auth/auth-service.unit.test.ts — 2 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-02

- apps/web/src/chart/chart-chaos-isolation.unit.test.tsx — 1 erro(s).
- apps/web/src/chart/chart-isolation-stress-chaos-security.unit.test.ts — 3 erro(s).
- apps/web/src/chart/chart-phase2-hardening.unit.test.tsx — 2 erro(s).
- apps/web/src/chart/chart-sandbox.unit.test.tsx — 2 erro(s).
- apps/web/src/chart/chart-sanitizer.unit.test.ts — 2 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-03

- apps/web/src/chart/chart-scale-normalizer.unit.test.ts — 2 erro(s).
- apps/web/src/chart/ChartDrawingOverlay.tsx — 1 erro(s).
- apps/web/src/chart/ChartErrorBoundary.tsx — 4 erro(s).
- apps/web/src/chart/drawing-sanitizer.ts — 4 erro(s).
- apps/web/src/chart/drawing-sanitizer.unit.test.ts — 7 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-04

- apps/web/src/chart/drawing.unit.test.ts — 13 erro(s).
- apps/web/src/chart/indicator-stress.unit.test.ts — 1 erro(s).
- apps/web/src/chart/IsolatedChartHost.tsx — 2 erro(s).
- apps/web/src/chart/multichart-chaos-stress.unit.test.tsx — 3 erro(s).
- apps/web/src/chart/pricechart-decoupling.unit.test.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-05

- apps/web/src/chart/PriceChart.tsx — 10 erro(s).
- apps/web/src/chart/raf-multisymbol.unit.test.ts — 1 erro(s).
- apps/web/src/chart/raf-tick-lifecycle.unit.test.ts — 3 erro(s).
- apps/web/src/chart/subetapa-01-parity-and-scale-hardening.unit.test.ts — 2 erro(s).
- apps/web/src/chart/subetapa-01-price-lines-leak.unit.test.ts — 2 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-06

- apps/web/src/chart/subetapa-04-integrated-chaos-stress.unit.test.ts — 2 erro(s).
- apps/web/src/chart/subetapa-18-03-grafico-overlays.unit.test.tsx — 1 erro(s).
- apps/web/src/chart/subetapa-ux-04-drawing-toolbar.unit.test.tsx — 5 erro(s).
- apps/web/src/chart/TimeLinesOverlay.tsx — 1 erro(s).
- apps/web/src/components/chart/TradingViewCanvas.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-07

- apps/web/src/components/drawer/BinmaxHistoryDrawer.tsx — 2 erro(s).
- apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx — 1 erro(s).
- apps/web/src/components/drawer/PortfolioDrawer.tsx — 2 erro(s).
- apps/web/src/components/drawer/TournamentsDrawer.tsx — 1 erro(s).
- apps/web/src/components/header/AccountSelectorDropdown.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-08

- apps/web/src/components/header/TerminalHeader.tsx — 1 erro(s).
- apps/web/src/components/KYCTierBadge.tsx — 1 erro(s).
- apps/web/src/components/layout/MobileTraderoomLayout.tsx — 1 erro(s).
- apps/web/src/components/modals/AssetCatalogModal.tsx — 1 erro(s).
- apps/web/src/components/trading/TradeTicket.tsx — 3 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-09

- apps/web/src/feed/TradingFeedManager.ts — 1 erro(s).
- apps/web/src/i18n/index.tsx — 2 erro(s).
- apps/web/src/lib/feature-flags.ts — 4 erro(s).
- apps/web/src/news/news.unit.test.ts — 1 erro(s).
- apps/web/src/pages/AnalysisPage.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-10

- apps/web/src/pages/auth-full-lifecycle-e2e.unit.test.tsx — 2 erro(s).
- apps/web/src/pages/auth-pages.unit.test.tsx — 1 erro(s).
- apps/web/src/pages/history-portfolio.unit.test.tsx — 1 erro(s).
- apps/web/src/pages/HistoryPage.tsx — 2 erro(s).
- apps/web/src/pages/LandingPage.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-11

- apps/web/src/pages/LoginPage.tsx — 1 erro(s).
- apps/web/src/pages/PasswordRecoveryPage.tsx — 2 erro(s).
- apps/web/src/pages/PreviewHubPage.tsx — 1 erro(s).
- apps/web/src/pages/RegisterPage.tsx — 1 erro(s).
- apps/web/src/pages/TournamentsPage.tsx — 2 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-12

- apps/web/src/pages/VerificationPage.tsx — 5 erro(s).
- apps/web/src/styles/tokens-precision.unit.test.ts — 1 erro(s).
- apps/web/src/trade/asset-catalog-modal.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/chart-drawing-tools.unit.test.tsx — 5 erro(s).
- apps/web/src/trade/expiry-calculator.unit.test.ts — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-13

- apps/web/src/trade/final-certification.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/history-expansion.unit.test.ts — 1 erro(s).
- apps/web/src/trade/in-chart-asset-selector.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/layout-spacing-overlays.unit.test.tsx — 6 erro(s).
- apps/web/src/trade/logo.unit.test.ts — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-14

- apps/web/src/trade/OrderTicket.tsx — 1 erro(s).
- apps/web/src/trade/portfolio-refinement-stress-chaos.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/portfolio-subetapa-02-04-cards-and-timers.unit.test.tsx — 2 erro(s).
- apps/web/src/trade/sidebar.unit.test.tsx — 4 erro(s).
- apps/web/src/trade/smoke.unit.test.ts — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-15

- apps/web/src/trade/subetapa-03-sidebar-fidelity.unit.test.tsx — 3 erro(s).
- apps/web/src/trade/subetapa-10-onboarding.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/subetapa-18-02-tipografia-moeda.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/subetapa-18-05-certificacao-final.unit.test.tsx — 1 erro(s).
- apps/web/src/trade/subetapa-refine-02-sidebar-expansion.unit.test.tsx — 2 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

### 00-E-16

- apps/web/src/trade/ticket-ergonomic.unit.test.tsx — 2 erro(s).
- apps/web/src/trade/ticket.unit.test.ts — 1 erro(s).
- apps/web/src/wallet/BinmaxWithdrawModal.tsx — 1 erro(s).
- apps/web/src/wallet/TransactionHistoryTable.tsx — 1 erro(s).

Entrada: lote anterior aprovado, backup e regressão antes da edição. Saída: cumprir passos1–7 e0erro local; nenhuma regressão funcional. Escopo protegido exige a autorização específica desta proposta.

## Limites e outras pendências

Zero lint não certifica segurança financeira. O typecheck atual exclui testes. Layout mobile/campos/teclado e estados demonstrativos de outras telas permanecem no diagnóstico, com recuperação separada antes de liberar o gate correspondente. A primeira medição sob pressão foi reprovada; perfil sem concorrência foi aprovado e não comprova saturação. Esta proposta não altera visual nem substitui o plano01–10.
