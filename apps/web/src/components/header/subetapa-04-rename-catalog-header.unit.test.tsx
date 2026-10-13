import { describe, it, expect } from 'vitest';
import { ASSET_CATALOG, getAssetMeta, normalizeSymbol, getAssetBasePrice, LEGACY_SYMBOL_MAP } from '../../catalog/assets';
import { getTabDisplayTitle } from './TerminalHeader';
import { getAsset24hChange } from '../modals/AssetCatalogModal';

describe('SUBETAPA 04: Certificação do Catálogo Frontend, Header & Normalização de Símbolos', () => {
  const canonicalSymbols = ['VOL_10', 'VOL_25', 'VOL_50', 'VOL_75', 'VOL_100', 'CRASH_BOOM_100'];

  it('1. Deve catalogar os 6 novos índices sintéticos com nomenclatura oficial das Opções Binárias', () => {
    const synthetics = ASSET_CATALOG.filter(a => a.category === 'Sintéticos');
    expect(synthetics).toHaveLength(6);

    const expectedNames: Record<string, { name: string; subtitle: string }> = {
      VOL_10: { name: 'Volatilidad 10', subtitle: 'Índice V-10 (24/7)' },
      VOL_25: { name: 'Volatilidad 25', subtitle: 'Índice V-25 (24/7)' },
      VOL_50: { name: 'Volatilidad 50', subtitle: 'Índice V-50 (24/7)' },
      VOL_75: { name: 'Volatilidad 75', subtitle: 'Índice V-75 (24/7)' },
      VOL_100: { name: 'Volatilidad 100', subtitle: 'Índice V-100 (24/7)' },
      CRASH_BOOM_100: { name: 'Crash & Boom 100', subtitle: 'Índice Crash / Boom (Spikes)' }
    };

    for (const item of synthetics) {
      expect(expectedNames[item.symbol]).toBeDefined();
      expect(item.name).toBe(expectedNames[item.symbol].name);
      expect(item.subtitle).toBe(expectedNames[item.symbol].subtitle);
      expect(item.payout).toBe(85);
      expect(item.precision).toBe(4);
    }
  });

  it('2. getTabDisplayTitle deve formatar de forma limpa e compacta para as abas do cabeçalho', () => {
    expect(getTabDisplayTitle('VOL_10')).toBe('Vol 10');
    expect(getTabDisplayTitle('VOL_25')).toBe('Vol 25');
    expect(getTabDisplayTitle('VOL_50')).toBe('Vol 50');
    expect(getTabDisplayTitle('VOL_75')).toBe('Vol 75');
    expect(getTabDisplayTitle('VOL_100')).toBe('Vol 100');
    expect(getTabDisplayTitle('CRASH_BOOM_100')).toBe('Crash 100');

    // Suporte aos legados nas abas
    expect(getTabDisplayTitle('SYNTH_VOL_50')).toBe('Vol 50');
    expect(getTabDisplayTitle('SYNTH_CRASH_BOOM_100')).toBe('Crash 100');
  });

  it('3. normalizeSymbol e getAssetMeta devem converter símbolos legados transparentemente', () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_SYMBOL_MAP)) {
      expect(normalizeSymbol(legacy)).toBe(canonical);
      const meta = getAssetMeta(legacy);
      expect(meta.symbol).toBe(canonical);
    }
  });

  it('4. getAssetBasePrice deve fornecer preços-base válidos para todos os 6 símbolos canônicos', () => {
    for (const sym of canonicalSymbols) {
      const price = getAssetBasePrice(sym);
      expect(price).toBeGreaterThan(0);
      expect(Number.isFinite(price)).toBe(true);
    }
  });

  it('5. getAsset24hChange deve calcular variação 24h para os 6 símbolos canônicos', () => {
    for (const sym of canonicalSymbols) {
      const change = getAsset24hChange(sym);
      expect(change.text).toMatch(/^[+-]\d+\.\d{2}%$/);
      expect(typeof change.isPositive).toBe('boolean');
    }
  });
});
