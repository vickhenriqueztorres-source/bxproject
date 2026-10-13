# Zonas sensíveis — Binmax Reference Room / Gate 01

Data: 2026-10-09. Handoff T13, etapa 01, skills 01/16/18. Evidência estática; este documento não altera as listas antigas nem autoriza mudanças de código. Classificar **o comportamento alterado**, não dar permissão ampla pelo nome do arquivo.

## Matriz de comportamento

| Cor | Arquivo / fronteira | Motivo e evidência | Regra para próximo passo |
|---|---|---|---|
| VERMELHO | `apps/web/src/api/client.ts` | API, sessão, store monetário guest, abertura/settlement (`:101`, `:134`, `:395`, `:431`, `:466`) | Não editar em passo visual |
| VERMELHO | `apps/web/src/auth/oidc.ts` e sessão em `App.tsx:221` | Login, tokens e fallback guest (`App.tsx:232`) | Não mudar acesso/fallback junto ao layout |
| VERMELHO | `services/**`, `db/**`, `infra/**`, env, CI/deploy | Blnk, contratos, ticks oficiais, persistência, execução; `services/api/src/routes/wallet.ts:22`, `routes/contracts.ts:15` | Tratar mudança funcional em handoff próprio |
| VERMELHO | `scripts/dev-live-feed.mjs:187` | Carteira/contratos dev em memória; reserva em :562 e liquidação em :612 | Não tomar dev feed como prova Blnk; não corrigir no passo visual |
| VERMELHO | Cálculo/disparo em `apps/web/src/trade/OrderTicket.tsx:108` | Saldo, parsing/limites (:119), trava (:136), expiração Date.now (:147), argumentos de ordem (:151) | Preservar callbacks, blocked/busy/executingRef e Idempotency-Key |
| VERMELHO | `apps/web/src/trade/expiry-calculator.ts`; cálculo temporal em `OrderTicket.tsx:77`, `PortfolioDrawer.tsx:22` | Definição de prazo e contadores | Não trocar fonte de tempo nem matemática no passo visual |
| VERMELHO | Financeiro em `apps/web/src/components/drawer/PortfolioDrawer.tsx:32` | PnL local com stake * 0.85 (:35) | Não recalcular payout/PnL por fidelidade à imagem |
| VERMELHO | `apps/web/src/wallet/DepositForm.tsx:23`, `:39` | Parse do valor, submissão, timer de sucesso/reset (:51) | Depósito simulado; mudança de comportamento exige etapa própria |
| VERMELHO | `apps/web/src/wallet/BilleteraModal.tsx:37`, `TransactionHistoryTable.tsx:13` | Registro financeiro local/seed | Não apresentar simulação como crédito real |
| VERMELHO | Financeiro em `apps/web/src/App.tsx:45`, `:70`, `:84`, `:110` | Eventos privados, invalidação e resetMockWallet | Não alterar atualização de saldo/contratos |
| VERMELHO | Analytics, rotas públicas, IDs/data-* consumidos | A busca atual não comprovou SDK, mas ausência não autoriza renomear identificadores | Preservar contratos de instrumentação/testes |
| AMARELO | `apps/web/src/feed/**` | Conexão/protocolo/replay/staleness; `use-feed.ts:41`, `TradingFeedManager.ts:97` | Leitura/reuso; alterações de protocolo ou reconexão são vermelhas |
| AMARELO | `apps/web/src/chart/**` | Chart, coordenadas, overlays, lifecycle; `PriceChart.tsx`, `StalenessOverlay.tsx:19` | Delimitar trechos visuais; não tocar ingestão, escala matemática ou RAF |
| AMARELO | `apps/web/src/App.tsx` | Composição da sala (:119) misturada a lógica financeira | Limitar patch aos slots/estado de apresentação explicitamente aprovado |
| AMARELO | `OrderTicket.tsx`, `PortfolioDrawer.tsx`, header, conta e wallet mistos | Style/JSX coexistem com lógica/callbacks; `TerminalHeader.tsx:67`, `:760` | Mudança só de apresentação; vermelho prevalece em parsing/callbacks/dinheiro/tempo |
| AMARELO | `apps/web/src/lib/money.ts`, catálogo e feature flag | Formatação, payout local e seleção de implementação; `catalog/assets.ts:13`, `feature-flags.ts:49` | Reutilizar; não alterar taxa, valor ou default da flag disfarçado de CSS |
| VERDE | CSS visual escopado em `apps/web/src/styles.css:216` | Tokens e regras .theme-binmax | Evitar vazamento para legado, mudanças de overlays/hitboxes com efeito funcional |
| VERDE | SVGs/ícones/brand somente apresentação | `apps/web/public/brand/binmax-mark.svg`, `components/sidebar/SidebarIcons.tsx:10` | Sem mudança de IDs/handlers/medidas fora da referência autorizada |
| VERDE | Texto e JSX puramente apresentacional delimitados | `apps/web/src/i18n/locales/es-ES.json`, shell `TerminalLayout.tsx:25` | Não inserir valores financeiros fixos como dados operacionais |

## Reuso e limites

- Reutilizar `getWallet/getContracts/getContract/openContract` (`api/client.ts:134`, `:362`, `:372`, `:382`), useFeed (`App.tsx:81`), invalidadores (`App.tsx:84`), formatMinor e callbacks existentes; não duplicar motor para reproduzir imagem.
- `docs/zonas-sensiveis.md` marca PortfolioDrawer/PriceChart inteiros como verdes; evidência atual contém cálculo monetário e motor gráfico. Esta matriz descreve o limite comportamental adicional, sem modificar a governança antiga.
- `docs/zonas-sensiveis.txt` não enumera todos os arquivos vermelhos. Checagem do gate deve considerar paths e prefixos; glob `**` não é expandido por comparação literal. Uma lista sem matches não prova ausência de mudança perigosa.
- Flag atual liga por padrão (`feature-flags.ts:49`); decidir seu contrato em passo próprio. Conta REAL local e depósito fake não são integrações operacionais. Falhas preexistentes devem ser registradas, não corrigidas no diff visual.
- Gate seguinte: revisar diff com base nesta matriz, executar build/testes acordados, conferir efeitos de clique/tempo/conexão e comparar cada estado no viewport da referência com flag ligada/desligada. Nenhuma dessas execuções foi assinada pelo mapeador neste Gate 01.
