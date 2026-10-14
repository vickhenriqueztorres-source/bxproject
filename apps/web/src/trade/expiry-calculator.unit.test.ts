import { describe, it, expect } from 'vitest';
import {
  calculateExpirySlots,
  calculateExecutionExpiry,
  formatSecondsToMmSs,
  formatTimeHhMm,
} from './expiry-calculator';

describe('[PLANO 2 - GATE 2] ExpiryCalculator & Blindagem dos 60 Segundos', () => {
  it('formata segundos em MM:SS corretamente', () => {
    expect(formatSecondsToMmSs(83)).toBe('01:23');
    expect(formatSecondsToMmSs(60)).toBe('01:00');
    expect(formatSecondsToMmSs(5)).toBe('00:05');
    expect(formatSecondsToMmSs(0)).toBe('00:00');
  });

  describe('calculateExecutionExpiry (Piso Inviolável de 60s e Modos de Execução)', () => {
    it('Modo 1M_FIXED: sempre retorna exatamente 60 segundos (60_000ms)', () => {
      const now = 1700000000000;
      const res = calculateExecutionExpiry('1M_FIXED', now);
      expect(res.durationMs).toBe(60_000);
      expect(res.targetEpochMs).toBe(now + 60_000);
    });

    it('Modo CANDLE_1M: quando restam 45s (<60s), avança para a próxima vela (+1m = 105s)', () => {
      // 19:03:15 -> faltam 45s para 19:04:00. Como o mínimo é 60s, vai para 19:05:00 (+105s)
      const now = new Date('2026-10-07T19:03:15.000Z').getTime();
      const res = calculateExecutionExpiry('CANDLE_1M', now);
      expect(res.durationMs).toBe(105_000);
      expect(res.durationMs).toBeGreaterThanOrEqual(60_000);
    });

    it('Modo CANDLE_1M: quando restam 15s (<60s), avança para a próxima vela (+1m = 75s)', () => {
      // 19:03:45 -> faltam 15s para 19:04:00. Deve ir para 19:05:00 (+75s)
      const now = new Date('2026-10-07T19:03:45.000Z').getTime();
      const res = calculateExecutionExpiry('CANDLE_1M', now);
      expect(res.durationMs).toBe(75_000);
      expect(res.durationMs).toBeGreaterThanOrEqual(60_000);
    });

    it('Modo CANDLE_5M: quando restam 20s (<60s), avança para o próximo bloco de 5m', () => {
      // 19:04:40 -> faltam 20s para 19:05:00. Deve ir para 19:10:00 (5m20s = 320s)
      const now = new Date('2026-10-07T19:04:40.000Z').getTime();
      const res = calculateExecutionExpiry('CANDLE_5M', now);
      expect(res.durationMs).toBe(320_000);
      expect(res.durationMs).toBeGreaterThanOrEqual(60_000);
    });

    it('[PISO INVIOLÁVEL DE SEGURANÇA] durationMs NUNCA é inferior a 60.000ms sob qualquer segundo do dia', () => {
      const baseNow = new Date('2026-10-07T12:00:00.000Z').getTime();
      // Testar todos os 60 segundos de um minuto
      for (let sec = 0; sec < 60; sec++) {
        const testNow = baseNow + sec * 1000;
        const res1m = calculateExecutionExpiry('CANDLE_1M', testNow);
        const res5m = calculateExecutionExpiry('CANDLE_5M', testNow);
        const resTurbo = calculateExecutionExpiry('1M_FIXED', testNow);

        expect(res1m.durationMs).toBeGreaterThanOrEqual(60_000);
        expect(res5m.durationMs).toBeGreaterThanOrEqual(60_000);
        expect(resTurbo.durationMs).toBeGreaterThanOrEqual(60_000);
      }
    });
  });

  describe('calculateExpirySlots (Interface e Slots)', () => {
    it('gera os 3 slots obrigatórios: 1M_FIXED, CANDLE_1M, CANDLE_5M com piso >= 60s', () => {
      const slots = calculateExpirySlots(new Date('2026-10-07T19:03:37.000Z'), 0);
      expect(slots.length).toBe(3);
      expect(slots.some((s) => s.mode === '1M_FIXED')).toBe(true);
      expect(slots.some((s) => s.mode === 'CANDLE_1M')).toBe(true);
      expect(slots.some((s) => s.mode === 'CANDLE_5M')).toBe(true);
      for (const s of slots) {
        expect(s.remainingSeconds).toBeGreaterThanOrEqual(60);
        expect(s.durationSeconds).toBeGreaterThanOrEqual(60);
      }
    });
  });
});
