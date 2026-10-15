import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { LATAM_COUNTRIES, COUNTRY_CURRENCY_MAP, CURRENCIES_TO_TRACK } from '../../scripts/lib/deposit-instructions.mjs';

const ROOT = process.cwd();

describe('Subetapa 7.1 — Expansao de 6 para 18 Paises LATAM', () => {
  it('possui exatamente 18 paises configurados em packages/shared e deposit-instructions', () => {
    assert.equal(LATAM_COUNTRIES.length, 18);
    const typesPath = path.join(ROOT, 'packages', 'shared', 'src', 'types.ts');
    const currencyPath = path.join(ROOT, 'packages', 'shared', 'src', 'currency.ts');
    const datetimePath = path.join(ROOT, 'packages', 'shared', 'src', 'datetime.ts');

    const typesContent = fs.readFileSync(typesPath, 'utf8');
    const currencyContent = fs.readFileSync(currencyPath, 'utf8');
    const datetimeContent = fs.readFileSync(datetimePath, 'utf8');

    for (const code of LATAM_COUNTRIES) {
      assert.ok(typesContent.includes(`"${code}"`) || typesContent.includes(`'${code}'`), `types.ts deve conter o pais ${code}`);
      assert.ok(datetimeContent.includes(`${code}:`), `datetime.ts deve conter fuso para ${code}`);
    }

    for (const curr of CURRENCIES_TO_TRACK) {
      assert.ok(currencyContent.includes(`${curr}:`), `currency.ts deve conter configuracao para ${curr}`);
    }
  });

  it('sincroniza todos os 18 locales e mapeamento de moedas em apps/web/src/i18n/index.tsx', () => {
    const i18nPath = path.join(ROOT, 'apps', 'web', 'src', 'i18n', 'index.tsx');
    const content = fs.readFileSync(i18nPath, 'utf8');

    const expectedLocales = [
      'pt-BR', 'es-MX', 'es-AR', 'es-CO', 'es-CL', 'es-PE',
      'es-EC', 'es-VE', 'es-UY', 'es-PY', 'es-BO', 'es-CR',
      'es-PA', 'es-DO', 'es-GT', 'es-HN', 'es-SV', 'es-NI',
    ];

    for (const locale of expectedLocales) {
      assert.ok(
        content.includes(`"${locale}"`) || content.includes(`'${locale}'`),
        `i18n/index.tsx deve suportar o locale ${locale}`
      );
    }

    for (const country of LATAM_COUNTRIES) {
      const currency = COUNTRY_CURRENCY_MAP[country].code;
      assert.ok(
        content.includes(`${country}: "${currency}"`) || content.includes(`${country}: '${currency}'`),
        `COUNTRY_TO_CURRENCY deve mapear ${country} -> ${currency}`
      );
    }
  });
});
