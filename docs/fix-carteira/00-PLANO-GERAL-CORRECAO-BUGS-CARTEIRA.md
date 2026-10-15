# Plano Geral — Correção de 4 Bugs Críticos de Carteira/Contrato

**Projeto**: Binmax (brokerproject)  
**Branch**: `fix/carteira`  
**Monólito**: `scripts/dev-live-feed.mjs` + `scripts/lib/settlement-engine.mjs`  
**Data**: 2026-10-15  
**Agente**: tech-lead-orchestrator + backend-implementation-agent  

---

## 0. Contexto e Escopo

### 0.1 Objetivo
Corrigir **4 bugs críticos** encontrados em auditoria no fluxo de carteira/abertura de contrato:

1. **BUG 1 (CRÍTICO)**: Ordem abre mesmo quando débito falha
2. **BUG 2**: Payout fixo hardcoded em dois lugares
3. **BUG 3**: Empate (DRAW) comparado em ponto flutuante
4. **BUG 4**: Reserva no Blnk fire-and-forget (fora da transação)

### 0.2 Zonas Proibidas (NÃO TOCAR)
- ❌ `apps/web/src/arena/**` (outro agente trabalhando em torneio)
- ❌ Trechos de torneio/arena em `scripts/dev-live-feed.mjs`
- ❌ `apps/web/src/App.tsx`
- ❌ `apps/web/src/api/client.ts`
- ❌ NÃO refatorar: polling de carteira, auth, Blnk schema, formato de API/WebSocket
- ❌ NÃO fazer deploy
- ❌ NÃO migrations destrutivas (só aditivas com DEFAULT)

### 0.3 Regras Duras
- ✅ Branch `fix/carteira` exclusiva
- ✅ **4 commits** (um por bug) + commits de testes
- ✅ Commits pequenos e atômicos
- ✅ Comportamento novo atrás de flag quando indicado
- ✅ Ler trechos antes de editar e confirmar números de linha
- ✅ Fail-closed em todos os caminhos de erro
- ✅ Zero caminhos que abrem contrato sem débito bem-sucedido

---

## 1. Mapeamento dos Bugs (Estado Atual)

### BUG 1 — Ordem abre mesmo quando débito falha (CRÍTICO)

**Localização Real**:
- ❌ **NÃO está na linha ~2620** conforme descrito
- ✅ **ESTÁ em:** Modo "demo sem Blnk" (~linha 2956-2972 em `dev-live-feed.mjs`)
- ✅ Débito do Blnk (~linha 2922-2954) **JÁ está correto** (usa `abortOrder` nos catches)

**Código Atual (Modo Demo)**:
```javascript
// linha ~2956-2972
} else {
  let userBalance = devWallet.available_minor;
  if (authData && authData.sub && pgPool) {
    try {
      const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
      if (uRes.rows.length > 0) {
        userBalance = Number(uRes.rows[0].demo_balance_minor);
      }
    } catch (_) {}  // ❌ PROBLEMA: Catch silencioso, continua mesmo se falhar
  }
  if (stake > userBalance) {
    abortOrder(400, { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' });
    return;
  }
  // ... continua criando contrato
}
```

**Problema**: O `catch (_) {}` é silencioso. Se a query falhar (conexão caiu, timeout), `userBalance` fica com o valor de `devWallet.available_minor` (não atualizado) e o fluxo continua.

### BUG 2 — Payout fixo hardcoded

**Localizações Reais**:
1. ✅ `scripts/dev-live-feed.mjs:1030` — Endpoint `/api/indices/:symbol`
   ```javascript
   payout_pct: 85
   ```

2. ✅ `scripts/lib/settlement-engine.mjs:112` — Função `computeContractOutcome`
   ```javascript
   const payoutMinor = won ? Math.round(stake * 1.85) : draw ? stake : 0;
   ```

**Problema**: Valor fixo 85%. Não há configuração por ativo, e contratos não gravam o payout no momento da abertura.

### BUG 3 — Empate comparado em float

**Localização Real**:
✅ `scripts/lib/settlement-engine.mjs:110`
```javascript
const draw = exit === entry;  // ❌ Comparação direta de floats
```

**Problema**: Preços como `1.0845200000001` vs `1.08452` podem ter `exit === entry` falso mesmo sendo iguais na precisão do ativo.

### BUG 4 — Blnk fire-and-forget

**Localização Real**:
✅ `scripts/dev-live-feed.mjs:2942` — Chamada paralela ao Blnk
```javascript
await blnk.reserveStake(authData.sub, contractId, stake);
```

**Verificação da Outbox**:
✅ Outbox **JÁ EXISTE** e está na mesma transação (~linha 3060-3063):
```javascript
await dbClient.query(`
  INSERT INTO outbox_events (event_type, payload, status, processed_at)
  VALUES ('RESERVE_STAKE', $1::jsonb, $2::varchar(16), ...)
`, [outboxPayload, blnkConfigured ? 'PROCESSED' : 'PENDING']);
```

**Problema**: A chamada `blnk.reserveStake` na linha 2942 é **paralela e fora da transação**. Se falhar, o evento fica como `PROCESSED` na outbox mas a reserva não aconteceu.

---

## 2. Arquitetura da Correção

### 2.1 Princípios
1. **Fail-Closed**: Erro = ordem recusada, **nunca** ordem aberta
2. **Idempotência Preservada**: Chaves existentes continuam funcionando
3. **Retrocompatibilidade**: Contratos antigos liquidam com payout antigo
4. **Precisão Financeira**: Comparações em inteiros na precisão do ativo
5. **Transação ACID**: Tudo ou nada (contrato + outbox + eventos)

### 2.2 Dependências Externas
- PostgreSQL (tabelas: `users`, `contracts`, `outbox_events`, `indices`)
- Blnk Ledger (API externa)
- Redis (não afetado)

### 2.3 Ordem de Implementação
```
BUG 1 → BUG 4 → BUG 2 → BUG 3
 ↓       ↓       ↓       ↓
Base   Outbox  Config  Liquidação
```

**Justificativa da Ordem**:
1. **BUG 1 primeiro**: Tapa o buraco mais crítico (dinheiro fantasma)
2. **BUG 4 antes do 2**: Remove chamada paralela antes de mexer em payout
3. **BUG 2 antes do 3**: Config por ativo necessária antes de liquidação
4. **BUG 3 por último**: Depende de precisão configurada por ativo

---

## 3. Riscos e Mitigações

### 3.1 Riscos Técnicos

| Risco | Impacto | Probabilidade | Mitigação |
|-------|---------|---------------|-----------|
| Query `SELECT demo_balance_minor` falha e aborta ordens válidas | MÉDIO | BAIXA | Retry com backoff + fallback para `devWallet` com flag de degradação |
| Migration adiciona coluna sem DEFAULT e trava INSERTs antigos | ALTO | BAIXA | Sempre `ALTER TABLE ADD COLUMN ... DEFAULT` |
| Contratos antigos liquidam com payout errado | MÉDIO | MÉDIA | Gravar `payout_pct` no contrato, liquidação lê dele |
| Comparação em int quebra empates legítimos | BAIXO | BAIXA | Usar precisão correta do ativo (`ASSETS_CONFIG`) |
| Remover `blnk.reserveStake` quebra fluxo sem outbox worker | ALTO | BAIXA | Só remover se outbox já está ativa e worker roda |

### 3.2 Riscos de Negócio

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Ordens recusadas por timeout de banco (falsos negativos) | MÉDIO | Monitorar taxa de erro 503, ajustar timeout, circuit breaker |
| Mudança de payout não refletida em contratos abertos | ALTO | Gravar no contrato, nunca ler config global na liquidação |
| Empates raros viram WIN/LOSS | BAIXO | Testes com preços idênticos na precisão do ativo |

### 3.3 Rollback

**Por Commit**:
```bash
# Rollback BUG 1
git revert <commit-bug-1>

# Rollback BUG 2 (migration + código)
git revert <commit-bug-2>
# Migration down manual se necessário:
psql -f db/migrations/0070_payout_per_asset.down.sql

# Rollback BUG 3
git revert <commit-bug-3>

# Rollback BUG 4
git revert <commit-bug-4>
```

**Rollback Completo da Branch**:
```bash
git checkout main
git branch -D fix/carteira
```

---

## 4. Subetapas Detalhadas

### Subetapa 1 — BUG 1: Fail-Closed no Débito Demo
**Arquivo**: `01-SUBETAPA-BUG-1-DEBITO-FAIL-CLOSED.md`
- Adicionar `abortOrder` no `catch` de `SELECT demo_balance_minor`
- Testes: saldo insuficiente, erro de conexão, timeout
- Commit: `fix(wallet): fail-closed on demo balance query error`

### Subetapa 2 — BUG 2: Payout Configurável por Ativo
**Arquivo**: `02-SUBETAPA-BUG-2-PAYOUT-CONFIGURAVEL.md`
- Migration aditiva: `ALTER TABLE contracts ADD COLUMN payout_pct INT DEFAULT 85`
- Adicionar `payout_pct` em `ASSETS_CONFIG`
- Endpoint `/api/indices/:symbol` retorna `payout_pct` do config
- Abertura de contrato grava `payout_pct` do config no momento
- Liquidação usa `payout_pct` gravado no contrato
- Commit: `feat(payout): configurable payout per asset with contract snapshot`

### Subetapa 3 — BUG 3: Comparação de Empate em Inteiros
**Arquivo**: `03-SUBETAPA-BUG-3-EMPATE-INTEGER-COMPARISON.md`
- Modificar `computeContractOutcome` para comparar em inteiros
- Usar `precision` do ativo para escalar preços
- Testes: preços idênticos na precisão mas diferentes em float
- Commit: `fix(settlement): DRAW comparison in integer precision`

### Subetapa 4 — BUG 4: Remover Blnk Paralelo, Usar Outbox
**Arquivo**: `04-SUBETAPA-BUG-4-OUTBOX-EXCLUSIVE.md`
- Remover `await blnk.reserveStake(...)` da linha 2942
- Verificar que outbox já está ativa e worker consumindo
- Testes: Blnk down → contrato abre, evento fica pendente
- Commit: `refactor(ledger): use outbox exclusively for Blnk reserve`

---

## 5. Critérios de Aceite Globais

### 5.1 Funcionais
- ✅ Erro de query de saldo → ordem recusada com erro 503
- ✅ Saldo insuficiente → ordem recusada com erro 400
- ✅ Payout configurável por ativo → contratos novos gravam payout
- ✅ Contratos antigos → liquidam com payout gravado (85% por padrão)
- ✅ Empate (preços iguais na precisão do ativo) → resultado DRAW
- ✅ Diferença de 1 unidade na última casa → WIN/LOSS correto
- ✅ Blnk down → contrato abre, evento fica pendente na outbox
- ✅ Blnk volta → worker processa eventos pendentes

### 5.2 Técnicos
- ✅ Suíte de testes existente: 100% passando
- ✅ 4 testes novos (um por bug): 100% passando
- ✅ Zero constantes de payout soltas (grep negativo)
- ✅ Zero chamadas Blnk fora da outbox (grep negativo)
- ✅ Migration reversível (`.up.sql` + `.down.sql`)
- ✅ Nenhum arquivo proibido tocado (`git diff --name-only`)

### 5.3 Segurança
- ✅ Nenhum caminho de erro abre contrato sem débito
- ✅ Idempotência preservada (chaves antigas funcionam)
- ✅ Nenhum UPDATE direto de `demo_balance_minor` fora de transação
- ✅ Outbox transacional (mesma transação que INSERT do contrato)

---

## 6. Testes Obrigatórios

### 6.1 Por Bug

**BUG 1 — Fail-Closed**:
```javascript
// Teste 1: Erro de conexão do banco
test('BUG-1: erro de query aborta ordem', async () => {
  // Simular pgPool.query que falha
  // Esperar: resposta 503, zero contratos criados
});

// Teste 2: Saldo insuficiente
test('BUG-1: saldo insuficiente recusa ordem', async () => {
  // Stake > saldo
  // Esperar: resposta 400, saldo inalterado
});
```

**BUG 2 — Payout Configurável**:
```javascript
// Teste 1: Novo contrato grava payout da config
test('BUG-2: contrato grava payout_pct da config no momento', async () => {
  // Config: VOL_50 com payout_pct=95
  // Abrir contrato VOL_50
  // Esperar: contrato.payout_pct = 95
});

// Teste 2: Liquidação usa payout gravado
test('BUG-2: liquidação usa payout gravado no contrato', async () => {
  // Contrato antigo com payout_pct=85
  // Config atual: payout_pct=95
  // Liquidar WIN
  // Esperar: payout = stake * 1.85 (não 1.95)
});
```

**BUG 3 — Empate Integer**:
```javascript
// Teste 1: Empate na precisão do ativo
test('BUG-3: preços iguais na precisão → DRAW', async () => {
  // entry=1.08452, exit=1.0845200001, precision=5
  // Esperar: resultado DRAW
});

// Teste 2: Diferença mínima → WIN/LOSS
test('BUG-3: diferença de 1 unidade na última casa → WIN/LOSS', async () => {
  // entry=1.08452, exit=1.08453, precision=5, UP
  // Esperar: resultado WIN
});
```

**BUG 4 — Outbox Exclusive**:
```javascript
// Teste 1: Blnk down → contrato abre
test('BUG-4: Blnk indisponível não impede abertura', async () => {
  // Derrubar Blnk
  // Abrir contrato
  // Esperar: contrato OPEN, evento PENDING na outbox
});

// Teste 2: Worker processa quando Blnk volta
test('BUG-4: worker processa eventos pendentes quando Blnk volta', async () => {
  // Evento PENDING na outbox
  // Subir Blnk
  // Esperar: evento PROCESSED, reserva no Blnk
});
```

### 6.2 Testes de Stress
- 100 ordens/segundo por 10s → zero duplicação, zero dinheiro fantasma
- 50% de falhas de banco → todas recusadas, zero contratos órfãos

### 6.3 Testes de Caos
- Derrubar PostgreSQL durante abertura de ordem
- Derrubar Blnk durante outbox relay
- Timeout de 5s na query de saldo

### 6.4 Testes de Segurança
- Tentativa de abrir contrato com `payout_minor` no payload (mass assignment)
- Idempotency-Key repetida com payout diferente
- Contrato liquidado manualmente no banco → zero re-liquidação

---

## 7. Verificações Finais Obrigatórias

### 7.1 Grep Final
```bash
# Zero constantes de payout soltas
grep -rn "1\.85\|* 1.85\|payout.*85" scripts/lib/settlement-engine.mjs scripts/dev-live-feed.mjs
# Deve retornar: 0 resultados (exceto comentários)

# Zero chamadas Blnk fora da outbox
grep -rn "blnk\.reserve\|blnk\.release\|blnk\.credit" scripts/dev-live-feed.mjs
# Deve retornar: 0 resultados (só na outbox worker)
```

### 7.2 Diff Review
```bash
git diff --name-only main..fix/carteira
```
**Esperado**:
- ✅ `scripts/dev-live-feed.mjs`
- ✅ `scripts/lib/settlement-engine.mjs`
- ✅ `db/migrations/0070_payout_per_asset.up.sql`
- ✅ `db/migrations/0070_payout_per_asset.down.sql`
- ✅ `tests/unit/bug-1-fail-closed.test.mjs`
- ✅ `tests/unit/bug-2-payout-config.test.mjs`
- ✅ `tests/unit/bug-3-draw-integer.test.mjs`
- ✅ `tests/unit/bug-4-outbox-exclusive.test.mjs`

**Proibido**:
- ❌ `apps/web/src/arena/**`
- ❌ `apps/web/src/App.tsx`
- ❌ `apps/web/src/api/client.tsx`

### 7.3 Suíte de Testes
```bash
# Rodar testes existentes
pnpm test:unit
pnpm test:int

# Rodar testes novos
node --test tests/unit/bug-*.test.mjs
```

---

## 8. Entregáveis Finais

### 8.1 Commits (4)
1. `fix(wallet): fail-closed on demo balance query error`
2. `feat(payout): configurable payout per asset with contract snapshot`
3. `fix(settlement): DRAW comparison in integer precision`
4. `refactor(ledger): use outbox exclusively for Blnk reserve`

### 8.2 Testes (4 arquivos)
- `tests/unit/bug-1-fail-closed.test.mjs`
- `tests/unit/bug-2-payout-config.test.mjs`
- `tests/unit/bug-3-draw-integer.test.mjs`
- `tests/unit/bug-4-outbox-exclusive.test.mjs`

### 8.3 Relatório Final (`RELATORIO-FINAL.md`)
- Diff por commit
- Linhas que não batiam com a descrição original
- Confirmação de que nenhum arquivo proibido foi tocado
- Riscos e rollback de cada commit
- Como testar manualmente cada correção
- Lista de coisas NÃO corrigidas (fora do escopo)

---

## 9. Cronograma Estimado

| Subetapa | Tempo Estimado | Dependências |
|----------|----------------|--------------|
| Subetapa 1 (BUG 1) | 1-2h | Nenhuma |
| Subetapa 2 (BUG 2) | 2-3h | Migration, config, liquidação |
| Subetapa 3 (BUG 3) | 1-2h | Subetapa 2 (precisão por ativo) |
| Subetapa 4 (BUG 4) | 1h | Subetapa 1 (fail-closed ativo) |
| Testes + Verificações | 2h | Todas as subetapas |
| **Total** | **7-10h** | — |

---

## 10. Aprovação Humana

Este plano deve ser aprovado antes de iniciar qualquer implementação.

**Aprovador**: Brendan (usuário)  
**Status**: ⏳ Pendente de aprovação  
**Data de Aprovação**: _____________________

**Após aprovação**, prosseguir para:
1. Criar branch `fix/carteira`
2. Implementar Subetapa 1 (BUG 1)
3. Validar 100% → Commit
4. Implementar Subetapa 2 (BUG 2)
5. ... e assim por diante

---

**FIM DO PLANO GERAL**
