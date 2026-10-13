# Plano Geral — Acabamento Profissional da Sala de Operação (`/operar`)

Branch: `feat/traderoom-design-refinement` · Base: checkpoint `aec6202` · Data: 2026-10-13

## 1. Problema

A sala funciona, mas parece amadora. Evidências: captura local 1920×1000 (`scratch/design-audit/00-atual-operar.png`) e 5 capturas de produção enviadas pelo dono em 13/10 17:54–17:56, comparadas com `docs/referencias/alvo-binmax-principal.png`.

## 2. Orquestração (AGENTS.md + skill `20-conduzir-etapa`)

| Agente | Papel neste plano | Skills |
|---|---|---|
| `tech-lead-orchestrator` | Conduz subetapa por subetapa, gates, commits | 20-conduzir-etapa |
| `chief-visual-director` | Diagnóstico e veto visual (checklist de 12 itens) | 21-designer-senior-binmax, 12-tokens-binmax |
| `codebase-mapper-agent` | Mapa de arquivos/testids (feito, ver §5) | 16-mapear-projeto, 18-zonas-sensiveis |
| `surgical-frontend-agent` | Implementa com diff mínimo | 17-mudanca-cirurgica, 12-tokens-binmax |
| `chart-trading-engineer` | Overlays do gráfico (linhas, flags, eixos) | 11-chart-trading-tools |
| `bug-fix-agent` | Bug de P&L esperado (reproduzir antes de corrigir) | 01–08 |
| `binmax-brand-agent` | Cor, fonte, microcopy ES | 12, 13-textos-es |
| `compliance-risk-reviewer` | SUBE/BAJA simétricos, aviso de risco, valores só do backend | 02, 18 |
| `regression-guardian-agent` | Suíte completa vs linha de base, flag on/off | 06, 19-testes-de-regressao-visual |
| `qa-resilience-agent` | Estresse, caos, segurança | 05, 06 |

## 3. Diagnóstico do Diretor Visual

**Veredito: REPROVADO.** A sala tem a estrutura certa (layout IQ), mas falha em sistema: três verdes, mono em tudo, overlays brigando entre si e texto cru de banco de dados na tela.

| # | Problema | Onde | Gravidade |
|---|---|---|---|
| P1 | 3 verdes e 2 vermelhos em uso (`#00E676`×86, `#22C47A`×62, `#22C55E`×48; `#E5484D`×30, `#F2545B`×18) e ciano `#00E5FF`×16 | todos os arquivos da sala | Alta |
| P2 | 6 posições viram uma faixa verde grossa; flags "SUBE $100.00" empilhadas cortadas pela linha de expiração ("S JBE") | `OrderFlagsOverlay.tsx`, `PriceChart.tsx` | Alta |
| P3 | Telemetria mostra "GANANCIA ESPERADA −$600.00" com 4 posições ganhando e 2 perdendo (esperado ≈ +$140) — também na aba do header | `PriceChart.tsx:1095-1146`, `TerminalHeader.tsx:184-219` | **Bug de lógica** |
| P4 | Símbolo cru: "VOL_50" no gráfico, "SYNTH_VOL_50" e "ARRIBA" na gaveta (vocabulário oficial é SUBE/BAJA) | `PriceChart.tsx:873`, `BinmaxPortfolioDrawer.tsx:229,376` | Alta |
| P5 | Ticket: chips 10/50/100/500 (proibidos em `dashboard-ux.md` §D), "+85%" pequeno, SUBE/BAJA largos e baixos | `OrderTicket.tsx` | Alta |
| P6 | Mono em rótulos ("HORA DE COMPRA", "SUBE 60%", "0 activas", 9px) | overlays, drawer, footer | Média |
| P7 | "HORA DE COMPRA" e "EXPIRACIÓN" encavalados; sentimento é linha fina e invade a barra de ferramentas | `TimeLinesOverlay.tsx`, `TradersMoodBar.tsx` | Média |
| P8 | Eixo de preço com 4 casas ("506.0000") e eixo de tempo em PT ("13 out. '26") | `PriceChart.tsx` | Média |
| P9 | Gaveta lateral + tabela inferior mostram as mesmas posições ao mesmo tempo; abrir gaveta escurece o ticket (SUBE/BAJA parecem desativados) | `PortfolioDrawer.tsx`, `BinmaxPortfolioDrawer.tsx` | Média |
| P10 | Onboarding ciano com glow cobrindo eixo e ticket | `LeadOnboardingTour.tsx:139-230` | Média |
| P11 | Promociones: card com borda/texto verde decorativo (verde = dinheiro) | `components/drawer` / sidebar | Baixa |
| P12 | Header: "16ms" fixo (não medido, `TerminalHeader.tsx:66`), "BR PT", item ativo da lateral com borda verde | header, sidebar | Baixa |
| P13 | Rodapé sem aviso de risco (D8) e sem Soporte (D7); barra "Terminal en espera" duplicada | `TerminalFooter.tsx`, `PortfolioDrawer.tsx` | Média (compliance) |

**Fora do escopo (registrado para depois):** landing e login. Login mistura PT/ES ("Bem-vindo de volta", "Senha"), landing usa logo diferente do oficial e rótulo em PT; login exibe números de plataforma ("12.840 operaciones", "+87%") que precisam de checagem de compliance; bônus "100% en tu primer depósito" idem.

## 4. Decisões de base

1. **Paleta única = manual** (`docs/identidade-visual.md`): Verde Ganancia `#22C47A`, Rojo Baja `#F2545B`, Prata `#DCE1EA`, Aço `#8A92A1`. Já é o valor de `styles/tokens-precision.css` (`--profit`, `--loss`). Os testes da subetapa 18 que exigem `#22C55E`/`#E5484D` já falham hoje e serão atualizados para os tokens.
2. **Chave nova** `TRADEROOM_POLISH` (`lib/feature-flags.ts`), mesmo padrão da `NEW_TRADEROOM` (`?polish=0|1`, `localStorage`, env). Padrão **ligada**; `?polish=0` devolve a sala exatamente como hoje.
3. **Visual e lógica nunca no mesmo passo.** O bug P3 é uma subetapa própria, antes do visual das posições.
4. **Nenhum valor financeiro calculado no cliente muda de fonte.** Payout, saldo e resultado continuam vindo do backend.

## 5. Subetapas (ordem obrigatória)

| # | Arquivo | Foco | Problemas |
|---|---|---|---|
| 00 | `01-SUBETAPA-00-FUNDACAO-TOKENS-FLAG.md` | Tokens únicos, chave, harness de prints e de regressão | P1 |
| 01 | `02-SUBETAPA-01-TICKET.md` | Ticket fiel ao alvo | P5, P6 |
| 02 | `03-SUBETAPA-02-CABECALHO-ATIVO-E-EIXOS.md` | Nome de exibição, cabeçalho do ativo, eixos | P4 (gráfico), P8 |
| 03 | `04-SUBETAPA-03-BUG-PNL-ESPERADO.md` | **Lógica**: P&L esperado correto | P3 |
| 04 | `05-SUBETAPA-04-POSICOES-NO-GRAFICO.md` | Linhas de strike agregadas, flags e telemetria | P2, P6 |
| 05 | `06-SUBETAPA-05-OVERLAYS-TEMPO-SENTIMENTO.md` | Hora de compra, expiração, sentimento | P7 |
| 06 | `07-SUBETAPA-06-GAVETAS-RODAPE.md` | Gavetas, barra inferior, rodapé, promoções | P4 (gaveta), P9, P11, P13 |
| 07 | `08-SUBETAPA-07-HEADER-SIDEBAR-ONBOARDING.md` | Header, lateral, onboarding | P10, P12 |
| 08 | `09-SUBETAPA-08-CERTIFICACAO-FINAL.md` | Caos, estresse, segurança, sobreposição, deploy | todos |

## 6. Gate de cada subetapa (nada avança sem isto)

1. Testes novos da subetapa escritos **antes** do código e vistos **vermelhos**.
2. Implementação → testes novos **verdes**.
3. `npx vitest run` completo: **zero falha nova** em relação a `scratch/design-audit/baseline-failing.txt` (43 falhas pré-existentes). Script: `scratch/design-audit/compare-baseline.sh`.
4. `tsc --noEmit` do `apps/web` sem erro novo e `vite build` OK.
5. Print 1920×1000 e 1366×768 com chave ligada e desligada; com `?polish=0` o print bate com o anterior.
6. Pareceres: diretor visual + marca; compliance quando tocar ticket, saldo ou tempo.
7. Commit isolado por subetapa → reversível com `git revert`.

## 7. Linha de base registrada

- Suíte: 229 arquivos, 43 testes falhando em 29 arquivos **antes** de qualquer mudança (lista em `scratch/design-audit/baseline-failing.txt`).
- Testes que já cobrem a sala e serão afetados: ver mapa do mapeador por subetapa.
