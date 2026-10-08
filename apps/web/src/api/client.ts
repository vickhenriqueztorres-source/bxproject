import { accessToken, isGuestMode, signIn, userManager } from '../auth/oidc';
import { ASSET_CATALOG } from '../catalog/assets';
import { safeRandomUUID } from '../lib/uuid';
import { tradingFeedManager } from '../feed/TradingFeedManager';

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
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('synth_mock_store') : null;
  if (raw) {
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  return { wallet: defaultWallet, candles: {}, contracts: [] };
}

function saveStoredMock(store: MockStore) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('synth_mock_store', JSON.stringify(store));
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
  let token: string;
  try {
    token = await accessToken();
  } catch {
    throw new ApiError(401, 'AUTH_REQUIRED');
  }
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

export const getCandles = async (
  symbol: string,
  interval: string = '1m',
  limit: number = 2880,
  before?: number
): Promise<Candle[]> => {
  const apiInterval = /^[1-9]\d{0,6}[mhd]$/.test(interval) ? interval : '1m';
  const safeLimit = Math.min(Math.max(1, limit || 2880), 10080);
  const params = new URLSearchParams({
    symbol,
    interval: apiInterval,
    limit: String(safeLimit),
  });
  if (before && Number.isFinite(before) && before > 0) {
    params.set('before', String(Math.floor(before)));
  }
  const url = `/api/candles?${params.toString()}`;

  // 1. Busca direta no endpoint público de velas (disponível tanto no gateway quanto em dev)
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (isGuestMode()) {
          const store = getStoredMock();
          store.candles[`${symbol}:${interval}`] = data;
          store.candles[symbol] = data;
          saveStoredMock(store);
        }
        return data as Candle[];
      }
    }
  } catch (err) {
    console.warn(`[getCandles] Falha ao buscar velas remotas para ${symbol}:`, err);
  }

  // 2. Se for modo autenticado e a requisição direta falhar, tentar via cliente autenticado
  if (!isGuestMode()) {
    try {
      return await api<Candle[]>(url.replace('/api', ''));
    } catch {
      // Ignora erro e recorre ao fallback
    }
  }

  // 3. Fallback para cache em sessionStorage se em modo convidado
  if (isGuestMode()) {
    const store = getStoredMock();
    let all = store.candles[`${symbol}:${interval}`] ?? store.candles[symbol] ?? [];
    if (before && Number.isFinite(before)) {
      all = all.filter((c) => Number(c.time) < before);
    }
    return all.slice(-safeLimit);
  }

  return [];
};

export const fetchHistoricalCandlesChunk = async (
  symbol: string,
  beforeTimestamp: number,
  count: number = 1000
): Promise<Candle[]> => {
  return getCandles(symbol, '1m', count, beforeTimestamp);
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

export const openContract = async (
  symbol: string,
  direction: 'UP' | 'DOWN',
  stakeMinor: number,
  key: string,
  durationSeconds: number = 60,
  targetExpiresAt?: string,
  expiryMode: string = '1M_FIXED'
): Promise<Receipt> => {
  // PISO INVIOLÁVEL: NUNCA MENOS DE 30 SEGUNDOS
  const durationMs = Math.max(30_000, durationSeconds * 1000);
  const expiresAt = targetExpiresAt || new Date(Date.now() + durationMs).toISOString();

  if (isGuestMode()) {
    const store = getStoredMock();
    if (store.wallet.available_minor < stakeMinor) {
      throw new ApiError(400, 'INSUFFICIENT_BALANCE');
    }

    store.wallet.available_minor -= stakeMinor;
    store.wallet.reserved_minor += stakeMinor;
    const contractId = 'guest_' + safeRandomUUID().slice(0, 8);
    const nowIso = new Date().toISOString();

    const lastTickPrice = tradingFeedManager.getLastPrice(symbol);
    const lastCandle = store.candles[symbol]?.slice(-1)[0];
    const assetMeta = ASSET_CATALOG.find((a) => a.symbol === symbol);
    const entryPrice = lastTickPrice ? Number(lastTickPrice) : (lastCandle ? Number(lastCandle.close) : 500);

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

    // Liquidação automática após o vencimento exato do contrato (mínimo absoluto 30s)
    const delayMs = Math.max(30_000, Date.parse(expiresAt) - Date.now());
    setTimeout(() => {
      const curStore = getStoredMock();
      const target = curStore.contracts.find((c) => c.id === contractId);
      if (target && target.status === 'OPEN') {
        const exitTickPrice = tradingFeedManager.getLastPrice(symbol);
        const curCandle = curStore.candles[symbol]?.slice(-1)[0];
        const exitPrice = exitTickPrice ? Number(exitTickPrice) : (curCandle ? Number(curCandle.close) : entryPrice);
        const won = (direction === 'UP' && exitPrice > entryPrice) ||
                    (direction === 'DOWN' && exitPrice < entryPrice);
        const draw = exitPrice === entryPrice;
        const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
        const payoutPct = assetMeta?.payout ?? 85;
        const payoutMinor = won ? Math.round(stakeMinor * (1 + payoutPct / 100)) : draw ? stakeMinor : 0;

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
    }, delayMs);

    return { id: contractId, expires_at: expiresAt, status: 'OPEN' };
  }

  return api<Receipt>('/contracts', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify({
      symbol,
      direction,
      stake_minor: stakeMinor,
      duration_seconds: durationSeconds,
      expires_at: expiresAt,
      expiry_mode: expiryMode,
    }),
  });
};

export const getMarketNews = async (category: string = 'ALL'): Promise<import('../news/news-types').MarketNewsArticle[]> => {
  try {
    const res = await api<import('../news/news-types').MarketNewsArticle[]>(
      `/news${category && category !== 'ALL' ? `?category=${encodeURIComponent(category)}` : ''}`
    );
    if (Array.isArray(res) && res.length > 0) return res;
  } catch {
    // Fallback gracioso offline
  }
  const { FALLBACK_MARKET_NEWS } = await import('../news/news-types');
  if (category && category !== 'ALL') {
    return FALLBACK_MARKET_NEWS.filter((n) => n.category === category);
  }
  return FALLBACK_MARKET_NEWS;
};

