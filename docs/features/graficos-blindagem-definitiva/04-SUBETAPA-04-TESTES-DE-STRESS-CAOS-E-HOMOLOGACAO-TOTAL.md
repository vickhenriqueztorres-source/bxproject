# SUBETAPA 04: TESTES DE ESTRESSE, CAOS E HOMOLOGAÇÃO TOTAL

> **Responsáveis:** `qa-resilience-agent`, `post-implementation-verifier`, `tech-lead-orchestrator`  
> **Arquivos-alvo:**  
> - Suíte de testes completa do Vitest (`apps/web/**` e `tests/unit/**`)  
> - Suíte matemática e de integração do backend (`services/**` e `tests/**`)  
> - Verificação de build de produção e ausência de erros de tipagem TypeScript  

---

## 1. Escopo de Homologação

A Subetapa 04 sela a estabilidade completa da plataforma de gráficos e do frontend comercial:
1. **Verificação das 4 Causas Clássicas do TradingView:**
   - [x] Cleanup completo de WebSocket, intervals e `chart.remove()`.
   - [x] Canvas em `useRef` dedicado, isolado em `IsolatedChartHost`, sem re-render pelo shell.
   - [x] Containers com alturas mínimas definidas (>= 350px) e proteção `ResizeObserver` contra colapso `<= 50px`.
   - [x] Instanciação única de chart/séries com atualização contínua via `setData()` e `update()`.
2. **Verificação das 4 Armadilhas Ocultas:**
   - [x] Sem bloqueio de sequência ao alternar entre múltiplos ativos no `RafChartUpdater`.
   - [x] Sem esmagamento de escala vertical por retenção de preços ou strikes do ativo anterior.
   - [x] 10 indicadores técnicos nativos e lazy loading inicializados de imediato via `isChartReady`.
   - [x] Conformidade de segurança estrita: 0 ocorrências de `Math.random` gerando cotações no frontend.

---

## 2. Bateria de Testes de Caos e Estresse

- **Caos C-01:** Redimensionamentos bruscos do navegador (0px a 4K) enquanto 500 ticks/s chegam.
- **Caos C-02:** Queda e restauração simulada de contexto WebGL (`webglcontextlost` -> `webglcontextrestored`).
- **Caos C-03:** Troca rápida alternada de 10 ativos em menos de 1 segundo sem vazamento de séries ou congelamento.
- **Estresse S-01:** 10.000 velas com ruído e inversão temporal processadas pelo `ensureStrictAscendingBars` e `ChartSanitizer` em < 50ms.
- **Integridade I-01:** Verificação de compilação TypeScript limpa (`tsc --noEmit`) em todos os workspaces.
- **Build B-01:** Geração de bundle de produção com sucesso (`pnpm build`).
