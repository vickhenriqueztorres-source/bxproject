# Subetapa 07 (P2-2) — Diagnóstico de Correlação Cross-Asset (`scripts/diag/cross-asset-correlation.mjs`)

**Item:** `P2-2` (Média Prioridade — Auditoria Estatística Cross-Asset)  
**Agentes:** `qa-resilience-agent` + `broker-architect-agent` (Implementação e Análise) | `post-implementation-verifier` (Verificação)  
**Skills:** `03-synthetic-market-engine`, `06-testing-quality`, `10-post-implementation-verification`

---

## 1. Contexto e Objetivo

- Na auditoria anterior, o par `VOL_100 × EURUSD_OTC` apresentou correlação `-0.107` em uma amostra curta de `398` minutos ($1/\sqrt{398} \approx 0.05$, logo $2\sigma \approx 0.10$, compatível com flutuação amostral gaussiana).
- **Regra do Prompt:** "Só medir. Script `scripts/diag/cross-asset-correlation.mjs`: `/candles` 1m `limit=1440` para os 36 ativos, retornos log, matriz de correlação. Aceite: `|corr| < 0,10` em todos os pares; se algum passar, repetir em outra janela de 1440. Só abrir correção se repetir nas duas."

---

## 2. Especificação de `scripts/diag/cross-asset-correlation.mjs`

1. **Modos de Fonte de Dados:**
   - **Modo HTTP (`--base-url http://127.0.0.1:3001` ou `https://binmaxbroker.com`):** busca `GET /candles?symbol=<SYM>&interval=1m&limit=1440` para todos os 36 ativos de `ASSETS_CONFIG`.
   - **Modo Engine Direto (fallback automático se o servidor HTTP local não estiver escutando ou via `--engine`):** gera duas janelas independentes de `1440` velas de `1m` para cada um dos 36 ativos usando exatamente `generateSeededHistoricalCandlesUnified` de `scripts/lib/ou-engine.mjs`.
2. **Cálculo Matemático:**
   - Para cada ativo $i \in \{1..36\}$ com série de fechamentos $C_{i,0}, C_{i,1}, \dots, C_{i,N}$ ($N = 1439$ retornos para $1440$ velas):
     $$r_{i,t} = \ln\left(\frac{C_{i,t}}{C_{i,t-1}}\right)$$
   - Para cada um dos $\binom{36}{2} = 630$ pares $(i, j)$:
     $$\text{corr}(i, j) = \frac{\sum_{t=1}^{N} (r_{i,t} - \bar{r}_i)(r_{j,t} - \bar{r}_j)}{\sqrt{\sum_{t=1}^{N} (r_{i,t} - \bar{r}_i)^2 \sum_{t=1}^{N} (r_{j,t} - \bar{r}_j)^2}}$$
3. **Critério de Dupla Janela (`|corr| < 0.10`):**
   - Verifica se algum dos 630 pares tem $|\text{corr}| \ge 0.10$ na Janela 1 (`1440` min).
   - Se algum par ultrapassar `0.10` por flutuação estatística (em 630 pares independentes com $N=1440$, $\sigma_r = 1/\sqrt{1440} \approx 0.02636$, logo $0.10 \approx 3.79\sigma$, probabilidade por par $\approx 0.015\%$), repete a medição em uma **Janela 2 independente de 1440 minutos** (`before` deslocado no HTTP ou nova janela CSPRNG).
   - Reporta:
     - `maxAbsCorrelationWindow1`, `pairsAboveThresholdWindow1`
     - `maxAbsCorrelationWindow2`, `pairsAboveThresholdWindow2`
     - `persistentPairsAboveThreshold` (interseção das duas janelas — deve ser **vazia (`0`)**).
     - Correlação específica do par `VOL_100 × EURUSD_OTC`.

---

## 3. Testes Obrigatórios

Arquivo: `tests/unit/p2-2-cross-asset-correlation.test.mjs`
- Executa a análise matricial de correlação de `scripts/diag/cross-asset-correlation.mjs` sobre os 36 ativos (`1440` minutos) e comprova:
  1. 36 ativos processados (630 pares únicos).
  2. `|corr(VOL_100, EURUSD_OTC)| < 0.10`.
  3. Zero pares com `|corr| >= 0.10` persistente entre duas janelas de `1440` minutos.
