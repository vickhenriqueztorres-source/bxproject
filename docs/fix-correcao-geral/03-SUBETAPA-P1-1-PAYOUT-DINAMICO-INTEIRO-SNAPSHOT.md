# Subetapa 03 (P1-1) — Payout Dinâmico por Snapshot no Contrato e Aritmética Inteira

**Item:** `P1-1` (Alta Prioridade — Precisão Financeira e Liquidação)  
**Agentes:** `backend-implementation-agent` (Implementação) | `financial-correctness-reviewer` + `qa-resilience-agent` + `post-implementation-verifier` (Revisão e Verificação)  
**Skills:** `01-project-context`, `02-financial-invariants`, `06-testing-quality`, `08-database-foundation`, `17-mudanca-cirurgica`

---

## 1. Diagnóstico do Problema

1. Em `scripts/lib/settlement-engine.mjs:112`, `computeContractOutcome` calculava:
   ```js
   const payoutMinor = won ? Math.round(stake * 1.85) : draw ? stake : 0;
   ```
   - Ignorava completamente o `payout_pct` do contrato.
   - Utilizava ponto flutuante (`stake * 1.85`) com `Math.round`, o que para stakes ímpares (ex.: `333` centavos a `85%` -> `333 * 1.85 = 616.05`, ou `335` a `85%` -> `335 * 0.85 = 284.75 -> 285`) arredondava meio centavo **a favor do cliente** (`Math.round`), violando a invariante de aritmética inteira truncada (`Math.floor`).
2. Na abertura do contrato (`scripts/dev-live-feed.mjs`), o `payout_pct` do ativo no momento da abertura precisa ser gravado na linha de `contracts` (`payout_pct`) e serializado em `serializeContract`.

---

## 2. Passo a Passo de Implementação

### Passo 1 — Migration Idempotente (`0064_contracts_payout_pct`)
Criar `db/migrations/0064_contracts_payout_pct.up.sql` e `db/migrations/0064_contracts_payout_pct.down.sql` (numerada imediatamente após a `0063`):
```sql
-- db/migrations/0064_contracts_payout_pct.up.sql
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS payout_pct INTEGER NOT NULL DEFAULT 85;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_contracts_payout_pct_range'
  ) THEN
    ALTER TABLE contracts
      ADD CONSTRAINT chk_contracts_payout_pct_range CHECK (payout_pct >= 0 AND payout_pct <= 100);
  END IF;
END $$;
```
E no bootstrap de `scripts/dev-live-feed.mjs`:
```js
pgPool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS payout_pct INTEGER NOT NULL DEFAULT 85').catch(() => {});
```

### Passo 2 — `computeContractOutcome` em `scripts/lib/settlement-engine.mjs`
1. Exigir `payoutPct` como parâmetro obrigatório e validar que é número finito/inteiro dentro de `[0, 100]`:
   ```js
   if (payoutPct === undefined || payoutPct === null || typeof payoutPct === 'boolean' || String(payoutPct).trim() === '') {
     throw new Error('INVALID_PAYOUT_PCT: payoutPct is required');
   }
   const parsedPayoutPct = Number(payoutPct);
   if (!Number.isFinite(parsedPayoutPct) || parsedPayoutPct < 0 || parsedPayoutPct > 100) {
     throw new Error(`INVALID_PAYOUT_PCT: must be within [0, 100], got ${payoutPct}`);
   }
   ```
2. Calcular `payoutMinor` usando exclusivamente aritmética inteira em minor units:
   ```js
   const profitMinor = Math.floor((stake * Math.trunc(parsedPayoutPct)) / 100);
   const payoutMinor = won ? stake + profitMinor : draw ? stake : 0;
   ```
3. Na liquidação (`settleOpenContract` em `settlement-engine.mjs`):
   - Ler `contractRow.payout_pct` (do banco) ou `target.payout_pct` (da memória).
   - Se um contrato antigo não tiver `payout_pct` (`null` ou `undefined`), usar `85` **apenas para ele**, emitindo `console.warn(\`[Settlement] Contrato legado \${contractId} sem payout_pct; aplicando fallback 85%\`)`.
4. Em `serializeContract(row)`:
   - Incluir `payout_pct: row.payout_pct !== undefined && row.payout_pct !== null ? Number(row.payout_pct) : 85` (ou preservar compatibilidade estrita com contratos existentes).
   - **Atenção:** Verificar os testes de contrato de `serializeContract` (`tests/unit/strike-price-12-contract-audit.test.mjs`) para garantir que se `payout_pct` for incluído condicionalmente (como `duration_seconds`, `expiry_mode`, `idempotency_key`), não quebre nenhum deepEqual!
     - Veja linhas 183-191 de `settlement-engine.mjs`:
       ```js
       if (row.payout_pct !== undefined && row.payout_pct !== null) {
         serialized.payout_pct = Number(row.payout_pct);
       }
       ```
       Isso preserva 100% de compatibilidade com todos os testes que comparam `Object.keys(serialized)` quando `row.payout_pct` não foi passado no mock, e inclui `payout_pct` sempre que presente na linha do banco ou no objeto de contrato!

### Passo 3 — Gravação na Abertura (`scripts/dev-live-feed.mjs`) e Auditoria (`live-market-store.mjs`)
1. Em `ASSETS_CONFIG` (`scripts/lib/ou-engine.mjs`), garantir `payout_pct: 85` como propriedade padrão de cada ativo (ou resolver via `state.payoutPct ?? item.payout_pct ?? 85`).
2. Em `GET /api/indices/:symbol`, retornar `payout_pct: state?.payoutPct ?? 85`.
3. Em `POST /contracts` (`scripts/dev-live-feed.mjs`), capturar `const contractPayoutPct = state?.payoutPct ?? 85;`, gravar em `newContract.payout_pct = contractPayoutPct` e no `INSERT INTO contracts (..., payout_pct) VALUES (..., $10)`.
4. Em `services/tick-engine/live-market-store.mjs` (`verifyMarketAuditIntegrity`, linha 1082): usar `c.payout_pct ?? 85` com a mesma fórmula `stakeMinor + Math.floor((stakeMinor * payoutPct) / 100)`.

---

## 3. Bateria de Testes Obrigatórios (Unitário, Integração, Estresse, Segurança e Caos)

Arquivo: `tests/unit/p1-1-dynamic-payout.test.mjs`

1. **[Unitário - Valores Exatos e Stakes Ímpares]:**
   - `payoutPct = 85`, `stake = 333` -> `333 + Math.floor(333 * 85 / 100) = 333 + 283 = 616` (e para `stake = 335`, `335 + Math.floor(335 * 85 / 100) = 335 + 284 = 619`, nunca `620` que `Math.round` daria!).
   - `payoutPct = 80`, `stake = 333` -> `333 + 266 = 599`.
   - `payoutPct = 70`, `stake = 333` -> `333 + 233 = 566`.
2. **[Segurança / Validação Fail-Closed de `payoutPct`]:**
   - `payoutPct` ausente (`undefined`, `null`, `NaN`, `''`), negativo (`-1`), ou `> 100` (`101`, `185`, `Infinity`) lança erro explícito `INVALID_PAYOUT_PCT`.
3. **[Integração / Snapshot Temporal]:**
   - Contrato aberto quando o ativo tinha `payout_pct = 80`.
   - Antes da expiração, o `payout_pct` do ativo muda para `90`.
   - Na liquidação, o contrato usa os `80%` gravados no contrato, nunca os `90%` atuais do ativo.
4. **[Caos - Contrato Legado sem `payout_pct`]:**
   - Contrato antigo vindo do banco com `payout_pct: null` liquida usando fallback `85%` e emite `WARN` no log.
