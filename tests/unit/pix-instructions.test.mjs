import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LATAM_COUNTRIES,
  getAvailableDepositMethods,
  generatePixQrCode,
  generateBankInstructions,
  generateDepositInstructions,
  calculateCRC16,
} from '../../scripts/lib/deposit-instructions.mjs';

describe('Subetapa 7.5 — PIX Correto e Instrucoes de Deposito por Pais', () => {
  it('aceita PIX APENAS para o Brasil (BR) na lista de metodos disponiveis', () => {
    const brMethods = getAvailableDepositMethods('BR');
    assert.deepEqual(brMethods, ['PIX', 'BANK', 'CARD', 'CRYPTO']);

    const nonBrazilCountries = LATAM_COUNTRIES.filter((c) => c !== 'BR');
    assert.equal(nonBrazilCountries.length, 17);

    for (const country of nonBrazilCountries) {
      const methods = getAvailableDepositMethods(country);
      assert.ok(!methods.includes('PIX'), `Pais ${country} NAO deve incluir PIX`);
      assert.deepEqual(methods, ['BANK', 'CARD', 'CRYPTO']);
    }
  });

  it('rejeita geracao de instrucoes PIX para paises fora do Brasil (erro 400)', () => {
    const nonBrazil = ['MX', 'AR', 'CO', 'CL', 'PE', 'EC', 'VE', 'UY', 'PY', 'BO', 'CR', 'PA', 'DO', 'GT', 'HN', 'SV', 'NI'];

    for (const country of nonBrazil) {
      assert.throws(
        () => generateDepositInstructions(country, 'PIX', 10000, 'dep-test-123'),
        (err) => {
          assert.equal(err.message, 'PIX is only available in Brazil');
          assert.equal(err.statusCode, 400);
          assert.deepEqual(err.availableMethods, ['BANK', 'CARD', 'CRYPTO']);
          return true;
        },
        `Deveria rejeitar PIX para ${country}`
      );
    }
  });

  it('gera QR Code PIX valido com CRC16-CCITT para o Brasil (BR)', () => {
    const instructions = generateDepositInstructions('BR', 'PIX', 15000, 'dep-br-001');
    assert.equal(typeof instructions, 'string');
    assert.ok(instructions.startsWith('000201'), 'Payload EMV deve iniciar com 000201');
    assert.ok(instructions.includes('BR.GOV.BCB.PIX'), 'Deve conter GUI do BACEN PIX');
    assert.ok(instructions.includes('150.00'), 'Deve conter o valor 150.00');
    assert.ok(instructions.includes('SAO PAULO'), 'Deve conter cidade SAO PAULO');

    // Verificar CRC16 deterministico nos ultimos 4 caracteres
    const directQr = generatePixQrCode(15000, 'dep-br-001');
    assert.equal(instructions, directQr);
    const payloadWithoutCrc = directQr.slice(0, -4);
    const expectedCrc = calculateCRC16(payloadWithoutCrc);
    assert.equal(directQr.slice(-4), expectedCrc);
  });

  it('gera instrucoes bancarias locais corretas por pais (SPEI no Mexico, CVU/CBU na Argentina, PSE na Colombia, TED no Brasil)', () => {
    const mxBank = generateBankInstructions('MX', 25000, 'dep-mx-001');
    assert.ok(mxBank.includes('SPEI'), 'Mexico deve exibir SPEI');
    assert.ok(mxBank.includes('CLABE:'), 'Mexico deve ter CLABE');
    assert.ok(mxBank.includes('250.00 MXN'), 'Mexico deve exibir valor em MXN');
    assert.ok(!mxBank.includes('PIX'), 'Mexico NAO deve conter PIX');

    const arBank = generateBankInstructions('AR', 50000, 'dep-ar-001');
    assert.ok(arBank.includes('CVU/CBU'), 'Argentina deve exibir CVU/CBU');
    assert.ok(arBank.includes('CVU:'), 'Argentina deve ter CVU');
    assert.ok(arBank.includes('500.00 ARS'), 'Argentina deve exibir valor em ARS');

    const coBank = generateBankInstructions('CO', 100000, 'dep-co-001');
    assert.ok(coBank.includes('PSE'), 'Colombia deve exibir PSE');
    assert.ok(coBank.includes('NIT:'), 'Colombia deve exibir NIT');
    assert.ok(coBank.includes('1000.00 COP'), 'Colombia deve exibir valor em COP');

    const brBank = generateBankInstructions('BR', 10000, 'dep-br-bank');
    assert.ok(brBank.includes('TED/DOC'), 'Brasil deve exibir TED/DOC');
    assert.ok(brBank.includes('CNPJ:'), 'Brasil deve exibir CNPJ');
    assert.ok(brBank.includes('100.00 BRL'), 'Brasil deve exibir valor em BRL');
  });

  it('teste de estresse: 1000 validacoes de PIX/BANK em < 500ms sem vazamento', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const country = LATAM_COUNTRIES[i % LATAM_COUNTRIES.length];
      if (country === 'BR') {
        const res = generateDepositInstructions('BR', 'PIX', 1000 + i, `stress-${i}`);
        assert.ok(res.startsWith('000201'));
      } else {
        const res = generateDepositInstructions(country, 'BANK', 1000 + i, `stress-${i}`);
        assert.ok(res.includes(`Referencia: stress-${i}`));
      }
    }
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 500, `1000 geracoes levaram ${elapsed.toFixed(1)}ms (esperado < 500ms)`);
  });
});
