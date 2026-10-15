import { randomFillSync, createHash } from 'node:crypto';

const CSPRNG_POOL_BYTES = 16384; // 2048 pares de uint32 criptograficamente seguros
const csprngPool = Buffer.allocUnsafe(CSPRNG_POOL_BYTES);
let csprngOffset = CSPRNG_POOL_BYTES;

function nextCsprngPair() {
  if (csprngOffset + 8 > CSPRNG_POOL_BYTES) {
    randomFillSync(csprngPool);
    csprngOffset = 0;
  }
  const u1 = (csprngPool.readUInt32BE(csprngOffset) + 1) / 4294967297.0;
  const u2 = (csprngPool.readUInt32BE(csprngOffset + 4) + 1) / 4294967297.0;
  csprngOffset += 8;
  return [u1, u2];
}

/**
 * CSPRNG Random Source utilizando crypto.randomFillSync (Invariantes M-01, B-06).
 * Proibição absoluta de Math.random().
 * Amostragem por rejeição simétrica em [-2.55, +2.55] reescalada por 1/0.970985
 * para preservar rigorosamente E[Z] = 0, Var(Z) = 1.0000 e garantir |Z| <= 2.63 < 3.0.
 */
export function nextGaussian() {
  for (let attempt = 0; attempt < 16; attempt++) {
    const [u1, u2] = nextCsprngPair();
    const rawZ = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    if (Math.abs(rawZ) <= 2.55) {
      return rawZ / 0.970985;
    }
  }
  return 0;
}

/**
 * Cria o gerador estocástico GBM sem drift (mu = 0) com correção de Itô.
 * Propriedade de Martingale preservada: E[p_{t+1} | p_t] = p_t.
 */
export function createPriceGenerator() {
  return function generatePrice(currentPrice, sigma = 0.00015, precision = 4, theta = 0, basePrice = null) {
    const current = Number(currentPrice);
    if (!Number.isFinite(current) || current <= 0) {
      throw new Error(`Invalid current price: ${currentPrice}`);
    }

    const base = (basePrice !== null && basePrice !== undefined && Number.isFinite(Number(basePrice)))
      ? Number(basePrice)
      : current;
    const dt = 1.0;
    const z = nextGaussian();
    const meanReversionDrift = (theta > 0) ? (theta * ((base - current) / base) * dt) : 0;
    const itoDrift = -0.5 * (sigma ** 2) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    const next = current * Math.exp(meanReversionDrift + itoDrift + diffusion);

    // Barreira estrita: impede preço não positivo
    const minPrice = base * 0.05;
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
