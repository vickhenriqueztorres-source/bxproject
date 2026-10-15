# Relatório Final — #12 `strike_price` Sobrescrito pelo Preço de Saída

## 1. Resumo Executivo

Todas as entregas especificadas no **Relatório #12 (`strike_price` sobrescrito pelo preço de saída)** foram implementadas na ordem segura de implantação (Front-end primeiro → Servidor & Migração → Testes de Contrato, Auditoria, Segurança, Caos e Estresse):

| Subetapa | Escopo | Status |
|---|---|---|
| **12.1** | Front-end: separação semântica `entry_price` vs `exit_price`, correção de contrato `OPEN` no CSV/tabela de `HistoryPage`, pino de resultado (`OrderFlagsOverlay`), reconciliação suave `applyOptions({ price })` (`PriceChart`) e preço oficial executado no recibo (`OrderTicket`) | **CONCLUÍDA (100%)** |
| **12.2** | Servidor e Banco: `serializeContract(row)` único em `settlement-engine.mjs` + `dev-live-feed.mjs`, remoção de `target.strike_price = exitPrice`, migração `0063_contracts_entry_tick_sequence` e gravação de `entry_tick_sequence` + `exit_tick_sequence` | **CONCLUÍDA (100%)** |
| **12.3** | Suíte automatizada de Contrato de API, Auditoria de 50 Liquidações por Tick Sequence, Segurança contra Mass Assignment, Caos (20 disparos concorrentes) e Estresse (10.000 serializações) | **CONCLUÍDA (100%)** |

---

## 2. Arquivos Criados e Modificados

### Documentação e Planos (`docs/fix-strike-price-12/`)
- [`00-PLANO-GERAL-STRIKE-PRICE-12.md`](file:///d:/brokerproject/docs/fix-strike-price-12/00-PLANO-GERAL-STRIKE-PRICE-12.md)
- [`01-SUBETAPA-12.1-FRONT-EXIT-PRICE-E-TRANSICAO-SUAVE.md`](file:///d:/brokerproject/docs/fix-strike-price-12/01-SUBETAPA-12.1-FRONT-EXIT-PRICE-E-TRANSICAO-SUAVE.md)
- [`02-SUBETAPA-12.2-SERVIDOR-SERIALIZE-CONTRACT-E-MIGRACAO.md`](file:///d:/brokerproject/docs/fix-strike-price-12/02-SUBETAPA-12.2-SERVIDOR-SERIALIZE-CONTRACT-E-MIGRACAO.md)
- [`03-SUBETAPA-12.3-TESTES-CONTRATO-AUDITORIA-SEGURANCA-CAOS.md`](file:///d:/brokerproject/docs/fix-strike-price-12/03-SUBETAPA-12.3-TESTES-CONTRATO-AUDITORIA-SEGURANCA-CAOS.md)

### Banco de Dados (`db/migrations/`)
- [`0063_contracts_entry_tick_sequence.up.sql`](file:///d:/brokerproject/db/migrations/0063_contracts_entry_tick_sequence.up.sql): `ALTER TABLE contracts ADD COLUMN IF NOT EXISTS entry_tick_sequence BIGINT;`
- [`0063_contracts_entry_tick_sequence.down.sql`](file:///d:/brokerproject/db/migrations/0063_contracts_entry_tick_sequence.down.sql): `ALTER TABLE contracts DROP COLUMN IF EXISTS entry_tick_sequence;`

### Backend (`scripts/`)
- [`scripts/lib/settlement-engine.mjs`](file:///d:/brokerproject/scripts/lib/settlement-engine.mjs):
  - Função canônica `serializeContract(row)` garantindo `strike_price === entry_price` sempre e `exit_price === null` quando `status === 'OPEN'`.
  - Liquidação em memória preserva `target.strike_price = entryPrice` e preenche `target.exit_price = exitPrice` e `target.exit_tick_sequence`.
  - Fallback SQL `UPDATE contracts` persiste `exit_tick_sequence = $5`.
  - Evento WebSocket `contract_settled` inclui `entry_price`, `strike_price: entryPrice`, `exit_price`, `entry_tick_sequence` e `exit_tick_sequence`.
- [`scripts/dev-live-feed.mjs`](file:///d:/brokerproject/scripts/dev-live-feed.mjs):
  - Unificação dos 6 pontos de serialização (`GET /contracts/:id`, `GET /contracts`, idempotência em voo/banco/memória/23505 e resposta `201` do `POST /contracts`) via `serializeContract`.
  - Captura de `entry_tick_sequence = currentTick.sequence` na abertura do contrato e persistência no `INSERT INTO contracts`.

### Front-end (`apps/web/src/`)
- [`apps/web/src/api/client.ts`](file:///d:/brokerproject/apps/web/src/api/client.ts):
  - Tipos `Contract` e `Receipt` enriquecidos com `exit_price`, `entry_tick_sequence` e `exit_tick_sequence`.
  - Normalizador `normalizeContractFields` garantindo compatibilidade retroativa e semântica estrita.
- [`apps/web/src/chart/OrderFlagsOverlay.tsx`](file:///d:/brokerproject/apps/web/src/chart/OrderFlagsOverlay.tsx):
  - `groupOpenContracts` e flags de contratos `OPEN` usam `entry_price ?? strike_price`.
  - Pino de resultado (`ExpirationResultPin`) de contratos liquidados lê `contract.exit_price ?? contract.strike_price ?? contract.entry_price`.
- [`apps/web/src/chart/PriceChart.tsx`](file:///d:/brokerproject/apps/web/src/chart/PriceChart.tsx):
  - Cálculo de P&L ao vivo e linhas de strike usam `entry_price ?? strike_price`.
  - Reconciliação suave in-place via `existingLine.line.applyOptions({ price: strike })` quando o servidor confirma o `entry_price` oficial.
- [`apps/web/src/pages/HistoryPage.tsx`](file:///d:/brokerproject/apps/web/src/pages/HistoryPage.tsx):
  - `resolveContractClosingPrice(c)` garante que contratos `OPEN` exibam `'—'` tanto na tabela ("Cierre") quanto no CSV ("Precio Cierre"), e contratos `SETTLED` exibam `exit_price`.
- [`apps/web/src/trade/OrderTicket.tsx`](file:///d:/brokerproject/apps/web/src/trade/OrderTicket.tsx):
  - Reconciliação do contrato otimista com `opened.entry_price ?? opened.strike_price` e `entry_tick_sequence`.
  - Exibição do preço oficial executado (`data-testid="receipt-executed-price"`) no recibo pós-ordem.

---

## 3. Evidências de Testes e Verificação

1. **Testes Unitários Front-end (`tests/unit/strike-price-12-frontend.test.ts`)**:
   - `3/3 PASS` (normalização de `Contract`, CSV e tabela de `HistoryPage` com contrato `OPEN` exibindo `'—'` e `SETTLED` exibindo `exit_price`).
2. **Testes de Regressão Visual/Componente Existentes**:
   - `apps/web/src/chart/strike-lines-precision.unit.test.tsx`: `5/5 PASS`.
   - `apps/web/src/pages/contracts-history-ledger.unit.test.tsx`: `6/6 PASS`.
3. **Suíte de Auditoria, Contrato de API, Caos e Estresse (`tests/unit/strike-price-12-contract-audit.test.mjs`)**:
   - `5/5 PASS` (invariante `strike_price === entry_price` antes e após liquidação, paridade `GET /contracts` vs idempotência, auditoria de 50 contratos liquidados contra `ticks[exit_tick_sequence]`, caos de 20 liquidações concorrentes sem duplicar payout e estresse de 10.000 serializações em ~10ms).
