import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  computeContractOutcome,
  createSettlementCoordinator,
} from '../../scripts/lib/settlement-engine.mjs';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');

test('P1-1: computeContractOutcome usa aritmética inteira exata stake + Math.floor(stake * payoutPct / 100) para payouts 85, 80, 70 e stakes ímpares sem arredondamento a favor do cliente', () => {
  // Caso 1: stake ímpar 101 com payout 85% -> lucro 85.85 -> Math.floor = 85 -> total 186 (Math.round daria 187 a favor do cliente!)
  const out101_85 = computeContractOutcome({
    direction: 'UP',
    entryPrice: 100,
    exitPrice: 101,
    stakeMinor: 101,
    payoutPct: 85,
  });
  assert.equal(out101_85.result, 'WIN');
  assert.equal(out101_85.payoutMinor, 186, 'stake 101 @ 85% deve pagar 186 (101 + floor(85.85)), nunca 187');

  // Caso 2: stake ímpar 333 nos payouts 85%, 80% e 70%
  const out333_85 = computeContractOutcome({
    direction: 'UP',
    entryPrice: 500,
    exitPrice: 501,
    stakeMinor: 333,
    payoutPct: 85,
  });
  assert.equal(out333_85.payoutMinor, 333 + Math.floor((333 * 85) / 100)); // 333 + 283 = 616

  const out333_80 = computeContractOutcome({
    direction: 'UP',
    entryPrice: 500,
    exitPrice: 501,
    stakeMinor: 333,
    payoutPct: 80,
  });
  assert.equal(out333_80.payoutMinor, 599, 'stake 333 @ 80% deve pagar 333 + floor(266.4) = 599');

  const out333_70 = computeContractOutcome({
    direction: 'DOWN',
    entryPrice: 500,
    exitPrice: 499,
    stakeMinor: 333,
    payoutPct: 70,
  });
  assert.equal(out333_70.payoutMinor, 566, 'stake 333 @ 70% deve pagar 333 + floor(233.1) = 566');

  // Caso 3: stake ímpar 335 @ 85% -> 335 * 85 / 100 = 284.75 -> Math.round daria 285 (620), Math.floor dá 284 (619)
  const out335_85 = computeContractOutcome({
    direction: 'UP',
    entryPrice: 10,
    exitPrice: 11,
    stakeMinor: 335,
    payoutPct: 85,
  });
  assert.equal(out335_85.payoutMinor, 619, 'stake 335 @ 85% deve pagar 619 sem arredondar .75 para cima');

  // Caso 4: DRAW e LOSS respeitam a regra
  const drawOut = computeContractOutcome({
    direction: 'UP',
    entryPrice: 500,
    exitPrice: 500,
    stakeMinor: 333,
    payoutPct: 70,
  });
  assert.equal(drawOut.result, 'DRAW');
  assert.equal(drawOut.payoutMinor, 333);

  const lossOut = computeContractOutcome({
    direction: 'UP',
    entryPrice: 500,
    exitPrice: 499,
    stakeMinor: 333,
    payoutPct: 70,
  });
  assert.equal(lossOut.result, 'LOSS');
  assert.equal(lossOut.payoutMinor, 0);
});

test('P1-1 Segurança: computeContractOutcome exige payoutPct obrigatório dentro de [0, 100]', () => {
  assert.throws(
    () =>
      computeContractOutcome({
        direction: 'UP',
        entryPrice: 100,
        exitPrice: 101,
        stakeMinor: 1000,
      }),
    /INVALID_PAYOUT_PCT/,
    'Deve lançar erro quando payoutPct estiver ausente'
  );

  for (const invalidPct of [null, undefined, -1, 101, 185, NaN, Infinity, 'abc']) {
    assert.throws(
      () =>
        computeContractOutcome({
          direction: 'UP',
          entryPrice: 100,
          exitPrice: 101,
          stakeMinor: 1000,
          payoutPct: invalidPct,
        }),
      /INVALID_PAYOUT_PCT/,
      `Deve rejeitar payoutPct inválido: ${String(invalidPct)}`
    );
  }
});

test('P1-1 Snapshot & Legado: liquidação usa payout_pct gravado no contrato na abertura (não o atual do ativo) e usa 85 com log apenas para contratos antigos sem payout_pct', async () => {
  const migUpPath = path.join(REPO_ROOT, 'db/migrations/0064_contracts_payout_pct.up.sql');
  assert.equal(fs.existsSync(migUpPath), true, 'Migration 0064_contracts_payout_pct.up.sql deve existir');
  const migSql = fs.readFileSync(migUpPath, 'utf8');
  assert.match(migSql, /ADD COLUMN IF NOT EXISTS payout_pct/i);

  const nowMs = Date.now();
  // O ativo agora está com payout_pct = 90 no estado em memória, mas o contrato foi aberto com 70!
  const state = {
    symbol: 'VOL_50',
    payout_pct: 90,
    currentPrice: '510.0000',
    sequence: 10,
    lastTs: nowMs,
    paused: false,
    tickHistory: [
      {
        sequence: 10,
        price: '510.0000',
        priceNum: 510,
        event_time: nowMs - 100,
        ts: new Date(nowMs - 100).toISOString(),
      },
    ],
  };

  const contractWith70 = {
    id: 'c-snap-70',
    user_id: 'user-1',
    symbol: 'VOL_50',
    direction: 'UP',
    stake_minor: 333,
    payout_pct: 70,
    status: 'OPEN',
    entry_price: 500,
    expires_at: new Date(nowMs - 500).toISOString(),
  };

  const legacyContractWithoutPct = {
    id: 'c-legacy-null',
    user_id: 'user-1',
    symbol: 'VOL_50',
    direction: 'UP',
    stake_minor: 1000,
    // sem payout_pct -> contrato antigo!
    status: 'OPEN',
    entry_price: 500,
    expires_at: new Date(nowMs - 500).toISOString(),
  };

  const devContracts = [contractWith70, legacyContractWithoutPct];
  const devWallet = { currency: 'USD', available_minor: 10000, reserved_minor: 1333 };

  const warnings = [];
  const origWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));

  try {
    const coordinator = createSettlementCoordinator({
      assetState: new Map([['VOL_50', state]]),
      resolveSymbol: (s) => s,
      devContracts,
      devWallet,
      pgPool: null,
      blnk: null,
      wss: null,
      WebSocket: null,
    });

    const res70 = await coordinator.settleOpenContract(contractWith70, 'timer', nowMs);
    assert.equal(res70.settled, true);
    assert.equal(res70.payoutMinor, 566, 'Deve usar payout_pct=70 gravado no contrato (333 + 233 = 566), ignorando o 90 do ativo');

    const resLegacy = await coordinator.settleOpenContract(legacyContractWithoutPct, 'timer', nowMs);
    assert.equal(resLegacy.settled, true);
    assert.equal(resLegacy.payoutMinor, 1850, 'Contrato legado sem payout_pct deve usar fallback 85 (1850)');
    assert.equal(
      warnings.some((w) => w.includes('c-legacy-null') && w.includes('85')),
      true,
      'Deve emitir log warn ao liquidar contrato antigo sem payout_pct'
    );
  } finally {
    console.warn = origWarn;
  }
});
