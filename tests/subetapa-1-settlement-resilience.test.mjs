import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordTickInHistory,
  resolveExitPriceAtExpiry,
  computeContractOutcome,
  createSettlementCoordinator,
  TICK_HISTORY_MAX_SIZE,
} from '../scripts/lib/settlement-engine.mjs';

test('[Subetapa 1 | M-03 & V-07] Captura exata do primeiro tick com event_time >= expires_at mesmo sob atraso de 3s do event loop', async () => {
  const baseTime = 1_760_000_000_000;
  const state = {
    symbol: 'VOL_50',
    currentPrice: '495.0000', // Preço atual 3s depois (seria LOSS se usasse currentPrice!)
    sequence: 10,
    lastTs: baseTime + 3000,
    paused: false,
    tickHistory: [],
  };

  // Ticks registrados antes, no exato vencimento e depois
  recordTickInHistory(state, { sequence: 7, price: '499.8000', event_time: baseTime - 1000, ts: new Date(baseTime - 1000).toISOString() });
  recordTickInHistory(state, { sequence: 8, price: '501.2500', event_time: baseTime, ts: new Date(baseTime).toISOString() }); // <-- Exato tick >= expires_at (WIN!)
  recordTickInHistory(state, { sequence: 9, price: '497.1000', event_time: baseTime + 1000, ts: new Date(baseTime + 1000).toISOString() });
  recordTickInHistory(state, { sequence: 10, price: '495.0000', event_time: baseTime + 3000, ts: new Date(baseTime + 3000).toISOString() });

  const resolved = resolveExitPriceAtExpiry(state, baseTime, 500.0);
  assert.equal(resolved.exitPrice, 501.25);
  assert.equal(resolved.tickSequence, 8);
  assert.equal(resolved.tickEventTime, baseTime);
  assert.equal(resolved.source, 'tick_history_exact');

  // Verifica que na liquidação completa com atraso de 3s no timer o contrato dá WIN (501.25 > 500.00)
  const assetState = new Map([['VOL_50', state]]);
  const devContracts = [
    {
      id: 'contract-lag-1',
      user_id: 'user-1',
      symbol: 'SYNTH_VOL_50',
      direction: 'UP',
      stake_minor: 10000,
      status: 'OPEN',
      entry_price: 500.0,
      expires_at: new Date(baseTime).toISOString(),
    },
  ];
  const devWallet = { currency: 'USD', available_minor: 90000, reserved_minor: 10000 };

  const coordinator = createSettlementCoordinator({
    assetState,
    resolveSymbol: (s) => s.replace(/^SYNTH_/, ''),
    devContracts,
    devWallet,
    pgPool: null,
    blnk: null,
    wss: null,
    WebSocket: null,
  });

  // Roda 3 segundos atrasado (baseTime + 3000)
  const res = await coordinator.settleOpenContract(devContracts[0], 'timer', baseTime + 3000);
  assert.equal(res.settled, true);
  assert.equal(res.result, 'WIN');
  assert.equal(res.exitPrice, 501.25);
  assert.equal(res.payoutMinor, 18500);
  assert.equal(devWallet.available_minor, 108500);
  assert.equal(devWallet.reserved_minor, 0);
});

test('[Subetapa 1 | Segurança I-03 & I-04] Anti-duplo pagamento sob condição de corrida extrema (25 disparos concorrentes)', async () => {
  const nowMs = Date.now();
  const state = {
    symbol: 'VOL_50',
    currentPrice: '510.0000',
    sequence: 5,
    lastTs: nowMs,
    paused: false,
    tickHistory: [{ sequence: 5, price: '510.0000', priceNum: 510.0, event_time: nowMs - 100, ts: new Date(nowMs - 100).toISOString() }],
  };

  const contract = {
    id: 'contract-race-999',
    user_id: 'user-auth-1',
    symbol: 'VOL_50',
    direction: 'UP',
    stake_minor: 10000, // $100.00
    status: 'OPEN',
    entry_price: 500.0,
    expires_at: new Date(nowMs - 500).toISOString(),
    _persistedInDb: true,
  };

  const devContracts = [contract];
  const devWallet = { currency: 'USD', available_minor: 90000, reserved_minor: 10000 };

  let dbContractUpdates = 0;
  let dbUserBalanceCredits = 0;
  let blnkSettlementCalls = 0;
  let userDbBalance = 90000;

  const mockPgPool = {
    query: async (sql, params) => {
      if (sql.includes('UPDATE contracts')) {
        if (dbContractUpdates === 0) {
          dbContractUpdates += 1;
          return { rowCount: 1, rows: [{ id: params[3], user_id: 'user-auth-1' }] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('UPDATE users')) {
        dbUserBalanceCredits += 1;
        userDbBalance += Number(params[0]);
        return { rowCount: 1, rows: [{ demo_balance_minor: userDbBalance }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const mockBlnk = {
    settleContract: async () => {
      blnkSettlementCalls += 1;
    },
    getBalance: async () => ({ available_minor: userDbBalance, reserved_minor: 0 }),
  };

  const coordinator = createSettlementCoordinator({
    assetState: new Map([['VOL_50', state]]),
    resolveSymbol: (s) => s,
    devContracts,
    devWallet,
    pgPool: mockPgPool,
    blnk: mockBlnk,
    wss: null,
    WebSocket: null,
  });

  // Dispara 25 chamadas simultâneas (timer + sweeper + retries concorrentes)
  const parallelPromises = Array.from({ length: 25 }, (_, idx) =>
    coordinator.settleOpenContract(contract, idx % 2 === 0 ? 'timer' : 'sweeper', nowMs)
  );
  const results = await Promise.all(parallelPromises);

  const settledOnes = results.filter((r) => r.settled);
  assert.equal(settledOnes.length, 1, 'Exatamente 1 chamada deve liquidar o contrato');
  assert.equal(dbContractUpdates, 1, 'Banco deve atualizar o contrato exatamente 1 vez');
  assert.equal(dbUserBalanceCredits, 1, 'Saldo no Postgres deve ser creditado exatamente 1 vez');
  assert.equal(blnkSettlementCalls, 1, 'Blnk Ledger deve ser chamado exatamente 1 vez');
  assert.equal(userDbBalance, 108500, 'Saldo final deve ser 90000 + 18500 = 108500 sem duplicação');
  assert.equal(coordinator.telemetry.duplicateSettlementPreventedTotal, 24);
});

test('[Subetapa 1 | Caos C-01 & V-08] Recuperação automática pós-restart do processo (contratos OPEN órfãos no PostgreSQL sem setTimeout)', async () => {
  const nowMs = Date.now();
  const state = {
    symbol: 'EURUSD_OTC',
    currentPrice: '1.09000',
    sequence: 20,
    lastTs: nowMs,
    paused: false,
    tickHistory: [{ sequence: 20, price: '1.09000', priceNum: 1.09, event_time: nowMs - 200, ts: new Date(nowMs - 200).toISOString() }],
  };

  // Simula memória RAM zerada após crash/restart do processo Node (devContracts = [])
  const devContracts = [];
  const devWallet = { currency: 'USD', available_minor: 50000, reserved_minor: 0 };

  // Contratos que ficaram presos como 'OPEN' no PostgreSQL durante o restart
  const dbOrphanContracts = new Map([
    [
      'orphan-win-1',
      {
        id: 'orphan-win-1',
        user_id: 'user-crash-1',
        symbol: 'EURUSD_OTC',
        direction: 'UP',
        status: 'OPEN',
        stake_minor: 5000,
        entry_price: 1.085,
        expires_at: new Date(nowMs - 10_000).toISOString(),
        created_at: new Date(nowMs - 70_000).toISOString(),
      },
    ],
    [
      'orphan-loss-2',
      {
        id: 'orphan-loss-2',
        user_id: 'user-crash-1',
        symbol: 'EURUSD_OTC',
        direction: 'DOWN',
        status: 'OPEN',
        stake_minor: 5000,
        entry_price: 1.085,
        expires_at: new Date(nowMs - 8_000).toISOString(),
        created_at: new Date(nowMs - 68_000).toISOString(),
      },
    ],
  ]);

  let userBalanceMinor = 40000;
  const mockPgPool = {
    query: async (sql, params) => {
      if (sql.includes("FROM contracts") && sql.includes("WHERE status = 'OPEN'")) {
        const openRows = Array.from(dbOrphanContracts.values()).filter((r) => r.status === 'OPEN');
        return { rowCount: openRows.length, rows: openRows };
      }
      if (sql.includes('UPDATE contracts')) {
        const id = params[3];
        const row = dbOrphanContracts.get(id);
        if (row && row.status === 'OPEN') {
          row.status = 'SETTLED';
          row.result = params[0];
          row.payout_minor = params[1];
          row.exit_price = params[2];
          return { rowCount: 1, rows: [row] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('UPDATE users')) {
        userBalanceMinor += Number(params[0]);
        return { rowCount: 1, rows: [{ demo_balance_minor: userBalanceMinor }] };
      }
      if (sql.includes('SELECT demo_balance_minor FROM users')) {
        return { rowCount: 1, rows: [{ demo_balance_minor: userBalanceMinor }] };
      }
      return { rowCount: 0, rows: [] };
    },
  };

  const coordinator = createSettlementCoordinator({
    assetState: new Map([['EURUSD_OTC', state]]),
    resolveSymbol: (s) => s,
    devContracts,
    devWallet,
    pgPool: mockPgPool,
    blnk: null,
    wss: null,
    WebSocket: null,
  });

  // Executa 1 ciclo do Sweeper (como acontece 500ms após o servidor subir)
  const sweepRes = await coordinator.runSweepCycle(nowMs);
  assert.equal(sweepRes.skipped, false);
  assert.equal(sweepRes.settledCount, 2, 'Ambos os contratos órfãos devem ser recuperados e liquidados');
  assert.equal(coordinator.telemetry.contractsRecoveredFromDbTotal, 2);

  assert.equal(dbOrphanContracts.get('orphan-win-1').status, 'SETTLED');
  assert.equal(dbOrphanContracts.get('orphan-win-1').result, 'WIN');
  assert.equal(dbOrphanContracts.get('orphan-win-1').payout_minor, 9250);

  assert.equal(dbOrphanContracts.get('orphan-loss-2').status, 'SETTLED');
  assert.equal(dbOrphanContracts.get('orphan-loss-2').result, 'LOSS');
  assert.equal(dbOrphanContracts.get('orphan-loss-2').payout_minor, 0);

  assert.equal(userBalanceMinor, 49250);
});

test('[Subetapa 1 | Segurança BOLA WebSocket] Isolamento de eventos privados entre usuários diferentes no broadcast de liquidação', async () => {
  const nowMs = Date.now();
  const state = {
    symbol: 'VOL_100',
    currentPrice: '1010.0000',
    sequence: 3,
    lastTs: nowMs,
    paused: false,
    tickHistory: [{ sequence: 3, price: '1010.0000', priceNum: 1010, event_time: nowMs, ts: new Date(nowMs).toISOString() }],
  };

  const messagesUserA = [];
  const messagesUserB = [];
  const mockWss = {
    clients: new Set([
      {
        readyState: 1,
        authenticatedUserId: 'user-A',
        send: (msg) => messagesUserA.push(JSON.parse(msg)),
      },
      {
        readyState: 1,
        authenticatedUserId: 'user-B',
        send: (msg) => messagesUserB.push(JSON.parse(msg)),
      },
    ]),
  };

  const contractUserA = {
    id: 'contract-user-a',
    user_id: 'user-A',
    symbol: 'VOL_100',
    direction: 'UP',
    stake_minor: 2000,
    status: 'OPEN',
    entry_price: 1000.0,
    expires_at: new Date(nowMs - 10).toISOString(),
  };

  const coordinator = createSettlementCoordinator({
    assetState: new Map([['VOL_100', state]]),
    resolveSymbol: (s) => s,
    devContracts: [contractUserA],
    devWallet: { currency: 'USD', available_minor: 100000, reserved_minor: 2000 },
    pgPool: null,
    blnk: null,
    wss: mockWss,
    WebSocket: { OPEN: 1 },
  });

  await coordinator.settleOpenContract(contractUserA, 'timer', nowMs);

  assert.equal(messagesUserA.length, 2, 'User A deve receber wallet_balance e contract_settled');
  assert.equal(messagesUserB.length, 0, 'User B NÃO pode receber eventos privados de carteira/contrato do User A');
});

test('[Subetapa 1 | Estresse Q-04] Liquidação simultânea de 500 contratos no mesmo segundo em < 250ms com buffer circular limitado', async () => {
  const nowMs = Date.now();
  const state = {
    symbol: 'BTCUSD_OTC',
    currentPrice: '65100.00',
    sequence: 1,
    lastTs: nowMs,
    paused: false,
    tickHistory: [],
  };

  // Testa limite do buffer circular (inserindo 1200 ticks, deve reter exatamente TICK_HISTORY_MAX_SIZE = 900)
  for (let i = 1; i <= 1200; i++) {
    recordTickInHistory(state, {
      sequence: i,
      price: (64000 + i).toFixed(2),
      event_time: nowMs - (1200 - i) * 1000,
      ts: new Date(nowMs - (1200 - i) * 1000).toISOString(),
    });
  }
  assert.equal(state.tickHistory.length, TICK_HISTORY_MAX_SIZE);

  // Cria 500 contratos abertos expirando agora
  const devContracts = Array.from({ length: 500 }, (_, i) => ({
    id: `stress-contract-${i}`,
    user_id: `user-${i % 50}`,
    symbol: 'BTCUSD_OTC',
    direction: i % 2 === 0 ? 'UP' : 'DOWN',
    stake_minor: 1000,
    status: 'OPEN',
    entry_price: 65000.0,
    expires_at: new Date(nowMs - 500).toISOString(),
  }));

  const devWallet = { currency: 'USD', available_minor: 1_000_000, reserved_minor: 500_000 };
  const coordinator = createSettlementCoordinator({
    assetState: new Map([['BTCUSD_OTC', state]]),
    resolveSymbol: (s) => s,
    devContracts,
    devWallet,
    pgPool: null,
    blnk: null,
    wss: null,
    WebSocket: null,
  });

  const t0 = performance.now();
  const sweepResult = await coordinator.runSweepCycle(nowMs);
  const elapsedMs = performance.now() - t0;

  assert.equal(sweepResult.settledCount, 500, 'Todos os 500 contratos devem ser liquidados em um único ciclo');
  assert.ok(elapsedMs < 250, `Liquidação de 500 contratos deve levar < 250ms (levou ${elapsedMs.toFixed(2)}ms)`);
  assert.equal(coordinator.settlingContractIds.size, 0, 'Nenhum lock órfão em settlingContractIds');
  assert.equal(devContracts.every((c) => c.status === 'SETTLED'), true);
});
