import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  recordTickInHistory,
  createSettlementCoordinator,
  serializeContract,
} from '../../scripts/lib/settlement-engine.mjs';

describe('Relatório #12 — strike_price, serializeContract, entry_tick_sequence & exit_tick_sequence', () => {
  it('1. Invariante de Contrato de API: strike_price === entry_price SEMPRE (em OPEN e em SETTLED) e exit_price === null enquanto OPEN', () => {
    const openRow = {
      id: '11111111-2222-4333-8444-555555555555',
      user_id: 'user-1',
      symbol: 'R_100',
      direction: 'UP',
      status: 'OPEN',
      result: null,
      stake_minor: '2500',
      payout_minor: null,
      entry_price: '500.2500',
      exit_price: null,
      entry_tick_sequence: '1042',
      exit_tick_sequence: null,
      opened_at: new Date('2026-10-15T19:00:00.000Z'),
      expires_at: new Date('2026-10-15T19:01:00.000Z'),
      created_at: new Date('2026-10-15T19:00:00.000Z'),
      settled_at: null,
      idempotency_key: 'idem-open-1',
    };

    const serializedOpen = serializeContract(openRow);
    assert.equal(serializedOpen.status, 'OPEN');
    assert.equal(serializedOpen.entry_price, 500.25);
    assert.equal(serializedOpen.strike_price, 500.25, 'Em OPEN, strike_price deve ser igual a entry_price');
    assert.equal(serializedOpen.exit_price, null, 'Em OPEN, exit_price deve ser estritamente null');
    assert.equal(serializedOpen.entry_tick_sequence, 1042);
    assert.equal(serializedOpen.exit_tick_sequence, null);

    const settledRow = {
      ...openRow,
      status: 'SETTLED',
      result: 'WIN',
      payout_minor: '4625',
      exit_price: '503.7500',
      exit_tick_sequence: '1102',
      settled_at: new Date('2026-10-15T19:01:00.200Z'),
    };

    const serializedSettled = serializeContract(settledRow);
    assert.equal(serializedSettled.status, 'SETTLED');
    assert.equal(serializedSettled.entry_price, 500.25);
    assert.equal(
      serializedSettled.strike_price,
      500.25,
      'Em SETTLED, strike_price NUNCA pode ser sobrescrito por exit_price (deve continuar 500.25)'
    );
    assert.equal(serializedSettled.exit_price, 503.75, 'Em SETTLED, exit_price deve conter o preço de saída (503.75)');
    assert.equal(serializedSettled.entry_tick_sequence, 1042);
    assert.equal(serializedSettled.exit_tick_sequence, 1102);
  });

  it('2. Consistência entre GET /contracts e resposta de Idempotência pós-liquidação (Item 4.2)', () => {
    // Simula um contrato já liquidado no banco sendo lido tanto por GET /contracts quanto por retry de POST /contracts (idempotência)
    const dbSettledRow = {
      id: '22222222-3333-4444-8555-666666666666',
      user_id: 'user-2',
      symbol: 'R_50',
      direction: 'DOWN',
      status: 'SETTLED',
      result: 'WIN',
      stake_minor: 1000,
      payout_minor: 1850,
      entry_price: '250.50',
      exit_price: '248.10',
      entry_tick_sequence: 500,
      exit_tick_sequence: 560,
      opened_at: '2026-10-15T19:00:00.000Z',
      expires_at: '2026-10-15T19:01:00.000Z',
      created_at: '2026-10-15T19:00:00.000Z',
      settled_at: '2026-10-15T19:01:00.100Z',
      idempotency_key: 'idem-consistent-2',
    };

    const fromGetList = serializeContract(dbSettledRow);
    const fromPostIdempotency = serializeContract(dbSettledRow);

    assert.deepEqual(
      fromGetList,
      fromPostIdempotency,
      'GET /contracts e POST /contracts (idempotente) devem devolver exatamente o mesmo objeto'
    );
    assert.equal(fromGetList.entry_price, 250.5);
    assert.equal(fromGetList.strike_price, 250.5);
    assert.equal(fromGetList.exit_price, 248.1);
  });

  it('3. Liquidação e Auditoria de Ticks (50 contratos): exit_price === tick[exit_tick_sequence] e strike_price permanece entry_price', async () => {
    const state = {
      symbol: 'R_100',
      currentPrice: '500.00',
      sequence: 1,
      lastTs: 1700000000000,
      paused: false,
      tickHistory: [],
    };
    const assetState = new Map([['R_100', state]]);
    const devContracts = [];
    const devWallet = { currency: 'USD', available_minor: 100000, reserved_minor: 50000 };
    const wsMessages = [];
    const mockWss = {
      clients: new Set([
        {
          readyState: 1,
          send: (msg) => wsMessages.push(JSON.parse(msg)),
        },
      ]),
    };

    // Gera 300 segundos de ticks oficiais
    const baseTimeMs = 1700000000000;
    const tickBySeq = new Map();
    for (let s = 0; s < 300; s++) {
      const seq = s + 1;
      const priceNum = Number((500 + Math.sin(s / 5) * 3.5).toFixed(2));
      const tick = {
        sequence: seq,
        price: priceNum.toFixed(2),
        event_time: baseTimeMs + s * 1000,
        ts: new Date(baseTimeMs + s * 1000).toISOString(),
      };
      recordTickInHistory(state, tick);
      tickBySeq.set(seq, priceNum);
    }

    const coordinator = createSettlementCoordinator({
      assetState,
      resolveSymbol: (sym) => sym,
      devContracts,
      devWallet,
      pgPool: null,
      blnk: null,
      wss: mockWss,
      WebSocket: { OPEN: 1 },
    });

    for (let i = 0; i < 50; i++) {
      const openSeq = i * 4 + 1;
      const expirySecOffset = openSeq + 60;
      const entryPrice = tickBySeq.get(openSeq);
      const expiresAtMs = baseTimeMs + expirySecOffset * 1000;

      const contract = {
        id: `audit-contract-${i}`,
        user_id: 'guest-demo',
        symbol: 'R_100',
        direction: i % 2 === 0 ? 'UP' : 'DOWN',
        stake_minor: 1000,
        status: 'OPEN',
        result: null,
        payout_minor: null,
        entry_price: entryPrice,
        strike_price: entryPrice,
        entry_tick_sequence: openSeq,
        exit_price: null,
        exit_tick_sequence: null,
        expires_at: new Date(expiresAtMs).toISOString(),
        created_at: new Date(baseTimeMs + openSeq * 1000).toISOString(),
      };
      devContracts.push(contract);

      const res = await coordinator.settleOpenContract(contract, 'timer', expiresAtMs + 50);
      assert.equal(res.settled, true);

      // 1. Verifica que strike_price NÃO mudou para exit_price
      assert.equal(
        contract.strike_price,
        entryPrice,
        `Contrato #${i}: strike_price (${contract.strike_price}) deve permanecer igual a entry_price (${entryPrice})`
      );
      assert.notEqual(
        contract.exit_price,
        null,
        `Contrato #${i}: exit_price deve estar preenchido após liquidação`
      );

      // 2. Auditoria: exit_price é exatamente o preço do tick exit_tick_sequence gravado
      assert.ok(Number.isFinite(contract.exit_tick_sequence));
      const officialExitTickPrice = tickBySeq.get(contract.exit_tick_sequence);
      assert.equal(
        contract.exit_price,
        officialExitTickPrice,
        `Contrato #${i}: exit_price deve bater exatamente com o tick de sequência ${contract.exit_tick_sequence}`
      );

      // 3. Auditoria: entry_price é exatamente o preço do tick entry_tick_sequence gravado
      const officialEntryTickPrice = tickBySeq.get(contract.entry_tick_sequence);
      assert.equal(contract.entry_price, officialEntryTickPrice);
    }

    const settledWsEvents = wsMessages.filter((m) => m.type === 'contract_settled');
    assert.equal(settledWsEvents.length, 50);
    for (const evt of settledWsEvents) {
      assert.equal(evt.strike_price, evt.entry_price);
      assert.ok(Number.isFinite(evt.exit_price));
      assert.ok(Number.isFinite(evt.entry_tick_sequence));
      assert.ok(Number.isFinite(evt.exit_tick_sequence));
    }
  });

  it('4. Caos — 20 disparos concorrentes de liquidação para o mesmo contrato + Estresse de 10.000 serializações', async () => {
    const state = {
      symbol: 'R_100',
      currentPrice: '510.00',
      sequence: 10,
      lastTs: 1700000010000,
      paused: false,
      tickHistory: [
        {
          sequence: 10,
          price: '510.00',
          priceNum: 510.0,
          event_time: 1700000010000,
          ts: new Date(1700000010000).toISOString(),
        },
      ],
    };
    const devContracts = [];
    const devWallet = { currency: 'USD', available_minor: 10000, reserved_minor: 1000 };
    const coordinator = createSettlementCoordinator({
      assetState: new Map([['R_100', state]]),
      resolveSymbol: (s) => s,
      devContracts,
      devWallet,
    });

    const targetContract = {
      id: 'chaos-concurrent-1',
      user_id: 'guest-demo',
      symbol: 'R_100',
      direction: 'UP',
      stake_minor: 1000,
      status: 'OPEN',
      entry_price: 500.0,
      strike_price: 500.0,
      entry_tick_sequence: 1,
      exit_price: null,
      exit_tick_sequence: null,
      expires_at: new Date(1700000005000).toISOString(),
      created_at: new Date(1700000000000).toISOString(),
    };
    devContracts.push(targetContract);

    const attempts = await Promise.all(
      Array.from({ length: 20 }, () =>
        coordinator.settleOpenContract(targetContract, 'timer', 1700000010000)
      )
    );

    const settledCount = attempts.filter((a) => a.settled).length;
    assert.equal(settledCount, 1, 'Exatamente 1 tentativa concorrente pode liquidar o contrato');
    assert.equal(coordinator.telemetry.duplicateSettlementPreventedTotal, 19);
    assert.equal(targetContract.strike_price, 500.0, 'strike_price permanece 500.0');
    assert.equal(targetContract.exit_price, 510.0, 'exit_price vale 510.0');
    assert.equal(devWallet.available_minor, 11850, 'Payout creditado exatamente 1 vez');

    // Estresse: 10.000 serializações em < 200ms
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) {
      const s = serializeContract(targetContract);
      if (s.strike_price !== s.entry_price || s.exit_price !== 510.0) {
        assert.fail('Violação de invariante sob estresse');
      }
    }
    const elapsedMs = performance.now() - t0;
    assert.ok(elapsedMs < 250, `10.000 serializações devem rodar em < 250ms (levou ${elapsedMs.toFixed(1)}ms)`);
  });

  it('5. Migração SQL 0063 e Segurança contra Mass Assignment verificadas estaticamente', () => {
    const upSqlPath = path.resolve('db/migrations/0063_contracts_entry_tick_sequence.up.sql');
    const downSqlPath = path.resolve('db/migrations/0063_contracts_entry_tick_sequence.down.sql');
    assert.ok(fs.existsSync(upSqlPath), 'Migration 0063 .up.sql deve existir');
    assert.ok(fs.existsSync(downSqlPath), 'Migration 0063 .down.sql deve existir');

    const upSql = fs.readFileSync(upSqlPath, 'utf8');
    assert.match(upSql, /ADD COLUMN IF NOT EXISTS entry_tick_sequence BIGINT/i);

    const feedCode = fs.readFileSync(path.resolve('scripts/dev-live-feed.mjs'), 'utf8');
    // Verifica que FORBIDDEN_CONTRACT_FIELDS bloqueia strike_price, entry_price, exit_price, entry_tick_sequence e exit_tick_sequence
    for (const field of ['strike_price', 'entry_price', 'exit_price', 'entry_tick_sequence', 'exit_tick_sequence']) {
      assert.ok(feedCode.includes(`'${field}'`), `FORBIDDEN_CONTRACT_FIELDS deve bloquear ${field}`);
    }
    // Verifica que não resta nenhum row.exit_price !== null ? Number(row.exit_price) : Number(row.entry_price) em dev-live-feed.mjs
    assert.equal(
      feedCode.includes('strike_price: row.exit_price !== null'),
      false,
      'Nenhuma rota do servidor pode atribuir exit_price a strike_price'
    );
  });
});
