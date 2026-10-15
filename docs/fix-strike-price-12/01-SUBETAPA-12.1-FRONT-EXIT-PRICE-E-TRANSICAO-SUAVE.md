# Subetapa 12.1 — Frontend: Semântica `exit_price` vs `entry_price`, Histórico e Preço Executado

**Agentes:** `chart-trading-engineer` + `frontend-realtime-agent`  
**Skills:** `01-project-context`, `11-chart-trading-tools`, `17-mudanca-cirurgica`

---

## 1. Escopo Passo a Passo

### Passo 1.1 — Tipagem e Sanitização no Cliente de API (`apps/web/src/api/client.ts`)
- Atualizar a interface `Contract` e `Receipt` para incluir explicitamente:
  - `entry_price?: number;`
  - `exit_price?: number | null;`
  - `entry_tick_sequence?: number | null;`
  - `exit_tick_sequence?: number | null;`
  - `strike_price?: number;` (alias legado de `entry_price`)
- Em `openContract` (`apps/web/src/api/client.ts` ~l.544):
  - Ler `const rawEntry = contract.entry_price ?? contract.strike_price ?? (envelope as any)?.entry_price ?? (envelope as any)?.strike_price;`
  - Preencher `resultReceipt.entry_price = numEntry` e `resultReceipt.strike_price = numEntry`.
- Em `getContracts` / normalização de contratos lidos da API ou `localStorage`:
  - Garantir que contratos `OPEN` tenham `exit_price: null` e que `entry_price` prevaleça sobre `strike_price`.

### Passo 1.2 — Pino de Resultado e Flags de Entrada (`apps/web/src/chart/OrderFlagsOverlay.tsx` e `PriceChart.tsx`)
- Em `groupOpenContracts` (`OrderFlagsOverlay.tsx` l.44) e nos filtros/badges de contratos `OPEN` (l.324, 365):
  - Trocar `Number(c.strike_price ?? c.entry_price)` por `Number(c.entry_price ?? c.strike_price)`.
- No **pino de resultado** de contratos liquidados (`OrderFlagsOverlay.tsx` l.578):
  - Trocar `const exitPrice = Number(contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0);` por:
    `const exitPrice = Number(contract.exit_price ?? contract.strike_price ?? contract.entry_price ?? currentPrice ?? 0);`
- Em `PriceChart.tsx` (l.184 e l.990):
  - Preferir `c.entry_price ?? c.strike_price` para cálculo de P&L ao vivo e linhas horizontais de strike de contratos `OPEN`.

### Passo 1.3 — Tabela e CSV de Histórico (`apps/web/src/pages/HistoryPage.tsx`)
- Na exportação CSV (`generateContractsCsv`, l.52):
  - Coluna `"Precio Cierre"`: usar `c.status === 'OPEN' || c.exit_price == null ? '—' : c.exit_price` (nunca mostrar `strike_price`/`entry_price` como preço de fechamento em contrato aberto).
- Na tabela de histórico (coluna `"Cierre"`, l.477):
  - Exibir `c.status !== 'OPEN' && c.exit_price != null ? (typeof c.exit_price === 'number' ? c.exit_price.toFixed(4) : c.exit_price) : '—'`.

### Passo 1.4 — Confirmação de Preço Executado e Reconciliação no `OrderTicket.tsx`
- Quando `openContract` resolve (`OrderTicket.tsx` ~l.214–235):
  - Reconciliar o contrato otimista no cache `['contracts']` atualizando `entry_price: opened.entry_price ?? opened.strike_price ?? c.entry_price` e `strike_price: opened.entry_price ?? opened.strike_price ?? c.strike_price`.
  - Exibir o preço oficial executado no banner/recibo de confirmação (`Executado @ {entry_price}`).

---

## 2. Critérios de Validação da Subetapa 12.1
- **Teste Unitário Visual/DOM (Vitest):**
  - Contrato `OPEN` na `HistoryPage` exibe `—` na coluna "Cierre" e no CSV "Precio Cierre".
  - Contrato `SETTLED` na `HistoryPage` exibe `exit_price` na coluna "Cierre" mesmo quando `strike_price === entry_price`.
  - `OrderFlagsOverlay` posiciona o pino de resultado (`ExpirationResultPin`) na coordenada de `exit_price` e mantém as flags `OPEN` em `entry_price`.
