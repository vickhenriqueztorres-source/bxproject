# Subetapa 2 — Cleanup Agressivo no Unmount & Destruição Segura de Instâncias

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_2_CLEANUP_AGRESSIVO_UNMOUNT.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-05 (Isolamento de Ativos), Prevenção de Memory Leaks

---

## 1. Objetivo Técnico

Impedir o vazamento silencioso de instâncias do Lightweight Charts, contextos 2D de Canvas e observadores de redimensionamento (`ResizeObserver`).

Quando uma célula da grade é fechada ou seu símbolo é alterado:
1. `chart.remove()` deve ser chamado de forma síncrona para liberar as estruturas C++/Rust/WebAssembly do canvas e os manipuladores de evento no nó DOM.
2. Qualquer `ResizeObserver` ativo deve ser desconectado (`disconnect()`).
3. O mapa de `PriceLine`s deve ser limpo explicitamente antes da remoção das séries.
4. Qualquer query em andamento no TanStack Query associada ao histórico do símbolo da célula deve ser cancelada (`queryClient.cancelQueries`) para evitar que respostas tardias tentem injetar dados em nós desmontados.

---

## 2. Passos de Execução

1. **Passo 2.1:** Auditar a função de cleanup do hook de instanciação em `PriceChart.tsx`.
2. **Passo 2.2:** Adicionar remoção limpa de séries existentes e desassociação de manipuladores de mouse/crosshair.
3. **Passo 2.3:** No componente `GridCell`, assegurar que a desinscrição de tick e staleness ocorra antes do desmonte do nó DOM.
4. **Passo 2.4:** Criar utilitário de expurgo de memória que garanta que referências a arrays de velas anteriores sejam marcadas para coleta de lixo (GC) pelo engine V8.
5. **Passo 2.5:** Criar teste automatizado `tests/test-subetapa-2-fe-aggressive-cleanup.mjs` simulando 50 ciclos rápidos de montagem e desmontagem e verificando se não restam listeners ou timers órfãos.
6. **Passo 2.6:** Validar ausência de vazamento de memória e homologar o Quality Gate da Subetapa 2.

---

## 3. Critérios de Aceite

- [x] Toda instância de `createChart()` tem seu `chart.remove()` invocado no desmonte.
- [x] O `ResizeObserver` é invariavelmente desconectado no cleanup.
- [x] Nenhum callback de tick continua sendo executado para nós já desmontados.
- [x] Zero mensagens de erro de "Warning: Can't perform a React state update on an unmounted component".
