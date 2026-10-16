import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeBootPrice } from '../../scripts/lib/ou-engine.mjs';

test('P2-1 Caso Real de Produção: VOL_50 com savedPrice=999.64 (1.9987x da base 500.125) é REJEITADO e 502.4 é ACEITO', () => {
  const warnings = [];
  const logger = { warn: (msg) => warnings.push(msg) };

  // 1. Caso real que passava na banda antiga [0.5x; 2.0x]: 999.64 / 500.125 = 1.99878x -> deve ser REJEITADO (> 1.4x)!
  const rejectedRes = sanitizeBootPrice(999.64, 500.125, 4, {
    symbol: 'VOL_50',
    logger,
  });
  assert.equal(rejectedRes, '500.1250', '999.64 deve ser rejeitado e retornar a base 500.1250');
  assert.equal(warnings.length, 1, 'Deve emitir log WARN ao rejeitar 999.64');
  assert.match(warnings[0], /VOL_50/);
  assert.match(warnings[0], /999\.64/);

  // 2. Caso são (502.4): aceito tanto sem lastClose ([0.7x; 1.4x]) quanto com lastClose próximo (<= 5%)
  const acceptedNoClose = sanitizeBootPrice(502.4, 500.125, 4, {
    symbol: 'VOL_50',
    logger,
  });
  assert.equal(acceptedNoClose, '502.4000');

  const acceptedWithClose = sanitizeBootPrice(502.4, 500.125, 4, {
    symbol: 'VOL_50',
    lastClose: 500.0,
    logger,
  });
  assert.equal(acceptedWithClose, '502.4000');
});

test('P2-1 Ordem de Validação: (1) contra último close +-5%, (2) sem último close [0.7x; 1.4x] da base, (3) fora disso usa lastClose ou base com log WARN', () => {
  const warnings = [];
  const logger = { warn: (msg) => warnings.push(msg) };

  // Regra 1: Com lastClose = 500.0000 -> 524.0000 (+4.8% <= 5%) é aceito; 530.0000 (+6.0% > 5%) é rejeitado e cai para lastClose (500.0000)
  assert.equal(
    sanitizeBootPrice(524.0, 500.125, 4, { symbol: 'VOL_50', lastClose: 500.0, logger }),
    '524.0000'
  );
  assert.equal(
    sanitizeBootPrice(530.0, 500.125, 4, { symbol: 'VOL_50', lastClose: 500.0, logger }),
    '500.0000',
    'Quando excede 5% do lastClose, deve usar lastClose e logar WARN'
  );
  assert.equal(warnings.length, 1);

  // Regra 2: Sem lastClose -> [0.7 * 100 = 70, 1.4 * 100 = 140]
  assert.equal(sanitizeBootPrice(70.0, 100.0, 4, { symbol: 'VOL_10', logger }), '70.0000');
  assert.equal(sanitizeBootPrice(140.0, 100.0, 4, { symbol: 'VOL_10', logger }), '140.0000');
  assert.equal(sanitizeBootPrice(69.99, 100.0, 4, { symbol: 'VOL_10', logger }), '100.0000');
  assert.equal(sanitizeBootPrice(140.01, 100.0, 4, { symbol: 'VOL_10', logger }), '100.0000');
});

test('P2-1 Segurança & Caos: base ausente ou inválida (null, undefined, 0, negativa, NaN) lança erro explícito', () => {
  for (const invalidBase of [undefined, null, 0, -100, NaN, Infinity, '', false]) {
    assert.throws(
      () => sanitizeBootPrice(500.0, invalidBase, 4, { symbol: 'VOL_50' }),
      /INVALID_BASE_PRICE/,
      `Deve lançar erro explícito para basePrice inválido: ${String(invalidBase)}`
    );
  }
});
