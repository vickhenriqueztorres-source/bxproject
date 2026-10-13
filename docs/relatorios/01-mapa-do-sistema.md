# Relatório 01 — Mapa do Sistema (Somente Leitura)

**Data de Execução:** 08 de Outubro de 2026  
**Status:** CONCLUÍDO COM SUCESSO  
**Objetivo:** Mapeamento fático, com evidências (`arquivo:linha`), de toda a base de código da plataforma de trading antes de iniciar as alterações da Identidade Visual Turbo Prata e Layout IQ Option.

---

## A. Base do Projeto

- **Linguagem e Framework:** React 18.3.1 + TypeScript 5.7.3 + Vite 6.1.0 (`apps/web/package.json:14-24`).
- **Gerenciador de Pacotes:** `pnpm@10.5.2` configurado em monorepo com workspaces (`pnpm-workspace.yaml:1-5`, `package.json:5`).
- **Comandos Disponíveis:**
  - Build do frontend: `npm run build --prefix apps/web` (executa `tsc && vite build`, validado com sucesso em 17.05s).
  - Testes: `npx vitest run --dir apps/web` (51 testes unitários passando em 9 arquivos).
- **Estrutura de Monorepo:**
  - `apps/web`: Aplicação principal do Traderoom.
  - `apps/admin`: Painel administrativo.
  - `packages/shared`: Tipos TypeScript compartilhados e utilitários de moedas.
  - `services/api`: API Fastify (BFF, contratos, carteira, saúde).
  - `services/tick-engine`: Motor gerador de ticks estocásticos OTC.
  - `services/websocket-gateway`: Gateway de streaming WebSocket a 250ms.
- **Sistema de Estilo:**
  - CSS nativo centralizado em `apps/web/src/styles.css:1-211`.
  - Estilos estruturais de full-bleed terminal em `apps/web/src/styles.css:8-120`.
  - Injeção de tema escopado: compatível via classe `.theme-binmax` dentro de contêineres React.
- **Fontes Carregadas:**
  - Atualmente: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` em `apps/web/index.html:14` e `'DM Sans', 'Space Grotesk'` em `apps/web/src/styles.css:1`.
  - Meta alvo: Fontes oficiais **Archivo** e **Geist Mono** conforme manual de marca.
- **Internacionalização (i18n):**
  - Sistema próprio baseado em React Context em `apps/web/src/i18n/index.tsx:1-114`.
  - Idiomas suportados: `pt-BR` e `es-ES` (`apps/web/src/i18n/locales/es-ES.json:1-51`).
  - Persistência em `localStorage.getItem("broker_locale")`.
- **Sistema de Feature Flags:**
  - Backend possui `services/api/src/services/feature-flags.ts`.
  - No frontend, a ativação visual da nova sala será controlada pela flag `NEW_TRADEROOM` (lida via query param `?theme=binmax` e `localStorage` com fallback seguro).

---

## B. Sala de Operação (Traderoom)

Mapeamento comparativo das zonas A1–F de `docs/dashboard-ux.md`:

| Zona | Componente Atual | Arquivo:Linha | Situação Hoje | Meta IQ / Binmax |
|---|---|---|---|---|
| **A (Barra Superior)** | `TerminalHeader` | `apps/web/src/components/header/TerminalHeader.tsx:22-120` | Altura 48px, logo verde genérico "BROKERPRO", abas sem underline Prata, botão Depositar azul/outline. | Altura ~76px, logo horizontal Binmax Turbo Prata, abas com underline Prata, saldo em Verde Ganancia com selo DEMO/REAL, botão Depositar verde e cheio. |
| **B (Menu Lateral)** | `SidebarDock` | `apps/web/src/components/sidebar/SidebarDock.tsx:18-100` | Largura 48px, ícones em emojis (`📊`, etc.) sem rótulos em texto. | Largura ~68px, ícones Lucide vetoriais (24px) com labels em caixa-alta embaixo em Aço `#8A92A1` (font-size ≥ 11px). |
| **C (Gráfico & Overlays)** | `PriceChart`, `MultiChartGrid` | `apps/web/src/chart/PriceChart.tsx:62-280`, `apps/web/src/chart/MultiChartGrid.tsx` | Fundo transparente/azul, velas `#00e676` e `#ff3d71`, overlays de linhas de tempo e sentimento ativos. | Fundo Noche `#0D0F14`, velas Verde Ganancia `#22C47A` e Rojo Baja `#F2545B`, linha de preço tracejada com tag Prata `#DCE1EA` em formato de seta, contadores C9, C10, C11. |
| **D (Ticket Direito)** | `OrderTicket` | `apps/web/src/trade/OrderTicket.tsx:31-250` | Largura 300px, chips de $5/$10, botões horizontais, textos em português ("ACIMA" / "ABAIXO"). | Coluna estreita ~115px, Monto ($ 1 com +/- empilhados), Expiración (relógio com +/- empilhados), Ganancia (+85% grande, +$0.85 verde), botões SUBE/BAJA quase quadrados (~110x110px). |
| **E (Barra Portfólio)** | `PortfolioDrawer` | `apps/web/src/components/drawer/PortfolioDrawer.tsx:13-100` | Barra de rodapé integrada com gaveta para cima, texto em português. | Barra ~30px, texto "Portafolio total" / "Mostrar posiciones ⌃", retrátil. |
| **F (Rodapé Geral)** | Integrado em `TerminalLayout` / `TerminalHeader` | `apps/web/src/components/layout/TerminalLayout.tsx` | Rodapé implícito no drawer bar. | Barra ~30px dedicada com botão "SOPORTE" neutro, aviso de risco D8 e relógio oficial do servidor. |

---

## C. Dados e Estado

- **Preços em Tempo Real:** Conexão WebSocket gerenciada por `TradingFeedManager.ts` e hook `useFeed.ts` (`apps/web/src/feed/use-feed.ts:1-60`). Recebe mensagens JSON com `type: 'tick'`, `symbol`, `price`, `timestamp`, `sequence`.
- **Saldo e Carteira:** Hook `useQuery` chamando `getWallet` (`apps/web/src/App.tsx:35-36`). Atualização instantânea em tempo real via evento de WebSocket privado `wallet_balance` (`apps/web/src/App.tsx:41-45`).
- **Abertura de Operações:** Função `handleExecute` em `apps/web/src/trade/OrderTicket.tsx:114-152` que invoca `openContract` de `apps/web/src/api/client.ts:80-120`. Valida saldo disponível, feed stale, idempotência via `safeRandomUUID()` e piso de duração de 30s (`Math.max(30, durationSeconds)`).
- **Liquidação de Operações:** Evento privado de WebSocket `contract_settled` capturado em `apps/web/src/App.tsx:46-53`. Invalida queries de carteira e contratos para atualizar a interface em < 50ms.
- **Hora do Servidor:** Sincronizada nos ticks via `tick.timestamp` e relógio de estado em `apps/web/src/trade/OrderTicket.tsx:43`.
- **Propriedade do Estado:** `@tanstack/react-query` gerencia cache e sincronização assíncrona; estado local via React hooks (`useState`, `useRef`).

---

## D. Motor Gráfico

- **Biblioteca:** TradingView Lightweight Charts **v4.2.1** (`apps/web/package.json:14`, `apps/web/src/chart/PriceChart.tsx:2-12`).
- **Configuração de Estilo:** `createChart` em `apps/web/src/chart/PriceChart.tsx:163-189`. Suporta renderização em 60 FPS com throttle via `RafChartUpdater`.

---

## E. Testes e Qualidade (Linha de Base)

- **Suíte de Testes:** Vitest v3.2.7.
- **Execução:** `npx vitest run --dir apps/web`
- **Resultado:** **9 arquivos testados, 51 testes passando (100% verde)**.
- **Build de Produção:** `npm run build --prefix apps/web` -> Compilação TypeScript e empacotamento Vite concluídos em 17.05s com **código de saída 0**.

---

## F. Zonas Proibidas (VERMELHO)

Arquivos catalogados em `docs/zonas-sensiveis.txt`:
1. `apps/web/src/api/client.ts`
2. `apps/web/src/auth/oidc.ts`
3. `apps/web/src/feed/**` (todos os 11 arquivos de protocolo e conexão)
4. `services/**` (toda a infraestrutura de backend)

---

## G. Parecer do Conselho dos Agentes

### Mapeador
> "O projeto possui separação arquitetural exemplar entre o motor de feed/trading e a camada de apresentação. Os componentes visuais (`TerminalHeader`, `SidebarDock`, `OrderTicket`, `PortfolioDrawer`) recebem callbacks e props bem definidos, permitindo a substituição de apresentação com risco zero às regras financeiras."

### Fidelidade IQ
> "O layout atual difere da IQ Option principalmente na largura do ticket (300px vs 115px), na altura do cabeçalho (48px vs 76px), no menu lateral (ícones soltos vs ícones verticais com texto abaixo em Aço) e na barra de portfólio. A migração deve respeitar estritamente as cotas A1–F e as diferenças autorizadas D1–D10."

### Marca Binmax
> "Identificada a necessidade de injetar a classe `.theme-binmax` com as cores oficiais Turbo Prata (Noche `#0D0F14`, Panel `#151922`, Prata `#DCE1EA`, Blanco `#F4F5F7`, Aço `#8A92A1`, Verde Ganancia `#22C47A`, Rojo Baja `#F2545B`). Nenhuma cor solta deve ser utilizada fora dos tokens."

### Compliance e Risco
> "O ticket atual usa os botões ACIMA/ABAIXO com cores assimétricas. A reformulação para SUBE (verde) e BAJA (vermelho) com tamanhos idênticos de 110x110px cumpre rigorosamente a exigência D2. O aviso de risco D8 no rodapé e a indicação de conta demo devem ser garantidos."

### Guardião de Regressão
> "A linha de base de 51 testes vitest e build sem erros está confirmada. Nenhuma alteração deve quebrar os testes existentes. Toda nova tela deve funcionar sob a flag `NEW_TRADEROOM`, garantindo fallback total."

### Engenheiro de Prompt
> "Mapa completo e rigorosamente verificado. Autorizado o avanço para a Etapa 02 (Rede de Segurança e Chave da Sala Nova)."

---

## H. Tabela Síntese: Zona → Arquivo → Situação → Mudança → Risco

| Zona | Arquivo | Situação Hoje | Mudança Alvo | Risco |
|---|---|---|---|---|
| A | `TerminalHeader.tsx` | 48px, logo BrokerPro, botões azuis | 76px, logo Binmax Turbo Prata, botões verdes/prata | BAIXO |
| B | `SidebarDock.tsx` | 48px, emojis, sem labels | 68px, ícones Lucide + labels em caixa-alta Aço | BAIXO |
| C | `PriceChart.tsx` | Cores verde `#00e676` / vermelho `#ff3d71` | Verde Ganancia `#22C47A` / Rojo Baja `#F2545B`, linha tracejada Prata | BAIXO |
| D | `OrderTicket.tsx` | 300px, botões retangulares ACIMA/ABAIXO | 115px estreito, SUBE/BAJA 110x110px, valores do servidor | MÉDIO (Supervisionado) |
| E | `PortfolioDrawer.tsx` | Barra genérica | Barra 30px 'Portafolio total' retrátil | BAIXO |
| F | `TerminalLayout.tsx` | Estrutura sem rodapé dedicado | Inclusão de rodapé 30px com aviso de risco D8 e hora | BAIXO |
| Flag | `App.tsx` | Renderização direta | Duas portas atrás de `NEW_TRADEROOM` | BAIXO |
