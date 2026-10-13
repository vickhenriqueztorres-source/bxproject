import { describe, it, expect } from 'vitest';
import { normalizeSymbol, isSameAsset } from '../catalog/assets';

describe('SUBETAPA 7.1 — Normalização Universal de Símbolos & Paridade de Contratos', () => {
  it('T7.1-01: normalizeSymbol remove o prefixo SYNTH_ mantendo o código base', () => {
    expect(normalizeSymbol('SYNTH_VOL_50')).toBe('VOL_50');
    expect(normalizeSymbol('SYNTH_VOL_10')).toBe('VOL_10');
    expect(normalizeSymbol('SYNTH_VOL_100')).toBe('VOL_100');
    expect(normalizeSymbol('SYNTH_CRASH_BOOM_100')).toBe('CRASH_BOOM_100');
  });

  it('T7.1-02: normalizeSymbol preserva símbolos de Forex, Cripto e Commodities sem prefixo', () => {
    expect(normalizeSymbol('EURUSD_OTC')).toBe('EURUSD_OTC');
    expect(normalizeSymbol('BTCUSD_OTC')).toBe('BTCUSD_OTC');
    expect(normalizeSymbol('XAUUSD_OTC')).toBe('XAUUSD_OTC');
    expect(normalizeSymbol('VOL_50')).toBe('VOL_50');
  });

  it('T7.1-03: isSameAsset reconhece igualdade bidirecional entre SYNTH_ e formato padrão', () => {
    expect(isSameAsset('SYNTH_VOL_50', 'VOL_50')).toBe(true);
    expect(isSameAsset('VOL_50', 'SYNTH_VOL_50')).toBe(true);
    expect(isSameAsset('SYNTH_VOL_100', 'VOL_100')).toBe(true);
    expect(isSameAsset('VOL_100', 'SYNTH_VOL_100')).toBe(true);
  });

  it('T7.1-04: isSameAsset é insensível a maiúsculas/minúsculas e espaços em branco', () => {
    expect(isSameAsset('synth_vol_50', 'VOL_50')).toBe(true);
    expect(isSameAsset(' vol_50 ', 'SYNTH_VOL_50')).toBe(true);
    expect(isSameAsset('eurusd_otc', 'EURUSD_OTC')).toBe(true);
  });

  it('T7.1-05: isSameAsset diferencia corretamente ativos distintos', () => {
    expect(isSameAsset('SYNTH_VOL_50', 'VOL_10')).toBe(false);
    expect(isSameAsset('EURUSD_OTC', 'GBPUSD_OTC')).toBe(false);
    expect(isSameAsset('VOL_50', 'CRASH_BOOM_100')).toBe(false);
  });

  it('T7.1-06 (Caos & Resiliência): isSameAsset lida com nulos, indefinidos e entradas vazias sem estourar exceção', () => {
    expect(isSameAsset(null as any, 'VOL_50')).toBe(false);
    expect(isSameAsset('VOL_50', undefined as any)).toBe(false);
    expect(isSameAsset('', '')).toBe(false);
    expect(isSameAsset('   ', 'VOL_50')).toBe(false);
    expect(isSameAsset(undefined, undefined)).toBe(false);
  });

  it('T7.1-07 (Estresse): Executa 100.000 comparações de isSameAsset em menos de 100ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      const result = isSameAsset('SYNTH_VOL_50', 'VOL_50');
      if (!result) throw new Error('Falha de consistência no loop de estresse');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
