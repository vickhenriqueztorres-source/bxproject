# Subetapa 5 — Lazy Loading, Virtualização & Pausa em Segundo Plano

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_5_LAZY_LOADING_VIRTUALIZACAO.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** Economia de Bateria/CPU, Responsividade de UI

---

## 1. Objetivo Técnico

Em ambientes multi-telas ou abas com múltiplos gráficos:
1. Gráficos que são rolados para fora da área visível (*viewport*) continuam consumindo CPU desenhando pixels invisíveis caso não sejam virtualizados.
2. Quando a aba inteira do navegador é minimizada ou colocada em segundo plano (`document.visibilityState === 'hidden'`), desenhar no Canvas é 100% inútil, pois nenhum pixel é exibido na tela.

### Arquitetura de Virtualização e Pausa:
1. **IntersectionObserver por Célula:** Cada célula da grade monitora sua visibilidade através da API nativa `IntersectionObserver`. Se a interseção for `0%` (fora do viewport), o componente entra em estado `isSuspended = true`.
2. **Page Visibility API:** O gerenciador de grade escuta o evento `visibilitychange`. Se a aba estiver oculta, todas as atualizações de Canvas são pausadas.
3. **Comportamento durante a Pausa:**
   - O WebSocket continua recebendo o último tick (para não perder o preço atual do ativo na reabertura).
   - O desenho do Canvas (`series.update()` / rAF) é suspenso.
4. **Retomada Instantânea:** Ao retornar ao viewport ou com o foco da aba restabelecido, o gráfico aplica a última cotação recebida em um único frame rápido, apresentando a tela atualizada sem travamentos.

---

## 2. Passos de Execução

1. **Passo 5.1:** Criar hook `useVisibilityPause` combinando `IntersectionObserver` e `document.visibilityState`.
2. **Passo 5.2:** Integrar a guarda de visibilidade em `GridCell` e `PriceChart`.
3. **Passo 5.3:** No `raf-updater`, adicionar verificação: se `isSuspended === true`, armazenar o tick mais recente, mas não agendar frames na GPU.
4. **Passo 5.4:** No restabelecimento da visibilidade (`isSuspended === false`), descarregar o último tick acumulado no frame imediatamente seguinte.
5. **Passo 5.5:** Criar teste automatizado `tests/test-subetapa-5-fe-lazy-virtualization.mjs` simulando eventos de transição de visibilidade e comprovando cessação de chamadas gráficas.
6. **Passo 5.6:** Homologar o Quality Gate da Subetapa 5.

---

## 3. Critérios de Aceite

- [x] Células fora do viewport suspendem operações de renderização no Canvas.
- [x] Abas em segundo plano cessam completamente o agendamento de frames via rAF.
- [x] O consumo de CPU com aba minimizada cai para próximo de 0%.
- [x] A retomada da visibilidade reconecta o estado gráfico em < 16ms sem distorção histórica.
