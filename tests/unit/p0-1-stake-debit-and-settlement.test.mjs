import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  createSettlementCoordinator,
  recordTickInHistory,
} from '../../scripts/lib/settlement-engine.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const DEV_LIVE_FEED_PATH = path.join(REPO_ROOT, 'scripts/dev-live-feed.mjs');
const SETTLEMENT_ENGINE_PATH = path.join(REPO_ROOT, 'scripts/lib/settlement-engine.mjs');

/**
 * Pool PostgreSQL transacional em memória (suporta pgPool.connect(), BEGIN, COMMIT, ROLLBACK,
 * SELECT ... FOR UPDATE, UPDATE users SET demo_balance_minor = demo_balance_minor - $1,
 * INSERT INTO contracts, UPDATE contracts, SELECT ... FROM ticks, INSERT INTO outbox_events).
 */
function createTransactionalPgSimulator({ initialBalanceMinor = 1_000_000, userId = 'user-p0-1' } = {}) {
  const state = {
    users: new Map([[userId, { id: userId, demo_balance_minor: initialBalanceMinor }]]),
    contracts: new Map(),
    ticks: [],
    outboxEvents: [],
    failOnContractInsert: false,
  };

  let txSnapshot = null;

  function cloneState(src) {
    return {
      users: new Map(Array.from(src.users.entries()).map(([k, v]) => [k, { ...v }])),
      contracts: new Map(Array.from(src.contracts.entries()).map(([k, v]) => [k, { ...v }])),
      ticks: src.ticks.map((t) => ({ ...t })),
      outboxEvents: src.outboxEvents.map((e) => ({ ...e })),
      failOnContractInsert: src.failOnContractInsert,
    };
  }

  async function executeQuery(sql, params = []) {
    const norm = sql.replace(/\s+/g, ' ').trim();

    if (norm === 'BEGIN') {
      txSnapshot = cloneState(state);
      return { rowCount: 0, rows: [] };
    }
    if (norm === 'COMMIT') {
      txSnapshot = null;
      return { rowCount: 0, rows: [] };
    }
    if (norm === 'ROLLBACK') {
      if (txSnapshot) {
        state.users = txSnapshot.users;
        state.contracts = txSnapshot.contracts;
        state.ticks = txSnapshot.ticks;
        state.outboxEvents = txSnapshot.outboxEvents;
        txSnapshot = null;
      }
      return { rowCount: 0, rows: [] };
    }

    // SELECT demo_balance_minor FROM users WHERE id = $1
    if (/^SELECT demo_balance_minor FROM users WHERE id = \$1/i.test(norm)) {
      const u = state.users.get(params[0]);
      return u
        ? { rowCount: 1, rows: [{ demo_balance_minor: u.demo_balance_minor }] }
        : { rowCount: 0, rows: [] };
    }

    // Débito atômico na abertura: UPDATE users SET demo_balance_minor = demo_balance_minor - $1 ... WHERE id = $2 AND demo_balance_minor >= $1
    if (/UPDATE users SET demo_balance_minor = demo_balance_minor - \$1/i.test(norm)) {
      const stake = Number(params[0]);
      const uid = params[1];
      const u = state.users.get(uid);
      if (!u || u.demo_balance_minor < stake) {
        return { rowCount: 0, rows: [] };
      }
      u.demo_balance_minor -= stake;
      return { rowCount: 1, rows: [{ demo_balance_minor: u.demo_balance_minor }] };
    }

    // Crédito atômico na liquidação: UPDATE users SET demo_balance_minor = demo_balance_minor + $1 ... WHERE id = $2
    if (/UPDATE users SET demo_balance_minor = demo_balance_minor \+ \$1/i.test(norm)) {
      const payout = Number(params[0]);
      const uid = params[1];
      const u = state.users.get(uid);
      if (!u) return { rowCount: 0, rows: [] };
      u.demo_balance_minor += payout;
      return { rowCount: 1, rows: [{ demo_balance_minor: u.demo_balance_minor }] };
    }

    // INSERT INTO contracts
    if (/^INSERT INTO contracts/i.test(norm)) {
      if (state.failOnContractInsert) {
        const err = new Error('Simulated DB insert failure');
        err.code = 'XX000';
        throw err;
      }
      const [id, uid, symbol, direction, stake_minor, entry_price, idempotency_key, expires_at, entry_tick_sequence, payout_pct] = params;
      for (const existing of state.contracts.values()) {
        if (existing.user_id === uid && existing.idempotency_key === idempotency_key) {
          const dupErr = new Error('duplicate key value violates unique constraint "uq_contracts_user_idempotency"');
          dupErr.code = '23505';
          dupErr.constraint = 'uq_contracts_user_idempotency';
          throw dupErr;
        }
      }
      const row = {
        id,
        user_id: uid,
        symbol,
        direction,
        status: 'OPEN',
        stake_minor: Number(stake_minor),
        entry_price: Number(entry_price),
        idempotency_key,
        expires_at,
        entry_tick_sequence: entry_tick_sequence ?? 1,
        payout_pct: payout_pct !== undefined ? Number(payout_pct) : 85,
        result: null,
        payout_minor: null,
        exit_price: null,
        exit_tick_sequence: null,
      };
      state.contracts.set(id, row);
      return { rowCount: 1, rows: [row] };
    }

    // SELECT ... FROM contracts WHERE id = $1 FOR UPDATE
    if (/FROM contracts WHERE id = \$1 FOR UPDATE/i.test(norm)) {
      const c = state.contracts.get(params[0]);
      return c ? { rowCount: 1, rows: [{ ...c }] } : { rowCount: 0, rows: [] };
    }

    // SELECT sequence, price, ts, hash FROM ticks WHERE symbol = $1 AND ts >= $2
    if (/FROM ticks WHERE symbol = \$1 AND ts >= \$2/i.test(norm)) {
      const sym = params[0];
      const minTs = Date.parse(params[1]);
      const matching = state.ticks
        .filter((t) => t.symbol === sym && Date.parse(t.ts) >= minTs)
        .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.sequence - b.sequence);
      return matching.length > 0
        ? { rowCount: 1, rows: [matching[0]] }
        : { rowCount: 0, rows: [] };
    }

    // UPDATE contracts SET status = 'SETTLED' ...
    if (/UPDATE contracts SET status = 'SETTLED'/i.test(norm)) {
      const contractId = params[4] ?? params[3];
      const c = state.contracts.get(contractId);
      if (!c || c.status !== 'OPEN') {
        return { rowCount: 0, rows: [] };
      }
      c.status = 'SETTLED';
      c.result = params[0];
      c.payout_minor = Number(params[1]);
      c.exit_price = Number(params[2]);
      c.exit_tick_sequence = Number(params[3]);
      return { rowCount: 1, rows: [{ id: c.id, user_id: c.user_id }] };
    }

    // INSERT INTO outbox_events
    if (/^INSERT INTO outbox_events/i.test(norm)) {
      state.outboxEvents.push({ sql: norm, params });
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  }

  return {
    state,
    query: executeQuery,
    connect: async () => ({
      query: executeQuery,
      release: () => {},
    }),
  };
}

test('P0-1 Passo 1 & 2: Sem Blnk (BLNK_ENABLED=false), abertura debita stake na mesma transação do contrato e liquidação credita apenas WIN/DRAW (LOSS=0, WIN=+18500, DRAW=+10000)', async () => {
  const devLiveFeedSrc = fs.readFileSync(DEV_LIVE_FEED_PATH, 'utf8');
  const settlementEngine = await import('../../scripts/lib/settlement-engine.mjs');

  // 1. Verifica que a gambiarra endsWith(':1') foi removida e substituída por BLNK_ENABLED explícito
  assert.equal(
    devLiveFeedSrc.includes("endsWith(':1')"),
    false,
    'dev-live-feed.mjs não pode usar a gambiarra endsWith(":1") para detectar o Blnk'
  );
  assert.equal(
    fs.readFileSync(SETTLEMENT_ENGINE_PATH, 'utf8').includes("endsWith(':1')"),
    false,
    'settlement-engine.mjs não pode usar a gambiarra endsWith(":1") para detectar o Blnk'
  );

  // 2. Verifica que executeAtomicContractOpen existe e debita o stake na mesma transação do INSERT INTO contracts
  assert.equal(
    typeof settlementEngine.executeAtomicContractOpen,
    'function',
    'settlement-engine.mjs deve exportar executeAtomicContractOpen usado pelo dev-live-feed.mjs na abertura de ordem'
  );

  const userId = '00000000-0000-4000-8000-000000000099';
  const pgPool = createTransactionalPgSimulator({
    initialBalanceMinor: 1_000_000,
    userId,
  });

  const baseTimeMs = 1_760_000_000_000;
  const assetState = new Map([
    [
      'VOL_50',
      {
        symbol: 'VOL_50',
        currentPrice: '500.0000',
        sequence: 1,
        lastTs: baseTimeMs,
        paused: false,
        tickHistory: [],
      },
    ],
  ]);
  const devContracts = [];
  const devWallet = { currency: 'USD', available_minor: 1_000_000, reserved_minor: 0 };

  const coordinator = createSettlementCoordinator({
    assetState,
    resolveSymbol: (s) => s,
    devContracts,
    devWallet,
    pgPool,
    blnk: null,
    blnkEnabled: false,
    wss: null,
    WebSocket: null,
  });

  // Saldo inicial antes de qualquer ordem = 1_000_000 ($10,000.00)
  assert.equal(pgPool.state.users.get(userId).demo_balance_minor, 1_000_000);

  // =========================================================================
  // Caso 1: Ordem de 10000 minor -> LOSS
  // Esperado: abertura -10000 (990000); após LOSS +0 (990000)
  // =========================================================================
  const openLoss = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-p0-loss',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-loss-1',
    expiresAt: new Date(baseTimeMs + 60_000).toISOString(),
    accountType: 'DEMO',
  });
  assert.equal(openLoss.ok, true);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    990_000,
    'Após abertura de 10000 minor sem Blnk, saldo deve cair de 1000000 para 990000 (-10000)'
  );

  // Registra tick de vencimento com queda (499.0000 < 500.0000 -> LOSS para UP)
  const lossTick = {
    symbol: 'VOL_50',
    sequence: 2,
    price: '499.0000',
    event_time: baseTimeMs + 60_000,
    ts: new Date(baseTimeMs + 60_000).toISOString(),
    hash: 'hash_2',
  };
  pgPool.state.ticks.push(lossTick);
  recordTickInHistory(assetState.get('VOL_50'), lossTick);

  const settleLoss = await coordinator.settleOpenContract(
    pgPool.state.contracts.get('contract-p0-loss'),
    'timer',
    baseTimeMs + 60_100
  );
  assert.equal(settleLoss.settled, true);
  assert.equal(settleLoss.result, 'LOSS');
  assert.equal(settleLoss.payoutMinor, 0);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    990_000,
    'Após LOSS, saldo deve permanecer 990000 (perda líquida de -10000)'
  );

  // =========================================================================
  // Caso 2: Ordem de 10000 minor -> WIN
  // Esperado: abertura -10000 (980000); após WIN +18500 (998500, lucro líquido +8500)
  // =========================================================================
  const openWin = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-p0-win',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 3,
    entryTickHash: 'hash_3',
    idempotencyKey: 'idem-win-1',
    expiresAt: new Date(baseTimeMs + 120_000).toISOString(),
    accountType: 'DEMO',
  });
  assert.equal(openWin.ok, true);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    980_000,
    'Após abertura de 10000 minor, saldo deve cair de 990000 para 980000 (-10000)'
  );

  const winTick = {
    symbol: 'VOL_50',
    sequence: 4,
    price: '501.0000',
    event_time: baseTimeMs + 120_000,
    ts: new Date(baseTimeMs + 120_000).toISOString(),
    hash: 'hash_4',
  };
  pgPool.state.ticks.push(winTick);
  recordTickInHistory(assetState.get('VOL_50'), winTick);

  const settleWin = await coordinator.settleOpenContract(
    pgPool.state.contracts.get('contract-p0-win'),
    'timer',
    baseTimeMs + 120_100
  );
  assert.equal(settleWin.settled, true);
  assert.equal(settleWin.result, 'WIN');
  assert.equal(settleWin.payoutMinor, 18_500);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    998_500,
    'Após WIN de 10000 minor (payout 85%), saldo deve ir de 980000 para 998500 (+18500, ganho líquido +8500)'
  );

  // =========================================================================
  // Caso 3: Ordem de 10000 minor -> DRAW
  // Esperado: abertura -10000 (988500); após DRAW +10000 (998500, variação líquida 0)
  // =========================================================================
  const openDraw = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-p0-draw',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 5,
    entryTickHash: 'hash_5',
    idempotencyKey: 'idem-draw-1',
    expiresAt: new Date(baseTimeMs + 180_000).toISOString(),
    accountType: 'DEMO',
  });
  assert.equal(openDraw.ok, true);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    988_500,
    'Após abertura de 10000 minor, saldo deve cair de 998500 para 988500 (-10000)'
  );

  const drawTick = {
    symbol: 'VOL_50',
    sequence: 6,
    price: '500.0000',
    event_time: baseTimeMs + 180_000,
    ts: new Date(baseTimeMs + 180_000).toISOString(),
    hash: 'hash_6',
  };
  pgPool.state.ticks.push(drawTick);
  recordTickInHistory(assetState.get('VOL_50'), drawTick);

  const settleDraw = await coordinator.settleOpenContract(
    pgPool.state.contracts.get('contract-p0-draw'),
    'timer',
    baseTimeMs + 180_100
  );
  assert.equal(settleDraw.settled, true);
  assert.equal(settleDraw.result, 'DRAW');
  assert.equal(settleDraw.payoutMinor, 10_000);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    998_500,
    'Após DRAW de 10000 minor, saldo deve voltar de 988500 para 998500 (+10000)'
  );
});

test('P0-1 Passo 2b/2c/Caos/Segurança: Blnk ativo não faz débito duplo; Conta REAL sem Blnk retorna 503 LEDGER_UNAVAILABLE; Rollback restaura saldo; Race condition não deixa saldo negativo', async () => {
  const settlementEngine = await import('../../scripts/lib/settlement-engine.mjs');
  assert.equal(typeof settlementEngine.executeAtomicContractOpen, 'function');

  const userId = '00000000-0000-4000-8000-000000000100';
  const pgPool = createTransactionalPgSimulator({
    initialBalanceMinor: 15_000,
    userId,
  });

  // 1. Conta REAL sem Blnk ativo -> 503 LEDGER_UNAVAILABLE
  const realAttempt = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-real-denied',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 5_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-real-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    accountType: 'REAL',
  });
  assert.equal(realAttempt.ok, false);
  assert.equal(realAttempt.statusCode, 503);
  assert.equal(realAttempt.errorBody.code, 'LEDGER_UNAVAILABLE');
  assert.equal(pgPool.state.users.get(userId).demo_balance_minor, 15_000, 'Saldo intocado após recusa 503');

  // 2. Caos: falha no INSERT INTO contracts após o UPDATE users -> ROLLBACK restaura os 15000 minor
  pgPool.state.failOnContractInsert = true;
  const failedTx = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-rollback-1',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-rollback-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    accountType: 'DEMO',
  });
  pgPool.state.failOnContractInsert = false;
  assert.equal(failedTx.ok, false);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    15_000,
    'ROLLBACK da transação deve restaurar integralmente o saldo debitado se INSERT INTO contracts falhar'
  );

  // 3. Segurança / Race condition: 2 ordens de 10000 minor com saldo de 15000 minor -> 1 passa, 1 falha com 400 INSUFFICIENT_BALANCE
  const firstOpen = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-race-a',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-race-a',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    accountType: 'DEMO',
  });
  const secondOpen = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: null,
    blnkEnabled: false,
    contractId: 'contract-race-b',
    userId,
    symbol: 'VOL_50',
    direction: 'DOWN',
    stakeMinor: 10_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-race-b',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    accountType: 'DEMO',
  });
  assert.equal(firstOpen.ok, true);
  assert.equal(secondOpen.ok, false);
  assert.equal(secondOpen.statusCode, 400);
  assert.equal(secondOpen.errorBody.code, 'INSUFFICIENT_BALANCE');
  assert.equal(pgPool.state.users.get(userId).demo_balance_minor, 5_000, 'Saldo final deve ser 5000 (nunca negativo)');

  // 4. Modo Blnk Ativo (blnkEnabled=true): reserva no Blnk e NÃO debita users.demo_balance_minor (zero débito duplo)
  let blnkReservedMinor = 0;
  let blnkAvailMinor = 100_000;
  const mockBlnk = {
    getBalance: async () => ({ available_minor: blnkAvailMinor, reserved_minor: blnkReservedMinor }),
    reserveStake: async (_uid, _cid, amount) => {
      blnkAvailMinor -= amount;
      blnkReservedMinor += amount;
    },
    releaseReservedStake: async (_uid, _cid, amount) => {
      blnkAvailMinor += amount;
      blnkReservedMinor -= amount;
    },
  };

  const blnkOpen = await settlementEngine.executeAtomicContractOpen({
    pgPool,
    blnk: mockBlnk,
    blnkEnabled: true,
    contractId: 'contract-blnk-active',
    userId,
    symbol: 'VOL_50',
    direction: 'UP',
    stakeMinor: 5_000,
    payoutPct: 85,
    entryPrice: 500.0,
    entryTickSequence: 1,
    entryTickHash: 'hash_1',
    idempotencyKey: 'idem-blnk-1',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    accountType: 'REAL',
  });
  assert.equal(blnkOpen.ok, true);
  assert.equal(blnkAvailMinor, 95_000, 'Blnk deve reservar 5000 minor');
  assert.equal(blnkReservedMinor, 5_000);
  assert.equal(
    pgPool.state.users.get(userId).demo_balance_minor,
    5_000,
    'Com Blnk ativo, users.demo_balance_minor NÃO deve sofrer débito local (evita débito duplo)'
  );
});

test('P0-1 Passo 4: scripts/diag/wallet-consistency.mjs calcula saldo esperado = inicial - Σ stakes + Σ payouts (estritamente read-only)', async () => {
  const { computeWalletConsistencyReport } = await import('../../scripts/diag/wallet-consistency.mjs');
  const diagSrc = fs.readFileSync(path.join(REPO_ROOT, 'scripts/diag/wallet-consistency.mjs'), 'utf8');

  // Garante que o script não contém comandos mutadores (UPDATE/DELETE/INSERT/TRUNCATE)
  assert.equal(/\b(UPDATE|DELETE|INSERT|TRUNCATE)\s+/i.test(diagSrc), false);

  const report = computeWalletConsistencyReport([
    {
      user_id: 'user-consistent-1',
      email: 'ok@binmax.com',
      contracts_count: 3,
      initial_balance_minor: 1_000_000,
      total_stakes_minor: 30_000,
      total_payouts_minor: 28_500, // 1 LOSS (0) + 1 WIN (18500) + 1 DRAW (10000)
      current_balance_minor: 998_500,
    },
    {
      user_id: 'user-divergent-bc0be5a',
      email: 'bug@binmax.com',
      contracts_count: 1,
      initial_balance_minor: 1_000_000,
      total_stakes_minor: 10_000,
      total_payouts_minor: 18_500,
      current_balance_minor: 1_018_500, // Stake de 10000 não havia sido debitado antes da correção!
    },
  ]);

  assert.equal(report.read_only, true);
  assert.equal(report.total_users_with_contracts, 2);
  assert.equal(report.consistent_users_count, 1);
  assert.equal(report.divergent_users_count, 1);
  assert.equal(report.divergences[0].user_id, 'user-divergent-bc0be5a');
  assert.equal(report.divergences[0].expected_balance_minor, 1_008_500);
  assert.equal(report.divergences[0].current_balance_minor, 1_018_500);
  assert.equal(report.divergences[0].diff_minor, 10_000);
});

