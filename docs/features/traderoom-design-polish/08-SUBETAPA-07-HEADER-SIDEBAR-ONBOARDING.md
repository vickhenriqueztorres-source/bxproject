# Subetapa 07 — Header, Lateral e Onboarding

**Agentes:** surgical-frontend-agent · chief-visual-director · binmax-brand-agent
**Skills:** 21-designer-senior-binmax, 12-tokens-binmax, 13-textos-es
**Problemas:** P10, P12

## Arquivos (lista fechada)
`components/header/TerminalHeader.tsx`, `components/sidebar/SidebarDock.tsx`, `components/onboarding/LeadOnboardingTour.tsx`, `trade/subetapa-polish-07-header-sidebar-onboarding.unit.test.tsx` (novo)

## O que muda (chave ligada)
1. Latência: some o "16ms" fixo (não é medido). Só volta quando houver medição real (fica para depois).
2. Seletor de idioma: "ES" / "PT" sem bandeira em texto; compacto.
3. "Salir" vai para o menu da conta (A5/A6), não fica solto no header.
4. Saldo em Verde Ganancia + selo **DEMO** pequeno (D5); "Cuenta de práctica" em 12px Aço.
5. Lateral: item ativo com fundo `--bg-3` e ícone Prata (sem borda verde — verde é dinheiro).
6. Onboarding: card `--bg-2`, borda `--line`, sem glow, sem ciano; botão "Siguiente" Prata com texto Noche; posicionado **ao lado** do ticket, sem cobrir o eixo de preço.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | nenhum `#00e5ff`/`#00b4d8` e nenhum `box-shadow` com glow no onboarding |
| Unidade | "Salir" dentro do menu da conta e funcionando (`signOut` chamado) |
| Unidade | selo DEMO presente com conta de prática |
| Caos | `localStorage` bloqueado → onboarding não trava a sala; pular tour em qualquer passo |
| Segurança | `signOut` limpa tokens como hoje (`traderoom-signout` continua verde) |
| A11y | foco visível nos itens da lateral; onboarding com `role="dialog"` e Esc fecha |
| Regressão | suites de header, sidebar e `subetapa-10-onboarding` |
