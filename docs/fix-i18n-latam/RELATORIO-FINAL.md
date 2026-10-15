# Relatório Final — `fix/i18n-latam` (Subetapas 7.1, 7.2, 7.4 e 7.5)

**Data**: 15/10/2026  
**Branch**: `fix/i18n-latam`  
**Status**: ✅ **CONCLUÍDO, TESTADO E COMMITADO**

---

## 1. Resumo das Subetapas Executadas

| Subetapa | Escopo | Status | Commit |
|----------|--------|--------|--------|
| **7.2 — Câmbio Real** | Atualizador automático de taxas de câmbio (15 moedas LATAM via API com fallback resiliente) + `GET /api/currencies` + hook `useExchangeRates()` no `I18nProvider` | ✅ Concluída | `da695ad` / `4a376be` |
| **7.1 — Expandir Países (6 → 18)** | Expansão de `PHASE2_COUNTRIES` (18 países), `PHASE2_DISPLAY_CURRENCIES` (15 moedas), `COUNTRY_STAKE_LIMITS`, `CURRENCY_CONFIGS`, `COUNTRY_TIMEZONES` e sincronização em `apps/web/src/i18n/index.tsx` | ✅ Concluída | `0f89847` / `4a376be` |
| **7.5 — PIX Correto por País** | Validação estrita no backend (`method === 'PIX' && country !== 'BR'` → HTTP 400), geração de QR Code EMV/BRCode com CRC16-CCITT para o Brasil, instruções bancárias locais por país (`SPEI`/CLABE no México, `CVU/CBU` na Argentina, `PSE`/NIT na Colômbia, `TED/DOC` no Brasil, etc.) e exibição do botão `PIX` exclusivamente para `BR` no frontend (`DepositPage.tsx` e `BinmaxDepositModal.tsx`) | ✅ Concluída | `4a376be` |
| **7.4 — Vazamento de Idioma** | Pareamento 100% dos catálogos `pt-BR.json` e `es-ES.json` (incluindo `arena.*`, `result.*`, `contract.*`, `mood.*`, `error.*`), remoção de strings em espanhol hardcoded em `App.tsx` (`¡Ganaste!` / `Perdiste` → `t('result.win')` / `t('result.loss')`) e localização de labels da Arena (`Você`/`Tú`, `Índice de Volatilidade`/`Índice de Volatilidad`) | ✅ Concluída | `1ecf893` |
| **7.3 — Migração Gradual de Catálogos Inline** | Opcional / Incremental — Estrutura de catálogos unificada e exposta via `buildCatalog` em `apps/web/src/i18n/index.tsx` | ✅ Coberta | `1ecf893` |

---

## 2. Arquivos Criados e Modificados

### Criados
- `scripts/lib/deposit-instructions.mjs` — Biblioteca isolada de métodos de depósito por país (`getAvailableDepositMethods`), cálculo `calculateCRC16`, gerador `generatePixQrCode`, templates bancários locais (`generateBankInstructions`) e validador `generateDepositInstructions`.
- `tests/unit/pix-instructions.test.mjs` — Testes unitários e de estresse (1.000 gerações < 15ms) da Subetapa 7.5.
- `tests/unit/exchange-rates.test.mjs` — Testes unitários de cobertura das 15 moedas e 18 países da Subetapa 7.2.
- `tests/unit/countries-config.test.mjs` — Testes unitários de sincronia entre `@broker/shared` e `apps/web/src/i18n/index.tsx` da Subetapa 7.1.
- `tests/unit/language-leakage.test.mjs` — Testes unitários de paridade de chaves PT/ES e prevenção de vazamento de idioma da Subetapa 7.4.

### Modificados
- `scripts/dev-live-feed.mjs` — Integração de `deposit-instructions.mjs` nas rotas de depósito (`/api/v1/wallet/deposit`, `/v1/wallet/deposit`, `/api/deposits`), rejeição HTTP 400 para PIX fora do Brasil, e restauração do atualizador de câmbio para as 15 moedas LATAM + rota `GET /api/currencies`.
- `apps/web/src/pages/DepositPage.tsx` e `apps/web/src/wallet/BinmaxDepositModal.tsx` — Exibição condicional de `PIX` apenas para `country === 'BR'` e `Transferencia` (`BANK`) para os demais 17 países LATAM.
- `apps/web/src/api/client.ts` — Tipagem de `country` e `instructions` em `DepositResponse` e `requestDeposit`.
- `apps/web/src/i18n/index.tsx`, `apps/web/src/i18n/locales/pt-BR.json`, `apps/web/src/i18n/locales/es-ES.json` — Suporte aos 18 países/locales, hook `useExchangeRates()` no topo do `I18nProvider` e chaves `arena`, `result`, `contract`, `mood`, `error`.
- `apps/web/src/App.tsx`, `apps/web/src/arena/use-arena.ts`, `apps/web/src/arena/ArenaRoom.tsx` — Eliminação de vazamentos de idioma PT/ES.

---

## 3. Evidências de Testes Executados

### 3.1 Testes Unitários e de Estresse (Node Test Runner)
```text
node --test tests/unit/language-leakage.test.mjs tests/unit/pix-instructions.test.mjs tests/unit/exchange-rates.test.mjs tests/unit/countries-config.test.mjs

✔ Subetapa 7.1 — Expansao de 6 para 18 Paises LATAM (2/2)
✔ Subetapa 7.2 — Cambio Real e Fallback de 15 Moedas LATAM (3/3)
✔ Subetapa 7.4 — Prevencao de Vazamento de Idioma (Language Leakage) (5/5)
✔ Subetapa 7.5 — PIX Correto e Instrucoes de Deposito por Pais (5/5)
# tests 15 | pass 15 | fail 0
```

### 3.2 Testes Unitários de Frontend (Vitest — Carteira, Depósito, i18n e Arena)
```text
npx vitest run apps/web/src/wallet/binmax-wallet.unit.test.tsx apps/web/src/wallet/cashier-transactions.unit.test.tsx apps/web/src/arena/tournaments-arena-i18n.unit.test.tsx apps/web/src/trade/i18n-es.unit.test.ts

✓ apps/web/src/wallet/binmax-wallet.unit.test.tsx (6 tests)
✓ apps/web/src/wallet/cashier-transactions.unit.test.tsx (7 tests)
✓ apps/web/src/trade/i18n-es.unit.test.ts (2 tests)
✓ apps/web/src/arena/tournaments-arena-i18n.unit.test.tsx (10 tests)
Test Files: 4 passed (4) | Tests: 25 passed (25)
```
