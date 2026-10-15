/**
 * Agendador Alinhado ao Segundo Exato (1 Hz sem Deriva) com Anti-Clock-Skew e Pulo Determinístico de Slots
 * 
 * Skills aplicadas:
 * - 03-synthetic-market-engine (M-02, M-05: 1 tick/s alinhado ao Unix epoch)
 * - 05-resilience-patterns (Anti-Drift, imunidade a Clock Skew e descarte de rajadas falsas sob engasgo)
 */

export function computeNextAlignedSlot(nowMs, lastSlotSec = null, intervalMs = 1000) {
  if (!Number.isFinite(nowMs) || nowMs <= 0) {
    nowMs = Date.now();
  }
  const rawSlotSec = Math.floor(nowMs / intervalMs);
  let effectiveSlotSec = rawSlotSec;
  let isClockSkew = false;
  let missedSlots = 0;

  if (lastSlotSec !== null && Number.isFinite(lastSlotSec)) {
    if (rawSlotSec <= lastSlotSec) {
      // Clock skew / NTP retrocesso: garante avanço estritamente monotônico
      effectiveSlotSec = lastSlotSec + 1;
      isClockSkew = true;
    } else if (rawSlotSec > lastSlotSec + 1) {
      // Engasgo do event loop / GC pause: detecta slots perdidos sem disparar rajada acumulada
      missedSlots = rawSlotSec - lastSlotSec - 1;
      effectiveSlotSec = rawSlotSec;
    }
  }

  const expectedSlotBoundaryMs = effectiveSlotSec * intervalMs;
  const jitterMs = Math.max(0, nowMs - expectedSlotBoundaryMs);
  
  // Próximo disparo alinhado ao início do próximo segundo (ex: se nowMs termina em .234, delay = 766ms)
  const remainderMs = nowMs % intervalMs;
  const delayToNextMs = Math.max(5, intervalMs - remainderMs);

  return {
    rawSlotSec,
    effectiveSlotSec,
    slotBoundaryMs: expectedSlotBoundaryMs,
    jitterMs,
    delayToNextMs,
    isClockSkew,
    missedSlots,
  };
}

export function createAlignedTickScheduler({
  onTickSlot,
  intervalMs = 1000,
  onError = (err) => console.error('[AlignedTickScheduler Error]', err),
} = {}) {
  let timerId = null;
  let isRunning = false;
  let lastSlotSec = null;

  const telemetry = {
    ticksDispatchedTotal: 0,
    missedSlotsTotal: 0,
    clockSkewCorrectionsTotal: 0,
    lastSlotJitterMs: 0,
    maxSlotJitterMs: 0,
    lastSlotSec: null,
  };

  async function step(nowMs = Date.now()) {
    const slotInfo = computeNextAlignedSlot(nowMs, lastSlotSec, intervalMs);

    lastSlotSec = slotInfo.effectiveSlotSec;
    telemetry.lastSlotSec = lastSlotSec;
    telemetry.ticksDispatchedTotal += 1;
    telemetry.lastSlotJitterMs = slotInfo.jitterMs;
    if (slotInfo.jitterMs > telemetry.maxSlotJitterMs) {
      telemetry.maxSlotJitterMs = slotInfo.jitterMs;
    }
    if (slotInfo.missedSlots > 0) {
      telemetry.missedSlotsTotal += slotInfo.missedSlots;
    }
    if (slotInfo.isClockSkew) {
      telemetry.clockSkewCorrectionsTotal += 1;
    }

    if (typeof onTickSlot === 'function') {
      try {
        await onTickSlot(slotInfo.effectiveSlotSec, slotInfo);
      } catch (err) {
        onError(err);
      }
    }

    return slotInfo;
  }

  function scheduleNext() {
    if (!isRunning) return;
    const now = Date.now();
    const remainder = now % intervalMs;
    // Agenda para o próximo segundo exato com folga mínima defensiva de 2ms
    const delay = Math.max(2, intervalMs - remainder);

    timerId = setTimeout(async () => {
      if (!isRunning) return;
      try {
        await step(Date.now());
      } catch (err) {
        onError(err);
      } finally {
        if (isRunning) {
          scheduleNext();
        }
      }
    }, delay);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    scheduleNext();
  }

  function stop() {
    isRunning = false;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return {
    start,
    stop,
    step,
    get isRunning() {
      return isRunning;
    },
    get telemetry() {
      return telemetry;
    },
    getLastSlotSec() {
      return lastSlotSec;
    },
    reset(newLastSlotSec = null) {
      lastSlotSec = newLastSlotSec;
      telemetry.lastSlotSec = newLastSlotSec;
    },
  };
}
