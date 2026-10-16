import test from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  computeContractOutcome,
  scalePriceToBigInt,
} from '../../scripts/lib/settlement-engine.mjs';
import { getAssetConfig } from '../../scripts/lib/ou-engine.mjs';

test('P1-2 Casos Canônicos: 1.10000 vs 1.1 e 0.1+0.2 vs 0.3 resultam em DRAW exato usando inteiro escalado pela precisão do ativo', () => {
  // Verifica que getAssetConfig expõe decimals (ou precision)
  const eurCfg = getAssetConfig('EURUSD_OTC');
  assert.equal(eurCfg.decimals, 5, 'getAssetConfig(EURUSD_OTC).decimals deve ser 5');
  assert.equal(typeof scalePriceToBigInt, 'function', 'scalePriceToBigInt deve ser exportada por settlement-engine.mjs');

  // Caso 1: '1.10000' vs '1.1'
  const out1 = computeContractOutcome({
    direction: 'UP',
    entryPrice: '1.10000',
    exitPrice: '1.1',
    stakeMinor: 1000,
    payoutPct: 85,
    symbol: 'EURUSD_OTC',
  });
  assert.equal(out1.result, 'DRAW');
  assert.equal(out1.payoutMinor, 1000);

  // Caso 2: 0.1 + 0.2 (0.30000000000000004 em IEEE-754) vs '0.3' / 0.3
  // No código antigo (Number(entry) vs Number(exit)), exit > entry dava WIN indevido!
  const out2Up = computeContractOutcome({
    direction: 'UP',
    entryPrice: '0.3',
    exitPrice: 0.1 + 0.2,
    stakeMinor: 1000,
    payoutPct: 85,
    symbol: 'EURUSD_OTC',
  });
  assert.equal(out2Up.result, 'DRAW', '0.1 + 0.2 vs 0.3 NÃO pode dar WIN por ruído de ponto flutuante');
  assert.equal(out2Up.payoutMinor, 1000);

  const out2Down = computeContractOutcome({
    direction: 'DOWN',
    entryPrice: 0.1 + 0.2,
    exitPrice: 0.3,
    stakeMinor: 1000,
    payoutPct: 85,
    symbol: 'EURUSD_OTC',
  });
  assert.equal(out2Down.result, 'DRAW', '0.1 + 0.2 vs 0.3 NÃO pode dar WIN na direção DOWN');
  assert.equal(out2Down.payoutMinor, 1000);
});

test('P1-2 Property-Based Test (fast-check): para qualquer par de strings na precisão do ativo, o resultado bate 100% com a comparação das strings normalizadas', () => {
  const symbols = ['BTCUSD_OTC', 'USDJPY_OTC', 'VOL_50', 'EURUSD_OTC']; // decimals: 2, 3, 4, 5

  fc.assert(
    fc.property(
      fc.constantFrom(...symbols),
      fc.constantFrom('UP', 'DOWN'),
      fc.bigInt({ min: 1n, max: 10_000_000_000n }),
      fc.bigInt({ min: 1n, max: 10_000_000_000n }),
      fc.integer({ min: 0, max: 4 }),
      (symbol, direction, scaledEntry, scaledExit, extraTrailingZeros) => {
        const decimals = getAssetConfig(symbol).decimals;
        const factor = 10n ** BigInt(decimals);

        const formatFromScaled = (val, trailingZeros = 0) => {
          const whole = val / factor;
          const frac = (val % factor).toString().padStart(decimals, '0');
          // Se terminar em zeros e trailingZeros === 0, testa também forma curta sem zeros à direita
          const baseStr = decimals > 0 ? `${whole}.${frac}` : `${whole}`;
          if (trailingZeros === 0 && frac.endsWith('0')) {
            return baseStr.replace(/0+$/, '').replace(/\.$/, '');
          }
          return baseStr + '0'.repeat(trailingZeros);
        };

        const entryStr = formatFromScaled(scaledEntry, extraTrailingZeros);
        const exitStr = formatFromScaled(scaledExit, 0);

        const outcome = computeContractOutcome({
          direction,
          entryPrice: entryStr,
          exitPrice: exitStr,
          stakeMinor: 1000,
          payoutPct: 85,
          symbol,
        });

        // Comparação canônica das strings normalizadas (mesma largura e casas decimais)
        const normEntry = scaledEntry.toString().padStart(16, '0');
        const normExit = scaledExit.toString().padStart(16, '0');

        let expectedResult;
        if (normEntry === normExit) {
          expectedResult = 'DRAW';
        } else if (
          (direction === 'UP' && normExit > normEntry) ||
          (direction === 'DOWN' && normExit < normEntry)
        ) {
          expectedResult = 'WIN';
        } else {
          expectedResult = 'LOSS';
        }

        assert.equal(outcome.result, expectedResult);
      }
    ),
    { numRuns: 500 }
  );
});
