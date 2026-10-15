import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENCIES_TO_TRACK,
  FALLBACK_EXCHANGE_RATES,
  COUNTRY_CURRENCY_MAP,
  LATAM_COUNTRIES,
} from '../../scripts/lib/deposit-instructions.mjs';

describe('Subetapa 7.2 — Cambio Real e Fallback de 15 Moedas LATAM', () => {
  it('rastreia todas as 15 moedas da America Latina', () => {
    assert.equal(CURRENCIES_TO_TRACK.length, 15);
    const expected = [
      'BRL', 'MXN', 'ARS', 'COP', 'CLP',
      'PEN', 'VES', 'UYU', 'PYG', 'BOB',
      'CRC', 'DOP', 'GTQ', 'HNL', 'NIO',
    ];
    for (const curr of expected) {
      assert.ok(CURRENCIES_TO_TRACK.includes(curr), `Moeda ${curr} deve estar em CURRENCIES_TO_TRACK`);
    }
  });

  it('possui taxas de fallback positivas e finitas para USD e todas as 15 moedas', () => {
    assert.equal(FALLBACK_EXCHANGE_RATES.USD, 1.0);
    for (const curr of CURRENCIES_TO_TRACK) {
      const rate = FALLBACK_EXCHANGE_RATES[curr];
      assert.equal(typeof rate, 'number', `Taxa de ${curr} deve ser number`);
      assert.ok(Number.isFinite(rate) && rate > 0, `Taxa de ${curr} deve ser finita e > 0 (recebido: ${rate})`);
    }
  });

  it('mapeia todos os 18 paises para moedas suportadas (15 moedas locais + USD para EC, PA, SV)', () => {
    for (const country of LATAM_COUNTRIES) {
      const entry = COUNTRY_CURRENCY_MAP[country];
      assert.ok(entry && entry.code, `Pais ${country} deve ter moeda mapeada`);
      assert.ok(
        entry.code === 'USD' || CURRENCIES_TO_TRACK.includes(entry.code),
        `Moeda ${entry.code} do pais ${country} deve ser USD ou estar em CURRENCIES_TO_TRACK`
      );
    }
    assert.equal(COUNTRY_CURRENCY_MAP.EC.code, 'USD');
    assert.equal(COUNTRY_CURRENCY_MAP.PA.code, 'USD');
    assert.equal(COUNTRY_CURRENCY_MAP.SV.code, 'USD');
  });
});
