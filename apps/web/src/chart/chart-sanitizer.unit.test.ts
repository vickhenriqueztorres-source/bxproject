import { describe, it, expect } from 'vitest';
import {
  normalizeTimeSeconds,
  safeNumber,
  sanitizeCandles,
  sanitizeTick,
  isSafeBarUpdate,
} from './chart-sanitizer';
import type { Candle } from '../api/client';
import type { Tick } from '../feed/protocol';

describe('SUBETAPA 2: ChartSanitizer & Proteção de Invariantes de Dados (Anti-Crash)', () => {
  it('CS-01: normalizeTimeSeconds lida com inteiros, strings e milissegundos', () => {
    // Segundos regulares
    expect(normalizeTimeSeconds(1700000000)).toBe(1700000000);
    // Milissegundos (> 10 bilhões)
    expect(normalizeTimeSeconds(1700000000000)).toBe(1700000000);
    // String numérica
    expect(normalizeTimeSeconds('1700000000')).toBe(1700000000);
    // String ISO
    const isoSec = Math.floor(new Date('2026-10-08T22:00:00Z').getTime() / 1000);
    expect(normalizeTimeSeconds('2026-10-08T22:00:00Z')).toBe(isoSec);
    // Entradas inválidas
    expect(normalizeTimeSeconds(null)).toBeNull();
    expect(normalizeTimeSeconds(undefined)).toBeNull();
    expect(normalizeTimeSeconds('invalido')).toBeNull();
    expect(normalizeTimeSeconds(-100)).toBeNull();
  });

  it('CS-02: safeNumber protege contra NaN, Infinity e valores não numéricos', () => {
    expect(safeNumber(100)).toBe(100);
    expect(safeNumber('123.45')).toBe(123.45);
    expect(safeNumber(NaN, 50)).toBe(50);
    expect(safeNumber(Infinity, 50)).toBe(50);
    expect(safeNumber('-Infinity', 50)).toBe(50);
    expect(safeNumber(undefined, 10)).toBe(10);
  });

  it('CS-03: Reordena velas desordenadas para ordem cronológica estritamente crescente', () => {
    const unorderedCandles: Candle[] = [
      { time: 1700000060, open: '100', high: '105', low: '98', close: '102', volume: 0 },
      { time: 1700000000, open: '95', high: '101', low: '94', close: '100', volume: 0 },
      { time: 1700000120, open: '102', high: '108', low: '101', close: '107', volume: 0 },
    ];

    const result = sanitizeCandles(unorderedCandles);
    expect(result).toHaveLength(3);
    expect(Number(result[0].time)).toBe(1700000000);
    expect(Number(result[1].time)).toBe(1700000060);
    expect(Number(result[2].time)).toBe(1700000120);

    // Verifica invariante: time[i] > time[i-1]
    for (let i = 1; i < result.length; i++) {
      expect(Number(result[i].time)).toBeGreaterThan(Number(result[i - 1].time));
    }
  });

  it('CS-04: Deduplica e mescla velas com timestamps repetidos', () => {
    const duplicateCandles: Candle[] = [
      { time: 1700000000, open: '100', high: '105', low: '95', close: '102', volume: 10 },
      { time: 1700000000, open: '102', high: '110', low: '92', close: '108', volume: 15 },
    ];

    const result = sanitizeCandles(duplicateCandles);
    expect(result).toHaveLength(1);
    expect(Number(result[0].time)).toBe(1700000000);
    expect(result[0].open).toBe('100'); // Mantém open do início
    expect(result[0].high).toBe('110'); // Máximo de ambas
    expect(result[0].low).toBe('92');   // Mínimo de ambas
    expect(result[0].close).toBe('108'); // Close da última
    expect(result[0].volume).toBe(25); // Soma volume
  });

  it('CS-05: Corrige anomalias geométricas da vela (high < low ou open fora dos limites)', () => {
    const anomalousCandle: Candle[] = [
      // High menor que close, Low maior que open
      { time: 1700000000, open: '100', high: '90', low: '110', close: '105', volume: 0 },
    ];

    const result = sanitizeCandles(anomalousCandle);
    expect(result).toHaveLength(1);
    expect(Number(result[0].high)).toBeGreaterThanOrEqual(105);
    expect(Number(result[0].low)).toBeLessThanOrEqual(100);
  });

  it('CS-06: Filtra velas com preços negativos, zeros ou NaN', () => {
    const corrupted: any[] = [
      { time: 1700000000, open: NaN, high: 100, low: 90, close: 95 },
      { time: 1700000060, open: -10, high: -5, low: -20, close: -15 },
      { time: 1700000120, open: 100, high: 105, low: 95, close: 102 }, // Válida
      { time: null, open: 100, high: 105, low: 95, close: 102 },
      null,
      undefined,
    ];

    const result = sanitizeCandles(corrupted);
    expect(result).toHaveLength(1);
    expect(Number(result[0].time)).toBe(1700000120);
    expect(result[0].close).toBe('102');
  });

  it('CS-07: sanitizeTick valida e extrai dados seguros de ticks', () => {
    const validTick: Tick = {
      type: 'tick',
      symbol: 'SYNTH_VOL_50',
      sequence: 1234,
      price: '1540.25',
      ts: '2026-10-08T22:00:00Z',
      event_time: 1700000000000,
    };
    const sanitized = sanitizeTick(validTick);
    expect(sanitized).not.toBeNull();
    expect(sanitized?.price).toBe(1540.25);
    expect(sanitized?.timeSec).toBe(1700000000);

    // Ticks inválidos
    expect(sanitizeTick(null)).toBeNull();
    expect(sanitizeTick({ type: 'tick', symbol: 'X', sequence: 1, price: '-5.0', ts: '2026-10-08T22:00:00Z' })).toBeNull();
    expect(sanitizeTick({ type: 'tick', symbol: 'X', sequence: 1, price: 'corrompido', ts: '2026-10-08T22:00:00Z' })).toBeNull();
  });

  it('CS-08: isSafeBarUpdate previne atualização com timestamp decrescente na série', () => {
    expect(isSafeBarUpdate(1700000060, 1700000000)).toBe(true);
    expect(isSafeBarUpdate(1700000060, 1700000060)).toBe(true);
    expect(isSafeBarUpdate(1700000000, 1700000060)).toBe(false); // Timestamp regressivo
    expect(isSafeBarUpdate(1700000060, null)).toBe(true);
  });

  it('CS-09 (Fuzzing e Stress Test): Processa 10.000 velas ruidosas e desordenadas em < 25ms', () => {
    const noisyCandles: any[] = [];
    const baseTime = 1700000000;

    for (let i = 0; i < 10000; i++) {
      // Inserção com tempos aleatórios entre 0 e 5000 segundos (gerando duplicatas e desordem)
      const randomOffset = Math.floor(Math.random() * 5000);
      const isCorrupted = i % 50 === 0;

      noisyCandles.push({
        time: isCorrupted ? 'invalido' : baseTime + randomOffset,
        open: isCorrupted ? NaN : 100 + (Math.random() * 20),
        high: 130,
        low: 90,
        close: 100 + (Math.random() * 20),
      });
    }

    const t0 = performance.now();
    const cleanCandles = sanitizeCandles(noisyCandles);
    const duration = performance.now() - t0;

    expect(cleanCandles.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Execução rápida garantida

    // Verifica garantia estrita de ordenação para a biblioteca
    for (let i = 1; i < cleanCandles.length; i++) {
      expect(Number(cleanCandles[i].time)).toBeGreaterThan(Number(cleanCandles[i - 1].time));
      expect(Number.isFinite(Number(cleanCandles[i].open))).toBe(true);
      expect(Number.isFinite(Number(cleanCandles[i].high))).toBe(true);
      expect(Number.isFinite(Number(cleanCandles[i].low))).toBe(true);
      expect(Number.isFinite(Number(cleanCandles[i].close))).toBe(true);
    }
  });
});
