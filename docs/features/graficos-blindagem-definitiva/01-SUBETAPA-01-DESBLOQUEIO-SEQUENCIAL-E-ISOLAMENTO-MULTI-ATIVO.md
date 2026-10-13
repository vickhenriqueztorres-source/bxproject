# SUBETAPA 01: DESBLOQUEIO SEQUENCIAL E ISOLAMENTO MULTI-ATIVO NO RAF UPDATER

> **Responsáveis:** `chart-trading-engineer`, `surgical-frontend-agent`, `qa-resilience-agent`  
> **Arquivos-alvo:**  
> - `apps/web/src/chart/raf-updater.ts`  
> - `apps/web/src/chart/PriceChart.tsx`  
> - `apps/web/src/chart/raf-updater.unit.test.ts` (testes de estresse e transição)

---

## 1. Problema e Causa Raiz

No `RafChartUpdater`, a propriedade `lastSequence: bigint` era tratada como um contador estático escalar.
Quando um ativo A com sequência avançada (ex: `sequence: 54200`) é substituído por um ativo B com sequência inferior (ex: `sequence: 1200`), o validador:
```typescript
if (seq <= this.lastSequence) {
  this.droppedUpdatesCount++;
  return;
}
```
interpretava todos os ticks de B como "mensagens atrasadas" e descartava **100% dos ticks do novo ativo**.
Isso causava congelamento completo da cotação no gráfico quando o usuário trocava de par no traderoom.

---

## 2. Solução Técnica Arquitetural

1. **Particionamento por Símbolo (`symbolSequences: Map<string, bigint>`):**
   - Em vez de uma única sequência global, o `RafChartUpdater` armazena a sequência mais recente de cada símbolo isoladamente.
   - Fornece método explícito `reset(symbol?: string)` para limpar o estado ao trocar de par ou reiniciar o feed.
2. **Descarte Atômico do Tick Pendente na Troca de Símbolo:**
   - Se houver um tick enfileirado no rAF para o símbolo antigo, ele é limpo imediatamente no `reset()`, impedindo que um tick defasado atinja a série do novo ativo.
3. **Sincronização no `PriceChart.tsx`:**
   - Adicionar efeito reativo que dispara `rafUpdaterRef.current.reset(symbol)` sempre que a prop `symbol` mudar.

---

## 3. Plano de Testes de Estresse e Caos (Subetapa 01)

- **Teste 1.1 (Desbloqueio de Sequência em Troca de Ativo):** Enviar 1.000 ticks para `SYNTH_VOL_50` (seq 50.000), alternar para `EURUSD_OTC` (seq 100), e comprovar que 100% dos ticks de `EURUSD_OTC` são processados e entregues ao callback sem descarte.
- **Teste 1.2 (Stress Burst Multissímbolo):** Alternar entre 4 símbolos diferentes a cada 50ms com rajadas de 500 ticks por segundo, verificando que nenhuma exceção é lançada e a sequência monotônica interna de cada símbolo é respeitada.
- **Teste 1.3 (Descarte de Zumbi Pendente):** Enfileirar tick para símbolo X, chamar `reset()`, e comprovar que o rAF seguinte não emite o tick zumbi de X.
