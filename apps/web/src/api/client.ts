import { accessToken, isGuestMode, signIn, userManager } from '../auth/oidc';

export type Wallet = { currency: 'USD'; available_minor: number; reserved_minor: number };
export type Index = { symbol: string; status: 'ACTIVE' | 'PAUSED' };
export type Candle = { time: number; open: string; high: string; low: string;
  close: string; volume: number };
export type Contract = { id: string; symbol: string; direction: 'UP' | 'DOWN';
  stake_minor: number | string; status: string; result: 'WIN' | 'LOSS' | 'DRAW' | null;
  payout_minor: number | string | null; expires_at: string; created_at: string;
  entry_price?: number | string; strike_price?: number | string };
export type Receipt = { id: string; expires_at: string; status: string };

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

// Guest Mode In-Memory / Session Storage Engine
type MockStore = {
  wallet: Wallet;
  candles: Record<string, Candle[]>;
  contracts: Contract[];
};

const listeners = new Set<(event: { type: string; [key: string]: unknown }) => void>();
export function onMockPrivateEvent(listener: (event: { type: string; [key: string]: unknown }) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function broadcastMockPrivate(event: { type: string; [key: string]: unknown }) {
  for (const listener of listeners) listener(event);
}

// Removido qualquer gerador de cotação simulada no cliente (A-07 / Menor 8)

function getStoredMock(): MockStore {
  const defaultWallet: Wallet = { currency: 'USD', available_minor: 1000000, reserved_minor: 0 };
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('synth_mock_store_v4') : null;
  if (raw) {
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  return { wallet: defaultWallet, candles: {}, contracts: [] };
}

function saveStoredMock(store: MockStore) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('synth_mock_store_v4', JSON.stringify(store));
  }
}

export function resetMockWallet(): Wallet {
  const store = getStoredMock();
  store.wallet = { currency: 'USD', available_minor: 1000000, reserved_minor: 0 };
  saveStoredMock(store);
  broadcastMockPrivate({ type: 'wallet_balance', available_minor: 1000000 });
  return store.wallet;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const send = (bearer: string) => fetch(`/api${path}`, { ...init,
    headers: { ...init.headers, Authorization: `Bearer ${bearer}` },
    signal: init.signal ?? AbortSignal.timeout(8000),
  });
  let response = await send(token);
  if (response.status === 401) {
    try {
      const renewed = await userManager.signinSilent();
      if (!renewed?.access_token) throw new Error('RENEW_FAILED');
      response = await send(renewed.access_token);
    } catch {
      void signIn();
      throw new ApiError(401, 'AUTH_REQUIRED');
    }
  }
  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    try { code = (await response.json()).code ?? code; } catch { /* No trusted error body. */ }
    throw new ApiError(response.status, code);
  }
  const value = await response.json();
  if (value?.code === 'WALLET_PROVISIONING')
    throw new ApiError(202, 'WALLET_PROVISIONING');
  return value as T;
}

export const getWallet = async (): Promise<Wallet> => {
  if (isGuestMode()) {
    const store = getStoredMock();
    return store.wallet;
  }
  return api<Wallet>('/wallet');
};

export const getIndex = async (symbol: string): Promise<Index> => {
  if (isGuestMode()) {
    return { symbol: symbol || 'SYNTH_VOL_50', status: 'ACTIVE' };
  }
  return api<Index>(`/indices/${encodeURIComponent(symbol)}`);
};

// Base prices, precision and calibrated volatility for realistic historical generation
const BASE_PRICES: Record<string, { price: number; precision: number; sigma: number }> = {
  // Forex OTC (18)
  EURUSD_OTC: { price: 1.08542, precision: 5, sigma: 0.00018 },
  GBPUSD_OTC: { price: 1.29415, precision: 5, sigma: 0.00020 },
  USDJPY_OTC: { price: 153.820, precision: 3, sigma: 0.00018 },
  USDCHF_OTC: { price: 0.86510, precision: 5, sigma: 0.00017 },
  AUDUSD_OTC: { price: 0.65820, precision: 5, sigma: 0.00019 },
  USDCAD_OTC: { price: 1.38450, precision: 5, sigma: 0.00018 },
  NZDUSD_OTC: { price: 0.59820, precision: 5, sigma: 0.00019 },
  EURGBP_OTC: { price: 0.83850, precision: 5, sigma: 0.00016 },
  EURJPY_OTC: { price: 166.950, precision: 3, sigma: 0.00020 },
  GBPJPY_OTC: { price: 199.120, precision: 3, sigma: 0.00022 },
  EURCAD_OTC: { price: 1.50280, precision: 5, sigma: 0.00019 },
  EURAUD_OTC: { price: 1.64890, precision: 5, sigma: 0.00020 },
  GBPAUD_OTC: { price: 1.96620, precision: 5, sigma: 0.00021 },
  GBPCAD_OTC: { price: 1.79210, precision: 5, sigma: 0.00020 },
  AUDCAD_OTC: { price: 0.91120, precision: 5, sigma: 0.00018 },
  AUDJPY_OTC: { price: 101.250, precision: 3, sigma: 0.00019 },
  CADJPY_OTC: { price: 111.120, precision: 3, sigma: 0.00019 },
  NZDJPY_OTC: { price: 92.050, precision: 3, sigma: 0.00019 },

  // Cripto OTC (8)
  BTCUSD_OTC: { price: 64850.00, precision: 2, sigma: 0.00065 },
  ETHUSD_OTC: { price: 3450.00, precision: 2, sigma: 0.00075 },
  SOLUSD_OTC: { price: 152.40, precision: 2, sigma: 0.00090 },
  BNBUSD_OTC: { price: 585.00, precision: 2, sigma: 0.00055 },
  XRPUSD_OTC: { price: 0.5420, precision: 4, sigma: 0.00085 },
  ADAUSD_OTC: { price: 0.3540, precision: 4, sigma: 0.00085 },
  DOGEUSD_OTC: { price: 0.1240, precision: 4, sigma: 0.00110 },
  AVAXUSD_OTC: { price: 28.40, precision: 2, sigma: 0.00095 },

  // Commodities OTC (4)
  XAUUSD_OTC: { price: 2652.80, precision: 2, sigma: 0.00030 },
  XAGUSD_OTC: { price: 31.750, precision: 3, sigma: 0.00045 },
  USOIL_OTC: { price: 72.40, precision: 2, sigma: 0.00040 },
  UKOIL_OTC: { price: 76.20, precision: 2, sigma: 0.00040 },

  // Sintéticos (6)
  SYNTH_VOL_10: { price: 100.5420, precision: 4, sigma: 0.00015 },
  SYNTH_VOL_25: { price: 250.8410, precision: 4, sigma: 0.00030 },
  SYNTH_VOL_50: { price: 500.1250, precision: 4, sigma: 0.00060 },
  SYNTH_VOL_75: { price: 750.3200, precision: 4, sigma: 0.00085 },
  SYNTH_VOL_100: { price: 1000.4500, precision: 4, sigma: 0.00110 },
  SYNTH_CRASH_BOOM_100: { price: 1000.8200, precision: 4, sigma: 0.00130 },
};

function createSeededRandom(seedStr: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0;
  }
  return function() {
    let t = (h += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextGaussian(rand: () => number) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function generateInitialCandles(symbol: string): Candle[] {
  const meta = BASE_PRICES[symbol] ?? { price: 500, precision: 4, sigma: 0.0005 };
  const base = meta.price;
  const prec = meta.precision;
  const sigma = meta.sigma;
  const rand = createSeededRandom(symbol + '_prime_market_v3');
  const nowMinute = Math.floor(Date.now() / 60000) * 60;
  const bars: Candle[] = [];
  let currentClose = base;

  for (let i = 0; i < 80; i++) {
    const t = nowMinute - (i * 60);
    const z = nextGaussian(rand);
    const step = z * (currentClose * sigma);
    const openVal = Math.max(currentClose * 0.01, currentClose - step);
    const bodyTop = Math.max(openVal, currentClose);
    const bodyBottom = Math.min(openVal, currentClose);

    const wickHigh = Math.abs(nextGaussian(rand)) * (currentClose * sigma * 0.7);
    const wickLow = Math.abs(nextGaussian(rand)) * (currentClose * sigma * 0.7);
    const highVal = bodyTop + wickHigh;
    const lowVal = Math.max(currentClose * 0.01, bodyBottom - wickLow);

    bars.unshift({
      time: t,
      open: openVal.toFixed(prec),
      high: highVal.toFixed(prec),
      low: lowVal.toFixed(prec),
      close: currentClose.toFixed(prec),
      volume: Math.floor(80 + rand() * 240),
    });

    currentClose = openVal;
  }
  return bars;
}

export const getCandles = async (symbol: string): Promise<Candle[]> => {
  // 1. Tenta obter o histórico sincronizado do servidor oficial
  try {
    const res = await fetch(`/api/candles?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=100`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (isGuestMode()) {
          const store = getStoredMock();
          store.candles[symbol] = data;
          saveStoredMock(store);
        }
        return data;
      }
    }
  } catch {
    // Falha silenciosa no fetch
  }

  // 2. Fallback resiliente com gerador estocástico realista seeded
  if (isGuestMode()) {
    const store = getStoredMock();
    if (!store.candles[symbol] || store.candles[symbol].length === 0) {
      store.candles[symbol] = generateInitialCandles(symbol);
      saveStoredMock(store);
    }
    return store.candles[symbol];
  }
  return api<Candle[]>(
    `/candles?symbol=${encodeURIComponent(symbol)}&interval=1m&limit=100`);
};

export const getContracts = async (filter: string): Promise<Contract[]> => {
  if (isGuestMode()) {
    const store = getStoredMock();
    if (!filter) return store.contracts;
    return store.contracts.filter((c) => c.result === filter);
  }
  return api<Contract[]>(
    `/contracts?limit=100${filter ? `&result=${encodeURIComponent(filter)}` : ''}`);
};

export const getContract = async (id: string): Promise<Contract> => {
  if (isGuestMode()) {
    const store = getStoredMock();
    const found = store.contracts.find((c) => c.id === id);
    if (!found) throw new ApiError(404, 'CONTRACT_NOT_FOUND');
    return found;
  }
  return api<Contract>(`/contracts/${encodeURIComponent(id)}`);
};

export const openContract = async (symbol: string, direction: 'UP' | 'DOWN',
  stakeMinor: number, key: string): Promise<Receipt> => {
  if (isGuestMode()) {
    const store = getStoredMock();
    if (store.wallet.available_minor < stakeMinor) {
      throw new ApiError(400, 'INSUFFICIENT_BALANCE');
    }
    store.wallet.available_minor -= stakeMinor;
    store.wallet.reserved_minor += stakeMinor;
    const contractId = 'guest_' + crypto.randomUUID().slice(0, 8);
    const nowIso = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const lastCandle = store.candles[symbol]?.slice(-1)[0];
    const entryPrice = lastCandle ? Number(lastCandle.close) : 500;

    const newContract: Contract = {
      id: contractId,
      symbol,
      direction,
      stake_minor: stakeMinor,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: expiresAt,
      created_at: nowIso,
      entry_price: entryPrice,
      strike_price: entryPrice,
    };
    store.contracts.unshift(newContract);
    saveStoredMock(store);
    broadcastMockPrivate({ type: 'wallet_balance', available_minor: store.wallet.available_minor });

    // Liquidação automática após a expiração (60s)
    setTimeout(() => {
      const curStore = getStoredMock();
      const target = curStore.contracts.find((c) => c.id === contractId);
      if (target && target.status === 'OPEN') {
        const curCandle = curStore.candles[symbol]?.slice(-1)[0];
        const exitPrice = curCandle ? Number(curCandle.close) : entryPrice;
        const won = (direction === 'UP' && exitPrice > entryPrice) ||
                    (direction === 'DOWN' && exitPrice < entryPrice);
        const draw = exitPrice === entryPrice;
        const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
        const payoutMinor = won ? Math.round(stakeMinor * 1.85) : draw ? stakeMinor : 0;

        target.status = 'SETTLED';
        target.result = result;
        target.payout_minor = payoutMinor;

        curStore.wallet.reserved_minor = Math.max(0, curStore.wallet.reserved_minor - stakeMinor);
        curStore.wallet.available_minor += payoutMinor;
        saveStoredMock(curStore);

        broadcastMockPrivate({ type: 'wallet_balance', available_minor: curStore.wallet.available_minor });
        broadcastMockPrivate({
          type: 'contract_settled',
          contract_id: contractId,
          result,
          payout_minor: payoutMinor,
        });
      }
    }, 60_000);

    return { id: contractId, expires_at: expiresAt, status: 'OPEN' };
  }
  return api<Receipt>('/contracts', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({ symbol, direction, stake_minor: stakeMinor }),
  });
};
