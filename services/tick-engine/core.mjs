import { randomBytes, createHash } from 'node:crypto';

/**
 * CSPRNG Random Source utilizando crypto.randomBytes (Invariantes M-01, B-06).
 * Proibição absoluta de Math.random().
 */
export function nextGaussian() {
  const buffer = randomBytes(8);
  const u1 = (buffer.readUInt32BE(0) + 1) / 4294967297.0; // (0, 1]
  const u2 = (buffer.readUInt32BE(4) + 1) / 4294967297.0; // (0, 1]
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Cria o gerador estocástico GBM sem drift (mu = 0) com correção de Itô.
 * Propriedade de Martingale preservada: E[p_{t+1} | p_t] = p_t.
 */
export function createPriceGenerator() {
  return function generatePrice(currentPrice, sigma = 0.00015, precision = 4) {
    const current = Number(currentPrice);
    if (!Number.isFinite(current) || current <= 0) {
      throw new Error(`Invalid current price: ${currentPrice}`);
    }

    const dt = 1.0;
    const z = nextGaussian();
    const itoDrift = -0.5 * (sigma ** 2) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    const next = current * Math.exp(itoDrift + diffusion);

    // Barreira estrita: impede preço não positivo
    const minPrice = current * 0.01;
    const clamped = next < minPrice ? minPrice : next;

    return clamped.toFixed(precision);
  };
}

/**
 * Hash de gênese canônico determinístico: SHA-256("genesis|" + symbol).
 */
export function genesisHash(symbol) {
  return createHash('sha256')
    .update(`genesis|${symbol}`, 'utf8')
    .digest('hex');
}

/**
 * Incremento monotônico estrito de sequência por ativo.
 */
export function nextSequence(lastSeq) {
  return Number(lastSeq) + 1;
}

/**
 * Serialização canônica determinística do elo da cadeia de hash:
 * prev_hash|symbol|sequence|ts_iso|price
 */
export function canonicalHash(prevHash, symbol, sequence, ts, price) {
  const payload = `${prevHash}|${symbol}|${sequence}|${ts}|${price}`;
  return createHash('sha256')
    .update(payload, 'utf8')
    .digest('hex');
}
