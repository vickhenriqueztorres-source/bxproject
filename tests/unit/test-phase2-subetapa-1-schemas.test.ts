import { describe, it, expect } from 'vitest';
import assert from 'node:assert/strict';
import {
  CountryCodeSchema,
  DisplayCurrencyCodeSchema,
  CountrySchema,
  DisplayCurrencySchema,
  CountryFeatureFlagSchema,
  KYCProfileSchema,
  PaymentMethodSchema,
  PHASE2_COUNTRIES,
  PHASE2_DISPLAY_CURRENCIES
} from '../../packages/shared/src/index.ts';

describe('Subetapa 1: Validação de Schemas e Contratos Zod da Fase 2', () => {
  it('1. Deve validar exatamente os países autorizados da Fase 2', () => {
    assert.strictEqual(PHASE2_COUNTRIES.length, 18, 'Devem existir exatamente 18 países autorizados');
    const validCountries = ['BR', 'MX', 'CO', 'AR', 'CL', 'PE'];
    
    for (const code of validCountries) {
      const parsed = CountryCodeSchema.safeParse(code);
      assert.strictEqual(parsed.success, true, `País ${code} deve ser aceito`);
    }

    const invalidCountries = ['DE', 'FR', 'CN', 'RU', 'JP', 'GB'];
    for (const code of invalidCountries) {
      const parsed = CountryCodeSchema.safeParse(code);
      assert.strictEqual(parsed.success, false, `País ${code} deve ser estritamente rejeitado`);
    }
  });

  it('2. Deve validar exatamente as moedas de exibição da Fase 2', () => {
    assert.strictEqual(PHASE2_DISPLAY_CURRENCIES.length, 15, 'Devem existir exatamente 15 moedas de exibição');
    const validCurrencies = ['BRL', 'MXN', 'COP', 'ARS', 'CLP', 'PEN'];

    for (const curr of validCurrencies) {
      const parsed = DisplayCurrencyCodeSchema.safeParse(curr);
      assert.strictEqual(parsed.success, true, `Moeda ${curr} deve ser aceita`);
    }

    const invalidCurrencies = ['GBP', 'JPY', 'CAD', 'CHF'];
    for (const curr of invalidCurrencies) {
      const parsed = DisplayCurrencyCodeSchema.safeParse(curr);
      assert.strictEqual(parsed.success, false, `Moeda ${curr} deve ser rejeitada como moeda de exibição regional`);
    }
  });

  it('3. Deve validar a estrutura de CountrySchema', () => {
    const validPayload = {
      code: 'BR',
      name: 'Brasil',
      default_currency: 'BRL',
      default_locale: 'pt-BR',
      is_active: true
    };
    const parsed = CountrySchema.safeParse(validPayload);
    assert.strictEqual(parsed.success, true);

    const invalidPayload = {
      code: 'US', // país não permitido
      name: 'United States',
      default_currency: 'USD',
      default_locale: 'en-US',
      is_active: true
    };
    const invalidParsed = CountrySchema.safeParse(invalidPayload);
    assert.strictEqual(invalidParsed.success, false);
  });

  it('4. Deve validar a estrutura de DisplayCurrencySchema', () => {
    const validCurrency = {
      code: 'BRL',
      symbol: 'R$',
      name: 'Real Brasileiro',
      decimals: 2,
      exchange_rate_to_usd: '5.500000'
    };
    const parsed = DisplayCurrencySchema.safeParse(validCurrency);
    assert.strictEqual(parsed.success, true);

    const invalidCurrency = {
      code: 'BRL',
      symbol: 'R$',
      name: 'Real Brasileiro',
      decimals: -1, // decimals inválido
      exchange_rate_to_usd: '5.500000'
    };
    const invalidParsed = DisplayCurrencySchema.safeParse(invalidCurrency);
    assert.strictEqual(invalidParsed.success, false);
  });

  it('5. Deve validar CountryFeatureFlagSchema', () => {
    const validFlag = {
      country_code: 'MX',
      flag_key: 'trading_enabled',
      enabled: true,
      metadata: { reason: 'operational_normal' }
    };
    const parsed = CountryFeatureFlagSchema.safeParse(validFlag);
    assert.strictEqual(parsed.success, true);
  });

  it('6. Deve validar KYCProfileSchema com status UNVERIFIED, PENDING, APPROVED, REJECTED', () => {
    const validKYC = {
      user_id: 'usr_latam_12345',
      country_code: 'CO',
      document_type: 'CC',
      document_number: '1020304050',
      status: 'UNVERIFIED'
    };
    const parsed = KYCProfileSchema.safeParse(validKYC);
    assert.strictEqual(parsed.success, true);

    const invalidStatus = {
      user_id: 'usr_latam_12345',
      country_code: 'CO',
      document_type: 'CC',
      status: 'INVALID_STATUS'
    };
    const invalidParsed = KYCProfileSchema.safeParse(invalidStatus);
    assert.strictEqual(invalidParsed.success, false);
  });

  it('7. Deve validar PaymentMethodSchema com status inativo na Fase 2', () => {
    const validMethod = {
      country_code: 'BR',
      method_code: 'PIX',
      name: 'Pix Banco Central',
      type: 'INSTANT',
      is_active: false,
      config: { currency: 'BRL' }
    };
    const parsed = PaymentMethodSchema.safeParse(validMethod);
    assert.strictEqual(parsed.success, true);
  });
});
