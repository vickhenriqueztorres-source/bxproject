import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeNextAlignedSlot,
  createAlignedTickScheduler,
} from '../scripts/lib/aligned-tick-scheduler.mjs';

test('Subetapa 1.1 (Precisão de 5 ticks por vela de 5s a 1 Hz): 120 segundos alinhados sem deriva', async () => {
  const dispatchedSlots = [];
  const scheduler = createAlignedTickScheduler({
    onTickSlot: (slotSec) => {
      dispatchedSlots.push(slotSec);
    },
    intervalMs: 1000,
  });

  // Alinhado ao minuto e a 5s
  const baseSec = Math.floor(1_700_000_000 / 60) * 60;
  // Simula 120 passos de exatamente 1 segundo cada
  for (let s = 0; s < 120; s++) {
    const fakeNowMs = (baseSec + s) * 1000 + 4; // 4ms de jitter normal
    await scheduler.step(fakeNowMs);
  }

  assert.equal(dispatchedSlots.length, 120, 'Deve despachar exatamente 120 slots');
  assert.equal(scheduler.telemetry.ticksDispatchedTotal, 120);
  assert.equal(scheduler.telemetry.missedSlotsTotal, 0, 'Zero slots perdidos em execução normal');
  assert.equal(scheduler.telemetry.clockSkewCorrectionsTotal, 0);

  // Valida que cada janela de 5s (0..5, 5..10, ...) tem EXATAMENTE 5 ticks
  const fiveSecBuckets = new Map();
  for (const slot of dispatchedSlots) {
    const bucket5s = Math.floor(slot / 5) * 5;
    fiveSecBuckets.set(bucket5s, (fiveSecBuckets.get(bucket5s) || 0) + 1);
  }

  assert.equal(fiveSecBuckets.size, 24, '120s devem formar exatamente 24 velas de 5 segundos');
  for (const [bucket, count] of fiveSecBuckets.entries()) {
    assert.equal(count, 5, `A vela de 5s no bucket ${bucket} deve conter exatamente 5 ticks`);
  }

  // Valida que cada minuto (0..60, 60..120) tem EXATAMENTE 60 ticks
  const oneMinBuckets = new Map();
  for (const slot of dispatchedSlots) {
    const bucket1m = Math.floor(slot / 60) * 60;
    oneMinBuckets.set(bucket1m, (oneMinBuckets.get(bucket1m) || 0) + 1);
  }
  assert.equal(oneMinBuckets.size, 2, '120s devem formar exatamente 2 velas de 1 minuto');
  for (const [bucket, count] of oneMinBuckets.entries()) {
    assert.equal(count, 60, `A vela de 1m no bucket ${bucket} deve conter exatamente 60 ticks`);
  }
});

test('Subetapa 1.2 (Caos — Congelamento de Event Loop de 4.2s): descarta rajada falsa acumulada e conta slots perdidos', async () => {
  const dispatchedSlots = [];
  const scheduler = createAlignedTickScheduler({
    onTickSlot: (slotSec) => {
      dispatchedSlots.push(slotSec);
    },
    intervalMs: 1000,
  });

  const baseSec = 1_700_000_000;
  // Passo 0 (t0)
  await scheduler.step((baseSec + 0) * 1000);
  // Passo 1 (t0 + 1s)
  await scheduler.step((baseSec + 1) * 1000);

  // Engasgo súbito de 4.200ms: o próximo step chega em t0 + 5.2s!
  const freezeJumpMs = (baseSec + 5) * 1000 + 200;
  await scheduler.step(freezeJumpMs);

  // Passo seguinte normal (t0 + 6s)
  await scheduler.step((baseSec + 6) * 1000);

  assert.equal(dispatchedSlots.length, 4, 'Deve despachar apenas 4 ticks (sem rajada de 4 ticks acumulados)');
  assert.deepEqual(dispatchedSlots, [baseSec, baseSec + 1, baseSec + 5, baseSec + 6]);
  assert.equal(
    scheduler.telemetry.missedSlotsTotal,
    3,
    'Deve registrar exatamente 3 slots perdidos durante a pausa (segundos 2, 3 e 4)'
  );
});

test('Subetapa 1.3 (Segurança / Caos — Clock Skew / NTP Rollback): garante avanço estritamente monotônico sem voltar no tempo', async () => {
  const dispatchedSlots = [];
  const scheduler = createAlignedTickScheduler({
    onTickSlot: (slotSec) => {
      dispatchedSlots.push(slotSec);
    },
    intervalMs: 1000,
  });

  const baseSec = 1_700_000_010;
  await scheduler.step(baseSec * 1000);
  await scheduler.step((baseSec + 1) * 1000);

  // NTP ajusta o relógio da máquina 3 segundos para trás!
  const rolledBackMs = (baseSec - 2) * 1000;
  await scheduler.step(rolledBackMs);

  assert.equal(dispatchedSlots.length, 3);
  assert.deepEqual(
    dispatchedSlots,
    [baseSec, baseSec + 1, baseSec + 2],
    'Slot nunca pode retroceder no tempo; deve ser estritamente monotônico t_n > t_{n-1}'
  );
  assert.equal(scheduler.telemetry.clockSkewCorrectionsTotal, 1);
});

test('Subetapa 1.4 (Cálculo Algébrico de Delay e Jitter): próximo disparo alinhado ao segundo (:00.000)', () => {
  // Teste em t = 1700000000234ms (234ms após a fronteira)
  const slot = computeNextAlignedSlot(1_700_000_000_234, 1_700_000_000 - 1);
  assert.equal(slot.effectiveSlotSec, 1_700_000_000);
  assert.equal(slot.jitterMs, 234);
  assert.equal(slot.delayToNextMs, 766, '1000ms - 234ms = 766ms até o próximo segundo');
});
