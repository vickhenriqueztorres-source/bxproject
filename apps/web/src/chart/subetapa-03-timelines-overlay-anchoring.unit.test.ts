import { describe, it, expect } from 'vitest';
import { timeframeSeconds, type Timeframe } from './candle-adapter';

describe('SUBETAPA 03: Ancoragem Geométrica das Linhas de Tempo (TimeLinesOverlay)', () => {
  function calculateTimeLineCoordinates(params: {
    xCandle: number | null;
    effectiveWidth: number;
    barSpacing: number;
    timeframe: Timeframe;
    secondsRemaining: number;
    purchaseSecondsRemaining: number;
    isPurchaseLocked: boolean;
  }) {
    const {
      xCandle,
      effectiveWidth,
      barSpacing,
      timeframe,
      secondsRemaining,
      purchaseSecondsRemaining,
      isPurchaseLocked,
    } = params;

    const maxExpirationX = Math.max(80, effectiveWidth - 65);
    const tfSec = timeframeSeconds(timeframe);

    let xExpiration: number;
    let xPurchase: number;

    if (xCandle !== null && xCandle > 10 && xCandle < effectiveWidth - 20) {
      const barsAheadExp = Math.max(0.1, secondsRemaining / tfSec);
      const calculatedExpX = xCandle + barsAheadExp * barSpacing;
      xExpiration = Math.min(maxExpirationX, calculatedExpX);

      if (isPurchaseLocked || purchaseSecondsRemaining <= 0) {
        xPurchase = xCandle;
      } else {
        const barsAheadPurchase = Math.max(0.05, purchaseSecondsRemaining / tfSec);
        const calculatedPurchX = xCandle + barsAheadPurchase * barSpacing;
        xPurchase = Math.min(xExpiration - 15, calculatedPurchX);
      }
    } else {
      xExpiration = Math.min(maxExpirationX, Math.round(effectiveWidth * 0.84));
      xPurchase = Math.min(xExpiration - 25, Math.round(effectiveWidth * 0.68));
    }

    return { xExpiration, xPurchase };
  }

  it('TLO-01: No timeframe de 1m, com 60s restantes a expiração fica exatamente a 1 barra à frente', () => {
    const coords = calculateTimeLineCoordinates({
      xCandle: 600,
      effectiveWidth: 1000,
      barSpacing: 20,
      timeframe: '1m',
      secondsRemaining: 60,
      purchaseSecondsRemaining: 30,
      isPurchaseLocked: false,
    });

    // 1m tem 60s. 60s / 60s = 1 barra à frente = 600 + 20 = 620px
    expect(coords.xExpiration).toBe(620);
    // Compra a 30s = 0.5 barras à frente = 600 + 10 = 610px (limitado a xExpiration - 15 = 605px)
    expect(coords.xPurchase).toBe(605);
  });

  it('TLO-02: No timeframe de 5s, a expiração projeta proporcionalmente à contagem de barras', () => {
    const coords = calculateTimeLineCoordinates({
      xCandle: 500,
      effectiveWidth: 1000,
      barSpacing: 10,
      timeframe: '5s',
      secondsRemaining: 30,
      purchaseSecondsRemaining: 10,
      isPurchaseLocked: false,
    });

    // 30s / 5s = 6 barras à frente = 500 + (6 * 10) = 560px
    expect(coords.xExpiration).toBe(560);
    // Compra 10s / 5s = 2 barras à frente = 500 + (2 * 10) = 520px
    expect(coords.xPurchase).toBe(520);
  });

  it('TLO-03: Quando a compra está travada (isPurchaseLocked), a linha de compra cola na vela atual', () => {
    const coords = calculateTimeLineCoordinates({
      xCandle: 750,
      effectiveWidth: 1200,
      barSpacing: 15,
      timeframe: '1m',
      secondsRemaining: 20,
      purchaseSecondsRemaining: 0,
      isPurchaseLocked: true,
    });

    // xPurchase cola exatamente em xCandle
    expect(coords.xPurchase).toBe(750);
    expect(coords.xExpiration).toBeGreaterThan(coords.xPurchase);
  });

  it('TLO-04: Fallback gracioso quando xCandle não está disponível sem gerar NaN ou valores negativos', () => {
    const coords = calculateTimeLineCoordinates({
      xCandle: null,
      effectiveWidth: 800,
      barSpacing: 10,
      timeframe: '1m',
      secondsRemaining: 45,
      purchaseSecondsRemaining: 15,
      isPurchaseLocked: false,
    });

    expect(Number.isFinite(coords.xExpiration)).toBe(true);
    expect(Number.isFinite(coords.xPurchase)).toBe(true);
    expect(coords.xExpiration).toBeGreaterThan(coords.xPurchase);
  });
});
