# Subetapa 06 (P2-1) — `sanitizeBootPrice` Estrito em `ou-engine.mjs`

**Item:** `P2-1` (Média Prioridade — Sanidade de Preço no Boot)  
**Agentes:** `backend-implementation-agent` (Implementação) | `broker-architect-agent` + `qa-resilience-agent` (Revisão e Verificação)  
**Skills:** `03-synthetic-market-engine`, `05-resilience-patterns`, `06-testing-quality`, `17-mudanca-cirurgica`

---

## 1. Diagnóstico do Problema

Em `scripts/lib/ou-engine.mjs:147-154`:
```js
export function sanitizeBootPrice(savedPrice, basePrice, precision) {
  const num = Number(savedPrice);
  const base = Number(basePrice);
  if (!Number.isFinite(num) || num < 0.5 * base || num > 2.0 * base) {
    return base.toFixed(precision);
  }
  return num.toFixed(precision);
}
```
- A faixa `[0.5×; 2.0×]` da base é larga demais: no caso real observado em produção para `VOL_50` (`base = 500.125`), o valor anômalo `999.64` (`999.64 / 500.125 = 1.99878×`) passou pela validação!
- Não comparava contra o último `close` persistido (`lastClose`), não exigia `basePrice` válido e não registrava `WARN` estruturado quando rejeitava um preço contaminado.

---

## 2. Passo a Passo de Implementação

### Passo 1 — Nova Assinatura Retrocompatível de `sanitizeBootPrice`
Em `scripts/lib/ou-engine.mjs` (**única alteração na lógica de `ou-engine.mjs`**):
```js
/**
 * Valida o preço de boot nesta ordem estrita (P2-1):
 * 1) Se basePrice estiver ausente ou inválida (<= 0 ou não finita), lança erro explícito.
 * 2) Contra o último close persistido (lastClose): se |boot / lastClose - 1| <= 5% (0.05), aceita.
 * 3) Sem último close: aceita se estiver na faixa [0.7 * basePrice, 1.4 * basePrice].
 * 4) Fora disso: usa lastClose (se válido e dentro de [0.7*base, 1.4*base]) ou basePrice,
 *    e loga WARN com símbolo, valor rejeitado e motivo.
 */
export function sanitizeBootPrice(savedPrice, basePrice, precision = 4, options = {}) {
  const base = Number(basePrice);
  if (
    basePrice === undefined ||
    basePrice === null ||
    typeof basePrice === 'boolean' ||
    String(basePrice).trim() === '' ||
    !Number.isFinite(base) ||
    base <= 0
  ) {
    throw new Error(`INVALID_BASE_PRICE: basePrice ausente ou inválido (${basePrice})`);
  }

  const prec = Number.isInteger(precision) && precision >= 0 ? precision : 4;
  const symbol = options?.symbol || 'UNKNOWN';
  const rawLastClose = options?.lastClose;
  const hasValidLastClose =
    rawLastClose !== undefined &&
    rawLastClose !== null &&
    String(rawLastClose).trim() !== '' &&
    Number.isFinite(Number(rawLastClose)) &&
    Number(rawLastClose) > 0;
  const lastCloseNum = hasValidLastClose ? Number(rawLastClose) : null;
  const warnFn = typeof options?.logger?.warn === 'function'
    ? options.logger.warn.bind(options.logger)
    : console.warn;

  const boot = Number(savedPrice);
  if (
    savedPrice === undefined ||
    savedPrice === null ||
    typeof savedPrice === 'boolean' ||
    String(savedPrice).trim() === '' ||
    !Number.isFinite(boot) ||
    boot <= 0
  ) {
    const fallback = lastCloseNum !== null ? lastCloseNum : base;
    warnFn(
      `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${savedPrice} reason=NON_FINITE_OR_NON_POSITIVE fallback=${fallback.toFixed(prec)}`
    );
    return fallback.toFixed(prec);
  }

  // Regra 1: Com último close persistido -> |boot / lastClose - 1| <= 5%
  if (lastCloseNum !== null) {
    const relDiff = Math.abs(boot / lastCloseNum - 1);
    if (relDiff <= 0.05 + 1e-12) {
      return boot.toFixed(prec);
    }
    warnFn(
      `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${boot} reason=EXCEEDS_5PCT_FROM_LAST_CLOSE(lastClose=${lastCloseNum},diffPct=${(relDiff * 100).toFixed(2)}%) fallback=${lastCloseNum.toFixed(prec)}`
    );
    return lastCloseNum.toFixed(prec);
  }

  // Regra 2: Sem último close -> faixa [0.7 * base, 1.4 * base]
  if (boot >= 0.7 * base && boot <= 1.4 * base) {
    return boot.toFixed(prec);
  }

  // Regra 3: Fora da faixa -> usa base e loga WARN com símbolo, valor rejeitado e motivo
  warnFn(
    `[WARN][sanitizeBootPrice] symbol=${symbol} rejected=${boot} reason=OUTSIDE_BASE_BAND_0.7_1.4(base=${base},ratio=${(boot / base).toFixed(4)}) fallback=${base.toFixed(prec)}`
  );
  return base.toFixed(prec);
}
```

### Passo 2 — Passar `symbol` e `lastClose` no Bootstrap do `scripts/dev-live-feed.mjs`
Em `scripts/dev-live-feed.mjs` (`bootstrapMarketState`), ao chamar `sanitizeBootPrice`:
- Obter o último `close` persistido das velas oficiais/seeded (quando disponível e dentro da banda sã da base) e passar `{ symbol: item.symbol, lastClose }`.

---

## 3. Bateria de Testes Obrigatórios (Unitário, Estresse, Segurança e Caos)

Arquivo: `tests/unit/p2-1-sanitize-boot-price.test.mjs`

1. **[Caso Real de Produção (`VOL_50` em `999.64`)]:**
   - `basePrice = 500.125`, `precision = 4`:
   - `sanitizeBootPrice(999.64, 500.125, 4, { symbol: 'VOL_50' })` -> **rejeita `999.64`**, retorna `'500.1250'` e emite log `WARN` contendo `VOL_50`, `999.64` e o motivo.
   - Com `lastClose = 500.125`: `sanitizeBootPrice(999.64, 500.125, 4, { symbol: 'VOL_50', lastClose: 500.125 })` -> **rejeita `999.64`**, retorna `'500.1250'` e loga `EXCEEDS_5PCT_FROM_LAST_CLOSE`.
2. **[Aceitação de `502.4`]:**
   - `sanitizeBootPrice(502.4, 500.125, 4, { symbol: 'VOL_50', lastClose: 500.125 })` -> **aceita `'502.4000'`** (`|502.4 / 500.125 - 1| = 0.45% <= 5%`) sem emitir `WARN`.
   - Sem `lastClose`: `sanitizeBootPrice(502.4, 500.125, 4, { symbol: 'VOL_50' })` -> **aceita `'502.4000'`** (dentro de `[0.7×; 1.4×]`).
3. **[Base Ausente / Inválida]:**
   - `sanitizeBootPrice(500, undefined, 4)`, `sanitizeBootPrice(500, null, 4)`, `sanitizeBootPrice(500, 0, 4)`, `sanitizeBootPrice(500, -10, 4)`, `sanitizeBootPrice(500, NaN, 4)` -> lançam erro explícito `/INVALID_BASE_PRICE/`.
4. **[Fronteiras Exatas de `±5%` e `[0.7×; 1.4×]`]:**
   - Testa `lastClose * 1.05` (aceito) vs `lastClose * 1.0501` (rejeitado -> `lastClose`).
   - Testa `base * 0.70` e `base * 1.40` sem `lastClose` (aceitos) vs `base * 0.699` e `base * 1.401` (rejeitados -> `base`).
