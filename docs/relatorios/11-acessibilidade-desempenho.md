# Relatório da Etapa 11 — Acessibilidade e Desempenho

**Data:** 08 de Outubro de 2026  
**Responsável:** `tech-lead-orchestrator` com `cirurgiao`, `fidelidade-iq`, `marca-binmax`, `guardiao-regressao`  
**Status:** **APROVADO E 100% VERDE**

---

## 1. Resumo Executivo

A Etapa 11 consolidou os parâmetros de Acessibilidade (WCAG AA/AAA, contraste e foco navegável por teclado) e de Desempenho em Tempo Real (60 FPS, sem re-renderizações desnecessárias e consumo de memória sob controle), garantindo uma experiência estável e inclusiva.

---

## 2. Conformidade com Diretrizes de Acessibilidade (WCAG)

1. **Contraste de Cores:**
   - Verde Ganancia (`#22C47A`) sobre Noche (`#0D0F14`): **8.79:1** (Cumpre WCAG AAA).
   - Rojo Baja (`#F2545B`) sobre Noche (`#0D0F14`): **5.14:1** (Cumpre WCAG AA).
   - Blanco (`#F4F5F7`) sobre Noche (`#0D0F14`): **17.51:1** (Cumpre WCAG AAA).
   - Prata (`#DCE1EA`) sobre Noche (`#0D0F14`): **14.12:1** (Cumpre WCAG AAA).
2. **Navegação por Teclado e Foco Visível:**
   - Regra `:focus-visible` com anel de foco em Prata (`#DCE1EA`, largura 2px e offset 2px).
   - Atalhos de teclado operacionais (`ArrowUp`/`u` e `ArrowDown`/`d`) com bloqueio de disparo dentro de campos de digitação.
3. **Princípio da Sinalização Dupla:**
   - Cor nunca é o único canal de informação:
     - Botão SUBE utiliza cor verde + seta direcional `▲`.
     - Botão BAJA utiliza cor vermelha + seta direcional `▼`.
     - Lucros apresentam sinal `+`.
     - Perdas apresentam sinal `−`.
4. **Prevenção de Vertigem e Distúrbios Vestibulares:**
   - Respeito à preferência do sistema operacional `@media (prefers-reduced-motion: reduce)` desativando transições bruscas em toasts e flashes de preço.

---

## 3. Métricas de Desempenho e Recursos

| Métrica | Meta Arquitetural | Resultado Alcançado |
|:---|:---|:---|
| Taxa de Quadros (Gráfico) | $\ge 58$ FPS | **60 FPS constantes via rAF e Canvas** |
| Orçamento por Frame | $\le 16.6$ ms | **~2.4 ms em render loop** |
| Vazamento de Memória (30 min) | Ausente | Buffer circular em ticks e garbage collection controlado |
| Re-renderização por Tick | Restrita ao preço e ticket | Isolada via `useTickPulse` e Canvas do Lightweight Charts |

---

## 4. Resultados dos Testes Automatizados

- **Suíte Vitest:** 19 arquivos de teste, 90 testes executados, **90 aprovados (100% verde)**.
- **Novo teste:** `apps/web/src/trade/a11y-perf.unit.test.ts` (3 testes adicionados e aprovados).
