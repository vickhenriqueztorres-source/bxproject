# Subetapa 04 (P1-2) — Empate (`DRAW`) Comparado com Inteiro Escalado pela Precisão + `fast-check`

**Item:** `P1-2` (Alta Prioridade — Determinismo Matemático na Liquidação)  
**Agentes:** `backend-implementation-agent` (Implementação) | `financial-correctness-reviewer` + `qa-resilience-agent` (Revisão e Verificação)  
**Skills:** `02-financial-invariants`, `03-synthetic-market-engine`, `06-testing-quality`, `17-mudanca-cirurgica`

---

## 1. Diagnóstico do Problema

Em `scripts/lib/settlement-engine.mjs:105-110`:
```js
const entry = Number(entryPrice);
const exit = Number(exitPrice);
const isUp = direction === 'UP';
const won = (isUp && exit > entry) || (!isUp && exit < entry);
const draw = exit === entry;
```
Problemas:
1. Comparar floats IEEE-754 diretamente (`exit === entry`, `exit > entry`, `exit < entry`) sofre com ruído de representação binária:
   - `0.1 + 0.2` (`0.30000000000000004`) vs `'0.3'` resulta em `WIN`/`LOSS` em vez de `DRAW`.
   - `1.0845200000001` vs `'1.08452'` para `EURUSD_OTC` (`precision = 5`) resulta em `WIN`/`LOSS` em vez de `DRAW`.
2. A precisão do ativo está em `getAssetConfig(symbol).precision` (e pode ter alias `decimals` para compatibilidade com a especificação `getAssetConfig(symbol).decimals`).

---

## 2. Passo a Passo de Implementação

### Passo 1 — Escalonamento Inteiro Determinístico (`scalePriceToScaledBigInt`)
1. Em `scripts/lib/ou-engine.mjs`, garantir que cada item de `ASSETS_CONFIG` exponha tanto `precision` quanto `decimals` (`decimals: item.precision`), ou que `getAssetConfig(symbol)` retorne ambos (`precision` e `decimals`).
2. Em `scripts/lib/settlement-engine.mjs`, criar e exportar a função `scalePriceToInt(priceInput, decimals = 6)`:
   - Para evitar qualquer erro de multiplicação float intermediária (como `1.135 * 1000 = 1134.9999999999998`), converter `Number(priceInput)` para string arredondada na precisão `decimals` (ou fazer parse exato de string decimal se já for string sem ruído exponencial, usando `Math.round(Number(priceInput) * (10 ** decimals))` / `BigInt(Math.round(Number(priceInput) * (10 ** decimals)))`).
   - Mais especificamente:
     ```js
     export function scalePriceToInt(priceInput, decimals = 6) {
       const dec = Number.isInteger(decimals) && decimals >= 0 && decimals <= 12 ? decimals : 6;
       const num = Number(priceInput);
       if (!Number.isFinite(num)) {
         throw new Error(`INVALID_PRICE: ${priceInput}`);
       }
       const factor = 10 ** dec;
       return BigInt(Math.round(num * factor));
     }
     ```
   - Comparar `entryScaled` e `exitScaled` como `BigInt`:
     ```js
     const resolvedDecimals =
       decimals !== undefined && decimals !== null
         ? Number(decimals)
         : symbol
           ? (getAssetConfig(symbol)?.decimals ?? getAssetConfig(symbol)?.precision ?? 6)
           : 6;
     const entryScaled = scalePriceToInt(entryPrice, resolvedDecimals);
     const exitScaled = scalePriceToInt(exitPrice, resolvedDecimals);
     const isUp = direction === 'UP';
     const draw = exitScaled === entryScaled;
     const won = !draw && ((isUp && exitScaled > entryScaled) || (!isUp && exitScaled < entryScaled));
     const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
     ```
3. Passar `symbol` e/ou `decimals: state?.precision` em todas as chamadas de `computeContractOutcome` dentro de `settlement-engine.mjs`.

---

## 3. Bateria de Testes Obrigatórios com `fast-check` (Property-Based, Unitário, Estresse e Caos)

Arquivo: `tests/unit/p1-2-draw-integer-comparison.test.mjs`

1. **[Casos Clássicos IEEE-754]:**
   - `'1.10000'` vs `'1.1'` (`decimals = 5`) -> `DRAW`.
   - `0.1 + 0.2` vs `0.3` (`decimals = 5`) -> `DRAW`.
   - `1.0845200000001` vs `1.08452` (`symbol = 'EURUSD_OTC'`, `decimals = 5`) -> `DRAW`.
   - `500.12504` vs `500.12501` (`symbol = 'VOL_50'`, `decimals = 4`) -> `DRAW` (ambos arredondam para `500.1250`).
   - `500.1251` vs `500.1250` (`symbol = 'VOL_50'`, `decimals = 4`) -> `WIN` para `UP`, `LOSS` para `DOWN`.
2. **[Property-Based Testing com `fast-check` (1.000+ pares gerados)]:**
   - Para qualquer par de inteiros `(a, b)` escalados na precisão `d ∈ {2, 3, 4, 5}` formatados como strings decimais `(a / 10^d).toFixed(d)` e `(b / 10^d).toFixed(d)` (com ou sem zeros à direita extras):
     - O resultado de `computeContractOutcome` (`WIN`, `LOSS`, `DRAW`) **bate 100%** com a comparação das strings decimais normalizadas (`BigInt(a) === BigInt(b)`, `BigInt(a) < BigInt(b)`, `BigInt(a) > BigInt(b)`).
   - Para qualquer preço `p` somado a um ruído sub-pip `< 0.4 * 10^(-d)`: `computeContractOutcome` retorna **sempre `DRAW`** e devolve exatamente `stakeMinor`.
3. **[Segurança / Caos - Entradas Malformadas]:**
   - `entryPrice = NaN` ou `exitPrice = Infinity` lança `INVALID_PRICE` (nunca liquida silenciosamente como `LOSS` ou `DRAW`).
