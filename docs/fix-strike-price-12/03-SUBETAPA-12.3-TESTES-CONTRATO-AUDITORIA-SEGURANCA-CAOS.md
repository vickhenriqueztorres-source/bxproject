# Subetapa 12.3 — Testes de Contrato de API, Auditoria de Ticks, Segurança, Caos e Estresse

**Agentes:** `financial-correctness-reviewer` + `security-reviewer` + `qa-resilience-agent` + `post-implementation-verifier`  
**Skills:** `02-financial-invariants`, `04-security-iam`, `06-testing-quality`, `10-post-implementation-verification`

---

## 1. Matriz de Testes Obrigatórios

### 1.1 Testes de Contrato de API e Rastreabilidade (`tests/unit/strike-price-12-contract-audit.test.mjs`)
1. **Invariante Semântica (`OPEN` vs `SETTLED`):**
   - Contrato `OPEN`: `entry_price === strike_price`, `exit_price === null`, `entry_tick_sequence` preenchido, `exit_tick_sequence === null`.
   - Contrato `SETTLED`: `strike_price` **permanece igual a `entry_price`** (jamais muda para `exit_price`), `exit_price` contém o preço do 1º tick oficial com `event_time >= expires_at`, e `exit_tick_sequence` contém o `sequence` exato desse tick.
2. **Paridade entre os 6 pontos de serialização:**
   - Verifica que `POST /contracts`, idempotência em memória, idempotência no banco, erro `23505`, `GET /contracts` e `GET /contracts/:id` produzem exatamente a mesma estrutura canônica via `serializeContract`.
3. **Auditoria Matemática de Liquidação:**
   - Para 50 contratos liquidados em sequência, comprova que `exit_price` é idêntico ao preço do tick `exit_tick_sequence` gravado no histórico oficial e `entry_price` é idêntico ao tick `entry_tick_sequence`.

### 1.2 Testes de Segurança, Caos e Estresse
4. **Segurança (Mass Assignment):**
   - Tentativas de injetar `strike_price`, `entry_price`, `exit_price`, `entry_tick_sequence` ou `exit_tick_sequence` no payload do `POST /contracts` são bloqueadas com `400 MASS_ASSIGNMENT_FORBIDDEN`.
5. **Caos — Cache Misto Legado e Idempotência Pós-Liquidação:**
   - Simula um contrato que acabou de liquidar (`exit_price = 105.50`, `entry_price = 100.00`) sendo consultado via `GET /contracts` e via retry de `POST /contracts` com a mesma `Idempotency-Key`: ambos retornam `entry_price: 100`, `strike_price: 100`, `exit_price: 105.50` sem divergência.
6. **Estresse — 10.000 Serializações e Liquidações Concorrentes:**
   - Executa 10.000 chamadas a `serializeContract` e liquidações concorrentes garantindo `0` mutações de `strike_price` e tempo de execução `< 200ms`.

### 1.3 Testes Frontend Vitest (`tests/unit/strike-price-12-frontend.test.tsx`)
7. **Histórico (`HistoryPage.tsx`):**
   - Contrato `OPEN` mostra `—` na coluna "Cierre" da tabela e no CSV (`generateContractsCsv`), nunca o `entry_price`.
   - Contrato `SETTLED` mostra `exit_price` na coluna "Cierre" e no CSV mesmo com `strike_price === entry_price`.
8. **Gráfico (`OrderFlagsOverlay.tsx`):**
   - `groupOpenContracts` agrupa pelo `entry_price`.
   - O pino de resultado de contrato `SETTLED` usa `contract.exit_price` (e não `strike_price`).
