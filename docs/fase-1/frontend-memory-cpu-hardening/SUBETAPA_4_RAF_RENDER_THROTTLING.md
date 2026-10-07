# Subetapa 4 — Throttling de Render via requestAnimationFrame (rAF a 60fps)

> **Documento:** `docs/fase-1/frontend-memory-cpu-hardening/SUBETAPA_4_RAF_RENDER_THROTTLING.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** Eficiência de CPU, 60fps Fluido, Zero Dropped Frames

---

## 1. Objetivo Técnico

Em mercados voláteis ou sob rajadas de rede, um ativo pode emitir dezenas de cotações em uma fração de segundo. Se o frontend chamar `series.update()` diretamente para cada tick recebido, o motor gráfico do navegador tentará sincronizar com o Canvas a cada evento, gerando sobrecarga massiva de CPU e quedas severas de taxa de quadros (frame drops).

O olho humano e a tela do monitor operam na frequência de 60Hz (ou 120Hz). Portanto, qualquer redesenho acima de 60fps é puro desperdício computacional.

### Solução com `requestAnimationFrame`:
1. Quando um tick chega, ele é armazenado em uma referência de tick pendente (`pendingTickRef.current = incomingTick`).
2. Se não houver nenhum frame agendado (`!rafIdRef.current`):
   - Agenda uma execução via `requestAnimationFrame`.
3. No disparo do callback do rAF:
   - Extrai o tick mais recente armazenado.
   - Executa `series.update()` e atualiza a linha de preço do TradingView **uma única vez para aquele frame**.
   - Reseta `rafIdRef.current = null`.
4. No cleanup do componente, qualquer animação pendente é cancelada imediatamente via `cancelAnimationFrame(rafIdRef.current)`.

---

## 2. Passos de Execução

1. **Passo 4.1:** Criar módulo ou hook dedicado `apps/web/src/chart/raf-updater.ts` com a lógica estrita de batching via `requestAnimationFrame`.
2. **Passo 4.2:** Integrar o atualizador rAF no `PriceChart.tsx`, substituindo a chamada síncrona direta em `useEffect([tick])`.
3. **Passo 4.3:** Assegurar que ticks intermediários que chegam no mesmo frame de ~16.6ms atualizem apenas o estado final da vela atual (preço atual, máximo e mínimo da barra), mantendo precisão OHLCV perfeita.
4. **Passo 4.4:** Garantir o cancelamento de `cancelAnimationFrame` no retorno do efeito de desmontagem.
5. **Passo 4.5:** Criar teste automatizado `tests/test-subetapa-4-fe-raf-throttling.mjs` simulando rajadas de 100 ticks em 20ms e provando que o número de chamadas de desenho foi comprimido com segurança respeitando o ciclo de rAF.
6. **Passo 4.6:** Homologar o Quality Gate da Subetapa 4.

---

## 3. Critérios de Aceite

- [x] O gráfico nunca chama `series.update()` mais de uma vez no mesmo ciclo de renderização do navegador (60fps).
- [x] Em rajadas de alta frequência (ex: 50 ticks/segundo), o número de paints do Canvas cai em mais de 70%, reduzindo drasticamente o consumo de CPU.
- [x] O último tick da rajada é garantidamente desenhado no frame correspondente, sem lag residual.
- [x] `cancelAnimationFrame` é executado no unmount, impedindo chamadas após a destruição da série.
