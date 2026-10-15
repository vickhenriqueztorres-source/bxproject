/**
 * Gate B — Oráculos de Contratos Abertos e Liquidação Durável (PostgreSQL 16 + Redis 7 + Blnk Ledger HTTP Reais Efêmeros)
 * Cobertura:
 * - [I-01..I-06][S-01..S-05][AC-GD-08-5] JWT, BOLA/IDOR, Mass Assignment, Idempotency-Key (sequencial + 20x paralelo), tick oficial confirmado e Blnk double-entry sem UPDATE users.demo_balance_minor como contabilidade.
 * - [M-03][V-07][AC-GD-08-1] Primeiro tick oficial persistido com ts >= expires_at; sem tick mantém OPEN (zero fallback de RAM); isolamento estrito por símbolo; grava exit_tick_sequence.
 * - [I-03][I-04][V-08][AC-GD-08-2][AC-GD-08-6] Recuperação pós-restart com perda de timers em memória + 20 liquidadores concorrentes (1 settlement, 1 outbox, 1 efeito no Blnk, soma contábil === 0).
 * - [R-01..R-03][AC-GD-08-3][AC-GD-08-4] Caos e injeção de falhas nas fronteiras Blnk / Outbox / PostgreSQL (timeout/falha parcial entre WIN_STAKE e WIN_PROFIT e falha de trigger PG sem duplo pagamento nem SETTLED órfão).
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { canonicalHash, genesisHash } from '../../services/tick-engine/core.mjs';
import { createSettlementCoordinator } from '../../scripts/lib/settlement-engine.mjs';
import {
  assertNotProduction,
  createEphemeralPostgres,
  createEphemeralRedis,
} from '../helpers/chart-durability-postgres.mjs';
import {
  databaseUrlOf,
  startEphemeralFeed,
  stopEphemeralFeed,
} from '../helpers/active-feed-process.mjs';

assertNotProduction();
const require = createRequire(import.meta.url);
const { BlnkClient } = require('../../services/wallet-adapter/dist/blnk-client.js');

const JWT_SECRET = 'qa-ephemeral-gate-b-secret-2026';

function signJwt(payload, secret = JWT_SECRET, headerOverrides = {}) {
  const headerObj = { alg: 'HS256', typ: 'JWT', ...headerOverrides };
  const header = Buffer.from(JSON.stringify(headerObj)).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function startEphemeralBlnkHttpServer() {
  const ledgers = new Map();
  const accounts = new Map();
  const transactions = [];
  const transactionsByRef = new Map();
  let faultRule = null; // (req, body, path) => { status, body } | null

  function ensureAccount(number, currency = 'USD') {
    let acc = accounts.get(number);
    if (!acc) {
      acc = {
        name: number,
        number,
        ledger_id: 'broker_demo',
        currency,
        balance: 0,
        credit_balance: 0,
        debit_balance: 0,
      };
      accounts.set(number, acc);
    }
    return acc;
  }

  ensureAccount('@broker_float', 'USD');
  ensureAccount('@house_revenue', 'USD');
  ensureAccount('@house_payout', 'USD');

  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk.toString();
    let body = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'INVALID_JSON' }));
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);

    if (typeof faultRule === 'function') {
      const injected = await faultRule(req, body, pathname);
      if (injected) {
        res.writeHead(injected.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(injected.body ?? { error: 'INJECTED_BLNK_FAULT' }));
        return;
      }
    }

    if (req.method === 'POST' && pathname === '/ledgers') {
      if (ledgers.has(body.id)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Ledger already exists' }));
        return;
      }
      ledgers.set(body.id, { id: body.id, name: body.name });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ledger_id: body.id }));
      return;
    }

    if (req.method === 'POST' && pathname === '/accounts') {
      if (body.currency !== 'USD') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'SILENT_CONVERSION_FORBIDDEN' }));
        return;
      }
      if (accounts.has(body.number)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Account already exists' }));
        return;
      }
      const created = ensureAccount(body.number, body.currency);
      created.name = body.name || body.number;
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(created));
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/balances/')) {
      const accNum = pathname.slice('/balances/'.length);
      const acc = accounts.get(accNum);
      if (!acc) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Account ${accNum} not found` }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          balance: acc.balance,
          credit_balance: acc.credit_balance,
          debit_balance: acc.debit_balance,
          currency: acc.currency,
        })
      );
      return;
    }

    if (req.method === 'POST' && pathname === '/transactions') {
      if (body.currency !== 'USD' || body.precision !== 100) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_CURRENCY_OR_PRECISION' }));
        return;
      }
      if (typeof body.amount !== 'number' || !Number.isSafeInteger(body.amount) || body.amount <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'INVALID_MINOR_AMOUNT' }));
        return;
      }
      if (!body.source || !body.destination || body.source === body.destination) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DOUBLE_ENTRY_VIOLATION' }));
        return;
      }
      if (!body.reference || typeof body.reference !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'IDEMPOTENCY_VIOLATION' }));
        return;
      }
      if (transactionsByRef.has(body.reference)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: 'CONFLICT: Transaction reference already applied',
            reference: body.reference,
          })
        );
        return;
      }

      const sourceAcc = ensureAccount(body.source, 'USD');
      const destAcc = ensureAccount(body.destination, 'USD');
      if (!body.allow_overdraft && sourceAcc.balance < body.amount) {
        res.writeHead(422, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: `INSUFFICIENT_BALANCE: ${body.source} has ${sourceAcc.balance}, required ${body.amount}`,
          })
        );
        return;
      }

      sourceAcc.debit_balance += body.amount;
      sourceAcc.balance -= body.amount;
      destAcc.credit_balance += body.amount;
      destAcc.balance += body.amount;

      const tx = {
        transaction_id: `tx_${transactions.length + 1}`,
        reference: body.reference,
        source: body.source,
        destination: body.destination,
        amount: body.amount,
        currency: body.currency,
        precision: body.precision,
        status: 'APPLIED',
      };
      transactions.push(tx);
      transactionsByRef.set(body.reference, tx);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tx));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'NOT_FOUND' }));
  });

  await new Promise((resolve, reject) =>
    server.once('error', reject).listen(0, '127.0.0.1', resolve)
  );
  const port = server.address().port;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    accounts,
    transactions,
    transactionsByRef,
    setFaultRule(fn) {
      faultRule = fn;
    },
    algebraicSum() {
      let sum = 0;
      for (const acc of accounts.values()) sum += acc.balance;
      return sum;
    },
    async close() {
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

let postgres;
let redis;
let blnkServer;

before(async () => {
  postgres = await createEphemeralPostgres();
  redis = await createEphemeralRedis();
  blnkServer = await startEphemeralBlnkHttpServer();

  for (const migration of [
    '0001_initial_schema.sql',
    '0010_seed_multi_assets.up.sql',
    '0050_rename_synthetic_indices.up.sql',
  ]) {
    await postgres.pool.query(
      await readFile(new URL(`../../db/migrations/${migration}`, import.meta.url), 'utf8')
    );
  }

  // Tabela users auxiliar presente no ambiente (mas que NÃO deve ser usada como contabilidade)
  await postgres.pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(120),
      email VARCHAR(160) UNIQUE,
      password_hash VARCHAR(128),
      password_salt VARCHAR(64),
      country_code VARCHAR(8) DEFAULT 'ES',
      demo_balance_minor BIGINT NOT NULL DEFAULT 1000000,
      email_verified BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}, { timeout: 120_000 });

after(async () => {
  try {
    if (blnkServer) await blnkServer.close();
  } finally {
    try {
      if (redis) await redis.dispose();
    } finally {
      if (postgres) await postgres.dispose();
    }
  }
}, { timeout: 90_000 });

test(
  '[Gate B | I-01..I-05 & S-01..S-05 & AC-GD-08-5] POST/GET /contracts valida JWT, BOLA, Mass Assignment, Idempotency-Key (20x concorrente), usa tick oficial confirmado e Blnk sem UPDATE users como contabilidade',
  { timeout: 90_000 },
  async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    await postgres.pool.query(
      `INSERT INTO users (id, name, email, demo_balance_minor)
       VALUES ($1, 'Alice', 'alice@binmax.test', 1000000),
              ($2, 'Bob', 'bob@binmax.test', 1000000)`,
      [userA, userB]
    );

    const tokenA = signJwt({
      sub: userA,
      email: 'alice@binmax.test',
      roles: ['trader'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const tokenB = signJwt({
      sub: userB,
      email: 'bob@binmax.test',
      roles: ['trader'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const expiredToken = signJwt({
      sub: userA,
      email: 'alice@binmax.test',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const algNoneToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: userA, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.`;
    const wrongIssToken = signJwt({
      sub: userA,
      iss: 'evil-issuer',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    let feed;
    try {
      feed = await startEphemeralFeed({
        databaseUrl: databaseUrlOf(postgres),
        redisUrl: redis.url,
        blnkUrl: blnkServer.baseUrl,
        jwtSecret: JWT_SECRET,
      });

      // Aguarda pelo menos 1 tick oficial confirmado em PostgreSQL para VOL_50
      let officialTick = null;
      for (let i = 0; i < 60; i++) {
        const tRes = await postgres.pool.query(
          `SELECT sequence, price, ts, hash FROM ticks WHERE symbol = 'VOL_50' ORDER BY sequence DESC LIMIT 1`
        );
        if (tRes.rowCount > 0) {
          officialTick = tRes.rows[0];
          break;
        }
        await pause(100);
      }
      assert(officialTick, 'Feed deve ter gravado pelo menos 1 tick oficial em ticks para VOL_50');

      // 1. Rejeita JWT expirado, alg:none e iss inválido com 401
      for (const badToken of [expiredToken, algNoneToken, wrongIssToken, 'invalid.jwt.token']) {
        const res = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${badToken}`,
            'Idempotency-Key': `idem-bad-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({ symbol: 'VOL_50', direction: 'UP', stake_minor: 1000 }),
        });
        assert.equal(res.status, 401, `Token inválido (${badToken.slice(0, 18)}...) deve ser recusado com 401`);
      }

      // 2. Rejeita ausência de Idempotency-Key com 400
      const noIdemRes = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({ symbol: 'VOL_50', direction: 'UP', stake_minor: 1000 }),
      });
      assert.equal(noIdemRes.status, 400, 'POST /contracts sem Idempotency-Key deve retornar 400');

      // 3. Rejeita Mass Assignment (user_id, entry_price, payout_minor, result forjados) com 400
      for (const forgedField of [
        { user_id: userB },
        { entry_price: 0.0001 },
        { payout_minor: 9999999 },
        { result: 'WIN' },
        { status: 'SETTLED' },
      ]) {
        const maRes = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenA}`,
            'Idempotency-Key': `idem-ma-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({
            symbol: 'VOL_50',
            direction: 'UP',
            stake_minor: 1000,
            ...forgedField,
          }),
        });
        assert.equal(
          maRes.status,
          400,
          `Campo forjado ${Object.keys(forgedField)[0]} deve ser recusado com 400`
        );
      }

      // 4. Rejeita stake_minor fracionário (float) com 400
      const floatRes = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
          'Idempotency-Key': `idem-float-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ symbol: 'VOL_50', direction: 'UP', stake_minor: 1000.5 }),
      });
      assert.equal(floatRes.status, 400, 'stake_minor float deve ser recusado com 400');

      // 5. Dispara 20 POSTs concorrentes com a mesma Idempotency-Key
      const sharedIdemKey = `idem-race-20-${crypto.randomUUID()}`;
      const parallelResponses = await Promise.all(
        Array.from({ length: 20 }, () =>
          fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${tokenA}`,
              'Idempotency-Key': sharedIdemKey,
            },
            body: JSON.stringify({
              symbol: 'SYNTH_VOL_50',
              direction: 'UP',
              stake_minor: 2500,
              duration_seconds: 60,
            }),
          })
        )
      );

      const statuses = parallelResponses.map((r) => r.status);
      const bodies = await Promise.all(parallelResponses.map((r) => r.json()));
      assert.equal(
        statuses.filter((s) => s === 201 || s === 200).length,
        20,
        `Todas as 20 requisições idempotentes devem responder 200/201 (statuses=${statuses.join(',')})`
      );
      assert.equal(statuses.filter((s) => s === 201).length, 1, 'Exatamente 1 deve criar (201)');
      assert.equal(
        bodies.filter((b) => b.is_duplicate === true).length,
        19,
        'Exatamente 19 devem ser duplicatas idempotentes'
      );

      const contractId = bodies[0].contract.id;
      const dbContractRes = await postgres.pool.query(
        `SELECT id, user_id, symbol, direction, status, stake_minor, entry_price, idempotency_key
         FROM contracts WHERE user_id = $1 AND idempotency_key = $2`,
        [userA, sharedIdemKey]
      );
      assert.equal(dbContractRes.rowCount, 1, 'Deve existir exatamente 1 contrato no PostgreSQL');
      const dbContract = dbContractRes.rows[0];
      assert.equal(dbContract.symbol, 'VOL_50', 'Contrato deve gravar símbolo canônico VOL_50 compatível com ticks');

      // Verifica que o entry_price veio de um tick oficial confirmado em ticks
      const matchedEntryTick = await postgres.pool.query(
        `SELECT sequence, price FROM ticks WHERE symbol = 'VOL_50' AND price = $1`,
        [dbContract.entry_price]
      );
      assert(matchedEntryTick.rowCount >= 1, 'entry_price do contrato deve existir na tabela oficial ticks');

      // Verifica contabilidade no Blnk: exatamente 1 reserva de 2500 e NENHUM uso de users.demo_balance_minor como contabilidade
      const blnkAvail = blnkServer.accounts.get(`@user_${userA}:available`);
      const blnkRes = blnkServer.accounts.get(`@user_${userA}:reserved`);
      assert.equal(blnkAvail?.balance, 1_000_000 - 2500, 'Saldo disponível no Blnk deve ser 997500');
      assert.equal(blnkRes?.balance, 2500, 'Saldo reservado no Blnk deve ser 2500');
      assert.equal(blnkServer.algebraicSum(), 0, 'Soma algébrica do Blnk deve ser estritamente 0');

      const userRowAfterOpen = await postgres.pool.query(
        `SELECT demo_balance_minor FROM users WHERE id = $1`,
        [userA]
      );
      assert.equal(
        Number(userRowAfterOpen.rows[0].demo_balance_minor),
        1_000_000,
        'POST /contracts NÃO deve fazer UPDATE users SET demo_balance_minor = demo_balance_minor - stake como contabilidade'
      );

      // 6. BOLA / IDOR em GET /contracts/:id: User B não pode ler contrato de User A
      const bolaRes = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert.equal(bolaRes.status, 404, 'User B consultando contrato de User A deve receber 404 (anti-BOLA)');

      const ownerRes = await fetch(`http://127.0.0.1:${feed.port}/api/v1/contracts/${contractId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert.equal(ownerRes.status, 200, 'User A consultando próprio contrato deve receber 200');
    } finally {
      await stopEphemeralFeed(feed);
    }
  }
);

test(
  '[Gate B | M-03 & V-07 & V-08 & AC-GD-08-1 & AC-GD-08-2 & AC-GD-08-6] Contrato OPEN sobrevive a restart, aguarda primeiro tick oficial >= expires_at (sem fallback de RAM) e resiste a 20 liquidadores concorrentes',
  { timeout: 90_000 },
  async () => {
    const traderId = crypto.randomUUID();
    const blnkClient = new BlnkClient(blnkServer.baseUrl, 2500);
    await blnkClient.onboardUser(traderId);

    const symbol = 'VOL_50';
    const baseTimeMs = Date.now() - 20_000;
    const expiresAtMs = baseTimeMs + 5_000; // Expirou há 15s, mas ainda sem tick >= expiresAtMs para VOL_50

    // Limpa ticks de VOL_50 posteriores a baseTimeMs - 1000 para controlar exatamente a fronteira de expiração
    await postgres.pool.query(`DELETE FROM ticks WHERE symbol = $1`, [symbol]);
    const preExpiryTs = new Date(expiresAtMs - 1_000).toISOString();
    const preHash = canonicalHash({
      symbol,
      sequence: 1,
      price: '500.0000',
      ts: preExpiryTs,
      prevHash: genesisHash(symbol),
    });
    await postgres.pool.query(
      `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
       VALUES ($1, 1, 500.0000, $2, $3, $4)`,
      [symbol, preExpiryTs, genesisHash(symbol), preHash]
    );
    await postgres.pool.query(
      `UPDATE index_state SET last_sequence = 1, last_price = 500.0000, last_hash = $2, last_ts = $3 WHERE symbol = $1`,
      [symbol, preHash, preExpiryTs]
    );

    // Insere um tick de OUTRO símbolo (EURUSD_OTC) com ts >= expires_at para provar que jamais liquida VOL_50
    const otherTs = new Date(expiresAtMs + 500).toISOString();
    await postgres.pool.query(
      `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
       VALUES ('EURUSD_OTC', 9999, 1.09999, $1, $2, $3)
       ON CONFLICT (symbol, sequence) DO NOTHING`,
      [otherTs, genesisHash('EURUSD_OTC'), 'h_other_9999']
    );

    // Cria contrato OPEN no PostgreSQL + reserva no Blnk (simulando contrato aberto antes de restart do processo, sem timer em RAM)
    const contractId = crypto.randomUUID();
    const stakeMinor = 3333; // Testa arredondamento inteiro exato D-19: Math.round(3333 * 1.85) = 6166 (lucro 2833)
    await blnkClient.reserveStake(traderId, contractId, stakeMinor);
    await postgres.pool.query(
      `INSERT INTO contracts (
         id, user_id, symbol, direction, status, stake_minor, entry_price,
         idempotency_key, opened_at, expires_at, created_at
       ) VALUES ($1, $2, $3, 'UP', 'OPEN', $4, 500.0000, $5, $6, $7, $6)`,
      [
        contractId,
        traderId,
        symbol,
        stakeMinor,
        `idem-restart-${contractId}`,
        new Date(baseTimeMs).toISOString(),
        new Date(expiresAtMs).toISOString(),
      ]
    );

    // Estado em RAM com tickHistory enganoso (se usasse RAM ou fallback liquidaria errado!)
    const fakeRamState = new Map([
      [
        symbol,
        {
          symbol,
          currentPrice: '480.0000',
          sequence: 99,
          lastTs: Date.now(),
          paused: false,
          tickHistory: [
            {
              sequence: 99,
              price: '480.0000',
              priceNum: 480.0,
              event_time: expiresAtMs + 100,
              ts: new Date(expiresAtMs + 100).toISOString(),
            },
          ],
        },
      ],
    ]);

    const coordinator = createSettlementCoordinator({
      assetState: fakeRamState,
      resolveSymbol: (s) => s.replace(/^SYNTH_/, ''),
      devContracts: [], // Vazio: simula processo reiniciado sem contratos nem timers em RAM
      devWallet: { currency: 'USD', available_minor: 1_000_000, reserved_minor: 0 },
      pgPool: postgres.pool,
      blnk: blnkClient,
      wss: null,
      WebSocket: null,
    });

    // 1. Sem tick oficial >= expires_at para VOL_50 no PostgreSQL, o sweeper DEVE manter o contrato OPEN
    const prematureSweep = await coordinator.runSweepCycle(Date.now());
    assert.equal(
      prematureSweep.settledCount,
      0,
      'Contrato NÃO pode ser liquidado sem tick oficial >= expires_at no PostgreSQL (mesmo com tick em RAM ou de outro ativo)'
    );
    const stillOpen = await postgres.pool.query(
      `SELECT status, exit_price, exit_tick_sequence FROM contracts WHERE id = $1`,
      [contractId]
    );
    assert.equal(stillOpen.rows[0].status, 'OPEN');
    assert.equal(stillOpen.rows[0].exit_price, null);
    assert.equal(stillOpen.rows[0].exit_tick_sequence, null);

    // 2. Agora persiste 2 ticks oficiais para VOL_50 após expires_at:
    //    - sequence 2 em expires_at + 200ms com price = 505.2500 (WIN, primeiro tick >= expires_at!)
    //    - sequence 3 em expires_at + 1200ms com price = 490.0000 (LOSS se pegasse o último tick!)
    const firstPostExpiryTs = new Date(expiresAtMs + 200).toISOString();
    const hash2 = canonicalHash({
      symbol,
      sequence: 2,
      price: '505.2500',
      ts: firstPostExpiryTs,
      prevHash: preHash,
    });
    const secondPostExpiryTs = new Date(expiresAtMs + 1200).toISOString();
    const hash3 = canonicalHash({
      symbol,
      sequence: 3,
      price: '490.0000',
      ts: secondPostExpiryTs,
      prevHash: hash2,
    });
    await postgres.pool.query(
      `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
       VALUES ($1, 2, 505.2500, $2, $3, $4),
              ($1, 3, 490.0000, $5, $4, $6)`,
      [symbol, firstPostExpiryTs, preHash, hash2, secondPostExpiryTs, hash3]
    );

    // 3. Dispara 20 liquidadores concorrentes (4 coordenadores distintos x 5 chamadas simultâneas)
    const coordinators = Array.from({ length: 4 }, () =>
      createSettlementCoordinator({
        assetState: fakeRamState,
        resolveSymbol: (s) => s.replace(/^SYNTH_/, ''),
        devContracts: [],
        devWallet: { currency: 'USD', available_minor: 1_000_000, reserved_minor: 0 },
        pgPool: postgres.pool,
        blnk: blnkClient,
        wss: null,
        WebSocket: null,
      })
    );

    const raceResults = await Promise.all(
      Array.from({ length: 20 }, (_, idx) =>
        coordinators[idx % 4].settleOpenContract(
          {
            id: contractId,
            user_id: traderId,
            symbol,
            direction: 'UP',
            status: 'OPEN',
            stake_minor: stakeMinor,
            entry_price: 500.0,
            expires_at: new Date(expiresAtMs).toISOString(),
            _persistedInDb: true,
          },
          'sweeper_db',
          Date.now()
        )
      )
    );

    const winners = raceResults.filter((r) => r.settled);
    assert.equal(winners.length, 1, 'Exatamente 1 dos 20 liquidadores concorrentes deve liquidar o contrato');
    assert.equal(winners[0].result, 'WIN');
    assert.equal(winners[0].exitPrice, 505.25);
    assert.equal(winners[0].payoutMinor, 6166);

    // Verifica estado gravado no PostgreSQL (incluindo exit_tick_sequence = 2 e outbox_events 1:1)
    const settledRowRes = await postgres.pool.query(
      `SELECT status, result, payout_minor, exit_price, exit_tick_sequence, settled_at
       FROM contracts WHERE id = $1`,
      [contractId]
    );
    assert.equal(settledRowRes.rowCount, 1);
    const settledRow = settledRowRes.rows[0];
    assert.equal(settledRow.status, 'SETTLED');
    assert.equal(settledRow.result, 'WIN');
    assert.equal(Number(settledRow.payout_minor), 6166);
    assert.equal(Number(settledRow.exit_price), 505.25);
    assert.equal(
      Number(settledRow.exit_tick_sequence),
      2,
      'exit_tick_sequence deve registrar exatamente a sequence (2) do primeiro tick oficial >= expires_at'
    );
    assert(settledRow.settled_at instanceof Date);

    const outboxRes = await postgres.pool.query(
      `SELECT id, event_type, payload, status FROM outbox_events
       WHERE event_type = 'CONTRACT_SETTLED' AND payload->>'contract_id' = $1`,
      [contractId]
    );
    assert.equal(outboxRes.rowCount, 1, 'Deve existir exatamente 1 evento CONTRACT_SETTLED na outbox');
    assert.equal(Number(outboxRes.rows[0].payload.exit_tick_sequence), 2);
    assert.equal(Number(outboxRes.rows[0].payload.payout_minor), 6166);

    // Verifica saldo final no Blnk: 1_000_000 - 3333 + 6166 = 1_002_833 e reserved = 0
    const finalBlnkBal = await blnkClient.getBalance(traderId);
    assert.equal(finalBlnkBal.available_minor, 1_002_833, 'Payout WIN deve ser creditado exatamente 1 vez no Blnk');
    assert.equal(finalBlnkBal.reserved_minor, 0, 'Reserva deve zerar após liquidação');
    assert.equal(blnkServer.algebraicSum(), 0, 'Equação de soma zero do Blnk preservada');
  }
);

test(
  '[Gate B | R-01..R-03 & AC-GD-08-3 & AC-GD-08-4] Caos: falha parcial após WIN_STAKE no Blnk e falha de trigger no PostgreSQL não geram duplo pagamento nem SETTLED sem ledger confirmado',
  { timeout: 90_000 },
  async () => {
    const traderId = crypto.randomUUID();
    const blnkClient = new BlnkClient(blnkServer.baseUrl, 1000);
    await blnkClient.onboardUser(traderId);

    const symbol = 'VOL_50';
    const expiresAtMs = Date.now() - 5_000;
    const contractId = crypto.randomUUID();
    const stakeMinor = 2000; // WIN -> payout 3700 (stake 2000 + profit 1700)

    await blnkClient.reserveStake(traderId, contractId, stakeMinor);
    await postgres.pool.query(
      `INSERT INTO contracts (
         id, user_id, symbol, direction, status, stake_minor, entry_price,
         idempotency_key, opened_at, expires_at, created_at
       ) VALUES ($1, $2, $3, 'UP', 'OPEN', $4, 490.0000, $5, NOW() - INTERVAL '65 seconds', $6, NOW() - INTERVAL '65 seconds')`,
      [contractId, traderId, symbol, stakeMinor, `idem-chaos-${contractId}`, new Date(expiresAtMs).toISOString()]
    );

    const tickTs4 = new Date(expiresAtMs + 100).toISOString();
    const prevTickRes = await postgres.pool.query(
      `SELECT sequence, hash FROM ticks WHERE symbol = $1 ORDER BY sequence DESC LIMIT 1`,
      [symbol]
    );
    const nextSeq = prevTickRes.rowCount > 0 ? Number(prevTickRes.rows[0].sequence) + 1 : 1;
    const prevHash = prevTickRes.rowCount > 0 ? prevTickRes.rows[0].hash : genesisHash(symbol);
    const hash4 = canonicalHash({
      symbol,
      sequence: nextSeq,
      price: '510.0000',
      ts: tickTs4,
      prevHash,
    });
    await postgres.pool.query(
      `INSERT INTO ticks (symbol, sequence, price, ts, prev_hash, hash)
       VALUES ($1, $2, 510.0000, $3, $4, $5)`,
      [symbol, nextSeq, tickTs4, prevHash, hash4]
    );

    const coordinator = createSettlementCoordinator({
      assetState: new Map(),
      resolveSymbol: (s) => s,
      devContracts: [],
      devWallet: { currency: 'USD', available_minor: 1_000_000, reserved_minor: 0 },
      pgPool: postgres.pool,
      blnk: blnkClient,
      wss: null,
      WebSocket: null,
    });

    // 1. Injeta falha no Blnk especificamente na 2ª perna (WIN_PROFIT) após WIN_STAKE já ter sido gravado!
    let winProfitBlocked = 0;
    blnkServer.setFaultRule((_req, body, pathname) => {
      if (pathname === '/transactions' && body.reference === `settlement:${contractId}:WIN_PROFIT`) {
        winProfitBlocked += 1;
        return { status: 503, body: { error: 'INJECTED_WIN_PROFIT_CRASH' } };
      }
      return null;
    });

    const failedAttempt = await coordinator.settleOpenContract(
      {
        id: contractId,
        user_id: traderId,
        symbol,
        direction: 'UP',
        status: 'OPEN',
        stake_minor: stakeMinor,
        entry_price: 490.0,
        expires_at: new Date(expiresAtMs).toISOString(),
        _persistedInDb: true,
      },
      'sweeper_db',
      Date.now()
    );
    assert.equal(failedAttempt.settled, false, 'Liquidação deve falhar quando WIN_PROFIT falha no Blnk');
    assert(winProfitBlocked >= 1, 'Injeção de falha em WIN_PROFIT deve ter disparado');

    // Contrato no PostgreSQL DEVE continuar OPEN (nunca SETTLED sem pagamento completo!)
    const afterBlnkFail = await postgres.pool.query(`SELECT status FROM contracts WHERE id = $1`, [contractId]);
    assert.equal(
      afterBlnkFail.rows[0].status,
      'OPEN',
      'Contrato deve permanecer OPEN no PostgreSQL quando o Blnk falha antes de concluir o pagamento'
    );

    // Remove falha do Blnk, mas injeta falha de trigger no PostgreSQL (outbox_events) para testar a 2ª fronteira!
    blnkServer.setFaultRule(null);
    await postgres.pool.query(`
      CREATE OR REPLACE FUNCTION qa_fail_settlement_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.event_type = 'CONTRACT_SETTLED' AND NEW.payload->>'contract_id' = '${contractId}' THEN
          RAISE EXCEPTION 'QA_INJECTED_PG_OUTBOX_FAILURE' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_qa_fail_settlement_outbox
      BEFORE INSERT ON outbox_events
      FOR EACH ROW EXECUTE FUNCTION qa_fail_settlement_outbox();
    `);

    const failedPgAttempt = await coordinator.settleOpenContract(
      {
        id: contractId,
        user_id: traderId,
        symbol,
        direction: 'UP',
        status: 'OPEN',
        stake_minor: stakeMinor,
        entry_price: 490.0,
        expires_at: new Date(expiresAtMs).toISOString(),
        _persistedInDb: true,
      },
      'sweeper_db',
      Date.now()
    );
    assert.equal(failedPgAttempt.settled, false, 'Falha na outbox do PostgreSQL deve abortar a transação');

    const afterPgFail = await postgres.pool.query(`SELECT status FROM contracts WHERE id = $1`, [contractId]);
    assert.equal(
      afterPgFail.rows[0].status,
      'OPEN',
      'Rollback do PostgreSQL deve manter o contrato OPEN após falha na outbox'
    );

    // 3. Remove o trigger de falha do PostgreSQL e roda o sweeper de recuperação:
    //    Agora deve concluir com sucesso, sem duplicar WIN_STAKE nem WIN_PROFIT no Blnk!
    await postgres.pool.query(`
      DROP TRIGGER trg_qa_fail_settlement_outbox ON outbox_events;
      DROP FUNCTION qa_fail_settlement_outbox();
    `);

    const recoveredSweep = await coordinator.runSweepCycle(Date.now());
    assert.equal(recoveredSweep.settledCount, 1, 'Sweeper deve recuperar e concluir a liquidação após fim das falhas');

    const finalContract = await postgres.pool.query(
      `SELECT status, result, payout_minor, exit_tick_sequence FROM contracts WHERE id = $1`,
      [contractId]
    );
    assert.equal(finalContract.rows[0].status, 'SETTLED');
    assert.equal(finalContract.rows[0].result, 'WIN');
    assert.equal(Number(finalContract.rows[0].payout_minor), 3700);
    assert.equal(Number(finalContract.rows[0].exit_tick_sequence), nextSeq);

    const finalBal = await blnkClient.getBalance(traderId);
    assert.equal(
      finalBal.available_minor,
      1_001_700,
      'Saldo final no Blnk após retries de falha parcial deve ter exatamente 1x o lucro (+1700)'
    );
    assert.equal(finalBal.reserved_minor, 0);
    assert.equal(blnkServer.algebraicSum(), 0, 'Soma algébrica do Blnk === 0 após recuperação de caos');
  }
);
