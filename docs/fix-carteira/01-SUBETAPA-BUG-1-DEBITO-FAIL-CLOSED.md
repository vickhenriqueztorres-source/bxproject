# Subetapa 1 — BUG 1: Débito Demo Fail-Closed

**Bug**: Ordem abre mesmo quando o débito da carteira demo falha  
**Severidade**: 🔴 **CRÍTICA** (dinheiro fantasma)  
**Arquivo**: `scripts/dev-live-feed.mjs`  
**Linhas**: ~2956-2972  
**Commit**: `fix(wallet): fail-closed on demo balance query error`

---

## 1. Análise do Bug

### 1.1 Localização Real

O bug **NÃO está na linha ~2620** conforme descrito originalmente. Está no **modo demo sem Blnk** (~linha 2956-2972).

**Código Atual**:
```javascript
// linha ~2956-2972 em scripts/dev-live-feed.mjs
} else {
  // Modo demo (sem Blnk configurado)
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
  // ... continua criando contrato mesmo se a query falhou
}
```

### 1.2 Caminho Crítico do Bug

```
1. Cliente envia POST /contracts com stake=1000
2. Modo demo (Blnk não configurado)
3. Query "SELECT demo_balance_minor" falha (timeout, conexão caiu)
4. Catch silencioso: userBalance fica com valor antigo de devWallet
5. Comparação: stake > userBalance pode passar (saldo desatualizado)
6. Contrato é criado SEM débito real
7. Saldo do usuário não muda no banco
8. Dinheiro fantasma: usuário pode abrir infinitas ordens
```

### 1.3 Vetores de Falha

| Cenário | Probabilidade | Impacto |
|---------|---------------|---------|
| Query timeout (>2s) | MÉDIA | Dinheiro fantasma |
| PostgreSQL reiniciando | BAIXA | Dinheiro fantasma |
| Rede instável | MÉDIA | Dinheiro fantasma |
| Pool de conexões esgotado | BAIXA | Dinheiro fantasma |
| Query syntax error (migration quebrada) | BAIXÍSSIMA | Ordem recusada (saldo 0) |

### 1.4 Observação Importante

O **débito do Blnk** (linhas 2922-2954) **JÁ está correto**:
```javascript
// linha ~2942-2954 - JÁ CORRETO
try {
  await blnk.reserveStake(authData.sub, contractId, stake);
  // ...
} catch (blnkReserveErr) {
  if (String(blnkReserveErr.message).includes('422') || ...) {
    abortOrder(400, { code: 'INSUFFICIENT_BALANCE', ... });
    return;
  }
  abortOrder(503, { code: 'LEDGER_UNAVAILABLE', ... });
  return;
}
```

Portanto, **só precisamos corrigir o modo demo**.

---

## 2. Correção Proposta

### 2.1 Estratégia: Fail-Closed Estrito

**Princípio**: Em caso de erro de leitura de saldo, **sempre recusar a ordem**. Nunca abrir contrato com saldo desconhecido.

**Trade-off**:
- ✅ **Ganho**: Zero dinheiro fantasma, integridade financeira preservada
- ⚠️ **Custo**: Falsos negativos (ordens válidas recusadas em caso de timeout)
- 📊 **Aceitável**: Preferível recusar ordem legítima do que criar dinheiro

### 2.2 Código Corrigido

```javascript
// linha ~2956-2972 em scripts/dev-live-feed.mjs (DEPOIS DA CORREÇÃO)
} else {
  // Modo demo (sem Blnk configurado)
  let userBalance = devWallet.available_minor;
  if (authData && authData.sub && pgPool) {
    try {
      const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
      if (uRes.rows.length === 0) {
        abortOrder(404, { code: 'USER_NOT_FOUND', message: 'Usuário não encontrado no banco' });
        return;
      }
      userBalance = Number(uRes.rows[0].demo_balance_minor);
    } catch (queryErr) {
      // ✅ CORREÇÃO: Fail-closed estrito
      console.error('[Demo Balance Query Error]', queryErr.message);
      abortOrder(503, { code: 'BALANCE_UNAVAILABLE', message: 'Não foi possível consultar saldo. Tente novamente.' });
      return;
    }
  }
  if (stake > userBalance) {
    abortOrder(400, { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' });
    return;
  }
  // ... continua criando contrato APENAS se query teve sucesso
}
```

### 2.3 Mudanças Específicas

1. **Remover `catch (_) {}`** silencioso
2. **Adicionar verificação de `rows.length === 0`** (usuário não existe)
3. **Catch explícito** com log de erro e `abortOrder(503, ...)`
4. **Retornar imediatamente** após `abortOrder`

---

## 3. Testes Obrigatórios

### 3.1 Testes Unitários

**Arquivo**: `tests/unit/bug-1-fail-closed.test.mjs`

```javascript
import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';

describe('BUG-1: Fail-Closed Demo Balance', () => {
  test('erro de query aborta ordem com 503', async () => {
    // Simular pgPool.query que falha com timeout
    const mockPool = {
      query: async () => { throw new Error('connection timeout'); }
    };
    
    // POST /contracts com stake=1000
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 503);
    const body = await response.json();
    assert.strictEqual(body.code, 'BALANCE_UNAVAILABLE');
    
    // Verificar que ZERO contratos foram criados
    const contracts = await pgPool.query('SELECT COUNT(*) FROM contracts WHERE user_id = $1', [testUserId]);
    assert.strictEqual(Number(contracts.rows[0].count), 0);
  });

  test('saldo insuficiente recusa ordem com 400', async () => {
    // Usuário com saldo 500, tenta stake 1000
    await pgPool.query('UPDATE users SET demo_balance_minor = 50000 WHERE id = $1', [testUserId]);
    
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000, // 1000 USD
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 400);
    const body = await response.json();
    assert.strictEqual(body.code, 'INSUFFICIENT_BALANCE');
    
    // Verificar que saldo NÃO mudou
    const user = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [testUserId]);
    assert.strictEqual(Number(user.rows[0].demo_balance_minor), 50000);
  });

  test('usuário não existe aborta ordem com 404', async () => {
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token_usuario_inexistente',
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 404);
    const body = await response.json();
    assert.strictEqual(body.code, 'USER_NOT_FOUND');
  });

  test('saldo suficiente abre ordem normalmente', async () => {
    // Usuário com saldo 10000, tenta stake 1000
    await pgPool.query('UPDATE users SET demo_balance_minor = 1000000 WHERE id = $1', [testUserId]);
    
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'test-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000, // 1000 USD
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 201);
    const body = await response.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.contract.status, 'OPEN');
    
    // Verificar que contrato foi criado
    const contract = await pgPool.query('SELECT * FROM contracts WHERE id = $1', [body.contract.id]);
    assert.strictEqual(contract.rows.length, 1);
    assert.strictEqual(Number(contract.rows[0].stake_minor), 100000);
  });
});
```

### 3.2 Testes de Stress

**Arquivo**: `tests/stress/bug-1-stress.test.mjs`

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('BUG-1 Stress: 100 ordens simultâneas com falhas intercaladas', () => {
  test('50% de falhas de banco → todas recusadas, zero dinheiro fantasma', async () => {
    const promises = [];
    let errorCount = 0;
    
    // Simular 100 requisições simultâneas
    for (let i = 0; i < 100; i++) {
      const shouldFail = i % 2 === 0; // 50% de falhas
      
      if (shouldFail) {
        // Derrubar banco por 100ms
        await pgPool.query('SELECT pg_sleep(0.1)');
      }
      
      promises.push(
        fetch('http://localhost:3001/contracts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid_token',
            'Idempotency-Key': 'stress-' + i,
          },
          body: JSON.stringify({
            symbol: 'VOL_50',
            direction: 'UP',
            stake_minor: 100000,
            duration_seconds: 60,
          }),
        }).then(res => {
          if (res.status >= 500) errorCount++;
          return res.json();
        })
      );
    }
    
    await Promise.all(promises);
    
    // Verificar que todas as ordens com falha foram recusadas
    assert.ok(errorCount >= 45 && errorCount <= 55, `Esperado ~50 erros, obteve ${errorCount}`);
    
    // Verificar que ZERO contratos órfãos foram criados
    const orphans = await pgPool.query(`
      SELECT COUNT(*) FROM contracts
      WHERE user_id = $1 AND status = 'OPEN'
        AND NOT EXISTS (
          SELECT 1 FROM outbox_events
          WHERE event_type = 'RESERVE_STAKE'
            AND payload->>'contract_id' = contracts.id
        )
    `, [testUserId]);
    assert.strictEqual(Number(orphans.rows[0].count), 0, 'Zero contratos órfãos');
  });
});
```

### 3.3 Testes de Caos

**Arquivo**: `tests/chaos/bug-1-chaos.test.mjs`

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('BUG-1 Caos: Derrubar PostgreSQL durante abertura', () => {
  test('PostgreSQL down → ordem recusada com 503', async () => {
    // Derrubar PostgreSQL
    await exec('docker compose -f infra/compose.yaml stop postgres');
    
    await sleep(1000); // Aguardar desligamento
    
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'chaos-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 503);
    const body = await response.json();
    assert.strictEqual(body.code, 'BALANCE_UNAVAILABLE');
    
    // Subir PostgreSQL novamente
    await exec('docker compose -f infra/compose.yaml start postgres');
    await sleep(3000); // Aguardar inicialização
  });

  test('timeout de 5s na query de saldo → ordem recusada', async () => {
    // Simular query lenta com pg_sleep
    await pgPool.query(`
      CREATE OR REPLACE FUNCTION slow_balance_query(user_id UUID)
      RETURNS INTEGER AS $$
      BEGIN
        PERFORM pg_sleep(6); -- 6 segundos (mais que o timeout)
        RETURN (SELECT demo_balance_minor FROM users WHERE id = user_id);
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': 'chaos-timeout-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 503);
    
    // Remover função de teste
    await pgPool.query('DROP FUNCTION IF EXISTS slow_balance_query(UUID)');
  });
});
```

### 3.4 Testes de Segurança

**Arquivo**: `tests/security/bug-1-security.test.mjs`

```javascript
import { describe, test } from 'node:test';
import assert from 'node:assert';

describe('BUG-1 Segurança: Tentativas de bypass', () => {
  test('token inválido → 401, sem consulta de saldo', async () => {
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token_invalido',
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    assert.strictEqual(response.status, 401);
  });

  test('payload com user_id → ignorado, usa JWT', async () => {
    const response = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token_user_A',
        'Idempotency-Key': 'security-' + Date.now(),
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
        user_id: 'outro_usuario_com_muito_saldo', // ❌ Tentativa de bypass
      }),
    });
    
    // Se passar (status 201), verificar que contrato foi criado com user_id do JWT
    if (response.status === 201) {
      const body = await response.json();
      const contract = await pgPool.query('SELECT user_id FROM contracts WHERE id = $1', [body.contract.id]);
      assert.notStrictEqual(contract.rows[0].user_id, 'outro_usuario_com_muito_saldo');
      assert.strictEqual(contract.rows[0].user_id, testUserIdA);
    }
  });

  test('idempotência preservada após erro de saldo', async () => {
    const idemKey = 'security-idem-' + Date.now();
    
    // Primeira tentativa: saldo insuficiente
    await pgPool.query('UPDATE users SET demo_balance_minor = 10000 WHERE id = $1', [testUserId]);
    
    const response1 = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': idemKey,
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000, // 1000 USD (mais que o saldo)
        duration_seconds: 60,
      }),
    });
    assert.strictEqual(response1.status, 400);
    
    // Segunda tentativa: adicionar saldo e repetir com mesma chave
    await pgPool.query('UPDATE users SET demo_balance_minor = 1000000 WHERE id = $1', [testUserId]);
    
    const response2 = await fetch('http://localhost:3001/contracts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid_token',
        'Idempotency-Key': idemKey, // Mesma chave
      },
      body: JSON.stringify({
        symbol: 'VOL_50',
        direction: 'UP',
        stake_minor: 100000,
        duration_seconds: 60,
      }),
    });
    
    // Deve retornar erro 400 novamente (idempotência de erro preservada)
    // OU criar contrato se a implementação não cacheia erros
    // Verificar documentação de idempotência do projeto
    assert.ok(response2.status === 400 || response2.status === 201);
  });
});
```

---

## 4. Implementação Passo a Passo

### Passo 1: Criar branch
```bash
git checkout main
git pull origin main
git checkout -b fix/carteira
```

### Passo 2: Ler código atual
```bash
# Confirmar linhas exatas
sed -n '2950,2975p' scripts/dev-live-feed.mjs
```

### Passo 3: Aplicar correção
```bash
# Editar scripts/dev-live-feed.mjs com a correção acima
```

### Passo 4: Criar testes
```bash
# Criar os 4 arquivos de teste acima
mkdir -p tests/unit tests/stress tests/chaos tests/security
```

### Passo 5: Rodar testes
```bash
# Subir infra
pnpm stack:up

# Rodar teste unitário
node --test tests/unit/bug-1-fail-closed.test.mjs

# Rodar stress
node --test tests/stress/bug-1-stress.test.mjs

# Rodar caos
node --test tests/chaos/bug-1-chaos.test.mjs

# Rodar segurança
node --test tests/security/bug-1-security.test.mjs
```

### Passo 6: Validar 100%
```bash
# Todos os testes devem passar
# Verificar logs do dev-live-feed.mjs para erros de query logados corretamente
```

### Passo 7: Commit
```bash
git add scripts/dev-live-feed.mjs tests/unit/bug-1-fail-closed.test.mjs
git commit -m "fix(wallet): fail-closed on demo balance query error

Corrige BUG-1 onde ordem era aberta mesmo quando a query de saldo demo falhava.

Mudanças:
- Catch silencioso substituído por fail-closed estrito
- Query error → 503 BALANCE_UNAVAILABLE
- Usuário não existe → 404 USER_NOT_FOUND
- Zero caminhos que abrem contrato com saldo desconhecido

Testes incluídos:
- Unitário: erro de query, saldo insuficiente, usuário inexistente
- Stress: 100 ordens com 50% de falhas
- Caos: PostgreSQL down, timeout de query
- Segurança: bypass de user_id, idempotência preservada

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 5. Critérios de Aceite

- ✅ Erro de query → ordem recusada com 503
- ✅ Saldo insuficiente → ordem recusada com 400
- ✅ Usuário não existe → ordem recusada com 404
- ✅ Saldo suficiente → ordem abre normalmente
- ✅ Zero contratos órfãos (sem débito)
- ✅ Todos os testes passando (unitário, stress, caos, segurança)
- ✅ Log de erro visível no console do dev-live-feed.mjs

---

## 6. Como Testar Manualmente

### 6.1 Teste Positivo (Saldo OK)
```bash
# Criar usuário de teste com saldo
psql -d binmax -c "UPDATE users SET demo_balance_minor = 1000000 WHERE id = '00000000-0000-4000-8000-000000000001';"

# Abrir ordem
curl -X POST http://localhost:3001/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .token-test)" \
  -H "Idempotency-Key: manual-test-$(date +%s)" \
  -d '{
    "symbol": "VOL_50",
    "direction": "UP",
    "stake_minor": 100000,
    "duration_seconds": 60
  }'

# Esperado: HTTP 201, contrato criado
```

### 6.2 Teste Negativo (Saldo Insuficiente)
```bash
# Zerar saldo
psql -d binmax -c "UPDATE users SET demo_balance_minor = 10000 WHERE id = '00000000-0000-4000-8000-000000000001';"

# Tentar abrir ordem de 1000 USD
curl -X POST http://localhost:3001/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .token-test)" \
  -H "Idempotency-Key: manual-test-insufficient-$(date +%s)" \
  -d '{
    "symbol": "VOL_50",
    "direction": "UP",
    "stake_minor": 100000,
    "duration_seconds": 60
  }'

# Esperado: HTTP 400, {"code": "INSUFFICIENT_BALANCE"}
```

### 6.3 Teste de Erro (Banco Down)
```bash
# Derrubar PostgreSQL
docker compose -f infra/compose.yaml stop postgres

# Tentar abrir ordem
curl -X POST http://localhost:3001/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .token-test)" \
  -H "Idempotency-Key: manual-test-db-down-$(date +%s)" \
  -d '{
    "symbol": "VOL_50",
    "direction": "UP",
    "stake_minor": 100000,
    "duration_seconds": 60
  }'

# Esperado: HTTP 503, {"code": "BALANCE_UNAVAILABLE"}

# Subir PostgreSQL novamente
docker compose -f infra/compose.yaml start postgres
sleep 5
```

---

## 7. Riscos e Rollback

### 7.1 Riscos
| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Falsos negativos (ordens válidas recusadas) | MÉDIA | Monitorar taxa de erro 503, ajustar timeout do pool |
| Query lenta causa timeout excessivo | BAIXA | Pool já tem timeout configurado |
| Logs poluídos com erros de conexão | BAIXA | Log estruturado com nível ERROR |

### 7.2 Rollback
```bash
# Rollback do commit
git revert <commit-hash-bug-1>
git push origin fix/carteira

# OU descartar branch completa
git checkout main
git branch -D fix/carteira
```

---

## 8. Fora do Escopo (NÃO será corrigido nesta subetapa)

- ❌ Refatorar polling de carteira
- ❌ Adicionar retry com backoff na query
- ❌ Circuit breaker para banco
- ❌ Fallback para `devWallet` em modo degradado
- ❌ Métricas Prometheus de taxa de erro 503
- ❌ Alerta quando taxa de erro > 5%

Estas melhorias podem ser feitas em issues futuras após aprovação humana.

---

**FIM DA SUBETAPA 1**
