import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let Pool = null;
try {
  const pgModule = require('../../node_modules/.pnpm/pg@8.23.1/node_modules/pg');
  Pool = (pgModule.default || pgModule).Pool;
} catch {
  try {
    Pool = require('pg').Pool;
  } catch (_) {}
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://synth_migrator:dev_secret_pw_123@172.18.0.4:5432/broker_platform';
const BASE_URL = 'http://127.0.0.1:3001';

test('Subetapa 9.4 — Suíte de Testes de Latência, Expiração e Resiliência', async (t) => {
  let pool = null;
  if (Pool) {
    try {
      pool = new Pool({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
      // Teste rápido de conexão
      await pool.query('SELECT 1');
    } catch {
      if (pool) {
        try { await pool.end(); } catch (_) {}
      }
      pool = null;
    }
  }

  t.after(async () => {
    if (pool) {
      try { await pool.end(); } catch (_) {}
    }
  });

  const testUserId = crypto.randomUUID();
  const initialBalance = 500000; // $5,000.00 USD em cents

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO users (id, keycloak_id, email, demo_balance_minor, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET demo_balance_minor = $4`,
        [testUserId, 'test-kc-' + testUserId, `test_${Date.now()}@binmax.local`, initialBalance]
      );
    } catch (e) {
      console.warn('DB User seed warning:', e.message);
    }
  }

  // Helper para gerar token JWT mock
  function createBearerToken(sub) {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub,
      email: 'test@binmax.local',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    return `${header}.${payload}.sig`;
  }

  const token = createBearerToken(testUserId);

  await t.test('1. Benchmark de Latência: Abertura de Ordem em < 50ms (Desacoplamento Blnk)', async () => {
    const latencies = [];

    for (let i = 0; i < 5; i++) {
      const idemKey = `idem_bench_${Date.now()}_${i}_${crypto.randomBytes(4).toString('hex')}`;
      const start = performance.now();

      const res = await fetch(`${BASE_URL}/api/v1/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idemKey
        },
        body: JSON.stringify({
          symbol: 'SYNTH_VOL_50',
          direction: 'UP',
          stake_minor: 1000,
          duration_seconds: 60,
          expiry_mode: '1M_FIXED'
        })
      });

      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      assert.equal(res.status, 201, `Status deve ser 201 Created (iter ${i})`);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.ok(body.contract?.id);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`\n⚡ [BENCHMARK LATÊNCIA] Média: ${avgLatency.toFixed(2)}ms (Amostras: ${latencies.map(l => l.toFixed(1) + 'ms').join(', ')})`);

    // A resposta HTTP do backend deve ser estritamente inferior a 50ms
    assert.ok(avgLatency < 50, `Latência média (${avgLatency.toFixed(2)}ms) deve ser menor que 50ms`);
  });

  await t.test('2. Sincronismo Matemático: target_expires_at Honrado com Precisão de Milissegundos', async () => {
    const now = Date.now();
    // Exatamente 45 segundos no futuro
    const targetEpoch = now + 45_000;
    const targetIso = new Date(targetEpoch).toISOString();
    const idemKey = `idem_sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const res = await fetch(`${BASE_URL}/api/v1/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idemKey
      },
      body: JSON.stringify({
        symbol: 'SYNTH_VOL_50',
        direction: 'DOWN',
        stake_minor: 2500,
        target_expires_at: targetIso,
        expiry_mode: 'CANDLE_1M'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.expires_at, targetIso, 'expires_at retornado deve ser idêntico ao target_expires_at');

    if (pool) {
      // Validação no PostgreSQL
      const dbRes = await pool.query(
        `SELECT expires_at FROM contracts WHERE id = $1`,
        [body.contract.id]
      );
      if (dbRes.rows.length > 0) {
        const dbEpoch = new Date(dbRes.rows[0].expires_at).getTime();
        assert.equal(dbEpoch, targetEpoch, 'Timestamp no PostgreSQL deve bater exatamente com o target');
      }
    }
  });

  await t.test('3. Piso Inviolável de 30 Segundos em Expiração Curta', async () => {
    const idemKey = `idem_floor_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Solicita duração inválida de apenas 5 segundos
    const res = await fetch(`${BASE_URL}/api/v1/contracts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idemKey
      },
      body: JSON.stringify({
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        stake_minor: 1000,
        duration_seconds: 5,
        expiry_mode: 'TURBO_5S'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const expiryEpoch = Date.parse(body.expires_at);
    const diffMs = expiryEpoch - Date.now();

    // Deve ter sido corrigido para pelo menos 29.5 segundos (tolerância de execução)
    assert.ok(diffMs >= 29_500, `Expiração (${diffMs}ms) deve respeitar o piso inviolável de 30s`);
  });

  await t.test('4. Estresse Concorrente de Idempotência (15 requisições paralelas simultâneas)', async () => {
    const sharedIdemKey = `idem_storm_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const requests = [];

    for (let i = 0; i < 15; i++) {
      requests.push(
        fetch(`${BASE_URL}/api/v1/contracts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Idempotency-Key': sharedIdemKey
          },
          body: JSON.stringify({
            symbol: 'SYNTH_VOL_50',
            direction: 'UP',
            stake_minor: 5000,
            duration_seconds: 60
          })
        })
      );
    }

    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.json()));

    // Todas as 15 devem ser bem-sucedidas (status 200 ou 201)
    const successCount = responses.filter(r => r.status === 201 || r.status === 200).length;
    assert.equal(successCount, 15, 'Todas as 15 requisições devem retornar HTTP 200 ou 201');

    // Exatamente 1 deve ser criação (201) e 14 devem ser duplicadas (200 com is_duplicate: true)
    const created = responses.filter(r => r.status === 201).length;
    const duplicates = results.filter(r => r.is_duplicate === true).length;

    assert.equal(created, 1, 'Exatamente 1 requisição deve ter status 201 Created');
    assert.equal(duplicates, 14, 'Exatamente 14 requisições devem ser identificadas como duplicadas');

    if (pool) {
      // Validação no PostgreSQL: exatamente 1 registro
      const countRes = await pool.query(
        `SELECT COUNT(*) FROM contracts WHERE user_id = $1 AND idempotency_key = $2`,
        [testUserId, sharedIdemKey]
      );
      assert.equal(parseInt(countRes.rows[0].count, 10), 1, 'Exatamente 1 contrato deve existir no banco de dados');
    }
  });
});
