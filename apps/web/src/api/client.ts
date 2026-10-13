import { accessToken, isGuestMode, signIn, userManager } from '../auth/oidc';
import { ASSET_CATALOG, getAssetBasePrice } from '../catalog/assets';
import { safeRandomUUID } from '../lib/uuid';
import { tradingFeedManager } from '../feed/TradingFeedManager';

declare const globalThis: { process?: { env?: { NODE_ENV?: string } } };

export { getAssetBasePrice };

export type Wallet = { currency: 'USD'; available_minor: number; reserved_minor: number };
export type Index = { symbol: string; status: 'ACTIVE' | 'PAUSED' };
export type Candle = { time: number; open: string; high: string; low: string;
  close: string; volume: number };
export type Contract = { id: string; symbol: string; direction: 'UP' | 'DOWN';
  stake_minor: number | string; status: string; result: 'WIN' | 'LOSS' | 'DRAW' | null;
  payout_minor: number | string | null; expires_at: string; created_at: string;
  entry_price?: number | string; strike_price?: number | string };
export type Receipt = {
  id: string;
  expires_at: string;
  status: string;
  strike_price?: number;
  entry_price?: number;
};

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

// Chave versionada de cache local para evitar resíduos descalibrados
const MOCK_STORAGE_KEY = 'synth_mock_store_v3';
const LEGACY_STORAGE_KEYS = ['synth_mock_store', 'synth_mock_store_v2'];

function getSafeSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch { /* ignore */ }
  return null;
}

function getStoredMock(): MockStore {
  const defaultWallet: Wallet = { currency: 'USD', available_minor: 1000000, reserved_minor: 0 };
  const storage = getSafeSessionStorage();
  if (storage) {
    // Purga chaves obsoletas legadas
    for (const legKey of LEGACY_STORAGE_KEYS) {
      try { storage.removeItem(legKey); } catch { /* ignore */ }
    }

    const raw = storage.getItem(MOCK_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as MockStore;
        }
      } catch { /* ignore */ }
    }
  }
  return { wallet: defaultWallet, candles: {}, contracts: [] };
}

function saveStoredMock(store: MockStore) {
  const storage = getSafeSessionStorage();
  if (storage) {
    try {
      storage.setItem(MOCK_STORAGE_KEY, JSON.stringify(store));
    } catch { /* ignore */ }
  }
}

export function isCandlesPriceAligned(candles: Candle[], symbol: string): boolean {
  if (!candles || candles.length === 0) return true;
  const lastBar = candles[candles.length - 1];
  const close = Number(lastBar?.close);
  if (!Number.isFinite(close) || close <= 0) return false;
  const base = getAssetBasePrice(symbol);
  if (!Number.isFinite(base) || base <= 0) return true;
  // Tolerância máxima de 25% entre o preço das velas e o preço base de mercado
  const diffRatio = Math.abs(close - base) / base;
  return diffRatio <= 0.25;
}

// Purgado na Etapa 8: a liquidação oficial é 100% executada pelo backend e Blnk Ledger
export function reconcileGuestContracts(_nowMs: number = Date.now()): {
  settledCount: number;
  settledContracts: Contract[];
} {
  return { settledCount: 0, settledContracts: [] };
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
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('binmax_auth_session');
      }
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
    try {
      const res = await fetch('/api/v1/wallet', { signal: AbortSignal.timeout(4000) });
      if (res.ok) return (await res.json()) as Wallet;
    } catch (_) {}
    const store = getStoredMock();
    return store.wallet;
  }
  return api<Wallet>('/v1/wallet');
};

export const getIndex = async (symbol: string): Promise<Index> => {
  if (isGuestMode()) {
    return { symbol: symbol || 'VOL_50', status: 'ACTIVE' };
  }
  return api<Index>(`/indices/${encodeURIComponent(symbol)}`);
};

// Gerador pseudo-aleatório com semente determinística (Mulberry32)
function createSeededPrng(seed: number) {
  let s = (seed >>> 0) || 123456789;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Transformada de Box-Muller para ruído gaussiano N(0, 1)
function boxMuller(rng: () => number): number {
  let u1 = rng();
  const u2 = rng();
  while (u1 <= 1e-15) u1 = rng();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

function hashSymbol(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generateSeedCandles(
  symbol: string,
  count: number = 120,
  endTimestamp?: number
): Candle[] {
  const base = getAssetBasePrice(symbol);
  const isRetroactive = Boolean(endTimestamp && Number.isFinite(endTimestamp) && endTimestamp > 0);
  const anchorTime = isRetroactive
    ? Math.floor(endTimestamp! / 60) * 60
    : Math.floor(Date.now() / 60000) * 60;
  const candles: Candle[] = [];
  const isForexJpy = symbol.includes('JPY');
  const isCrypto = symbol.startsWith('BTC') || symbol.startsWith('ETH');
  const isCommodity = symbol.startsWith('XAU') || symbol.startsWith('XAG') || symbol.startsWith('OIL');
  const isSynth = symbol.startsWith('SYNTH');
  const precision = isCrypto ? 2 : isForexJpy ? 3 : base > 500 ? 2 : 5;

  // Parâmetro sigma (volatilidade típica por candle de 1m)
  const sigma = isCrypto
    ? base * 0.0018
    : isForexJpy
    ? base * 0.0006
    : isCommodity
    ? base * 0.001
    : isSynth
    ? base * 0.0012
    : base * 0.0005;

  const rng = createSeededPrng(hashSymbol(symbol) ^ (anchorTime & 0xffffff00));
  let currentPrice = base;
  let momentum = 0;
  const theta = 0.025; // Força de reversão à média

  // Pré-aquecimento de 30 passos para estabilização de Ornstein-Uhlenbeck
  for (let p = 0; p < 30; p++) {
    const z = boxMuller(rng);
    momentum = 0.45 * momentum + 0.55 * z;
    const delta = theta * (base - currentPrice) + sigma * momentum;
    currentPrice = Math.max(base * 0.2, currentPrice + delta);
  }

  // Gera as velas ordenadas no tempo (do mais antigo para o mais recente)
  // Se for retroativo ("before"), o último candle deve terminar em anchorTime - 60
  const lastMinute = isRetroactive ? anchorTime - 60 : anchorTime;
  const startTime = lastMinute - (count - 1) * 60;
  for (let i = 0; i < count; i++) {
    const time = startTime + i * 60;
    const zClose = boxMuller(rng);
    momentum = 0.4 * momentum + 0.6 * zClose;
    const delta = theta * (base - currentPrice) + sigma * momentum;
    const open = currentPrice;
    const close = Math.max(base * 0.05, open + delta);

    // Pavios assimétricos com meia-normal
    const zHigh = Math.abs(boxMuller(rng));
    const zLow = Math.abs(boxMuller(rng));
    const wickHigh = zHigh * sigma * 0.65;
    const wickLow = zLow * sigma * 0.65;

    const high = Math.max(open, close) + wickHigh;
    const low = Math.max(base * 0.01, Math.min(open, close) - wickLow);
    currentPrice = close;

    // Volume estocástico proporcional à amplitude da vela
    const bodySize = Math.abs(close - open) / (sigma || 1);
    const volume = Math.max(10, Math.floor(25 + bodySize * 45 + rng() * 30));

    candles.push({
      time,
      open: open.toFixed(precision),
      high: high.toFixed(precision),
      low: low.toFixed(precision),
      close: close.toFixed(precision),
      volume,
    });
  }
  return candles;
}

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
      if (Array.isArray(data) && data.length === 0) return [];
      if (Array.isArray(data) && data.length > 0 && isCandlesPriceAligned(data, symbol)) {
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
    if (typeof globalThis.process !== 'undefined' && globalThis.process.env?.NODE_ENV !== 'test') {
      console.warn(`[getCandles] Falha ao buscar velas remotas para ${symbol}:`, err);
    }
  }

  // 2. Se for modo autenticado e a requisição direta falhar, tentar via cliente autenticado
  if (!isGuestMode()) {
    try {
      const authData = await api<Candle[]>(url.replace('/api', ''));
      if (Array.isArray(authData) && authData.length > 0 && isCandlesPriceAligned(authData, symbol)) {
        return authData;
      }
    } catch {
      // Ignora erro e recorre ao fallback
    }
  }

  if (import.meta.env.VITE_DEMO_OFFLINE_FEED !== '1') return [];

  // 3. Cache e preços simulados somente no modo offline explicitamente selecionado
  if (isGuestMode()) {
    const store = getStoredMock();
    const cacheKey = `${symbol}:${interval}`;
    let all = store.candles[cacheKey] ?? store.candles[symbol] ?? [];

    // Sanitização de sanidade de preço: purga automática se divergir do preço base (>25%)
    if (all.length > 0 && !isCandlesPriceAligned(all, symbol)) {
      delete store.candles[cacheKey];
      delete store.candles[symbol];
      saveStoredMock(store);
      all = [];
    }

    if (all.length === 0) {
      all = generateSeedCandles(symbol, safeLimit);
      store.candles[cacheKey] = all;
      store.candles[symbol] = all;
      saveStoredMock(store);
    }
    if (before && Number.isFinite(before)) {
      const filtered = all.filter((c) => Number(c.time) < before);
      if (filtered.length >= safeLimit) {
        return filtered.slice(-safeLimit);
      }
      // Gera lote retroativo determinístico contíguo
      const historicalChunk = generateSeedCandles(symbol, safeLimit, before);
      const existingMap = new Map(all.map((c) => [Number(c.time), c]));
      historicalChunk.forEach((c) => existingMap.set(Number(c.time), c));
      all = Array.from(existingMap.values()).sort((a, b) => Number(a.time) - Number(b.time));
      store.candles[cacheKey] = all;
      store.candles[symbol] = all;
      saveStoredMock(store);
      return historicalChunk;
    }
    return all.slice(-safeLimit);
  }

  if (before && Number.isFinite(before)) {
    return generateSeedCandles(symbol, safeLimit, before);
  }
  return generateSeedCandles(symbol, safeLimit);
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
    try {
      const res = await fetch(`/api/v1/contracts?limit=100${filter ? `&result=${encodeURIComponent(filter)}` : ''}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const body = await res.json();
        return Array.isArray(body) ? body : (body.contracts || []);
      }
    } catch (_) {}
    const store = getStoredMock();
    if (!filter) return store.contracts;
    return store.contracts.filter((c) => c.result === filter);
  }
  return api<Contract[]>(
    `/contracts?limit=100${filter ? `&result=${encodeURIComponent(filter)}` : ''}`);
};

export const getContract = async (id: string): Promise<Contract> => {
  if (isGuestMode()) {
    try {
      const res = await fetch(`/api/v1/contracts/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return await res.json();
    } catch (_) {}
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
    try {
      const contractBody: Record<string, unknown> = {
        symbol,
        direction,
        stake_minor: stakeMinor,
        duration_seconds: durationSeconds,
        expiry_mode: expiryMode,
      };
      if (targetExpiresAt) {
        contractBody.target_expires_at = targetExpiresAt;
      }
      const res = await fetch('/api/v1/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(contractBody),
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const body = await res.json();
        const contract = (body.contract || body) as Record<string, unknown>;
        const rawStrike = contract.strike_price ?? contract.entry_price ?? (body as any)?.strike_price;
        const numStrike = typeof rawStrike === 'number' ? rawStrike : (typeof rawStrike === 'string' ? parseFloat(rawStrike) : undefined);
        return {
          id: String(contract.id || key),
          status: String(contract.status || 'OPEN'),
          expires_at: String(contract.expires_at || expiresAt),
          strike_price: numStrike,
          entry_price: numStrike,
        };
      }
    } catch (_) {}

    // Fallback gracioso offline sem simulação de vitória/derrota pelo cliente
    const store = getStoredMock();
    if (store.wallet.available_minor < stakeMinor) {
      throw new ApiError(400, 'INSUFFICIENT_BALANCE');
    }

    store.wallet.available_minor -= stakeMinor;
    store.wallet.reserved_minor += stakeMinor;
    const contractId = 'guest_' + safeRandomUUID().slice(0, 8);
    const lastTickPrice = tradingFeedManager.getLastPrice(symbol);
    const entryPrice = lastTickPrice ? Number(lastTickPrice) : 500;

    const newContract: Contract = {
      id: contractId,
      symbol,
      direction,
      stake_minor: stakeMinor,
      status: 'OPEN',
      result: null,
      payout_minor: null,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
      entry_price: entryPrice,
      strike_price: entryPrice,
    };

    store.contracts.unshift(newContract);
    saveStoredMock(store);
    broadcastMockPrivate({ type: 'wallet_balance', available_minor: store.wallet.available_minor });

    return {
      id: contractId,
      expires_at: expiresAt,
      status: 'OPEN',
      strike_price: entryPrice,
      entry_price: entryPrice,
    };
  }

  const contractBody: Record<string, unknown> = {
    symbol,
    direction,
    stake_minor: stakeMinor,
    duration_seconds: durationSeconds,
    expiry_mode: expiryMode,
  };
  if (targetExpiresAt) {
    contractBody.target_expires_at = targetExpiresAt;
  }

  const envelope = await api<{ contract?: unknown }>('/v1/contracts', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(contractBody),
  });
  const value = envelope?.contract;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(502, 'INVALID_CONTRACT_RESPONSE');
  }
  const contract = value as Record<string, unknown>;
  const { id, status, expires_at: expiry } = contract;
  const iso = typeof expiry === 'string'
    ? /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(expiry)
    : null;
  const calendarTime = iso ? Date.parse(`${iso[1]}Z`) : NaN;
  if (typeof id !== 'string' || !id.trim() || typeof status !== 'string' || !status.trim()
      || typeof expiry !== 'string' || !iso || !Number.isFinite(Date.parse(expiry))
      || !Number.isFinite(calendarTime) || !new Date(calendarTime).toISOString().startsWith(iso[1])) {
    throw new ApiError(502, 'INVALID_CONTRACT_RESPONSE');
  }
  const rawStrike = contract.strike_price ?? contract.entry_price ?? (envelope as any)?.strike_price;
  const numStrike = typeof rawStrike === 'number' ? rawStrike : (typeof rawStrike === 'string' ? parseFloat(rawStrike) : undefined);
  return { id, status, expires_at: expiry, strike_price: numStrike, entry_price: numStrike };
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

// ─── Cashier & Wallet Transactions API ────────────────────────────────────────

export type DepositMethod = 'PIX' | 'CARD' | 'CRYPTO' | 'BANK';
export type WithdrawMethod = 'PIX' | 'BANK' | 'CRYPTO';

export interface WalletTransaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  method: string;
  amount_minor: number;
  fee_minor: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  destination_account?: string;
  created_at: string;
}

export interface DepositResponse {
  success: boolean;
  transaction: {
    id: string;
    type: 'DEPOSIT';
    method: DepositMethod;
    amount_minor: number;
    status: 'PENDING';
    pix_code?: string;
    expires_at?: string;
  };
}

export interface DepositConfirmResponse {
  success: boolean;
  transaction_id: string;
  status: 'COMPLETED';
  new_balance_minor: number;
}

export interface WithdrawResponse {
  success: boolean;
  transaction: {
    id: string;
    type: 'WITHDRAWAL';
    method: WithdrawMethod;
    amount_minor: number;
    status: 'PENDING';
    destination_account: string;
  };
  new_balance_minor: number;
}

export async function requestDeposit(params: {
  amount_minor: number;
  method?: DepositMethod;
  idempotency_key?: string;
}): Promise<DepositResponse> {
  const key = params.idempotency_key || ('idem_dep_' + safeRandomUUID());
  return api<DepositResponse>('/v1/wallet/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(params),
  });
}

export async function confirmDeposit(transactionId: string): Promise<DepositConfirmResponse> {
  return api<DepositConfirmResponse>('/v1/wallet/deposit/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
}

export async function requestWithdrawal(params: {
  amount_minor: number;
  method?: WithdrawMethod;
  destination_account: string;
  idempotency_key?: string;
}): Promise<WithdrawResponse> {
  const key = params.idempotency_key || ('idem_wth_' + safeRandomUUID());
  return api<WithdrawResponse>('/v1/wallet/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body: JSON.stringify(params),
  });
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  return api<WalletTransaction[]>('/v1/wallet/transactions');
}

// ─── KYC, Tournaments & Promotions API (Etapa 5) ──────────────────────────────

export type KycStatusType = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';

export interface KycStatusResponse {
  identity_status: KycStatusType;
  address_status: KycStatusType;
  document_type?: string;
  document_number?: string;
  uploaded_files?: Array<{ name: string; category: string; uploaded_at: string }>;
  submitted_at?: string;
}

export interface KycSubmitParams {
  category: 'identity' | 'address';
  file_name: string;
  document_type?: string;
  document_number?: string;
}

export interface TournamentItem {
  id: string;
  name: string;
  status: 'EN_VIVO' | 'PROXIMO' | 'FINALIZADO';
  prizeFormatted: string;
  participants: number;
  timeRemaining: string;
  rules: {
    period: string;
    depositRequired: string;
    operationType: string;
    criteria: string;
    minOperations: number;
  };
  prizes: { position: string; prize: string }[];
  leaderboard: { rank: number; name: string; country: string; returnPct: string; ops: number }[];
  userJoined?: boolean;
}

export interface PromotionItem {
  id: string;
  title: string;
  badge: string;
  value: string;
  subtext: string;
  description: string;
  requirements: string[];
  actionText: string;
  isActive?: boolean;
}

export async function getKycStatus(): Promise<KycStatusResponse> {
  return api<KycStatusResponse>('/v1/kyc/status');
}

export async function submitKycDocument(params: KycSubmitParams): Promise<KycStatusResponse> {
  return api<KycStatusResponse>('/v1/kyc/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function getTournaments(): Promise<TournamentItem[]> {
  return api<TournamentItem[]>('/v1/tournaments');
}

export async function joinTournament(tournamentId: string): Promise<{ success: boolean; tournament_id: string; joined: boolean }> {
  return api<{ success: boolean; tournament_id: string; joined: boolean }>(`/v1/tournaments/${encodeURIComponent(tournamentId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function getPromotions(): Promise<PromotionItem[]> {
  return api<PromotionItem[]>('/v1/promotions');
}

export async function activatePromotion(promoId: string): Promise<{ success: boolean; promo_id: string; status: string }> {
  return api<{ success: boolean; promo_id: string; status: string }>(`/v1/promotions/${encodeURIComponent(promoId)}/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Analytics & Performance Telemetry API (Etapa 6) ─────────────────────────

export interface UserAnalyticsDailyItem {
  day: string;
  date: string;
  profit: number;
  ops: number;
}

export interface UserAnalyticsAssetItem {
  symbol: string;
  name: string;
  winRate: number;
  ops: number;
  profit: string;
}

export interface UserAnalyticsHourlyItem {
  slot: string;
  rate: number;
  ops: number;
  isBest?: boolean;
}

export interface UserAnalyticsResponse {
  has_data: boolean;
  period: '7d' | '30d' | 'all';
  total_ops: number;
  win_ops: number;
  loss_ops: number;
  draw_ops: number;
  win_rate: number;
  net_profit_minor: number;
  current_streak: number;
  max_streak: number;
  max_win_minor: number;
  max_loss_minor: number;
  avg_trade_profit_minor: number;
  daily: UserAnalyticsDailyItem[];
  assets: UserAnalyticsAssetItem[];
  hourly: UserAnalyticsHourlyItem[];
  best_time_window: string | null;
}

export async function getUserAnalytics(period: '7d' | '30d' | 'all' = '30d'): Promise<UserAnalyticsResponse> {
  return api<UserAnalyticsResponse>(`/v1/analytics/performance?period=${period}`);
}




