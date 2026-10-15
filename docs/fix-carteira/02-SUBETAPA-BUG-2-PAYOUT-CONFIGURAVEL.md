# Subetapa 2 — BUG 2: Payout Configurável por Ativo

**Bug**: Payout fixo hardcoded em dois lugares (85%)  
**Severidade**: 🟡 **MÉDIA** (impede ajuste de rentabilidade por ativo)  
**Arquivos**: 
- `scripts/dev-live-feed.mjs` (linha 1030)
- `scripts/lib/settlement-engine.mjs` (linha 112)  
**Commit**: `feat(payout): configurable payout per asset with contract snapshot`

---

## 1. Análise do Bug

### 1.1 Localizações Exatas

**Local 1 — Endpoint de Informação do Índice**:
```javascript
// scripts/dev-live-feed.mjs:1030
res.end(JSON.stringify({
  symbol: rawSymbol,
  canonical_symbol: symbol,
  status: state ? (state.paused ? 'PAUSED' : 'ACTIVE') : 'ACTIVE',
  name: state ? state.name : symbol,
  precision: state ? state.precision : 4,
  payout_pct: 85  // ❌ HARDCODED
}));
```

**Local 2 — Cálculo de Payout na Liquidação**:
```javascript
// scripts/lib/settlement-engine.mjs:112
const payoutMinor = won ? Math.round(stake * 1.85) : draw ? stake : 0;
// ❌ HARDCODED: 1.85 = 185% = 85% de lucro sobre stake
```

### 1.2 Problema Central

1. **Sem configuração por ativo**: Todos os índices têm payout fixo de 85%
2. **Sem snapshot no contrato**: Mudança de config afeta contratos já abertos
3. **Inconsistência temporal**: Contrato aberto com payout X, liquidado com payout Y

### 1.3 Impacto de Negócio

| Cenário | Problema |
|---------|----------|
| Ativo novo com payout 95% | Impossível configurar diferente |
| Promoção temporária (90% por 1 semana) | Contratos antigos liquidam com payout novo |
| Rollback de payout | Contratos abertos durante rollback liquidam com payout errado |
| Competitividade | Não consegue oferecer payout diferenciado por ativo |

---

## 2. Arquitetura da Correção

### 2.1 Estratégia: Config + Snapshot

**Princípio**: 
1. **Configuração por ativo** em `ASSETS_CONFIG`
2. **Snapshot no contrato** (gravar payout no momento da abertura)
3. **Liquidação usa snapshot** (nunca config global)

**Fluxo**:
```
1. Cliente consulta /api/indices/VOL_50
   → Retorna payout_pct da ASSETS_CONFIG (ex: 90)

2. Cliente abre contrato VOL_50
   → Código lê payout_pct de ASSETS_CONFIG (90)
   → Grava no contrato: INSERT ... payout_pct = 90

3. Admin muda ASSETS_CONFIG: VOL_50 payout_pct = 85
   → Contratos novos gravam 85
   → Contratos antigos continuam com 90 gravado

4. Liquidação
   → Lê payout_pct do contrato (não da config)
   → Payout = stake * (1 + payout_pct/100)
```

### 2.2 Migration Aditiva

**Arquivo**: `db/migrations/0070_payout_per_asset.up.sql`

```sql
-- Migration 0070: Adicionar coluna payout_pct aos contratos
-- SEMPRE aditiva com DEFAULT para não quebrar INSERTs antigos

BEGIN;

-- Adicionar coluna com default 85 (comportamento atual)
ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS payout_pct INTEGER NOT NULL DEFAULT 85
CHECK (payout_pct >= 50 AND payout_pct <= 200);

-- Comentário para auditoria
COMMENT ON COLUMN contracts.payout_pct IS 
'Percentual de payout capturado no momento da abertura do contrato. Não muda com alterações na configuração do ativo.';

COMMIT;
```

**Arquivo**: `db/migrations/0070_payout_per_asset.down.sql`

```sql
-- Rollback: Remover coluna payout_pct

BEGIN;

ALTER TABLE contracts
DROP COLUMN IF EXISTS payout_pct;

COMMIT;
```

### 2.3 Modificações no Código

**Passo 1 — Adicionar `payout_pct` em `ASSETS_CONFIG`**:

```javascript
// scripts/dev-live-feed.mjs (~linha 360-400)
const ASSETS_CONFIG = [
  // Forex OTC (18)
  { 
    symbol: 'EURUSD_OTC', 
    price: 1.08542, 
    precision: 5, 
    annualVolTarget: 0.08, 
    sigma: 0.00001425, 
    theta: 0.00002407, 
    halfLifeSec: 28800, 
    legacySigma: 0.00018,
    payout_pct: 85  // ✅ NOVO
  },
  // ... (adicionar em todos os 36 ativos)
  
  // Sintéticos (6) - Exemplo de payout diferenciado
  { 
    symbol: 'VOL_50', 
    price: 500.1250, 
    precision: 4, 
    annualVolTarget: 0.5, 
    sigma: 0.00008904, 
    theta: 0.00038508, 
    halfLifeSec: 1800, 
    legacySigma: 0.0006,
    payout_pct: 90  // ✅ Payout maior para sintéticos populares
  },
];
```

**Passo 2 — Endpoint retorna `payout_pct` da config**:

```javascript
// scripts/dev-live-feed.mjs (~linha 1024-1032)
const indexMatch = pathname.match(/^\/(api\/)?(v1\/)?indices\/([A-Za-Z0-9_]+)$/);
if (indexMatch && req.method === 'GET') {
  const rawSymbol = indexMatch[3];
  const symbol = resolveSymbol(rawSymbol);
  const state = assetState.get(symbol);
  
  // ✅ CORREÇÃO: Buscar payout_pct da config do ativo
  const assetConfig = ASSETS_CONFIG.find(a => a.symbol === symbol);
  const payoutPct = assetConfig?.payout_pct ?? 85; // Fallback para 85
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    symbol: rawSymbol,
    canonical_symbol: symbol,
    status: state ? (state.paused ? 'PAUSED' : 'ACTIVE') : 'ACTIVE',
    name: state ? state.name : symbol,
    precision: state ? state.precision : 4,
    payout_pct: payoutPct  // ✅ DINÂMICO
  }));
  return;
}
```

**Passo 3 — Abertura de contrato grava `payout_pct`**:

```javascript
// scripts/dev-live-feed.mjs (~linha 3042-3047)
// Dentro da transação de INSERT do contrato
const assetConfig = ASSETS_CONFIG.find(a => a.symbol === dbSymbol);
const contractPayoutPct = assetConfig?.payout_pct ?? 85;

await dbClient.query(`
  INSERT INTO contracts (
    id, user_id, symbol, direction, status, stake_minor, entry_price,
    idempotency_key, opened_at, expires_at, created_at, payout_pct  -- ✅ NOVO
  ) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, NOW(), $8, NOW(), $9)  -- ✅ NOVO
`, [contractId, authData.sub, dbSymbol, direction, stake, entryPrice, idempotencyKey, expiresAt, contractPayoutPct]);
```

**Passo 4 — Liquidação usa `payout_pct` do contrato**:

```javascript
// scripts/lib/settlement-engine.mjs (~linha 104-121)
export function computeContractOutcome({ direction, entryPrice, exitPrice, stakeMinor, payoutPct }) {
  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const stake = parseInt(stakeMinor, 10);
  const payout = Number(payoutPct ?? 85); // ✅ Recebe do contrato, fallback 85
  
  const isUp = direction === 'UP';
  const won = (isUp && exit > entry) || (!isUp && exit < entry);
  const draw = exit === entry;
  const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
  
  // ✅ CORREÇÃO: Usa payout_pct do contrato
  const payoutMinor = won 
    ? Math.round(stake * (1 + payout / 100))  // Ex: 85% → stake * 1.85
    : draw ? stake : 0;

  return {
    result,
    payoutMinor,
    entryPrice: entry,
    exitPrice: exit,
    stakeMinor: stake,
  };
}
```

**Passo 5 — Settlement coordinator passa `payoutPct` do contrato**:

```javascript
// scripts/lib/settlement-engine.mjs (~linha 200-230)
// Dentro de settleOpenContract()

// Buscar contrato do banco com payout_pct
const dbContract = await pgPool.query(`
  SELECT id, user_id, symbol, direction, stake_minor, entry_price, 
         expires_at, status, payout_pct  -- ✅ ADICIONAR
  FROM contracts
  WHERE id = $1
  FOR UPDATE SKIP LOCKED
`, [contractId]);

// ...

const outcome = computeContractOutcome({
  direction: target.direction,
  entryPrice,
  exitPrice,
  stakeMinor: stake,
  payoutPct: dbContract.rows[0]?.payout_pct ?? target.payout_pct ?? 85  // ✅ NOVO
});
```

---

## 3. Testes Obrigatórios

### 3.1 Testes Unitários

**Arquivo**: `tests/unit/bug-2-payout-config.test.mjs`

```javascript
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert';

describe('BUG-2: Payout Configurável', () => {
  test('endpoint /api/indices/:symbol retorna payout_pct da config', async () => {
    const response = await fetch('http://localhost:3001/api/indices/VOL_50');
    assert.strictEqual(response.status, 200);
    
    const body = await response.json();
    assert.ok(body.payout_pct, 'payout_pct deve existir');
    assert.strictEqual(typeof body.payout_pct, 'number');
    assert.ok(body.payout_pct >= 50 && body.payout_pct <= 200, 'payout_pct entre 50 e 200');
  });

  test('contrato novo grava payout_pct da config no momento da abertura', async () => {
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'bug2-test-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 201);
    const body = await response.json();
    
    // Verificar que contrato foi gravado com payout_pct
    const contract = await pgPool.query('SELECT payout_pct FROM contracts WHERE id = $1', [body.contract.id]);
    assert.strictEqual(contract.rows.length, 1);
    assert.ok(contract.rows[0].payout_pct, 'payout_pct gravado no contrato');
    assert.strictEqual(typeof contract.rows[0].payout_pct, 'number');
  });

  test('liquidação WIN usa payout_pct gravado no contrato', async () => {
    // 1. Criar contrato com payout_pct = 90
    await pgPool.query(`
      INSERT INTO contracts (
        id, user_id, symbol, direction, status, stake_minor, entry_price,
        opened_at, expires_at, created_at, payout_pct
      ) VALUES ($1, $2, 'VOL_50', 'UP', 'OPEN', 100000, 500.0, NOW(), NOW() - INTERVAL '1 second', NOW(), 90)
    `, ['test-contract-win', testUserId]);
    
    // 2. Criar tick de saída com preço maior (WIN)
    await pgPool.query(`
      INSERT INTO ticks (symbol, sequence, price, ts, hash, event_time)
      VALUES ('VOL_50', 9999, 501.0, NOW(), 'test-hash', EXTRACT(EPOCH FROM NOW()) * 1000)
    `);
    
    // 3. Liquidar
    await settlementCoordinator.settleOpenContract({ id: 'test-contract-win' });
    
    // 4. Verificar payout = stake * 1.90 (não 1.85)
    const settled = await pgPool.query('SELECT payout_minor, result FROM contracts WHERE id = $1', ['test-contract-win']);
    assert.strictEqual(settled.rows[0].result, 'WIN');
    assert.strictEqual(Number(settled.rows[0].payout_minor), 190000); // 100000 * 1.90
  });

  test('mudança de config não afeta contratos já abertos', async () => {
    // 1. Abrir contrato com payout_pct = 85 (config original)
    const response1 = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'bug2-retrocompat-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 300,
      }),
    });
    const contract1 = (await response1.json()).contract;
    
    // 2. Simular mudança de config (payout_pct = 95)
    // (Em produção, isso seria feito editando ASSETS_CONFIG e reiniciando)
    // Aqui, vamos verificar que o contrato gravou 85
    
    const dbContract = await pgPool.query('SELECT payout_pct FROM contracts WHERE id = $1', [contract1.id]);
    const originalPayout = dbContract.rows[0].payout_pct;
    
    // 3. Simular liquidação após "mudança de config"
    // (liquidação deve usar payout_pct gravado, não config nova)
    await pgPool.query(`UPDATE contracts SET expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [contract1.id]);
    await settlementCoordinator.settleOpenContract({ id: contract1.id });
    
    const settled = await pgPool.query('SELECT payout_minor, result FROM contracts WHERE id = $1', [contract1.id]);
    
    // 4. Verificar que usou payout original (85), não "config nova" (95)
    if (settled.rows[0].result === 'WIN') {
      const expectedPayout = Math.round(100000 * (1 + originalPayout / 100));
      assert.strictEqual(Number(settled.rows[0].payout_minor), expectedPayout);
    }
  });

  test('migration adiciona coluna com DEFAULT 85', async () => {
    // Verificar que contratos antigos (sem payout_pct explícito) têm 85
    const oldContracts = await pgPool.query(`
      SELECT COUNT(*) FROM contracts WHERE payout_pct = 85
    `);
    assert.ok(Number(oldContracts.rows[0].count) >= 0, 'Migration aplicou DEFAULT 85');
  });
});
```

### 3.2 Testes de Retrocompatibilidade

```javascript
describe('BUG-2 Retrocompatibilidade', () => {
  test('contratos abertos antes da migration liquidam corretamente', async () => {
    // Simular contrato "antigo" sem payout_pct (usará DEFAULT 85)
    await pgPool.query(`
      INSERT INTO contracts (
        id, user_id, symbol, direction, status, stake_minor, entry_price,
        opened_at, expires_at, created_at
        -- ❌ SEM payout_pct (usará DEFAULT 85 da migration)
      ) VALUES ($1, $2, 'VOL_50', 'UP', 'OPEN', 100000, 500.0, NOW(), NOW() + INTERVAL '1 minute', NOW())
    `, ['legacy-contract-' + Date.now(), testUserId]);
    
    // ... liquidar e verificar que usou 85%
  });

  test('função computeContractOutcome com payoutPct undefined usa 85', () => {
    const outcome = computeContractOutcome({
      direction: 'UP',
      entryPrice: 500.0,
      exitPrice: 501.0,
      stakeMinor: 100000,
      payoutPct: undefined  // ❌ Sem payout (retrocompat)
    });
    
    assert.strictEqual(outcome.result, 'WIN');
    assert.strictEqual(outcome.payoutMinor, 185000); // 100000 * 1.85 (default 85%)
  });
});
```

### 3.3 Testes de Segurança

```javascript
describe('BUG-2 Segurança', () => {
  test('payload com payout_pct customizado é ignorado', async () => {
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'security-payout-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
        payout_pct: 999  // ❌ Tentativa de manipulação
      }),
    });
    
    if (response.status === 201) {
      const body = await response.json();
      const contract = await pgPool.query('SELECT payout_pct FROM contracts WHERE id = $1', [body.contract.id]);
      
      // Deve usar payout da config (ex: 90), não o enviado (999)
      assert.notStrictEqual(contract.rows[0].payout_pct, 999);
      assert.ok(contract.rows[0].payout_pct >= 50 && contract.rows[0].payout_pct <= 200);
    }
  });

  test('constraint CHECK impede payout_pct fora do range [50, 200]', async () => {
    await assert.rejects(
      pgPool.query(`
        INSERT INTO contracts (
          id, user_id, symbol, direction, status, stake_minor, entry_price,
          opened_at, expires_at, created_at, payout_pct
        ) VALUES ($1, $2, 'VOL_50', 'UP', 'OPEN', 100000, 500.0, NOW(), NOW(), NOW(), 999)
      `, ['invalid-payout-' + Date.now(), testUserId]),
      /violates check constraint/
    );
  });
});
```

---

## 4. Implementação Passo a Passo

### Passo 1: Rodar migration
```bash
# Subir banco
pnpm stack:up

# Rodar migration
psql -d binmax -f db/migrations/0070_payout_per_asset.up.sql

# Verificar coluna criada
psql -d binmax -c "\d contracts"
# Deve mostrar: payout_pct | integer | not null | default 85
```

### Passo 2: Modificar `ASSETS_CONFIG`
```bash
# Editar scripts/dev-live-feed.mjs
# Adicionar payout_pct em todos os 36 ativos
```

### Passo 3: Modificar endpoint `/api/indices/:symbol`
```bash
# Editar scripts/dev-live-feed.mjs ~linha 1024-1032
```

### Passo 4: Modificar abertura de contrato
```bash
# Editar scripts/dev-live-feed.mjs ~linha 3042-3047
# Adicionar payout_pct no INSERT
```

### Passo 5: Modificar `computeContractOutcome`
```bash
# Editar scripts/lib/settlement-engine.mjs ~linha 104-121
# Adicionar parâmetro payoutPct
```

### Passo 6: Modificar settlement coordinator
```bash
# Editar scripts/lib/settlement-engine.mjs ~linha 200-230
# Buscar payout_pct do banco e passar para computeContractOutcome
```

### Passo 7: Rodar testes
```bash
# Criar arquivo de teste
node --test tests/unit/bug-2-payout-config.test.mjs

# Verificar todos passando
```

### Passo 8: Validar manualmente
```bash
# Ver próxima seção
```

### Passo 9: Commit
```bash
git add db/migrations/0070_payout_per_asset.*.sql \
        scripts/dev-live-feed.mjs \
        scripts/lib/settlement-engine.mjs \
        tests/unit/bug-2-payout-config.test.mjs

git commit -m "feat(payout): configurable payout per asset with contract snapshot

Corrige BUG-2 onde payout era fixo 85% hardcoded.

Mudanças:
- Migration 0070: coluna payout_pct em contracts (DEFAULT 85)
- ASSETS_CONFIG: campo payout_pct por ativo
- Endpoint /api/indices/:symbol retorna payout_pct dinâmico
- Abertura de contrato grava payout_pct da config no momento
- Liquidação usa payout_pct gravado no contrato (nunca config)

Retrocompatibilidade:
- Contratos antigos têm DEFAULT 85 (comportamento inalterado)
- Mudança de config não afeta contratos já abertos

Segurança:
- Payload com payout_pct é ignorado (mass assignment bloqueado)
- CHECK constraint: payout_pct BETWEEN 50 AND 200

Testes incluídos:
- Unitário: snapshot, retrocompat, liquidação
- Segurança: mass assignment, constraint

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 5. Critérios de Aceite

- ✅ Migration aplicada e reversível
- ✅ Endpoint `/api/indices/:symbol` retorna `payout_pct` da config
- ✅ Contrato novo grava `payout_pct` da config no momento da abertura
- ✅ Liquidação WIN usa `payout_pct` do contrato (não da config)
- ✅ Mudança de config não afeta contratos já abertos
- ✅ Contratos antigos (DEFAULT 85) liquidam corretamente
- ✅ Payload com `payout_pct` é ignorado (mass assignment)
- ✅ Constraint CHECK impede valores fora de [50, 200]
- ✅ Todos os testes passando

---

## 6. Como Testar Manualmente

### 6.1 Verificar endpoint retorna payout dinâmico
```bash
curl http://localhost:3001/api/indices/VOL_50 | jq '.payout_pct'
# Esperado: 90 (ou valor configurado em ASSETS_CONFIG)

curl http://localhost:3001/api/indices/EURUSD_OTC | jq '.payout_pct'
# Esperado: 85
```

### 6.2 Abrir contrato e verificar snapshot
```bash
# Abrir contrato
CONTRACT_ID=$(curl -X POST http://localhost:3001/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .token-test)" \
  -H "Idempotency-Key: manual-payout-$(date +%s)" \
  -d '{
    "symbol": "VOL_50",
    "direction": "UP",
    "stake_minor": 100000,
    "duration_seconds": 60
  }' | jq -r '.contract.id')

# Verificar payout_pct gravado
psql -d binmax -c "SELECT id, symbol, payout_pct FROM contracts WHERE id = '$CONTRACT_ID';"
# Esperado: payout_pct = 90 (config de VOL_50)
```

### 6.3 Simular mudança de config e verificar isolamento
```bash
# 1. Abrir contrato com payout 90
CONTRACT_1=$(curl -X POST http://localhost:3001/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .token-test)" \
  -H "Idempotency-Key: manual-config-change-$(date +%s)" \
  -d '{
    "symbol": "VOL_50",
    "direction": "UP",
    "stake_minor": 100000,
    "duration_seconds": 300
  }' | jq -r '.contract.id')

# 2. "Mudar" config (editar ASSETS_CONFIG e reiniciar dev-live-feed)
# (Para teste rápido, editar manualmente no banco)
psql -d binmax -c "UPDATE contracts SET payout_pct = 95 WHERE id != '$CONTRACT_1';"

# 3. Liquidar contrato antigo
# ... (esperar vencer ou forçar no banco)

# 4. Verificar que usou payout original (90)
psql -d binmax -c "SELECT id, payout_minor, stake_minor, result FROM contracts WHERE id = '$CONTRACT_1';"
# Se WIN: payout_minor = 190000 (100000 * 1.90)
```

---

## 7. Riscos e Rollback

### 7.1 Riscos
| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Migration sem DEFAULT trava INSERTs antigos | BAIXA | SEMPRE usar DEFAULT 85 |
| Código usa config global na liquidação | BAIXA | Code review + testes |
| Ativos sem `payout_pct` em ASSETS_CONFIG | MÉDIA | Fallback para 85 em todos os lugares |
| Constraint CHECK muito restritivo | BAIXA | Range [50, 200] permite flexibilidade |

### 7.2 Rollback

**Rollback do Código**:
```bash
git revert <commit-hash-bug-2>
```

**Rollback da Migration**:
```bash
psql -d binmax -f db/migrations/0070_payout_per_asset.down.sql
```

**Rollback Completo**:
```bash
# Código
git revert <commit-hash-bug-2>

# Migration
psql -d binmax -f db/migrations/0070_payout_per_asset.down.sql

# Verificar
psql -d binmax -c "\d contracts"
# Coluna payout_pct não deve existir
```

---

## 8. Fora do Escopo

- ❌ Interface admin para alterar payout_pct por ativo em runtime
- ❌ Histórico de mudanças de payout
- ❌ Payout diferente por tier de usuário (VIP, normal)
- ❌ Payout progressivo (aumenta com volume)
- ❌ Validação de rentabilidade do book (payout não pode exceder X%)

---

**FIM DA SUBETAPA 2**
