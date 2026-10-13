# Subetapa 06 — Gavetas, Barra Inferior, Rodapé e Promoções

**Agentes:** surgical-frontend-agent · chief-visual-director · compliance-risk-reviewer · binmax-brand-agent
**Skills:** 21-designer-senior-binmax, 13-textos-es, 18-zonas-sensiveis
**Problemas:** P4 (gaveta), P9, P11, P13

## Arquivos (lista fechada)
`components/drawer/BinmaxPortfolioDrawer.tsx`, `components/drawer/PortfolioDrawer.tsx`, `components/footer/TerminalFooter.tsx`, gaveta de Promociones (arquivo confirmado pelo mapeador antes de editar), `trade/subetapa-polish-06-drawers-footer.unit.test.tsx` (novo)

## O que muda (chave ligada)
1. Gaveta Portafolio: nome de exibição ("Vol 50"), direção **SUBE/BAJA** (fim de "ARRIBA/ABAJO"), selo neutro com ponto colorido; valor 14px Geist Mono.
2. Abrir uma gaveta **não** escurece o ticket nem os botões SUBE/BAJA (hoje parecem desativados).
3. Gaveta aberta e tabela inferior não exibem a mesma lista ao mesmo tempo: abrir uma fecha a outra.
4. Barra inferior: some "· Terminal en espera"; rótulos em Geist (não mono).
5. Rodapé: botão **Soporte** neutro (D7) + e-mail que o sistema já usa; **aviso de risco curto** centralizado (D8, texto de `identidade-visual.md` §10).
6. Promociones: card `--bg-2` sem borda verde; "BONO EXCLUSIVO" em Aço; código em Geist Mono. Verde só em valores de dinheiro.

## Testes
| Tipo | Caso |
|---|---|
| Unidade | nenhum "ARRIBA"/"ABAJO"/"SYNTH_" no HTML com chave ligada |
| Unidade | aviso de risco e Soporte presentes no rodapé |
| Unidade | abrir gaveta não aplica `opacity`/`filter` no ticket |
| Compliance | aviso de risco visível em 1366×768 sem cortar; não depende de feature flag de país |
| Caos | 0, 1 e 200 posições; contrato liquida com gaveta aberta |
| Estresse | 100 abre/fecha seguidos sem vazar listeners |
| Segurança | e-mail de suporte e textos de promoção renderizados como texto (sem `dangerouslySetInnerHTML`) |
| Regressão | suites `subetapa-drawer-*`, `subetapa-06-footer-fidelity`, `footer-reactive-metrics` |
