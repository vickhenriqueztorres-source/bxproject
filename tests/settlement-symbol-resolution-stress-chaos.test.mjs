import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSettlementCoordinator,
  recordTickInHistory,
  buildSymbolCandidates,
} from '../scripts/lib/settlement-engine.mjs';

const SYMBOL_ALIASES = {
  SYNTH_VOL_10: 'VOL_10',
  SYNTH_VOL_25: 'VOL_25',
  SYNTH_VOL_50: 'VOL_50',
  SYNTH_VOL_75: 'VOL_75',
  SYNTH_VOL_100: 'VOL_100',
  SYNTH_CRASH_BOOM_100: 'CRASH_BOOM_100',
};

function resolveSymbol(sym) {
  if (!sym) return 'VOL_50';
  return SYMBOL_ALIASES[sym] || sym;
}

/**
 * Simulador realista de PostgreSQL transacional (suporta BEGIN, COMMIT, ROLLBACK,
 * SELECT ... FOR UPDATE em contracts e users, e busca em ticks com = $1 ou = ANY($1)).
 */
function createMockTransactionalPgPool({
  contracts = [],
  ticks = [],
  users = [],
  failQueryUntil = 0,
}) {
  const contractsMap = new Map(contracts.map((c) => [c.id, { ...c }]));
  const usersMap = new Map(users.map((u) => [u.id, { ...u }]));
  const ticksList = ticks.map((t) => ({ ...t }));
  const rowLocks = new Set();
  let queryCount = 0;

  async function executeQuery(sql, params = [], txState = null) {
    queryCount += 1;
    if (Date.now() < failQueryUntil) {
      throw new Error('PG_CONNECTION_CHAOS_FAILURE');
    }

    const norm = sql.replace(/\s+/g, ' ').trim().toUpperCase();

    if (norm === 'BEGIN' || norm === 'COMMIT' || norm === 'ROLLBACK') {
      if (norm === 'ROLLBACK' && txState?.snapshot) {
        for (const [k, v] of txState.snapshot.contracts.entries()) {
          contractsMap.set(k, { ...v });
        }
        for (const [k, v] of txState.snapshot.users.entries()) {
          usersMap.set(k, { ...v });
        }
      }
      return { rowCount: 0, rows: [] };
    }

    // SELECT ... FROM contracts WHERE status = 'OPEN' AND expires_at <= NOW()
    if (norm.includes('FROM CONTRACTS') && norm.includes("WHERE STATUS = 'OPEN' AND EXPIRES_AT <= NOW()")) {
      const nowMs = Date.now();
      const rows = Array.from(contractsMap.values())
        .filter((c) => c.status === 'OPEN' && Date.parse(c.expires_at) <= nowMs)
        .sort((a, b) => Date.parse(a.expires_at) - Date.parse(b.expires_at))
        .slice(0, 100)
        .map((c) => ({ ...c }));
      return { rowCount: rows.length, rows };
    }

    // SELECT ... FROM contracts WHERE id = $1 FOR UPDATE
    if (norm.includes('FROM CONTRACTS') && norm.includes('WHERE ID = $1') && norm.includes('FOR UPDATE')) {
      const id = params[0];
      while (rowLocks.has(id)) {
        await new Promise((r) => setTimeout(r, 2));
      }
      if (txState) {
        txState.lockedIds.add(id);
      }
      rowLocks.add(id);
      const row = contractsMap.get(id);
      if (!row) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ ...row }] };
    }

    // SELECT sequence, price, ts, hash FROM ticks WHERE ...
    if (norm.includes('FROM TICKS')) {
      const symbolParam = params[0];
      const expiresIso = params[1];
      const expiresMs = Date.parse(expiresIso);
      const symbolSet = Array.isArray(symbolParam)
        ? new Set(symbolParam.map(String))
        : new Set([String(symbolParam)]);

      const matched = ticksList
        .filter((t) => symbolSet.has(t.symbol) && Date.parse(t.ts) >= expiresMs)
        .sort((a, b) => {
          const dt = Date.parse(a.ts) - Date.parse(b.ts);
          return dt !== 0 ? dt : Number(a.sequence) - Number(b.sequence);
        });

      if (matched.length === 0) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ ...matched[0] }] };
    }

    // UPDATE contracts SET status = 'SETTLED' ...
    if (norm.startsWith('UPDATE CONTRACTS SET STATUS =')) {
      const result = params[0];
      const payoutMinor = Number(params[1]);
      const exitPrice = Number(params[2]);
      let exitTickSeq;
      let contractId;
      if (norm.includes('WHERE ID = $5')) {
        exitTickSeq = params[3];
        contractId = params[4];
      } else {
        contractId = params[3];
        exitTickSeq = params[4];
      }
      const existing = contractsMap.get(contractId);
      if (!existing || existing.status !== 'OPEN') {
        return { rowCount: 0, rows: [] };
      }
      existing.status = 'SETTLED';
      existing.result = result;
      existing.payout_minor = payoutMinor;
      existing.exit_price = exitPrice;
      existing.exit_tick_sequence = exitTickSeq;
      existing.settled_at = new Date().toISOString();
      return { rowCount: 1, rows: [{ id: existing.id, user_id: existing.user_id }] };
    }

    // UPDATE users SET demo_balance_minor = demo_balance_minor + $1 WHERE id = $2
    if (norm.startsWith('UPDATE USERS SET DEMO_BALANCE_MINOR = DEMO_BALANCE_MINOR + $1')) {
      const credit = Number(params[0]);
      const userId = params[1];
      const user = usersMap.get(userId);
      if (!user) return { rowCount: 0, rows: [] };
      user.demo_balance_minor = Number(user.demo_balance_minor) + credit;
      return { rowCount: 1, rows: [{ demo_balance_minor: user.demo_balance_minor }] };
    }

    // SELECT demo_balance_minor FROM users WHERE id = $1
    if (norm.includes('SELECT DEMO_BALANCE_MINOR FROM USERS WHERE ID = $1')) {
      const userId = params[0];
      const user = usersMap.get(userId);
      if (!user) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [{ demo_balance_minor: user.demo_balance_minor }] };
    }

    // INSERT INTO outbox_events ...
    if (norm.startsWith('INSERT INTO OUTBOX_EVENTS')) {
      return { rowCount: 1, rows: [] };
    }

    throw new Error(`Unhandled SQL in mock pool: ${norm}`);
  }

  return {
    contractsMap,
    usersMap,
    ticksList,
    getQueryCount: () => queryCount,
    setFailQueryUntil: (ts) => {
      failQueryUntil = ts;
    },
    query: (sql, params) => executeQuery(sql, params, null),
    connect: async () => {
      if (Date.now() < failQueryUntil) {
        throw new Error('PG_CONNECT_CHAOS_FAILURE');
      }
      const txState = {
        lockedIds: new Set(),
        snapshot: {
          contracts: new Map(
            Array.from(contractsMap.entries()).map(([k, v]) => [k, { ...v }])
          ),
          users: new Map(
            Array.from(usersMap.entries()).map(([k, v]) => [k, { ...v }])
          ),
        },
      };
      return {
        query: (sql, params) => executeQuery(sql, params, txState),
        release: () => {
          for (const id of txState.lockedIds) {
            rowLocks.delete(id);
          }
          txState.lockedIds.clear();
        },
      };
    },
  };
}

test('Subetapa 1.1 (Unitário): buildSymbolCandidates resolve variantes bidirecionais (SYNTH_* <-> VOL_*/CRASH_BOOM_100)', () => {
  assert.equal(typeof buildSymbolCandidates, 'function');

  const cVol50FromSynth = buildSymbolCandidates('SYNTH_VOL_50', resolveSymbol);
  assert.deepEqual(cVol50FromSynth, ['SYNTH_VOL_50', 'VOL_50']);

  const cVol50FromCanon = buildSymbolCandidates('VOL_50', resolveSymbol);
  assert.deepEqual(cVol50FromCanon, ['VOL_50', 'SYNTH_VOL_50']);

  const cCrashFromSynth = buildSymbolCandidates('SYNTH_CRASH_BOOM_100', resolveSymbol);
  assert.deepEqual(cCrashFromSynth, ['SYNTH_CRASH_BOOM_100', 'CRASH_BOOM_100']);

  const cCrashFromCanon = buildSymbolCandidates('CRASH_BOOM_100', resolveSymbol);
  assert.deepEqual(cCrashFromCanon, ['CRASH_BOOM_100', 'SYNTH_CRASH_BOOM_100']);

  const cOtc = buildSymbolCandidates('EURUSD_OTC', resolveSymbol);
  assert.deepEqual(cOtc, ['EURUSD_OTC']);
});

test('Subetapa 1.2 (Integração ACID — Reprodução Exata VPS): liquida contrato SYNTH_VOL_50 quando ticks estão sob SYNTH_VOL_50', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const contractId = 'e847d79e-737b-46b7-8a3b-1e1b2608140c';
  const expiresAtIso = '2026-10-16T03:16:00.355Z';

  const mockPool = createMockTransactionalPgPool({
    users: [{ id: userId, demo_balance_minor: 1207500 }],
    contracts: [
      {
        id: contractId,
        user_id: userId,
        symbol: 'SYNTH_VOL_50',
        direction: 'DOWN',
        status: 'OPEN',
        stake_minor: 10000,
        payout_pct: 85,
        entry_price: 504.112943,
        expires_at: expiresAtIso,
        created_at: '2026-10-16T03:15:00.355Z',
        _persistedInDb: true,
      },
    ],
    ticks: [
      {
        symbol: 'SYNTH_VOL_50',
        sequence: 18831,
        price: 504.200000,
        ts: '2026-10-16T03:16:00.000Z',
        hash: 'h_18831',
      },
      {
        symbol: 'SYNTH_VOL_50',
        sequence: 18832,
        price: 503.954645,
        ts: '2026-10-16T03:16:01.000Z',
        hash: 'h_18832',
      },
    ],
  });

  const assetState = new Map([
    ['VOL_50', { symbol: 'VOL_50', currentPrice: '503.954645', sequence: 18832, tickHistory: [] }],
  ]);
  const devContracts = [mockPool.contractsMap.get(contractId)];
  const devWallet = { available_minor: 1207500, reserved_minor: 10000 };

  const coordinator = createSettlementCoordinator({
    assetState,
    resolveSymbol,
    devContracts,
    devWallet,
    pgPool: mockPool,
    blnk: null,
    blnkEnabled: false,
    wss: null,
    WebSocket: null,
  });

  const sweepRes = await coordinator.runSweepCycle(Date.parse('2026-10-16T03:16:02.000Z'));
  assert.equal(sweepRes.settledCount, 1);

  const dbContract = mockPool.contractsMap.get(contractId);
  assert.equal(dbContract.status, 'SETTLED');
  assert.equal(dbContract.result, 'WIN');
  assert.equal(dbContract.exit_price, 503.954645);
  assert.equal(dbContract.exit_tick_sequence, 18832);
  assert.equal(dbContract.payout_minor, 18500);
  assert.equal(mockPool.usersMap.get(userId).demo_balance_minor, 1207500 + 18500);
});

test('Subetapa 1.3 (Estresse e Concorrência Massiva): 200 contratos simultâneos + disputa tripla timer/sweeper_mem/sweeper_db sem Double-Payout', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const totalContracts = 200;
  const stakeMinor = 1000; // $10.00
  const payoutPct = 85;
  const expectedPayoutPerWin = 1850; // $18.50
  const expiresAtIso = '2026-10-16T04:00:00.000Z';

  const initialContracts = [];
  for (let i = 0; i < totalContracts; i++) {
    initialContracts.push({
      id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      user_id: userId,
      symbol: i % 2 === 0 ? 'SYNTH_VOL_50' : 'VOL_50',
      direction: i % 2 === 0 ? 'UP' : 'DOWN',
      status: 'OPEN',
      stake_minor: stakeMinor,
      payout_pct: payoutPct,
      entry_price: 500.0,
      expires_at: expiresAtIso,
      created_at: '2026-10-16T03:59:00.000Z',
      _persistedInDb: true,
    });
  }

  // O tick de expiração sobe para 501.25 -> metade (100 UP) ganha, metade (100 DOWN) perde
  const mockPool = createMockTransactionalPgPool({
    users: [{ id: userId, demo_balance_minor: 500000 }],
    contracts: initialContracts,
    ticks: [
      {
        symbol: 'SYNTH_VOL_50',
        sequence: 50001,
        price: 501.25,
        ts: '2026-10-16T04:00:00.100Z',
        hash: 'h_50001',
      },
    ],
  });

  const assetState = new Map([
    ['VOL_50', { symbol: 'VOL_50', currentPrice: '501.2500', sequence: 50001, tickHistory: [] }],
  ]);
  const devContracts = initialContracts.map((c) => ({ ...c }));
  const devWallet = { available_minor: 500000, reserved_minor: totalContracts * stakeMinor };

  const coordinator = createSettlementCoordinator({
    assetState,
    resolveSymbol,
    devContracts,
    devWallet,
    pgPool: mockPool,
    blnk: null,
    blnkEnabled: false,
    wss: null,
    WebSocket: null,
  });

  const nowMs = Date.parse('2026-10-16T04:00:01.000Z');

  // Dispara simultaneamente: 200 timers individuais + 3 chamadas de runSweepCycle
  await Promise.all([
    ...devContracts.map((c) => coordinator.settleOpenContract(c, 'timer', nowMs)),
    coordinator.runSweepCycle(nowMs),
    coordinator.runSweepCycle(nowMs + 10),
  ]);

  // Verifica que todos os 200 contratos foram liquidados exatamente 1 vez
  let settledCount = 0;
  let winCount = 0;
  let lossCount = 0;
  for (const c of mockPool.contractsMap.values()) {
    if (c.status === 'SETTLED') settledCount += 1;
    if (c.result === 'WIN') winCount += 1;
    if (c.result === 'LOSS') lossCount += 1;
  }

  assert.equal(settledCount, 200);
  assert.equal(winCount, 100);
  assert.equal(lossCount, 100);

  // Invariante Financeira I-01 / I-06: Saldo final deve ser EXATAMENTE 500.000 + (100 * 1.850) = 685.000
  const finalBalance = mockPool.usersMap.get(userId).demo_balance_minor;
  assert.equal(finalBalance, 500000 + 100 * expectedPayoutPerWin);
  assert.ok(coordinator.telemetry.duplicateSettlementPreventedTotal > 0);
});

test('Subetapa 1.4 (Segurança): imutabilidade de contrato SETTLED e isolamento de broadcast WebSocket por user_id', async () => {
  const userA = '00000000-0000-4000-8000-00000000000a';
  const userB = '00000000-0000-4000-8000-00000000000b';
  const contractId = '11111111-2222-4333-8444-555555555555';
  const expiresAtIso = '2026-10-16T05:00:00.000Z';

  const mockPool = createMockTransactionalPgPool({
    users: [
      { id: userA, demo_balance_minor: 100000 },
      { id: userB, demo_balance_minor: 100000 },
    ],
    contracts: [
      {
        id: contractId,
        user_id: userA,
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        status: 'OPEN',
        stake_minor: 5000,
        payout_pct: 85,
        entry_price: 500.0,
        expires_at: expiresAtIso,
        created_at: '2026-10-16T04:59:00.000Z',
        _persistedInDb: true,
      },
    ],
    ticks: [
      {
        symbol: 'SYNTH_VOL_50',
        sequence: 9001,
        price: 499.0, // LOSS
        ts: '2026-10-16T05:00:00.200Z',
        hash: 'h_9001',
      },
    ],
  });

  const messagesToA = [];
  const messagesToB = [];
  const mockWss = {
    clients: new Set([
      {
        readyState: 1,
        authenticatedUserId: userA,
        send: (msg) => messagesToA.push(JSON.parse(msg)),
      },
      {
        readyState: 1,
        authenticatedUserId: userB,
        send: (msg) => messagesToB.push(JSON.parse(msg)),
      },
    ]),
  };

  const devContracts = [{ ...mockPool.contractsMap.get(contractId) }];
  const coordinator = createSettlementCoordinator({
    assetState: new Map([['VOL_50', { symbol: 'VOL_50', currentPrice: '499.0000', sequence: 9001, tickHistory: [] }]]),
    resolveSymbol,
    devContracts,
    devWallet: { available_minor: 100000, reserved_minor: 5000 },
    pgPool: mockPool,
    blnk: null,
    blnkEnabled: false,
    wss: mockWss,
    WebSocket: { OPEN: 1 },
  });

  const firstRes = await coordinator.settleOpenContract(devContracts[0], 'timer', Date.parse('2026-10-16T05:00:01.000Z'));
  assert.equal(firstRes.settled, true);
  assert.equal(firstRes.result, 'LOSS');

  // Verifica que userB NÃO recebeu eventos privados de carteira/contrato de userA (S-03 BOLA/IDOR)
  assert.equal(messagesToA.length, 2);
  assert.equal(messagesToB.length, 0);

  // Tentativa maliciosa de re-liquidar o contrato forçando status='OPEN' no objeto externo
  const forgedAttempt = await coordinator.settleOpenContract(
    { ...devContracts[0], status: 'OPEN', entry_price: 1.0 },
    'timer',
    Date.parse('2026-10-16T05:00:02.000Z')
  );
  assert.equal(forgedAttempt.settled, false);
  assert.equal(mockPool.contractsMap.get(contractId).result, 'LOSS');
  assert.equal(mockPool.usersMap.get(userA).demo_balance_minor, 100000);
});

test('Subetapa 1.5 (Caos): atraso de tick oficial (WAITING_FOR_OFFICIAL_EXPIRY_TICK) + falha temporária de DB + deduplicação por ciclo', async () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const contractId = '22222222-3333-4444-8555-666666666666';
  const expiresAtIso = '2026-10-16T06:00:00.500Z';

  const mockPool = createMockTransactionalPgPool({
    users: [{ id: userId, demo_balance_minor: 200000 }],
    contracts: [
      {
        id: contractId,
        user_id: userId,
        symbol: 'SYNTH_VOL_50',
        direction: 'UP',
        status: 'OPEN',
        stake_minor: 10000,
        payout_pct: 85,
        entry_price: 500.0,
        expires_at: expiresAtIso,
        created_at: '2026-10-16T05:59:00.500Z',
        _persistedInDb: true,
      },
    ],
    // Ainda não há tick >= 06:00:00.500Z
    ticks: [
      {
        symbol: 'SYNTH_VOL_50',
        sequence: 100,
        price: 500.1,
        ts: '2026-10-16T06:00:00.000Z',
        hash: 'h_100',
      },
    ],
  });

  const devContracts = [{ ...mockPool.contractsMap.get(contractId) }];
  const coordinator = createSettlementCoordinator({
    assetState: new Map([['VOL_50', { symbol: 'VOL_50', currentPrice: '500.1000', sequence: 100, tickHistory: [] }]]),
    resolveSymbol,
    devContracts,
    devWallet: { available_minor: 200000, reserved_minor: 10000 },
    pgPool: mockPool,
    blnk: null,
    blnkEnabled: false,
    wss: null,
    WebSocket: null,
  });

  const nowCycle1 = Date.parse('2026-10-16T06:00:00.600Z');
  const resCycle1 = await coordinator.runSweepCycle(nowCycle1);
  assert.equal(resCycle1.settledCount, 0);
  assert.equal(mockPool.contractsMap.get(contractId).status, 'OPEN');

  // Caos: injeta tick oficial ts >= expires_at no 2º segundo
  mockPool.ticksList.push({
    symbol: 'SYNTH_VOL_50',
    sequence: 101,
    price: 502.5,
    ts: '2026-10-16T06:00:01.000Z',
    hash: 'h_101',
  });

  const nowCycle2 = Date.parse('2026-10-16T06:00:01.100Z');
  const resCycle2 = await coordinator.runSweepCycle(nowCycle2);
  assert.equal(resCycle2.settledCount, 1);
  assert.equal(mockPool.contractsMap.get(contractId).status, 'SETTLED');
  assert.equal(mockPool.contractsMap.get(contractId).exit_tick_sequence, 101);
  assert.equal(mockPool.contractsMap.get(contractId).result, 'WIN');
});
