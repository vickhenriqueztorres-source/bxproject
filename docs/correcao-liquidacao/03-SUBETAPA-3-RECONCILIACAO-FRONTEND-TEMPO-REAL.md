# Subetapa 3 — Reconciliação Ativa de Operações em `"Liquidando..."` no Frontend e Normalização de Portfólio

**Orquestrador:** `tech-lead-orchestrator`  
**Agentes Alocados:** `frontend-realtime-agent`, `surgical-frontend-agent`, `qa-resilience-agent`, `compliance-risk-reviewer`  
**Skills Ativadas:** `01-project-context`, `02-financial-invariants`, `03-synthetic-market-engine`, `06-testing-quality`, `17-mudanca-cirurgica`

---

## 1. Objetivo da Subetapa
Garantir que o frontend ([`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx) e [`apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx)) nunca fique preso visualmente em `"Liquidando..."` (`0s`) caso a página seja recarregada com operações abertas, caso um frame WebSocket `contract_settled` se perca durante reconexão, ou caso o tick oficial de expiração leve 1–2s para ser confirmado no banco.

---

## 2. Passo a Passo de Implementação

### Passo 3.1 — Autenticação no Handshake WebSocket e Watchdog de Contratos Vencidos em [`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx)
1. No `ws.onopen` ([`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx#L382-L389)):
   - Se houver token de sessão (`getAuthToken()`), enviar `{ type: 'auth', token }` junto com o `subscribe`, garantindo que a conexão WebSocket fique vinculada ao `user_id` autenticado para recebimento prioritário de `contract_settled` e `wallet_balance`.
2. Adicionar um `useEffect` de **Reconciliação Ativa (Watchdog de Liquidação)** em [`apps/web/src/App.tsx`](file:///d:/brokerproject/apps/web/src/App.tsx):
   - Sempre que `openContracts.length > 0`, verificar a cada `1.000 ms` se existe algum contrato em `openContracts` cujo `Date.parse(c.expires_at) <= Date.now() + 250`.
   - Caso exista pelo menos 1 contrato vencido (em estado `"Liquidando..."`), acionar `refreshPortfolioState()` de forma controlada (sem sobreposição de chamadas em voo).
   - Assim que todos os contratos vencidos transitarem para `SETTLED`, o intervalo fica ocioso automaticamente (Zero overhead quando não há contratos vencendo).

### Passo 3.2 — Normalização de Símbolo `SYNTH_` e Aritmética Inteira de Payout em [`apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx)
1. Ao buscar o preço ao vivo do ativo na aba de operações abertas ([`BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx#L177)):
   - Resolver `const canonicalSym = c.symbol.replace(/^SYNTH_/, '');`
   - Consultar `currentPrices?.[c.symbol] ?? currentPrices?.[canonicalSym] ?? ...` para que contratos persistidos como `SYNTH_VOL_50` sempre encontrem a cotação em tempo real de `VOL_50`.
2. Substituir o cálculo float `Math.round(stake * 0.85)` ([`BinmaxPortfolioDrawer.tsx`](file:///d:/brokerproject/apps/web/src/components/drawer/BinmaxPortfolioDrawer.tsx#L184)) por aritmética inteira estrita:
   - `const payoutPct = typeof c.payout_pct === 'number' && Number.isFinite(c.payout_pct) ? c.payout_pct : 85;`
   - `const expectedProfitMinor = Math.floor((stake * payoutPct) / 100);` (conformidade estrita com D-18 e Skill `02-financial-invariants`).

---

## 3. Baterias Obrigatórias de Testes (`apps/web/src/__tests__/settlement-reconciliation-resilience.test.tsx`)

1. **Teste Unitário de Normalização e Aritmética Inteira no `BinmaxPortfolioDrawer`**:
   - Renderiza operações abertas com `symbol = 'SYNTH_VOL_50'` e `currentPrices = { VOL_50: 505.1234 }`, comprovando cálculo exato de P&L inteiro (`Math.floor((stake * payout_pct) / 100)`) e transição de timer para `"Liquidando..."` quando `remainingSec === 0`.
2. **Teste de Caos / Queda de WebSocket e Recuperação por Watchdog**:
   - Simula operação aberta que atinge `expires_at <= Date.now()` quando o evento WebSocket `contract_settled` é omitido/perdido; comprova que o watchdog de reconciliação consulta `getContracts()`/`getWallet()` e move automaticamente a operação de `openContracts` (`"Liquidando..."`) para `history` (`SETTLED`).
3. **Teste de Regressão e Build Completo**:
   - Execução da suíte Vitest e `pnpm --filter @synth-broker/web build` sem nenhum erro de TypeScript ou bundle.

---

## 4. Critérios de Aceite para Avançar para a Subetapa 4
- [x] Suíte Vitest de reconciliação e portfólio (`apps/web/src/__tests__/settlement-reconciliation-resilience.test.tsx`) 100% VERDE (4/4 testes aprovados).
- [x] Build de produção do frontend (`pnpm --filter @broker/web build`) 100% VERDE.
