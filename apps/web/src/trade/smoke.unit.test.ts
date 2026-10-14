import { describe, it, expect, beforeEach } from 'vitest';
import { isNewTraderoomEnabled, setNewTraderoomEnabled } from '../lib/feature-flags';
import { parseStakeInput, formatMinor } from '../lib/money';
import { ASSET_CATALOG } from '../catalog/assets';
import { calculateExecutionExpiry } from './expiry-calculator';
import { safeRandomUUID } from '../lib/uuid';

describe('Rede de Segurança - Smoke Tests de Base (Etapa 02)', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  beforeEach(() => {
    store.clear();
    (globalThis as any).localStorage = mockStorage;
  });

  it('Feature Flag: deve resolver para true por padrão ou quando explicitamente configurada', () => {
    expect(isNewTraderoomEnabled()).toBe(true);
    setNewTraderoomEnabled(false);
    expect(isNewTraderoomEnabled()).toBe(false);
    setNewTraderoomEnabled(true);
    expect(isNewTraderoomEnabled()).toBe(true);
  });

  it('Parse de Stake: converte valores monetários com precisão de centavos', () => {
    expect(parseStakeInput('10,00')).toBe(1000);
    expect(parseStakeInput('50,50')).toBe(5050);
    expect(parseStakeInput('1')).toBe(100);
    expect(parseStakeInput('100,00')).toBe(10000);
    expect(parseStakeInput('-5')).toBeNull();
    expect(parseStakeInput('abc')).toBeNull();
  });

  it('Formatação de Saldo: formata números inteiros minor para representação monetária USD', () => {
    expect(formatMinor(1000000)).toContain('10.000,00');
    expect(formatMinor(100)).toContain('1,00');
  });

  it('Catálogo de Ativos: todos os ativos possuem payout positivo e categoria válida', () => {
    expect(ASSET_CATALOG.length).toBeGreaterThan(0);
    for (const asset of ASSET_CATALOG) {
      expect(asset.payout).toBeGreaterThanOrEqual(70);
      expect(asset.symbol).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it('Tempo de Expiração: garante rigorosamente o piso inviolável de 60 segundos', () => {
    const now = 1700000000000;
    const { durationMs, targetEpochMs } = calculateExecutionExpiry('1M_FIXED', now);
    expect(durationMs).toBeGreaterThanOrEqual(60000);
    expect(targetEpochMs).toBe(now + durationMs);
  });

  it('Idempotência: safeRandomUUID gera strings únicas no formato UUID v4', () => {
    const id1 = safeRandomUUID();
    const id2 = safeRandomUUID();
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
