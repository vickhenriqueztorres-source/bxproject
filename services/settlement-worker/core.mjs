/**
 * Módulo ESM central do Settlement Worker (Invariantes I-01 a I-06, D-18, D-19).
 */

export function priceUnits(price, precision = 6) {
  const scaled = Math.round(parseFloat(price) * Math.pow(10, precision));
  return BigInt(scaled);
}

export function settlementFor(direction, entryPrice, exitPrice, stakeMinor, payoutPercentage = 85) {
  const entryScaled = BigInt(Math.round(parseFloat(entryPrice) * 1_000_000));
  const exitScaled = BigInt(Math.round(parseFloat(exitPrice) * 1_000_000));

  let result;
  if (exitScaled === entryScaled) {
    result = 'DRAW';
  } else if (direction === 'UP') {
    result = exitScaled > entryScaled ? 'WIN' : 'LOSS';
  } else {
    result = exitScaled < entryScaled ? 'WIN' : 'LOSS';
  }

  if (result === 'LOSS') {
    return {
      result: 'LOSS',
      profitMinor: 0,
      payoutMinor: 0,
    };
  }

  if (result === 'DRAW') {
    return {
      result: 'DRAW',
      profitMinor: 0,
      payoutMinor: Number(stakeMinor),
    };
  }

  // WIN: lucro = Math.floor(stake * 85 / 100)
  const stake = Number(stakeMinor);
  const profitMinor = Math.floor((stake * payoutPercentage) / 100);
  const payoutMinor = stake + profitMinor;

  return {
    result: 'WIN',
    profitMinor,
    payoutMinor,
  };
}
