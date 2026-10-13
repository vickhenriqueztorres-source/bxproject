# Classificação de Zonas Sensíveis — Binmax Option

Classificação formal de todos os arquivos tocados ou adjacentes ao Traderoom da Binmax Option, seguindo o protocolo de mitigação de risco e integridade financeira.

## Matriz de Classificação

| Arquivo | Cor | Motivo | Evidência |
|---|---|---|---|
| `apps/web/src/api/client.ts` | **VERMELHO** | Disparo de ordens, obtenção de contratos e saldo no Blnk | `apps/web/src/api/client.ts:80-120` |
| `apps/web/src/auth/oidc.ts` | **VERMELHO** | Autenticação PKCE Keycloak, tokens JWT e usuário demo | `apps/web/src/auth/oidc.ts:1-60` |
| `apps/web/src/feed/**` | **VERMELHO** | Protocolo binário/JSON de ticks, detecção de gap e latência | `apps/web/src/feed/protocol.ts:1-50` |
| `services/**` | **VERMELHO** | Backend, contabilidade de dupla entrada, motor de ticks | `services/api/src/index.ts:1` |
| `apps/web/src/trade/OrderTicket.tsx` | **AMARELO** | Componente do ticket: altera apenas o visual (botões SUBE/BAJA), mas conecta com `openContract` | `apps/web/src/trade/OrderTicket.tsx:114-152` |
| `apps/web/src/trade/expiry-calculator.ts` | **AMARELO** | Lógica temporal de fechamento de vela e piso de 30s | `apps/web/src/trade/expiry-calculator.ts:1-40` |
| `apps/web/src/lib/money.ts` | **AMARELO** | Formatação de centavos sem manipulação de taxa | `apps/web/src/lib/money.ts:1-30` |
| `apps/web/src/App.tsx` | **AMARELO** | Orquestrador principal da tela: lê feature flag e compõe layout | `apps/web/src/App.tsx:104-170` |
| `apps/web/src/styles.css` | **VERDE** | Estilos CSS e tokens da classe `.theme-binmax` | `apps/web/src/styles.css:1-210` |
| `apps/web/src/components/layout/TerminalLayout.tsx` | **VERDE** | Casca do grid da aplicação | `apps/web/src/components/layout/TerminalLayout.tsx:1-45` |
| `apps/web/src/components/header/TerminalHeader.tsx` | **VERDE** | Cabeçalho, logo Binmax, abas de ativos | `apps/web/src/components/header/TerminalHeader.tsx:55-120` |
| `apps/web/src/components/sidebar/SidebarDock.tsx` | **VERDE** | Barra lateral de navegação e ícones Lucide | `apps/web/src/components/sidebar/SidebarDock.tsx:45-100` |
| `apps/web/src/components/drawer/PortfolioDrawer.tsx` | **VERDE** | Barra inferior retrátil de posições | `apps/web/src/components/drawer/PortfolioDrawer.tsx:50-100` |
| `apps/web/src/chart/PriceChart.tsx` | **VERDE** | Paleta visual de velas e linhas de tempo no Lightweight Charts | `apps/web/src/chart/PriceChart.tsx:265-275` |
| `apps/web/src/i18n/locales/es-ES.json` | **VERDE** | Dicionário de microcopy em espanhol neutro | `apps/web/src/i18n/locales/es-ES.json:1-50` |
| `public/brand/*` | **VERDE** | Arquivos SVG estáticos da marca | `public/brand/` |
