# PLANO MESTRE DE ENGENHARIA — REFINAMENTO E ACABAMENTO FINO DA SALA (ANÁLISE 18)
## Binmax Option Reference Room — Fase 2 Polimento Profissional

**Data:** 09/10/2026  
**Status:** APROVADO PARA EXECUÇÃO CIRÚRGICA  
**Orquestrador:** `tech-lead-orchestrator`  
**Equipe Especializada Mobilizada:**
- `surgical-frontend-agent` (`cirurgiao`) — Alterações cirúrgicas nos arquivos delimitados de frontend (`apps/web/src/**`).
- `iq-fidelity-reviewer` (`fidelidade-iq`) — Garantia de fidelidade de grid, proporções, alinhamentos e eliminação de sobreposições.
- `binmax-brand-agent` (`marca-binmax`) — Aplicação dos tokens Turbo Prata oficiais, eliminação do neon amador, padronização cromática e tipografia dual (Inter/Sans para UI, Geist Mono exclusivamente para grandezas financeiras essenciais).
- `chart-trading-engineer` — Ajuste e desacoplamento do canvas Lightweight Charts, eliminação de etiqueta duplicada de preço, reposicionamento do painel de ferramentas flutuante, sanitização da TradersMoodBar e TimeLinesOverlay.
- `compliance-risk-reviewer` (`compliance-risco`) — Integridade monetária (formato universal `$185.00`), simetria SUBE/BAJA, prevenção de duplo disparo e integridade com a wallet Blnk.
- `regression-guardian-agent` & `qa-resilience-agent` — Testes unitários, de estresse, de caos visual/rede e validação contínua da suíte de 425+ testes automatizados.

---

## 1. Diagnóstico Forense (As 7 Causas Concretas de Amadorismo)

| # | Sintoma Identificado | Causa Raiz no Código | Resolução Técnica Cirúrgica |
|---|---|---|---|
| **C1** | **Azul neon no Operar ativo** | `#00e5ff` / `rgba(0, 229, 255, 0.08)` em `SidebarDock.tsx` e abas do header com glow saturado lembrando cassino. | Substituir por branco `#E6EAF0` / `#F4F5F7` no ícone e texto, com indicador de aba/dock em barra lateral sutil de 2px em verde `#22C55E`, sem glow/sombra. |
| **C2** | **Fonte mono em todo lugar** | Classes e styles inline aplicando `'Geist Mono', monospace` indiscriminadamente em Monto, Expiración, rótulos, botões e drawers. | Aplicar regra estrita: Geist Mono **apenas** para preço atual, saldo tabular, relógio e valor de operação aberta. Todos os rótulos, botões e textos usam fonte sans institucional (Inter / Archivo). |
| **C3** | **Três tons de verde conflitantes** | Saldo em `#4ADE80` / `#22C47A`, SUBE em `#22C47A`, badges em `#00e676`, bordas em tons variados. | Padronizar rigorosamente um único verde para ganhos e ação: `#22C55E` (`--bm-verde`). Saldo tabular em branco `#F4F5F7` / `#E6EAF0`. |
| **C4** | **Vermelho rosado no BAJA e velas** | `#F2545B` / `#ff3d71` com matiz rosado infantil no botão BAJA, velas e linhas de tempo. | Padronizar no vermelho sóbrio institucional `#E5484D` (`--bm-rojo`). |
| **C5** | **Bordas e cantos inconsistentes** | Mistura de raios (4px, 8px, 10px, 12px) e bordas coloridas não padronizadas. | Padronizar raio de 6px (`border-radius: 6px`) em todos os botões, cards, abas e inputs. Bordas neutras de 1px em `#1F2A3A` sem vazamento cromático. |
| **C6** | **Elementos soltos e sobrepostos** | `ChartDrawingToolbar` e `TradersMoodBar` disputando a mesma coordenada absoluta (`left: 14px`, `top: 60px`), gerando sobreposição; "SU..." truncado; botão "BAJA 45%" isolado; etiqueta `#guest_` desordenada. | Fixar a barra de ferramentas de desenho no canto inferior esquerdo (`bottom: 20px, left: 16px`); alargar e centralizar a TradersMoodBar (`top: 56px, left: 16px`) com rótulos limpos; organizar gaveta e ticket em grid de 12px/16px. |
| **C7** | **Hierarquia tipográfica plana** | Rótulos ("Monto", "Expiración", "Ganancia") com mesmo tamanho e peso dos valores. | Rótulos secundários em 12px cinza `#8A94A6` font-normal/medium; valores principais em 16px branco font-bold; payout percentual em 22px bold. |

---

## 2. Os 12 Itens de Refinamento Técnico (Escopo Fechado)

1. **Etiqueta de preço duplicada no gráfico:** Remover `title: price.toFixed(5)` em `PriceChart.tsx` (que gerava uma segunda etiqueta no canvas ao lado do eixo) e delegar a renderização unicamente para a escala de preço da série com precisão configurada (5 casas para Forex, 2 para Cripto e Sintéticos).
2. **Dois ticket-cards de ganho redundantes:** Remover o cartão duplicado `#guest_` do corpo do ticket. Centralizar notificações de resultado exclusivamente no toast `TradeResultToast.tsx` e deixar no ticket apenas um resumo sutil opcional ("Última operación: +$185.00" em cinza pequeno).
3. **Formatação de moeda mista:** Eliminar ocorrências de `US$ 185,00` (pt-BR) na interface Binmax. Unificar tudo para `$185.00` via `formatCurrencyBinmax`.
4. **Área vazia abaixo do gráfico (Portfolio Drawer):** Manter a gaveta inferior recolhida por padrão ("Mostrar posiciones ⌵"). Ao ser aberta, limitar altura máxima em 220px com rolagem interna suave e visual alinhado ao padrão IQ/Binmax.
5. **Painel de ferramentas flutuante:** Deslocar do topo para o canto inferior esquerdo do gráfico, garantindo zero colisão física ou visual com a barra de sentimento do trader.
6. **Barra de sentimento saneada:** Eliminar truncamento do texto "SUBE 55%" e a caixa vermelha recortada de "BAJA 45%". Rótulos em cinza claro sem fundos contrastantes pesados, perfeitamente simétricos sobre a cápsula bicolor.
7. **Eliminação de linha tracejada órfã (494.9696):** Garantir que linhas de preço no gráfico correspondam estritamente a ordens abertas identificadas com `OrderFlagsOverlay` ou cotação viva; nunca deixar resíduos de strikes anteriores ou linhas desnecessárias.
8. **Etiqueta de expiração refinada:** Substituir o bloco vermelho maciço por container escuro elegante (`rgba(15, 20, 28, 0.92)`) com borda sutil e texto em `#E5484D`. Bandeirinha no eixo temporal proporcional e discreta.
9. **Racionalização da fonte monoespaçada:** Substituição de `Geist Mono` por fontes sans nos rótulos de portfólio, ganhos do dia, seletores e status. Preservação de mono exclusivamente nas métricas numéricas dinâmicas.
10. **Remoção de duplicidade em "Portafolio total":** Manter o indicador de portfólio total unificado na barra de status inferior, despoluindo a barra de cabeçalho da gaveta.
11. **Cabeçalho amigável de ativo:** Exibir "Vol 50" (nome comercial da aba) em vez da chave de backend `SYNTH_VOL_50` no seletor e no topo do gráfico, mantendo o código técnico acessível apenas no popover informativo.
12. **Acabamento fino e microinterações:** Cantos arredondados de 6px, bordas de 1px em `#1F2A3A`, sombras suaves `0 8px 24px rgba(0,0,0,.35)`, hovers de +6% de luminosidade sem brilho neon, espaçamento interno do ticket de 16px e indicador de latência reativo (16ms verde / "Reconectando…" cinza/amarelo quando instável).

---

## 3. Arquitetura das Subetapas de Execução

```text
Orquestrador (tech-lead-orchestrator)
 ├── Subetapa 01: Tokens e Identidade Cromática (Verde #22C55E, Vermelho #E5484D, Branco #E6EAF0, Borda #1F2A3A)
 ├── Subetapa 02: Tipografia, Hierarquia Visual e Unificação Monetária ($185.00)
 ├── Subetapa 03: Engenharia Gráfica, Desacoplamento de Overlays e Eliminação de Duplicidades
 ├── Subetapa 04: Ticket de Operações, Portfólio Retrátil e Resiliência de Conexão
 └── Subetapa 05: Homologação Final, Testes de Caos, Estresse e Garantia Anti-Regressão
```

Cada subetapa é acompanhada de seu respectivo documento com plano passo a passo, testes unitários, testes de estresse, segurança e critérios rigorosos de aceite antes de avançar para a subsequente.
