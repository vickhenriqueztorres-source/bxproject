# Subetapa 08 — Certificação Final (Caos, Estresse, Segurança, Sobreposição)

**Agentes:** regression-guardian-agent · qa-resilience-agent · post-implementation-verifier · chief-visual-director · compliance-risk-reviewer
**Skills:** 06-testing-quality, 05-resilience-patterns, 14-teste-de-sobreposicao, 19-testes-de-regressao-visual, 10-post-implementation-verification

## Passo a passo
1. Suíte completa com chave ligada e com `?polish=0` → zero falha nova vs linha de base.
2. Varredura de cor: `grep` de hex nos arquivos da sala com chave ligada → só `#22C47A`/`#F2545B` via tokens; zero `#00E5FF`, `#00E676`, `#22C55E`, `#E5484D` nos ramos novos.
3. Teste de sobreposição 1920×1000 contra `alvo-binmax-principal.png` (tolerância ±10px por elemento A1–F), relatório "igual / D# / fora do lugar".
4. Caos integrado (navegador real, Playwright):
   - feed derrubado 10 s e de volta → overlay "Reconectando", SUBE/BAJA desabilitados, retomada sem erro no console;
   - 20 posições abertas + troca de ativo 30× + abre/fecha gavetas 50×;
   - aba em segundo plano 2 min e volta.
5. Estresse: 10 min de ticks a 250 ms → memória do heap estável (±10%), sem nós DOM crescendo.
6. Segurança: CSP inalterada; nenhum `dangerouslySetInnerHTML` novo; nenhum segredo no bundle (`grep` no `dist`).
7. Build de produção + relatório `docs/relatorios/traderoom-design-polish.md`.
8. Deploy **somente com aprovação do dono**.

## Critério de pronto
Tudo acima verde e pareceres de todos os revisores APROVADO.
