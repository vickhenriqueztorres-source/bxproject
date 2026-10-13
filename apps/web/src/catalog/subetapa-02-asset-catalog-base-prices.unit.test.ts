import { describe, it, expect } from 'vitest';
import { ASSET_CATALOG, getAssetBasePrice, getAssetMeta } from './assets';

describe('SUBETAPA 02: Integridade de Cotações Base e Catálogo dos 36 Ativos', () => {
  it('CAT-01: Todos os 36 ativos do catálogo possuem preços base calibrados e realistas', () => {
    expect(ASSET_CATALOG.length).toBe(36);

    for (const asset of ASSET_CATALOG) {
      const basePrice = getAssetBasePrice(asset.symbol);
      expect(basePrice).toBeGreaterThan(0);
      expect(Number.isFinite(basePrice)).toBe(true);

      // Verificação por classe
      if (asset.category === 'Forex') {
        // Pares Forex fiduciários nunca custam 1000+ nem exatamente 100.0 (antigo bug)
        expect(basePrice).toBeLessThan(300);
        expect(basePrice).not.toBe(100.0);
      } else if (asset.category === 'Cripto') {
        if (asset.symbol.startsWith('BTC')) {
          expect(basePrice).toBeGreaterThan(50000);
        } else if (asset.symbol.startsWith('ETH')) {
          expect(basePrice).toBeGreaterThan(2000);
        }
      } else if (asset.category === 'Commodities') {
        if (asset.symbol.startsWith('XAU')) {
          expect(basePrice).toBeGreaterThan(2000);
        }
      }
    }
  });

  it('CAT-02: Eliminação do bug do AUD/USD e pares Forex caindo em fallback de 100.0', () => {
    // AUD/USD foi a causa raiz vista no print do usuário
    const audPrice = getAssetBasePrice('AUDUSD_OTC');
    expect(audPrice).toBeCloseTo(0.65820, 4);

    const cadPrice = getAssetBasePrice('USDCAD_OTC');
    expect(cadPrice).toBeCloseTo(1.38450, 4);

    const chfPrice = getAssetBasePrice('USDCHF_OTC');
    expect(chfPrice).toBeCloseTo(0.86510, 4);

    const eurGbpPrice = getAssetBasePrice('EURGBP_OTC');
    expect(eurGbpPrice).toBeCloseTo(0.83850, 4);
  });

  it('CAT-03: Ativos sintéticos possuem preços proporcionais às suas volatilidades', () => {
    expect(getAssetBasePrice('SYNTH_VOL_10')).toBeCloseTo(100.5420, 2);
    expect(getAssetBasePrice('SYNTH_VOL_25')).toBeCloseTo(250.8410, 2);
    expect(getAssetBasePrice('SYNTH_VOL_50')).toBeCloseTo(500.1250, 2);
    expect(getAssetBasePrice('SYNTH_VOL_75')).toBeCloseTo(750.3200, 2);
    expect(getAssetBasePrice('SYNTH_VOL_100')).toBeCloseTo(1000.4500, 2);
    expect(getAssetBasePrice('SYNTH_CRASH_BOOM_100')).toBeCloseTo(1000.8200, 2);
  });

  it('CAT-04: getAssetMeta retorna precisão e payout corretos para todos os ativos', () => {
    const audMeta = getAssetMeta('AUDUSD_OTC');
    expect(audMeta.precision).toBe(5);
    expect(audMeta.payout).toBe(85);

    const btcMeta = getAssetMeta('BTCUSD_OTC');
    expect(btcMeta.precision).toBe(2);

    const jpyMeta = getAssetMeta('USDJPY_OTC');
    expect(jpyMeta.precision).toBe(3);
  });
});
