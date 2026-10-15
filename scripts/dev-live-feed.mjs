import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import {
  createPriceGenerator,
  canonicalHash,
  nextSequence,
  genesisHash,
} from '../services/tick-engine/core.mjs';
import {
  recordTickInHistory,
  createSettlementCoordinator,
} from './lib/settlement-engine.mjs';
import { createLiveMarketStore } from '../services/tick-engine/live-market-store.mjs';
import { createWalletReadEngine } from './lib/wallet-read-engine.mjs';
import {
  VALID_INTERVALS_SEC,
  parseIntervalSeconds,
  aggregateTicksToCandles,
  createCandleAggregationCache,
  computeTickDispatchLatencyMs,
  applyTickToCandleBuffer,
} from './lib/candle-aggregation-engine.mjs';
import { createAlignedTickScheduler } from './lib/aligned-tick-scheduler.mjs';
import { createArenaHttpEngine } from './lib/arena-http-engine.mjs';
import {
  ASSETS_CONFIG,
  FEATURE_UNIFIED_CONTINUOUS_MARKET,
  sanitizeBootPrice,
  generateSeededHistoricalCandlesUnified,
  generateForwardGapCandles,
} from './lib/ou-engine.mjs';

const require = createRequire(import.meta.url);
const WebSocket = require('../node_modules/.pnpm/ws@8.22.0/node_modules/ws');
import crypto from 'node:crypto';

let pgPool = null;
try {
  let pgModule;
  try {
    pgModule = require('../node_modules/.pnpm/pg@8.23.1/node_modules/pg');
  } catch {
    pgModule = require('pg');
  }
  const pgClass = pgModule.default || pgModule;
  const Pool = pgClass.Pool;
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://synth_migrator:dev_secret_pw_123@172.18.0.4:5432/broker_platform',
    max: 10,
    connectionTimeoutMillis: 3000,
  });
  pgPool.on('error', (err) => {
    console.error('[DB] Erro no pool do PostgreSQL:', err.message);
  });
} catch (e) {
  console.warn('[DB] Fallback em memória para auth/users:', e.message);
}

let BlnkClient = null;
let blnk = null;
try {
  const blnkModule = require('../services/wallet-adapter/dist/blnk-client.js');
  BlnkClient = blnkModule.BlnkClient;
  const BLNK_URL = process.env.BLNK_URL || 'http://127.0.0.1:5001';
  blnk = new BlnkClient(BLNK_URL, 2500);
  blnk.initializeLedgerAndHouseAccounts().then(() => {
    console.log('[Blnk] Ledger e contas da casa inicializadas com sucesso.');
  }).catch((err) => {
    console.warn('[Blnk] Aviso na inicialização de contas da casa:', err.message);
  });
} catch (bErr) {
  console.warn('[Blnk] Adaptador Blnk não carregado:', bErr.message);
}

const memoryUsers = new Map();
const memoryVerificationCodes = new Map();
memoryUsers.set('demo@binmax.com', {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Usuario Demo Binmax',
  email: 'demo@binmax.com',
  password_hash: crypto.createHash('sha256').update('Demo1234!' + 'c7a8b9f1d2e3456789abcdef01234567').digest('hex'),
  password_salt: 'c7a8b9f1d2e3456789abcdef01234567',
  country_code: 'ES',
  demo_balance_minor: 1000000
});

const JWT_SECRET = process.env.JWT_SECRET || 'binmax_jwt_secure_session_key_2026';

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function createSessionToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    name: user.name,
    email: user.email,
    country: user.country_code || user.country || 'ES',
    roles: ['trader'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 86400)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) return null;
  try {
    const headerObj = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (!headerObj || headerObj.alg !== 'HS256') return null;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data || typeof data.sub !== 'string' || !data.sub.trim()) return null;
    if (data.exp !== undefined && Number(data.exp) < Math.floor(Date.now() / 1000)) return null;
    if (data.iss !== undefined && data.iss !== (process.env.JWT_ISSUER || 'binmax')) return null;
    if (data.aud !== undefined && data.aud !== (process.env.JWT_AUDIENCE || 'binmax-web')) return null;
    return data;
  } catch {
    return null;
  }
}

function extractBearerUser(req) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return verifySessionToken(token);
}

function hasInvalidAuthorizationHeader(req, authData) {
  const rawAuth = req.headers['authorization'];
  if (rawAuth === undefined || rawAuth === '') return false;
  return !authData || !authData.sub;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'Binmax Broker <suporte@binmaxbroker.com>';

function resolveEmailLang(countryCode) {
  const cc = (countryCode || '').toUpperCase().trim();
  if (['BR', 'PT', 'AO', 'MZ'].includes(cc)) return 'pt';
  if (['ES', 'MX', 'CO', 'AR', 'CL', 'PE', 'UY', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA'].includes(cc)) return 'es';
  return 'en';
}

function renderVerificationHtml({ name, code, link, lang }) {
  const content = {
    pt: {
      subject: `Seu código de ativação: ${code} — Binmax Broker`,
      badge: 'VERIFICAÇÃO DE SEGURANÇA',
      headline: `Confirmação de acesso, ${name}`,
      intro: `Para concluir a ativação da sua conta e liberar sua banca demonstrativa de <strong style="color: #22C47A;">$10.000 USD</strong> na sala de operações, utilize o código de segurança abaixo:`,
      codeLabel: 'CÓDIGO DE ATIVAÇÃO:',
      buttonText: 'Confirmar E-mail e Acessar Plataforma',
      footerNote: 'Válido por 15 minutos. Contas verificadas contam com proteção de capital e saques liberados.',
      text: `Olá ${name},\n\nSeu código de ativação Binmax é: ${code}\n\nOu abra este link para ativar em 1 clique:\n${link}\n\nCódigo válido por 15 minutos.\nEquipe Binmax Broker`
    },
    es: {
      subject: `Tu código de activación: ${code} — Binmax Broker`,
      badge: 'VERIFICACIÓN DE SEGURIDAD',
      headline: `Confirmación de acceso, ${name}`,
      intro: `Para completar la activación de tu cuenta y liberar tu saldo de práctica de <strong style="color: #22C47A;">$10.000 USD</strong> en la sala de operaciones, utiliza el código de seguridad:`,
      codeLabel: 'CÓDIGO DE ACTIVACIÓN:',
      buttonText: 'Confirmar Correo y Entrar a la Plataforma',
      footerNote: 'Válido por 15 minutos. Las cuentas verificadas cuentan con retiros prioritarios y protección de capital.',
      text: `Hola ${name},\n\nTu código de activación Binmax es: ${code}\n\nO abre este enlace para activar en 1 clic:\n${link}\n\nCódigo válido por 15 minutos.\nEquipo Binmax Broker`
    },
    en: {
      subject: `Your activation code: ${code} — Binmax Broker`,
      badge: 'SECURITY VERIFICATION',
      headline: `Access confirmation, ${name}`,
      intro: `To complete your account activation and unlock your <strong style="color: #22C47A;">$10,000 USD</strong> practice balance on the trading floor, enter the code below:`,
      codeLabel: 'ACTIVATION CODE:',
      buttonText: 'Verify Email & Open Trading Room',
      footerNote: 'Valid for 15 minutes. Verified accounts enjoy priority withdrawals and capital protection.',
      text: `Hello ${name},\n\nYour Binmax activation code is: ${code}\n\nOr open this link to verify in 1 click:\n${link}\n\nCode valid for 15 minutes.\nBinmax Broker Team`
    }
  }[lang || 'es'];

  return {
    subject: content.subject,
    text: content.text,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${content.subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0F14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F4F5F7;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0D0F14; padding: 48px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #151922; border: 1px solid #232936; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
          <tr>
            <td style="padding: 28px 32px 24px; border-bottom: 1px solid #232936;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="vertical-align: middle;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: middle; padding-right: 12px; line-height: 0;">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="28" height="28" fill="none">
                            <path d="M 9 26 L 24 11 L 39 26" stroke="#DCE1EA" stroke-width="6.5" stroke-linejoin="miter" stroke-linecap="square" />
                            <path d="M 9 41 L 24 26 L 39 41" stroke="#8A92A1" stroke-width="6.5" stroke-linejoin="miter" stroke-linecap="square" />
                          </svg>
                        </td>
                        <td style="vertical-align: middle;">
                          <span style="font-size: 19px; font-weight: 700; letter-spacing: -0.2px; color: #DCE1EA; display: inline-block;">BINMAX</span>
                          <span style="font-size: 10px; font-weight: 600; letter-spacing: 2px; color: #8A92A1; display: inline-block; margin-left: 4px;">BROKER</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="display: inline-block; padding: 4px 10px; font-size: 10px; font-weight: 600; color: #8A92A1; background-color: #0D0F14; border: 1px solid #232936; border-radius: 4px; letter-spacing: 0.8px;">
                      ${content.badge}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 16px; font-size: 19px; font-weight: 600; color: #F4F5F7; line-height: 1.35; letter-spacing: -0.2px;">
                ${content.headline}
              </h1>
              <p style="margin: 0 0 20px; color: #8A92A1; font-size: 14px; line-height: 1.6;">
                ${content.intro}
              </p>
              <div style="background-color: #0D0F14; border: 1px solid #232936; border-radius: 8px; padding: 22px 16px; text-align: center; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 600; color: #8A92A1; letter-spacing: 1.5px; margin-bottom: 10px; text-transform: uppercase;">
                  ${content.codeLabel}
                </div>
                <div style="font-size: 34px; font-weight: 700; letter-spacing: 8px; color: #F4F5F7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; display: inline-block;">
                  ${code}
                </div>
              </div>
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 14px;">
                <tr>
                  <td align="center">
                    <a href="${link}" style="display: block; width: 100%; box-sizing: border-box; background-color: #22C47A; color: #0D0F14; text-align: center; padding: 13px 24px; border-radius: 6px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; text-decoration: none;">
                      ${content.buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 18px 0 0; font-size: 12px; color: #8A92A1; text-align: center; line-height: 1.5;">
                ${content.footerNote}
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #0D0F14; padding: 22px 32px; border-top: 1px solid #232936; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #8A92A1; line-height: 1.4;">
                © 2026 Binmax Broker. Todos os direitos reservados.
              </p>
              <p style="margin: 0; font-size: 10px; color: #535B6A; line-height: 1.4;">
                Aviso de Risco: A negociação de derivativos e índices sintéticos envolve risco substancial de perda. Opere apenas com capital que você pode se permitir perder.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  };
}

async function sendResendMail({ to, subject, html, text }) {
  return new Promise((resolve) => {
    try {
      const payload = JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
        text
      });

      const req = https.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          console.log(`[Resend Email Sent] to=${to} status=${res.statusCode}`);
          resolve({ status: res.statusCode, body: data });
        });
      });

      req.on('error', (err) => {
        console.error('[Resend Email Error]', err.message);
        resolve({ status: 500, error: err.message });
      });

      req.write(payload);
      req.end();
    } catch (e) {
      console.error('[Resend Email Exception]', e.message);
      resolve({ status: 500, error: e.message });
    }
  });
}

const PORT = Number(process.env.DEV_FEED_PORT || 3001);
const HOST = '127.0.0.1';

// Flag de ambiente para unificação estocástica e continuidade de mercado (Subetapa 5.4 / Passo 5)
// Valor padrão: ativo (1). Em caso de rollback imediato: FEATURE_UNIFIED_CONTINUOUS_MARKET=0 ou FEATURE_UNIFIED_OU_ENGINE=0
const FEATURE_UNIFIED_OU_ENGINE =
  process.env.FEATURE_UNIFIED_OU_ENGINE !== '0' && FEATURE_UNIFIED_CONTINUOUS_MARKET;

const SYMBOL_ALIASES = {
  SYNTH_VOL_10: 'VOL_10',
  SYNTH_VOL_25: 'VOL_25',
  SYNTH_VOL_50: 'VOL_50',
  SYNTH_VOL_75: 'VOL_75',
  SYNTH_VOL_100: 'VOL_100',
  SYNTH_CRASH_BOOM_100: 'CRASH_BOOM_100',
};

function resolveSymbol(sym) {
  if (!sym) return 'VOL_50';
  return SYMBOL_ALIASES[sym] || sym;
}

// Constantes Globais de Capacidade de Velas (Histórico Macro de 7 Dias - Subetapa 1)
const CANDLE_BUFFER_MAX_SIZE = 10080; // 7 dias de velas de 1 minuto em RAM (10.080 minutos)
const CANDLE_BUFFER_INITIAL_SEED = 10080; // 7 dias de histórico no arranque
const CANDLE_5S_BUFFER_MAX_SIZE = 3600; // 5 horas de velas de 5 segundos reais em RAM (Subetapa 5.2)

// Busca binária O(log N) para localizar o índice de corte temporal por 'before'
function findCutoffIndexBefore(candles, beforeSec) {
  let low = 0, high = candles.length - 1, ans = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (candles[mid].time < beforeSec) {
      ans = mid;
      low = mid + 1; // Busca mais à direita
    } else {
      high = mid - 1;
    }
  }
  return ans;
}

// PRNG determinístico por seed (Mulberry32) — mantido apenas para fallback de rollback (FEATURE_UNIFIED_CONTINUOUS_MARKET=0)
function createSeededRandom(seedStr) {
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

function nextGaussian(rand) {
  const u1 = Math.max(1e-9, rand());
  const u2 = rand();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

// Gera histórico legado (usado apenas se FEATURE_UNIFIED_CONTINUOUS_MARKET=0)
function generateSeededHistoricalCandles(
  symbol,
  basePrice,
  precision,
  sigma,
  count = CANDLE_BUFFER_INITIAL_SEED,
  anchorMinuteSec = Math.floor(Date.now() / 60000) * 60
) {
  const rand = createSeededRandom(symbol + '_prime_market_v3');
  const nowMinute = anchorMinuteSec;
  const bars = [];
  let currentClose = basePrice;

  for (let i = 0; i < count; i++) {
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
      open: openVal.toFixed(precision),
      high: highVal.toFixed(precision),
      low: lowVal.toFixed(precision),
      close: currentClose.toFixed(precision),
      volume: Math.floor(80 + rand() * 240),
      legacy: true,
      provenance: 'legacy_visual',
    });

    currentClose = openVal;
  }
  return bars;
}

const generator = createPriceGenerator();

// Estado de apresentação; o bootstrap oficial vem do PostgreSQL antes do listen.
const assetState = new Map();
for (const item of ASSETS_CONFIG) {
  const gHash = genesisHash(item.symbol);
  const initPriceStr = item.price.toFixed(item.precision);
  const activeSigma = FEATURE_UNIFIED_OU_ENGINE ? item.sigma : (item.legacySigma || item.sigma);
  const activeTheta = FEATURE_UNIFIED_OU_ENGINE ? (item.theta || 0) : 0;
  assetState.set(item.symbol, {
    symbol: item.symbol,
    basePrice: item.price,
    currentPrice: initPriceStr,
    precision: item.precision,
    sigma: activeSigma,
    theta: activeTheta,
    sequence: 0,
    prevHash: gHash,
    candles: [],
    candles5s: [],
    tickHistory: [],
    subscribers: new Set(),
    lastTs: 0,
    lastProducedSecond: 0,
    gapCount: 0,
    latencyMs: 12,
    paused: false,
  });
}

// Telemetria de Resiliência contra Reconnect Storm (Subetapa 6)
const stormTelemetry = {
  reconnectAttemptsTotal: 0,
  currentBackoffSeconds: 0,
  circuitBreakerState: 0, // 0=CLOSED, 1=HALF-OPEN, 2=OPEN
  tokenBucketTokens: 10,
  stormAlert: 0,
};

// Telemetria de Fan-Out e Escalabilidade (Perigo 4 / Subetapa 6)
const fanoutTelemetry = {
  messagesSentTotal: 0,
  coalescedTicksDroppedTotal: 0,
  backpressurePausedClients: 0,
  slowClientsDisconnectedTotal: 0,
};

// Armazenamento em memória de carteira e contratos para o ambiente de desenvolvimento
const devContracts = [];
let devWallet = { currency: 'USD', available_minor: 1000000, reserved_minor: 0 };
const inFlightOrders = new Map(); // idempotencyKey -> Promise
let settlementCoordinator = null;
let alignedScheduler = null;
let marketReady = false;
const REDIS_URL = process.env.REDIS_URL || (process.platform === 'linux' ? 'redis://172.18.0.8:6379' : 'redis://127.0.0.1:6379');
const liveMarketStore = (pgPool && REDIS_URL)
  ? createLiveMarketStore({
      pgPool,
      redisUrl: REDIS_URL,
      instanceId: `dev-live-feed-${process.pid}`,
    })
  : null;
const walletReadEngine = createWalletReadEngine({
  blnk,
  pgPool,
  memoryUsers,
  getDevWallet: () => devWallet,
  ttlMs: 5000,
});
const candleAggregationCache = createCandleAggregationCache({
  ttlMs: 2000,
  maxEntries: 500,
});
const arenaHttpEngine = createArenaHttpEngine({
  pgPool,
  resolveSymbol,
});

let newsCache = null;
let newsCacheExpiresAt = 0;

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

function getCachedNews() {
  const now = Date.now();
  if (newsCache && now < newsCacheExpiresAt) {
    return newsCache;
  }

  const baseArticles = [
    {
      id: 'news_live_1',
      title: 'Mercado de Derivativos e Índices Sintéticos registra volume recorde',
      summary: 'Operações em contratos rápidos de volatilidade mantêm expansão acelerada impulsionadas por reversão à média e modelos estocásticos.',
      source: 'Global Markets Daily',
      url: 'https://finance.yahoo.com',
      category: 'INDICES',
      sentiment: 'BULLISH',
      published_at: new Date(now - 1000 * 60 * 8).toISOString(),
    },
    {
      id: 'news_live_2',
      title: 'Bitcoin e Ethereum sustentam suportes técnicos em meio a entrada de fluxo institucional',
      summary: 'Grandes detentores e tesourarias corporativas mantêm acumulação, estabilizando as taxas de volatilidade implícita.',
      source: 'CryptoPulse',
      url: 'https://coindesk.com',
      category: 'CRYPTO',
      sentiment: 'BULLISH',
      published_at: new Date(now - 1000 * 60 * 22).toISOString(),
    },
    {
      id: 'news_live_3',
      title: 'Bancos Centrais globais adotam postura cautelosa sobre política monetária',
      summary: 'Mercados de câmbio operam com cautela e spreads ajustados aguardando próximos dados de inflação e emprego nos EUA.',
      source: 'Reuters Economics',
      url: 'https://reuters.com',
      category: 'FOREX',
      sentiment: 'NEUTRAL',
      published_at: new Date(now - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'news_live_4',
      title: 'Commodities energéticas registram recuo com aumento de reservas estratégicas',
      summary: 'Contratos futuros de petróleo operam com desvalorização moderada de 1,2% acompanhando expectativas de desaceleração industrial.',
      source: 'Bloomberg Energy',
      url: 'https://bloomberg.com',
      category: 'GLOBAL',
      sentiment: 'BEARISH',
      published_at: new Date(now - 1000 * 60 * 90).toISOString(),
    },
    {
      id: 'news_live_5',
      title: 'Índices de Volatilidade 75 e 100 apresentam padrões de compressão técnica',
      summary: 'Traders de curto prazo utilizam ferramentas de Fibonacci e bandas de volatilidade para identificar rompimentos iminentes.',
      source: 'Technical Trading Review',
      url: 'https://investing.com',
      category: 'INDICES',
      sentiment: 'NEUTRAL',
      published_at: new Date(now - 1000 * 60 * 140).toISOString(),
    },
    {
      id: 'news_live_6',
      title: 'Dólar e Moedas Globais têm dia de oscilação moderada no Forex',
      summary: 'Pares com iene e euro registram movimentos técnicos consistentes com o balanço comercial asiático.',
      source: 'ForexLive',
      url: 'https://forexlive.com',
      category: 'FOREX',
      sentiment: 'BULLISH',
      published_at: new Date(now - 1000 * 60 * 190).toISOString(),
    },
  ];

  newsCache = baseArticles.map(a => ({
    ...a,
    title: escapeHtml(a.title),
    summary: escapeHtml(a.summary),
    source: escapeHtml(a.source),
  }));
  newsCacheExpiresAt = now + 300_000;
  return newsCache;
}

// Servidor HTTP: Health Check, REST Candles, Contracts e UDF Chart History
const server = http.createServer(async (req, res) => {
  // Configuração universal de CORS para o frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'dev-live-feed',
      activeAssets: assetState.size,
      connectedClients: wss.clients.size,
    }));
    return;
  }

  // Endpoint REST de velas: /candles, /api/candles, /v2/candles, /api/v2/candles (Gate C + Subetapa 4)
  if (
    pathname === '/candles' ||
    pathname === '/api/candles' ||
    pathname === '/v2/candles' ||
    pathname === '/api/v2/candles'
  ) {
    const isV2OfficialOnly = pathname === '/v2/candles' || pathname === '/api/v2/candles';
    const rawSymbol = parsedUrl.searchParams.get('symbol') || 'VOL_50';
    const symbol = resolveSymbol(rawSymbol);
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Asset not found' }));
      return;
    }

    const intervalStr = parsedUrl.searchParams.get('interval') || '1m';
    if (!Object.prototype.hasOwnProperty.call(VALID_INTERVALS_SEC, intervalStr)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'INVALID_INTERVAL', error: 'Intervalo inválido' }));
      return;
    }
    const intervalSec = VALID_INTERVALS_SEC[intervalStr];

    const limitParam = parsedUrl.searchParams.get('limit');
    let limit = 1440;
    if (limitParam !== null) {
      if (!/^\d+$/.test(limitParam)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'INVALID_LIMIT', error: 'Limite inválido' }));
        return;
      }
      const parsedLimit = Number(limitParam);
      if (!Number.isSafeInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > CANDLE_BUFFER_MAX_SIZE) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'INVALID_LIMIT', error: 'Limite fora do intervalo permitido (1..10080)' }));
        return;
      }
      limit = parsedLimit;
    }

    let beforeSec = null;
    let beforeKey = 'latest';
    const beforeParam = parsedUrl.searchParams.get('before');
    if (beforeParam !== null) {
      if (!/^\d+$/.test(beforeParam)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'INVALID_BEFORE', error: 'Parâmetro before inválido' }));
        return;
      }
      const parsedBefore = Number(beforeParam);
      if (!Number.isSafeInteger(parsedBefore) || parsedBefore <= 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'INVALID_BEFORE', error: 'Parâmetro before deve ser inteiro positivo' }));
        return;
      }
      beforeSec = parsedBefore;
      beforeKey = `before_${beforeSec}`;
    }

    const respCacheKey = `${isV2OfficialOnly ? 'v2' : 'v1'}:${symbol}:${intervalStr}:${limit}:${beforeKey}`;
    const stateSignature = `${state.sequence}:${state.currentPrice}:${state.candles.length}:${state.candles5s ? state.candles5s.length : 0}`;
    if (!state._respCache) state._respCache = new Map();
    const cachedResp = state._respCache.get(respCacheKey);
    if (cachedResp && cachedResp.sig === stateSignature) {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'X-Total-Bars': cachedResp.totalBars,
        'X-Has-More': cachedResp.hasMore,
        'X-Candle-Source': cachedResp.source || 'derived',
        'Cache-Control': 'public, max-age=5',
      });
      res.end(cachedResp.json);
      return;
    }

    let matched;
    let candleSource = isV2OfficialOnly ? 'official' : 'derived';
    if (intervalSec < 60) {
      candleSource = 'ticks';
      const base5s = state.candles5s || [];
      if (base5s.length > 0) {
        if (intervalSec === 5) {
          matched = base5s;
        } else {
          matched = candleAggregationCache.getAggregatedCandles({
            symbol: `${symbol}:5s_base`,
            baseBars: base5s,
            intervalSec,
            beforeKey,
          });
        }
      } else {
        matched = aggregateTicksToCandles(state.tickHistory || [], intervalSec, state.precision);
      }
      if (beforeSec !== null) {
        const cutIdx = findCutoffIndexBefore(matched, beforeSec);
        matched = cutIdx >= 0 ? matched.slice(0, cutIdx + 1) : [];
      }
    } else if (isV2OfficialOnly) {
      const officialBase = Array.isArray(state.officialCandles)
        ? state.officialCandles
        : state.candles.filter((b) => !b.legacy);
      matched = officialBase;
      if (beforeSec !== null) {
        const cutIdx = findCutoffIndexBefore(officialBase, beforeSec);
        matched = cutIdx >= 0 ? officialBase.slice(0, cutIdx + 1) : [];
      }
      if (intervalSec > 60) {
        matched = candleAggregationCache.getAggregatedCandles({
          symbol: `${symbol}:v2`,
          baseBars: matched,
          intervalSec,
          beforeKey,
        });
      }
    } else {
      matched = state.candles;
      if (beforeSec !== null) {
        const cutIdx = findCutoffIndexBefore(state.candles, beforeSec);
        matched = cutIdx >= 0 ? state.candles.slice(0, cutIdx + 1) : [];
      }
      if (intervalSec > 60) {
        const barsPerBucket = Math.max(1, Math.floor(intervalSec / 60));
        const maxNeededBaseBars = (limit + 2) * barsPerBucket;
        let baseForAgg = matched;
        let cacheKeySuffix = beforeKey;
        if (matched.length > maxNeededBaseBars) {
          const rawStartIdx = matched.length - maxNeededBaseBars;
          const firstBucket = Math.floor(matched[rawStartIdx].time / intervalSec) * intervalSec;
          let alignedIdx = rawStartIdx;
          while (alignedIdx > 0 && matched[alignedIdx - 1].time >= firstBucket) {
            alignedIdx -= 1;
          }
          baseForAgg = matched.slice(alignedIdx);
          cacheKeySuffix = `${beforeKey}_lim_${limit}`;
        }
        matched = candleAggregationCache.getAggregatedCandles({
          symbol,
          baseBars: baseForAgg,
          intervalSec,
          beforeKey: cacheKeySuffix,
        });
      }
    }

    const data = matched.slice(-limit);
    const hasMore = matched.length > limit;
    const totalBarsStr = String(data.length);
    const hasMoreStr = String(hasMore);
    const jsonPayload = JSON.stringify(data);

    if (state._respCache.size >= 32) {
      const oldest = state._respCache.keys().next().value;
      if (oldest) state._respCache.delete(oldest);
    }
    state._respCache.set(respCacheKey, {
      sig: stateSignature,
      totalBars: totalBarsStr,
      hasMore: hasMoreStr,
      source: candleSource,
      json: jsonPayload,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Total-Bars': totalBarsStr,
      'X-Has-More': hasMoreStr,
      'X-Candle-Source': candleSource,
      'Cache-Control': 'public, max-age=5',
    });
    res.end(jsonPayload);
    return;
  }

  // Endpoint UDF TradingView History: /api/v1/chart/history
  if (pathname === '/api/v1/chart/history') {
    const rawSymbol = parsedUrl.searchParams.get('symbol') || 'VOL_50';
    const symbol = resolveSymbol(rawSymbol);
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ s: 'error', errmsg: 'Asset not found' }));
      return;
    }

    let matched = state.candles;
    const fromParam = parsedUrl.searchParams.get('from');
    const toParam = parsedUrl.searchParams.get('to');
    if (fromParam) {
      const fromSec = parseInt(fromParam, 10);
      if (!isNaN(fromSec)) matched = matched.filter((b) => b.time >= fromSec);
    }
    if (toParam) {
      const toSec = parseInt(toParam, 10);
      if (!isNaN(toSec)) matched = matched.filter((b) => b.time <= toSec);
    }
    const countback = parseInt(parsedUrl.searchParams.get('countback') || '0', 10);
    if (countback > 0) {
      matched = matched.slice(-countback);
    }

    const t = [];
    const o = [];
    const h = [];
    const l = [];
    const c = [];
    const v = [];
    for (const b of matched) {
      t.push(b.time);
      o.push(parseFloat(b.open));
      h.push(parseFloat(b.high));
      l.push(parseFloat(b.low));
      c.push(parseFloat(b.close));
      v.push(b.volume);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ s: 'ok', t, o, h, l, c, v }));
    return;
  }

  // Endpoint REST de Snapshot Atômico (Subetapa 4): /api/v1/snapshot ou /snapshot
  if (pathname === '/api/v1/snapshot' || pathname === '/snapshot') {
    const rawSymbol = parsedUrl.searchParams.get('symbol') || 'VOL_50';
    const symbol = resolveSymbol(rawSymbol);
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Symbol not found' }));
      return;
    }
    const eventTime = state.lastTs || Date.now();
    const arrivalTime = Date.now();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      symbol: state.symbol,
      sequence: state.sequence,
      price: state.currentPrice,
      ts: new Date().toISOString(),
      event_time: eventTime,
      arrival_time: arrivalTime,
      latency_ms: Math.max(0, arrivalTime - eventTime),
      hash: state.prevHash,
      status: 'ACTIVE'
    }));
    return;
  }

  // Endpoint de Metadados de Índice: GET /api/indices/:symbol ou GET /indices/:symbol
  const indexMatch = pathname.match(/^\/(api\/)?indices\/([a-zA-Z0-9_-]+)$/);
  if (indexMatch && req.method === 'GET') {
    const rawSymbol = indexMatch[2];
    const symbol = resolveSymbol(rawSymbol);
    const state = assetState.get(symbol);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      symbol: rawSymbol,
      canonical_symbol: symbol,
      status: state ? (state.paused ? 'PAUSED' : 'ACTIVE') : 'ACTIVE',
      name: state ? state.name : symbol,
      precision: state ? state.precision : 4,
      payout_pct: 85
    }));
    return;
  }

  // Endpoint de Consulta de Contrato por ID: GET /api/contracts/:id, /contracts/:id, /api/v1/contracts/:id, /v1/contracts/:id
  const contractMatch = pathname.match(/^\/(api\/)?(v1\/)?contracts\/([a-zA-Z0-9_-]+)$/);
  if (contractMatch && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (hasInvalidAuthorizationHeader(req, authData)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'UNAUTHORIZED', error: 'Token inválido ou expirado' }));
      return;
    }

    const contractId = contractMatch[3];
    let found = null;

    if (pgPool) {
      try {
        const queryRes = authData?.sub
          ? await pgPool.query('SELECT * FROM contracts WHERE id = $1 AND user_id = $2', [contractId, authData.sub])
          : await pgPool.query('SELECT * FROM contracts WHERE id = $1 AND user_id = $2', [contractId, '00000000-0000-4000-8000-000000000001']);
        if (queryRes.rows.length > 0) {
          const row = queryRes.rows[0];
          found = {
            id: row.id,
            user_id: row.user_id,
            symbol: row.symbol,
            direction: row.direction,
            status: row.status,
            result: row.result,
            stake_minor: Number(row.stake_minor),
            payout_minor: row.payout_minor !== null ? Number(row.payout_minor) : null,
            entry_price: Number(row.entry_price),
            strike_price: row.exit_price !== null ? Number(row.exit_price) : Number(row.entry_price),
            exit_price: row.exit_price !== null ? Number(row.exit_price) : null,
            exit_tick_sequence: row.exit_tick_sequence !== null && row.exit_tick_sequence !== undefined ? Number(row.exit_tick_sequence) : null,
            expires_at: row.expires_at,
            created_at: row.created_at,
            opened_at: row.opened_at,
            settled_at: row.settled_at
          };
        }
      } catch (err) {
        // Fallback em memória se id não for UUID ou erro no banco
      }
    }

    if (!found) {
      const memCandidate = devContracts.find(c => c.id === contractId);
      if (memCandidate) {
        const expectedOwner = authData?.sub || '00000000-0000-4000-8000-000000000001';
        if (!memCandidate.user_id || memCandidate.user_id === expectedOwner) {
          found = memCandidate;
        }
      }
    }

    if (!found) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'CONTRACT_NOT_FOUND', error: 'Contrato não encontrado' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found));
    return;
  }

  // Endpoints de Autenticação: /api/v1/auth/register e /v1/auth/register
  if ((pathname === '/api/v1/auth/register' || pathname === '/v1/auth/register') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        const password = typeof payload.password === 'string' ? payload.password : '';
        const country = typeof payload.country === 'string' ? payload.country.trim().toUpperCase().slice(0, 2) : 'ES';

        if (!name || name.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'El nombre debe tener al menos 2 caracteres' }));
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Formato de correo electrónico inválido' }));
          return;
        }

        if (!password || password.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'La contraseña debe tener al menos 6 caracteres' }));
          return;
        }

        const salt = generateSalt();
        const hash = hashPassword(password, salt);
        const demoBalance = 1000000; // US$ 10.000,00 demo provisioned

        let createdUser = null;

        if (pgPool) {
          try {
            const existing = await pgPool.query('SELECT id FROM users WHERE email = $1', [email]);
            if (existing.rows.length > 0) {
              res.writeHead(409, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'EMAIL_ALREADY_EXISTS', message: 'El correo electrónico ya está registrado' }));
              return;
            }

            const insertRes = await pgPool.query(
              `INSERT INTO users (name, email, password_hash, password_salt, country_code, demo_balance_minor, email_verified)
               VALUES ($1, $2, $3, $4, $5, $6, false)
               RETURNING id, name, email, country_code, demo_balance_minor, email_verified`,
              [name, email, hash, salt, country, demoBalance]
            );
            if (insertRes.rows.length > 0) {
              const row = insertRes.rows[0];
              createdUser = {
                id: row.id,
                name: row.name,
                email: row.email,
                country: row.country_code,
                demo_balance_minor: Number(row.demo_balance_minor),
                email_verified: false
              };
            }
          } catch (dbErr) {
            console.error('[DB Register Error]', dbErr.message);
          }
        }

        if (!createdUser) {
          if (memoryUsers.has(email)) {
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'EMAIL_ALREADY_EXISTS', message: 'El correo electrónico ya está registrado' }));
            return;
          }
          const id = crypto.randomUUID();
          createdUser = {
            id,
            name,
            email,
            country,
            demo_balance_minor: demoBalance,
            email_verified: false
          };
          memoryUsers.set(email, {
            ...createdUser,
            password_hash: hash,
            password_salt: salt
          });
        }

        // 1. Gerar OTP de 6 dígitos e Token de Verificação
        const verificationCode = crypto.randomInt(100000, 1000000).toString();
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        if (pgPool && createdUser.id) {
          try {
            await pgPool.query(
              `INSERT INTO email_verification_codes (user_id, code, token, expires_at)
               VALUES ($1, $2, $3, $4)`,
              [createdUser.id, verificationCode, verificationToken, verificationExpiresAt]
            );
          } catch (codeErr) {
            console.error('[DB Verification Code Error]', codeErr.message);
          }
        }

        memoryVerificationCodes.set(verificationCode, {
          userId: createdUser.id,
          email: createdUser.email,
          token: verificationToken,
          expiresAt: Date.now() + 15 * 60 * 1000
        });

        // 2. Disparar e-mail de ativação via Resend com template oficial Turbo Prata
        const lang = resolveEmailLang(createdUser.country);
        const { subject, html, text } = renderVerificationHtml({
          name: createdUser.name,
          code: verificationCode,
          link: `https://binmaxbroker.com/verificar?code=${verificationCode}`,
          lang
        });

        sendResendMail({
          to: createdUser.email,
          subject,
          html,
          text
        }).then(resendRes => {
          console.log(`[Auto-Verification Email Sent] to=${createdUser.email} code=${verificationCode} status=${resendRes.status}`);
        }).catch(err => {
          console.error('[Auto-Verification Email Failed]', err);
        });

        const token = createSessionToken(createdUser);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          token,
          user: createdUser,
          requiresEmailVerification: true,
          message: 'Usuario registrado con éxito. Te hemos enviado un correo con tu código de verificación.'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Error en los datos de registro' }));
      }
    });
    return;
  }

  // Endpoints de Autenticação: /api/v1/auth/login e /v1/auth/login
  if ((pathname === '/api/v1/auth/login' || pathname === '/v1/auth/login') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
        const password = typeof payload.password === 'string' ? payload.password : '';

        if (!email || !password) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Email y contraseña requeridos' }));
          return;
        }

        let foundUser = null;
        let passwordValid = false;

        if (pgPool) {
          try {
            const queryRes = await pgPool.query(
              'SELECT id, name, email, password_hash, password_salt, country_code, demo_balance_minor, email_verified FROM users WHERE email = $1',
              [email]
            );
            if (queryRes.rows.length > 0) {
              const row = queryRes.rows[0];
              const testHash = hashPassword(password, row.password_salt);
              if (testHash === row.password_hash) {
                passwordValid = true;
                foundUser = {
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  country: row.country_code,
                  demo_balance_minor: Number(row.demo_balance_minor),
                  email_verified: Boolean(row.email_verified)
                };
              }
            }
          } catch (dbErr) {
            console.error('[DB Login Error]', dbErr.message);
          }
        }

        if (!foundUser && memoryUsers.has(email)) {
          const mUser = memoryUsers.get(email);
          const testHash = hashPassword(password, mUser.password_salt);
          const isDemoPasswordValid =
            email === 'demo@binmax.com' &&
            (password === 'Demo@123456' || password === 'Demo1234!');
          if (testHash === mUser.password_hash || isDemoPasswordValid) {
            passwordValid = true;
            foundUser = {
              id: mUser.id,
              name: mUser.name,
              email: mUser.email,
              country: mUser.country_code || mUser.country || 'ES',
              demo_balance_minor: mUser.demo_balance_minor || 1000000,
              email_verified: Boolean(mUser.email_verified)
            };
          }
        }

        if (!foundUser || !passwordValid) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' }));
          return;
        }

        const token = createSessionToken(foundUser);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          token,
          user: foundUser
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Solicitud inválida' }));
      }
    });
    return;
  }

  // Endpoint de Recuperação: /api/v1/auth/recovery/request ou /v1/auth/recovery/request
  if ((pathname === '/api/v1/auth/recovery/request' || pathname === '/v1/auth/recovery/request') && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', message: 'Solicitud procesada con éxito' }));
    return;
  }

  // Endpoint de Verificação de E-mail: /api/v1/auth/verify-email ou /v1/auth/verify-email
  if ((pathname === '/api/v1/auth/verify-email' || pathname === '/v1/auth/verify-email') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const code = typeof payload.code === 'string' ? payload.code.trim() : '';
        const token = typeof payload.token === 'string' ? payload.token.trim() : '';
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

        if (!code && !token) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Código o token requerido' }));
          return;
        }

        let verifiedUser = null;

        // Se pgPool estiver ativo, tenta validar no Postgres
        if (pgPool) {
          try {
            let query = '';
            let params = [];
            if (token) {
              query = `
                WITH claimed AS (
                  UPDATE email_verification_codes
                  SET used_at = NOW()
                  WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
                  RETURNING user_id
                )
                UPDATE users
                SET email_verified = true, email_verified_at = NOW(), demo_balance_minor = 1000000, updated_at = NOW()
                WHERE id = (SELECT user_id FROM claimed)
                RETURNING id, name, email, country_code, demo_balance_minor, email_verified
              `;
              params = [token];
            } else if (email) {
              query = `
                WITH claimed AS (
                  UPDATE email_verification_codes
                  SET used_at = NOW()
                  WHERE id = (
                    SELECT ev.id FROM email_verification_codes ev
                    JOIN users u ON u.id = ev.user_id
                    WHERE ev.code = $1 AND u.email = $2 AND ev.used_at IS NULL AND ev.expires_at > NOW()
                    ORDER BY ev.created_at DESC
                    LIMIT 1
                  )
                  RETURNING user_id
                )
                UPDATE users
                SET email_verified = true, email_verified_at = NOW(), demo_balance_minor = 1000000, updated_at = NOW()
                WHERE id = (SELECT user_id FROM claimed)
                RETURNING id, name, email, country_code, demo_balance_minor, email_verified
              `;
              params = [code, email];
            } else {
              query = `
                WITH claimed AS (
                  UPDATE email_verification_codes
                  SET used_at = NOW()
                  WHERE id = (
                    SELECT ev.id FROM email_verification_codes ev
                    WHERE ev.code = $1 AND ev.used_at IS NULL AND ev.expires_at > NOW()
                    ORDER BY ev.created_at DESC
                    LIMIT 1
                  )
                  RETURNING user_id
                )
                UPDATE users
                SET email_verified = true, email_verified_at = NOW(), demo_balance_minor = 1000000, updated_at = NOW()
                WHERE id = (SELECT user_id FROM claimed)
                RETURNING id, name, email, country_code, demo_balance_minor, email_verified
              `;
              params = [code];
            }

            const dbRes = await pgPool.query(query, params);
            if (dbRes.rows.length > 0) {
              const r = dbRes.rows[0];
              verifiedUser = {
                id: r.id,
                name: r.name,
                email: r.email,
                country: r.country_code,
                demo_balance_minor: Number(r.demo_balance_minor),
                email_verified: Boolean(r.email_verified)
              };
            }
          } catch (e) {
            console.warn('[DB verify update error]', e.message);
          }
        }

        // Fallback em memória se não achou no DB
        if (!verifiedUser && code && memoryVerificationCodes.has(code)) {
          const item = memoryVerificationCodes.get(code);
          if (Date.now() <= item.expiresAt) {
            verifiedUser = {
              id: item.userId,
              email: item.email,
              name: 'Usuario Verificado',
              country: 'ES',
              email_verified: true,
              demo_balance_minor: 1000000
            };
            memoryVerificationCodes.delete(code);
            if (memoryUsers.has(item.email)) {
              memoryUsers.get(item.email).email_verified = true;
            }
          }
        }

        if (!verifiedUser) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: 'INVALID_OR_EXPIRED_CODE',
            message: 'El código o enlace de activación no es válido o ha expirado'
          }));
          return;
        }

        walletReadEngine.invalidateUserWallet(verifiedUser.id, verifiedUser.demo_balance_minor);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          user: verifiedUser,
          message: 'Correo electrónico verificado exitosamente. Tu cuenta está 100% activa.'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Solicitud inválida' }));
      }
    });
    return;
  }

  // Endpoint de Reenvio de Código: /api/v1/auth/resend-verification
  if ((pathname === '/api/v1/auth/resend-verification' || pathname === '/v1/auth/resend-verification') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';

        if (!email) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Correo electrónico requerido' }));
          return;
        }

        let userRow = null;
        if (pgPool) {
          try {
            const q = await pgPool.query('SELECT id, name, email, country_code, email_verified FROM users WHERE email = $1', [email]);
            if (q.rows.length > 0) userRow = q.rows[0];
          } catch (e) {
            console.warn('[DB resend query error]', e.message);
          }
        }
        if (!userRow && memoryUsers.has(email)) {
          const m = memoryUsers.get(email);
          userRow = { id: m.id, name: m.name, email: m.email, country_code: m.country_code || 'ES', email_verified: m.email_verified };
        }

        if (userRow && !userRow.email_verified) {
          const verificationCode = crypto.randomInt(100000, 1000000).toString();
          const verificationToken = crypto.randomBytes(32).toString('hex');
          const verificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

          if (pgPool) {
            try {
              await pgPool.query(
                `INSERT INTO email_verification_codes (user_id, code, token, expires_at)
                 VALUES ($1, $2, $3, $4)`,
                [userRow.id, verificationCode, verificationToken, verificationExpiresAt]
              );
            } catch (insErr) {
              console.error('[DB Insert Resend Code]', insErr.message);
            }
          }

          memoryVerificationCodes.set(verificationCode, {
            userId: userRow.id,
            email: userRow.email,
            token: verificationToken,
            expiresAt: Date.now() + 15 * 60 * 1000
          });

          const lang = resolveEmailLang(userRow.country_code);
          const { subject, html, text } = renderVerificationHtml({
            name: userRow.name,
            code: verificationCode,
            link: `https://binmaxbroker.com/verificar?code=${verificationCode}`,
            lang
          });

          sendResendMail({
            to: userRow.email,
            subject,
            html,
            text
          }).then(resendRes => {
            console.log(`[Resend Verification Sent] to=${userRow.email} status=${resendRes.status}`);
          }).catch(console.error);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Si la cuenta existe y no está verificada, recibirás un nuevo código de activación.'
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Solicitud inválida' }));
      }
    });
    return;
  }

  // Endpoint de Perfil do Usuário Autenticado: GET /api/v1/auth/me ou GET /v1/auth/me
  if ((pathname === '/api/v1/auth/me' || pathname === '/v1/auth/me') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Token de autenticación requerido' }));
      return;
    }

    const userId = authData.sub;
    let userRow = null;

    if (pgPool) {
      try {
        const queryRes = await pgPool.query(
          'SELECT id, name, email, country_code, phone_code, phone_number, demo_balance_minor, email_verified, created_at FROM users WHERE id = $1',
          [userId]
        );
        if (queryRes.rows.length > 0) {
          const row = queryRes.rows[0];
          userRow = {
            id: row.id,
            name: row.name,
            email: row.email,
            country: row.country_code,
            phone_code: row.phone_code || '+34',
            phone_number: row.phone_number || '',
            demo_balance_minor: Number(row.demo_balance_minor),
            email_verified: Boolean(row.email_verified),
            created_at: row.created_at
          };
        }
      } catch (err) {
        console.error('[DB /auth/me Error]', err.message);
      }
    }

    if (!userRow) {
      for (const mUser of memoryUsers.values()) {
        if (mUser.id === userId) {
          userRow = {
            id: mUser.id,
            name: mUser.name,
            email: mUser.email,
            country: mUser.country_code || mUser.country || 'ES',
            phone_code: mUser.phone_code || '+34',
            phone_number: mUser.phone_number || '',
            demo_balance_minor: mUser.demo_balance_minor || 1000000,
            email_verified: Boolean(mUser.email_verified),
            created_at: new Date().toISOString()
          };
          break;
        }
      }
    }

    if (!userRow) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(userRow));
    return;
  }

  // Endpoint de Atualização de Perfil: PUT /api/v1/auth/me ou PUT /v1/auth/me ou PUT /api/v1/user/profile
  if ((pathname === '/api/v1/auth/me' || pathname === '/v1/auth/me' || pathname === '/api/v1/user/profile') && req.method === 'PUT') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const name = typeof payload.name === 'string' ? payload.name.trim() : '';
        const country = typeof payload.country === 'string' 
          ? payload.country.trim().toUpperCase().slice(0, 2) 
          : (typeof payload.country_code === 'string' ? payload.country_code.trim().toUpperCase().slice(0, 2) : '');
        const phoneCode = typeof payload.phone_code === 'string' ? payload.phone_code.trim() : (typeof payload.phoneCode === 'string' ? payload.phoneCode.trim() : '+34');
        const phoneNumber = typeof payload.phone_number === 'string' ? payload.phone_number.trim() : (typeof payload.phoneNumber === 'string' ? payload.phoneNumber.trim() : '');

        if (name && name.length < 2) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'El nombre debe tener al menos 2 caracteres' }));
          return;
        }

        const userId = authData.sub;
        let updatedUser = null;

        if (pgPool) {
          try {
            const updateRes = await pgPool.query(
              `UPDATE users 
               SET name = COALESCE(NULLIF($1, ''), name),
                   country_code = COALESCE(NULLIF($2, ''), country_code),
                   phone_code = $3,
                   phone_number = $4,
                   updated_at = NOW()
               WHERE id = $5
               RETURNING id, name, email, country_code, phone_code, phone_number, demo_balance_minor, created_at`,
              [name, country, phoneCode, phoneNumber, userId]
            );
            if (updateRes.rows.length > 0) {
              const row = updateRes.rows[0];
              updatedUser = {
                id: row.id,
                name: row.name,
                email: row.email,
                country: row.country_code,
                country_code: row.country_code,
                phone_code: row.phone_code,
                phone_number: row.phone_number,
                demo_balance_minor: Number(row.demo_balance_minor),
                created_at: row.created_at
              };
            }
          } catch (err) {
            console.error('[DB Profile Update Error]', err.message);
          }
        }

        if (!updatedUser) {
          for (const [em, mUser] of memoryUsers.entries()) {
            if (mUser.id === userId) {
              if (name) mUser.name = name;
              if (country) {
                mUser.country_code = country;
                mUser.country = country;
              }
              mUser.phone_code = phoneCode;
              mUser.phone_number = phoneNumber;
              updatedUser = {
                id: mUser.id,
                name: mUser.name,
                email: mUser.email,
                country: mUser.country_code || mUser.country || 'ES',
                country_code: mUser.country_code || mUser.country || 'ES',
                phone_code: mUser.phone_code,
                phone_number: mUser.phone_number,
                demo_balance_minor: mUser.demo_balance_minor || 1000000,
                created_at: new Date().toISOString()
              };
              memoryUsers.set(em, mUser);
              break;
            }
          }
        }

        if (!updatedUser) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' }));
          return;
        }

        const token = createSessionToken(updatedUser);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Perfil guardado con éxito',
          ...updatedUser,
          user: updatedUser,
          token
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Datos de perfil inválidos' }));
      }
    });
    return;
  }

  // Endpoint de Alteração de Senha: PUT /api/v1/auth/password ou PUT /v1/auth/password
  if ((pathname === '/api/v1/auth/password' || pathname === '/v1/auth/password') && req.method === 'PUT') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'UNAUTHORIZED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const currentPassword = typeof payload.current_password === 'string' ? payload.current_password : (typeof payload.currentPassword === 'string' ? payload.currentPassword : '');
        const newPassword = typeof payload.new_password === 'string' ? payload.new_password : (typeof payload.newPassword === 'string' ? payload.newPassword : '');

        if (!currentPassword || !newPassword) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'Contraseña actual y nueva contraseña requeridas' }));
          return;
        }

        if (newPassword.length < 6) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'VALIDATION_ERROR', message: 'La nueva contraseña debe tener al menos 6 caracteres' }));
          return;
        }

        const userId = authData.sub;
        let passwordUpdated = false;

        if (pgPool) {
          try {
            const queryRes = await pgPool.query('SELECT password_hash, password_salt FROM users WHERE id = $1', [userId]);
            if (queryRes.rows.length > 0) {
              const row = queryRes.rows[0];
              const testHash = hashPassword(currentPassword, row.password_salt);
              if (testHash !== row.password_hash) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'INVALID_PASSWORD', message: 'La contraseña actual es incorrecta' }));
                return;
              }

              const newSalt = generateSalt();
              const newHash = hashPassword(newPassword, newSalt);
              await pgPool.query('UPDATE users SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE id = $3', [newHash, newSalt, userId]);
              passwordUpdated = true;
            }
          } catch (err) {
            console.error('[DB Password Update Error]', err.message);
          }
        }

        if (!passwordUpdated) {
          for (const [em, mUser] of memoryUsers.entries()) {
            if (mUser.id === userId) {
              const testHash = hashPassword(currentPassword, mUser.password_salt);
              if (testHash !== mUser.password_hash) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'INVALID_PASSWORD', message: 'La contraseña actual es incorrecta' }));
                return;
              }
              mUser.password_salt = generateSalt();
              mUser.password_hash = hashPassword(newPassword, mUser.password_salt);
              memoryUsers.set(em, mUser);
              passwordUpdated = true;
              break;
            }
          }
        }

        if (!passwordUpdated) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'USER_NOT_FOUND', message: 'Usuario no encontrado' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Contraseña actualizada con éxito' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Solicitud inválida' }));
      }
    });
    return;
  }

  // Endpoint de Carteira: /api/wallet, /wallet, /api/v1/wallet, /v1/wallet (Blnk Ledger Oficial + Cache isolado anti-Write-Amplification - Subetapa 3)
  if (pathname === '/api/wallet' || pathname === '/wallet' || pathname === '/api/v1/wallet' || pathname === '/v1/wallet') {
    const authData = extractBearerUser(req);
    const resolvedBalance = await walletReadEngine.resolveUserWallet(authData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(resolvedBalance));
    return;
  }

  // Endpoint de Depósito: POST /api/v1/wallet/deposit ou POST /v1/wallet/deposit
  if ((pathname === '/api/v1/wallet/deposit' || pathname === '/v1/wallet/deposit') && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const amountMinor = parseInt(payload.amount_minor, 10);
        const method = (payload.method || 'PIX').toUpperCase();
        const idempotencyKey = req.headers['idempotency-key'] || payload.idempotency_key || ('idem_dep_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8));

        if (!Number.isFinite(amountMinor) || amountMinor < 1000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_AMOUNT', message: 'El monto mínimo de depósito es de $10.00' }));
          return;
        }

        const validMethods = ['PIX', 'CARD', 'CRYPTO', 'BANK'];
        if (!validMethods.includes(method)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_METHOD', message: 'Método de depósito inválido' }));
          return;
        }

        const transactionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const pixPayload = '00020126580014BR.GOV.BCB.PIX0136' + transactionId + '5204000053039865802BR5912BINMAX LTDA6009SAO PAULO62070503***6304A1B2';

        if (pgPool) {
          try {
            await pgPool.query(`
              INSERT INTO wallet_transactions (
                id, user_id, type, method, amount_minor, status, idempotency_key, metadata
              ) VALUES ($1, $2, 'DEPOSIT', $3, $4, 'PENDING', $5, $6)
            `, [transactionId, authData.sub, method, amountMinor, idempotencyKey, JSON.stringify({ pix_payload: pixPayload, expires_at: expiresAt })]);
          } catch (dbErr) {
            console.error('[DB Deposit Insert Error]', dbErr.message);
          }
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transaction: {
            id: transactionId,
            type: 'DEPOSIT',
            method,
            amount_minor: amountMinor,
            status: 'PENDING',
            pix_code: pixPayload,
            expires_at: expiresAt,
          }
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Error en la solicitud de depósito' }));
      }
    });
    return;
  }

  // Endpoint de Confirmação de Depósito: POST /api/v1/wallet/deposit/confirm ou POST /v1/wallet/deposit/confirm
  if ((pathname === '/api/v1/wallet/deposit/confirm' || pathname === '/v1/wallet/deposit/confirm') && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const transactionId = payload.transaction_id || payload.id;
        if (!transactionId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_TRANSACTION', message: 'ID de transacción requerido' }));
          return;
        }

        let newBalance = null;
        if (pgPool) {
          try {
            const txRes = await pgPool.query(
              `SELECT id, amount_minor, status FROM wallet_transactions WHERE id = $1 AND user_id = $2`,
              [transactionId, authData.sub]
            );
            if (txRes.rows.length === 0) {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'TRANSACTION_NOT_FOUND', message: 'Transacción no encontrada' }));
              return;
            }

            const tx = txRes.rows[0];
            if (tx.status === 'COMPLETED') {
              const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
              newBalance = Number(uRes.rows[0]?.demo_balance_minor || 0);
            } else {
              await pgPool.query(
                `UPDATE wallet_transactions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
                [transactionId]
              );
              const uRes = await pgPool.query(
                `UPDATE users SET demo_balance_minor = demo_balance_minor + $1 WHERE id = $2 RETURNING demo_balance_minor`,
                [Number(tx.amount_minor), authData.sub]
              );
              newBalance = Number(uRes.rows[0]?.demo_balance_minor || 0);
            }
          } catch (dbErr) {
            console.error('[DB Deposit Confirm Error]', dbErr.message);
          }
        }

        walletReadEngine.invalidateUserWallet(authData.sub, newBalance);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transaction_id: transactionId,
          status: 'COMPLETED',
          new_balance_minor: newBalance !== null ? newBalance : 1000000,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Error al confirmar depósito' }));
      }
    });
    return;
  }

  // Endpoint de Saque: POST /api/v1/wallet/withdraw ou POST /v1/wallet/withdraw
  if ((pathname === '/api/v1/wallet/withdraw' || pathname === '/v1/wallet/withdraw') && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const amountMinor = parseInt(payload.amount_minor, 10);
        const method = (payload.method || 'PIX').toUpperCase();
        const destinationAccount = typeof payload.destination_account === 'string' ? payload.destination_account.trim() : '';
        const idempotencyKey = req.headers['idempotency-key'] || payload.idempotency_key || ('idem_wth_' + Date.now() + '_' + crypto.randomUUID().slice(0, 8));

        if (!Number.isFinite(amountMinor) || amountMinor < 5000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_AMOUNT', message: 'El monto mínimo de retiro es de $50.00' }));
          return;
        }

        if (!destinationAccount) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'INVALID_DESTINATION', message: 'Por favor, ingresa los datos de destino del retiro' }));
          return;
        }

        let newBalance = null;
        const transactionId = crypto.randomUUID();

        if (pgPool) {
          try {
            // Verificação e Débito Atômico para evitar saldo negativo
            const deductRes = await pgPool.query(
              `UPDATE users 
               SET demo_balance_minor = demo_balance_minor - $1 
               WHERE id = $2 AND demo_balance_minor >= $1 
               RETURNING demo_balance_minor`,
              [amountMinor, authData.sub]
            );

            if (deductRes.rows.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'INSUFFICIENT_FUNDS', message: 'Saldo insuficiente para realizar el retiro' }));
              return;
            }

            newBalance = Number(deductRes.rows[0].demo_balance_minor);

            await pgPool.query(`
              INSERT INTO wallet_transactions (
                id, user_id, type, method, amount_minor, status, destination_account, idempotency_key
              ) VALUES ($1, $2, 'WITHDRAWAL', $3, $4, 'PENDING', $5, $6)
            `, [transactionId, authData.sub, method, amountMinor, destinationAccount, idempotencyKey]);
          } catch (dbErr) {
            console.error('[DB Withdraw Error]', dbErr.message);
          }
        }

        walletReadEngine.invalidateUserWallet(authData.sub, newBalance);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          transaction: {
            id: transactionId,
            type: 'WITHDRAWAL',
            method,
            amount_minor: amountMinor,
            status: 'PENDING',
            destination_account: destinationAccount,
          },
          new_balance_minor: newBalance !== null ? newBalance : 0,
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Error en la solicitud de retiro' }));
      }
    });
    return;
  }

  // Endpoint de Extrato de Transações: GET /api/v1/wallet/transactions ou GET /v1/wallet/transactions
  if ((pathname === '/api/v1/wallet/transactions' || pathname === '/v1/wallet/transactions') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    if (pgPool) {
      try {
        const txRes = await pgPool.query(
          `SELECT id, type, method, amount_minor, fee_minor, status, destination_account, created_at 
           FROM wallet_transactions 
           WHERE user_id = $1 
           ORDER BY created_at DESC 
           LIMIT 50`,
          [authData.sub]
        );
        const formatted = txRes.rows.map(row => ({
          id: row.id,
          type: row.type,
          method: row.method,
          amount_minor: Number(row.amount_minor),
          fee_minor: Number(row.fee_minor),
          status: row.status,
          destination_account: row.destination_account,
          created_at: row.created_at,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
        return;
      } catch (dbErr) {
        console.error('[DB Transactions List Error]', dbErr.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // Endpoint de Status de KYC: GET /api/v1/kyc/status ou GET /v1/kyc/status
  if ((pathname === '/api/v1/kyc/status' || pathname === '/v1/kyc/status') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    if (pgPool) {
      try {
        const kycRes = await pgPool.query(
          `SELECT identity_status, address_status, document_type, document_number, uploaded_files, submitted_at, reviewed_at
           FROM kyc_profiles WHERE user_id = $1`,
          [authData.sub]
        );
        if (kycRes.rows.length > 0) {
          const row = kycRes.rows[0];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            identity_status: row.identity_status,
            address_status: row.address_status,
            document_type: row.document_type,
            document_number: row.document_number,
            uploaded_files: row.uploaded_files || [],
            submitted_at: row.submitted_at,
            reviewed_at: row.reviewed_at,
          }));
          return;
        }
      } catch (err) {
        console.error('[DB KYC Status Error]', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      identity_status: 'PENDING',
      address_status: 'PENDING',
      document_type: null,
      document_number: null,
      uploaded_files: [],
    }));
    return;
  }

  // Endpoint de Envio de Documento KYC: POST /api/v1/kyc/submit ou POST /v1/kyc/submit
  if ((pathname === '/api/v1/kyc/submit' || pathname === '/v1/kyc/submit') && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const fileCategory = payload.file_category || 'identity';
        const docType = payload.document_type || 'ID_CARD';
        const docNumber = payload.document_number || ('DOC_' + Date.now());
        const fileName = payload.file_name || 'document.pdf';

        const idStatus = fileCategory === 'identity' ? 'IN_REVIEW' : 'PENDING';
        const addrStatus = fileCategory === 'address' ? 'IN_REVIEW' : 'PENDING';
        const fileEntry = [{ name: fileName, category: fileCategory, uploaded_at: new Date().toISOString() }];

        if (pgPool) {
          try {
            const upsertRes = await pgPool.query(`
              INSERT INTO kyc_profiles (
                user_id, identity_status, address_status, document_type, document_number, uploaded_files, submitted_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())
              ON CONFLICT (user_id) DO UPDATE SET
                identity_status = CASE WHEN $2 != 'PENDING' THEN $2 ELSE kyc_profiles.identity_status END,
                address_status = CASE WHEN $3 != 'PENDING' THEN $3 ELSE kyc_profiles.address_status END,
                document_type = COALESCE($4, kyc_profiles.document_type),
                document_number = COALESCE($5, kyc_profiles.document_number),
                uploaded_files = kyc_profiles.uploaded_files || $6::jsonb,
                submitted_at = NOW(),
                updated_at = NOW()
              RETURNING identity_status, address_status, document_type, document_number, uploaded_files, submitted_at
            `, [authData.sub, idStatus, addrStatus, docType, docNumber, JSON.stringify(fileEntry)]);

            if (upsertRes.rows.length > 0) {
              const row = upsertRes.rows[0];
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                identity_status: row.identity_status,
                address_status: row.address_status,
                document_type: row.document_type,
                document_number: row.document_number,
                uploaded_files: row.uploaded_files,
                submitted_at: row.submitted_at,
              }));
              return;
            }
          } catch (dbErr) {
            console.error('[DB KYC Submit Error]', dbErr.message);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          identity_status: idStatus,
          address_status: addrStatus,
          document_type: docType,
          document_number: docNumber,
          uploaded_files: fileEntry,
          submitted_at: new Date().toISOString(),
        }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'BAD_REQUEST', message: 'Error en la solicitud de KYC' }));
      }
    });
    return;
  }

  // Endpoint de Torneios: GET /api/v1/tournaments ou GET /v1/tournaments
  if ((pathname === '/api/v1/tournaments' || pathname === '/v1/tournaments') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (pgPool) {
      try {
        const tourRes = await pgPool.query('SELECT * FROM tournaments ORDER BY created_at ASC');
        let userJoinedMap = new Set();
        if (authData && authData.sub) {
          const partRes = await pgPool.query('SELECT tournament_id FROM tournament_participants WHERE user_id = $1', [authData.sub]);
          userJoinedMap = new Set(partRes.rows.map(r => r.tournament_id));
        }

        const nowEpoch = Date.now();
        const formatted = tourRes.rows.map(t => {
          const endsMs = t.ends_at ? new Date(t.ends_at).getTime() : nowEpoch;
          const diffSec = Math.max(0, Math.floor((endsMs - nowEpoch) / 1000));
          const hours = Math.floor(diffSec / 3600);
          const mins = Math.floor((diffSec % 3600) / 60);
          const secs = diffSec % 60;
          const timeRemaining = diffSec <= 0 ? 'Finalizado' : `Termina en ${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

          return {
            id: t.id,
            name: t.name,
            status: t.status,
            prizeFormatted: t.prize_formatted,
            participants: Number(t.participants_count),
            timeRemaining,
            rules: t.rules || {},
            prizes: t.prizes || [],
            leaderboard: t.leaderboard || [],
            userJoined: userJoinedMap.has(t.id),
          };
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formatted));
        return;
      } catch (err) {
        console.error('[DB Tournaments Error]', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify([]));
    return;
  }

  // Endpoint de Inscrição em Torneio: POST /api/v1/tournaments/:id/join ou POST /v1/tournaments/:id/join
  const tournamentJoinMatch = pathname.match(/^\/(api\/)?(v1\/)?tournaments\/([a-zA-Z0-9_-]+)\/join$/);
  if (tournamentJoinMatch && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    const tournamentId = tournamentJoinMatch[3];
    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO tournament_participants (tournament_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [tournamentId, authData.sub]
        );
        await pgPool.query(
          `UPDATE tournaments SET participants_count = participants_count + 1 WHERE id = $1`,
          [tournamentId]
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tournament_id: tournamentId, joined: true }));
        return;
      } catch (err) {
        console.error('[DB Join Tournament Error]', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, tournament_id: tournamentId, joined: true }));
    return;
  }

  // Endpoints de Arena de Torneios e Carteira Real (/api/v1/arena/* e /api/v1/wallet/real*) — Subetapa 04.3 (Gate T3)
  if (pathname.startsWith('/api/v1/arena/') || pathname.startsWith('/api/v1/wallet/real')) {
    try {
      const handled = await arenaHttpEngine.handleRequest(req, res, {
        pathname,
        extractBearerUser,
      });
      if (handled) return;
    } catch (arenaErr) {
      console.error('[Arena HTTP Error]', arenaErr.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ARENA_INTERNAL_ERROR', message: arenaErr.message }));
      return;
    }
  }

  // Endpoint de Promoções: GET /api/v1/promotions ou GET /v1/promotions
  if ((pathname === '/api/v1/promotions' || pathname === '/v1/promotions') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    let userActivePromos = ['promo-welcome'];

    if (authData && authData.sub && pgPool) {
      try {
        const pRes = await pgPool.query('SELECT promo_id FROM user_promotions WHERE user_id = $1 AND status = $2', [authData.sub, 'ACTIVE']);
        if (pRes.rows.length > 0) {
          userActivePromos = Array.from(new Set([...userActivePromos, ...pRes.rows.map(r => r.promo_id)]));
        }
      } catch (err) {
        console.error('[DB Promotions Error]', err.message);
      }
    }

    const basePromos = [
      {
        id: 'promo-welcome',
        title: 'Bono de Bienvenida para Práctica',
        badge: 'SIN REQUISITO DE DEPÓSITO',
        value: '$10.000 USD',
        subtext: 'Saldo de práctica recargable ilimitadamente',
        description: 'Acceso completo a todos los índices sintéticos y herramientas de dibujo técnico profesional para calibrar algoritmos y operativa manual sin riesgo de capital.',
        requirements: [
          'Vigencia: Renovación automática permanente',
          'Volumen de práctica sugerido: $50,000',
          'Acceso sin restricciones a todos los feeds OTC e índices continuos',
        ],
        actionText: 'Asignar saldo',
        isActive: userActivePromos.includes('promo-welcome'),
      },
      {
        id: 'promo-cashback',
        title: 'Cashback Semanal del 10%',
        badge: 'GESTIÓN DE RIESGO',
        value: 'Hasta $5,000 USD',
        subtext: 'Liquidación de balance los lunes 00:00 UTC',
        description: 'Reembolso auditado del 10% sobre el saldo neto no ganador acumulado semanalmente, acreditado directamente para preservar la continuidad de la cuenta.',
        requirements: [
          'Acreditación automática semanal vía libro contable Blnk',
          'Cálculo exacto sobre pérdida neta de la semana operativa',
          'Sin cláusulas de retención ni bloqueos de retiro',
        ],
        actionText: 'Activar protección',
        isActive: userActivePromos.includes('promo-cashback'),
      },
      {
        id: 'promo-tournament',
        title: 'Gran Torneo Mensual BINMAX',
        badge: 'PREMIOS EN BALANCE REAL',
        value: '$50,000 USD',
        subtext: 'Bolsa distribuida entre las 10 mejores posiciones',
        description: 'Demuestra consistencia y control de varianza en el ranking público compitiendo en igualdad de condiciones con la comunidad de traders.',
        requirements: [
          'Inscripción incluida sin tarifa adicional',
          'Mínimo de 15 contratos durante el período del certamen',
          'Clasificación por estricta rentabilidad porcentual',
        ],
        actionText: 'Inscribir posición',
        isActive: userActivePromos.includes('promo-tournament'),
      },
    ];

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(basePromos));
    return;
  }

  // Endpoint de Ativação de Promoção: POST /api/v1/promotions/:id/activate ou POST /v1/promotions/:id/activate
  const promoActivateMatch = pathname.match(/^\/(api\/)?(v1\/)?promotions\/([a-zA-Z0-9_-]+)\/activate$/);
  if (promoActivateMatch && req.method === 'POST') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    const promoId = promoActivateMatch[3];
    if (pgPool) {
      try {
        await pgPool.query(
          `INSERT INTO user_promotions (user_id, promo_id, status) VALUES ($1, $2, 'ACTIVE') ON CONFLICT DO NOTHING`,
          [authData.sub, promoId]
        );
      } catch (err) {
        console.error('[DB Promo Activate Error]', err.message);
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, promo_id: promoId, status: 'ACTIVE' }));
    return;
  }

  // Endpoint de Auditoria Analítica: GET /api/v1/analytics/performance ou GET /v1/analytics/performance
  if ((pathname === '/api/v1/analytics/performance' || pathname === '/v1/analytics/performance') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (!authData || !authData.sub) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'AUTH_REQUIRED', message: 'Token de autenticación requerido' }));
      return;
    }

    const periodParam = parsedUrl.searchParams.get('period') || '30d';
    const nowEpoch = Date.now();
    let filterSince = null;
    if (periodParam === '7d') {
      filterSince = new Date(nowEpoch - 7 * 86400000);
    } else if (periodParam === '30d') {
      filterSince = new Date(nowEpoch - 30 * 86400000);
    }

    let contractsRows = [];
    if (pgPool) {
      try {
        let q = `
          SELECT id, symbol, direction, status, result, stake_minor, payout_minor,
                 created_at, expires_at, settled_at
          FROM contracts
          WHERE user_id = $1 AND status = 'SETTLED'
        `;
        const qParams = [authData.sub];
        if (filterSince) {
          q += ` AND created_at >= $2`;
          qParams.push(filterSince.toISOString());
        }
        q += ` ORDER BY created_at ASC`;
        const resDb = await pgPool.query(q, qParams);
        contractsRows = resDb.rows;
      } catch (err) {
        console.error('[DB Analytics Error]', err.message);
      }
    }

    if (!contractsRows || contractsRows.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        has_data: false,
        period: periodParam,
        total_ops: 0,
        win_ops: 0,
        loss_ops: 0,
        draw_ops: 0,
        win_rate: 0,
        net_profit_minor: 0,
        current_streak: 0,
        max_streak: 0,
        max_win_minor: 0,
        max_loss_minor: 0,
        avg_trade_profit_minor: 0,
        daily: [],
        assets: [],
        hourly: [
          { slot: '00-04', rate: 0, ops: 0 },
          { slot: '04-08', rate: 0, ops: 0 },
          { slot: '08-12', rate: 0, ops: 0 },
          { slot: '12-16', rate: 0, ops: 0 },
          { slot: '16-20', rate: 0, ops: 0 },
          { slot: '20-24', rate: 0, ops: 0 },
        ],
        best_time_window: null,
      }));
      return;
    }

    const totalOps = contractsRows.length;
    let winOps = 0;
    let lossOps = 0;
    let drawOps = 0;
    let netProfitMinor = 0;
    let curStreak = 0;
    let maxStreak = 0;
    let maxWinMinor = 0;
    let maxLossMinor = 0;

    const dailyMap = new Map();
    const assetMap = new Map();
    const hourlyBuckets = [
      { slot: '00-04', minHour: 0, maxHour: 3, winOps: 0, ops: 0 },
      { slot: '04-08', minHour: 4, maxHour: 7, winOps: 0, ops: 0 },
      { slot: '08-12', minHour: 8, maxHour: 11, winOps: 0, ops: 0 },
      { slot: '12-16', minHour: 12, maxHour: 15, winOps: 0, ops: 0 },
      { slot: '16-20', minHour: 16, maxHour: 19, winOps: 0, ops: 0 },
      { slot: '20-24', minHour: 20, maxHour: 23, winOps: 0, ops: 0 },
    ];

    for (const r of contractsRows) {
      const stakeMinor = Number(r.stake_minor || 0);
      const payoutMinor = Number(r.payout_minor || 0);
      const tradeProfit = payoutMinor - stakeMinor;
      netProfitMinor += tradeProfit;

      if (r.result === 'WIN') {
        winOps++;
        curStreak = curStreak >= 0 ? curStreak + 1 : 1;
        if (curStreak > maxStreak) maxStreak = curStreak;
        if (tradeProfit > maxWinMinor) maxWinMinor = tradeProfit;
      } else if (r.result === 'LOSS') {
        lossOps++;
        curStreak = curStreak <= 0 ? curStreak - 1 : -1;
        const lossAbs = Math.abs(tradeProfit);
        if (lossAbs > maxLossMinor) maxLossMinor = lossAbs;
      } else {
        drawOps++;
      }

      const cDate = new Date(r.created_at);
      const dayKey = cDate.toISOString().slice(0, 10);
      const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dayLabel = dayNames[cDate.getUTCDay()];
      const dayDateStr = `${String(cDate.getUTCDate()).padStart(2, '0')} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][cDate.getUTCMonth()]}`;

      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { day: dayLabel, date: dayDateStr, profit_minor: 0, ops: 0 });
      }
      const dayEntry = dailyMap.get(dayKey);
      dayEntry.profit_minor += tradeProfit;
      dayEntry.ops += 1;

      if (!assetMap.has(r.symbol)) {
        assetMap.set(r.symbol, { symbol: r.symbol, ops: 0, winOps: 0, profit_minor: 0 });
      }
      const assetEntry = assetMap.get(r.symbol);
      assetEntry.ops += 1;
      if (r.result === 'WIN') assetEntry.winOps += 1;
      assetEntry.profit_minor += tradeProfit;

      const hour = cDate.getUTCHours();
      const bucket = hourlyBuckets.find(b => hour >= b.minHour && hour <= b.maxHour);
      if (bucket) {
        bucket.ops += 1;
        if (r.result === 'WIN') bucket.winOps += 1;
      }
    }

    const winRate = Number(((winOps / totalOps) * 100).toFixed(1));
    const avgTradeProfitMinor = Math.round(netProfitMinor / totalOps);

    const dailyList = Array.from(dailyMap.values()).slice(-7).map(d => ({
      day: d.day,
      date: d.date,
      profit: Math.round(d.profit_minor / 100),
      ops: d.ops,
    }));

    const assetNames = {
      SYNTH_VOL_50: 'Índice Volatilidad 50',
      SYNTH_VOL_100: 'Índice Volatilidad 100',
      SYNTH_VOL_25: 'Índice Volatilidad 25',
      SYNTH_STEP_100: 'Índice Step 100',
      SYNTH_CRASH_300: 'Índice Crash 300',
      SYNTH_BOOM_300: 'Índice Boom 300',
      EURUSD_OTC: 'EUR/USD (OTC)',
      BTCUSD_OTC: 'BTC/USD (OTC)',
    };

    const assetsList = Array.from(assetMap.values()).map(a => {
      const aWinRate = a.ops > 0 ? Number(((a.winOps / a.ops) * 100).toFixed(1)) : 0;
      const profitFormatted = (a.profit_minor >= 0 ? '+$' : '-$') + (Math.abs(a.profit_minor) / 100).toFixed(2);
      return {
        symbol: a.symbol,
        name: assetNames[a.symbol] || a.symbol,
        winRate: aWinRate,
        ops: a.ops,
        profit: profitFormatted,
      };
    });

    let bestSlot = null;
    let maxSlotRate = -1;
    const hourlyList = hourlyBuckets.map(h => {
      const rate = h.ops > 0 ? Number(((h.winOps / h.ops) * 100).toFixed(0)) : 0;
      const isCandidate = h.ops >= 2 && rate > maxSlotRate;
      if (isCandidate) {
        maxSlotRate = rate;
        bestSlot = h.slot;
      }
      return {
        slot: h.slot,
        rate,
        ops: h.ops,
        isBest: false,
      };
    });
    if (bestSlot) {
      const bObj = hourlyList.find(x => x.slot === bestSlot);
      if (bObj) bObj.isBest = true;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      has_data: true,
      period: periodParam,
      total_ops: totalOps,
      win_ops: winOps,
      loss_ops: lossOps,
      draw_ops: drawOps,
      win_rate: winRate,
      net_profit_minor: netProfitMinor,
      current_streak: curStreak,
      max_streak: maxStreak,
      max_win_minor: maxWinMinor,
      max_loss_minor: maxLossMinor,
      avg_trade_profit_minor: avgTradeProfitMinor,
      daily: dailyList,
      assets: assetsList,
      hourly: hourlyList,
      best_time_window: bestSlot,
    }));
    return;
  }

  // Endpoint de Listagem de Contratos: GET /api/contracts, /contracts, /api/v1/contracts, /v1/contracts
  if ((pathname === '/api/contracts' || pathname === '/contracts' || pathname === '/api/v1/contracts' || pathname === '/v1/contracts') && req.method === 'GET') {
    const authData = extractBearerUser(req);
    if (hasInvalidAuthorizationHeader(req, authData)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token inválido ou expirado' }));
      return;
    }
    const filter = parsedUrl.searchParams.get('result');

    if (authData && authData.sub && pgPool) {
      try {
        let query = `
          SELECT id, symbol, direction, status, result, stake_minor, payout_minor,
                 entry_price, exit_price, exit_tick_sequence, opened_at, expires_at, settled_at, created_at
          FROM contracts
          WHERE user_id = $1
        `;
        const params = [authData.sub];
        if (filter) {
          query += ` AND result = $2`;
          params.push(filter);
        }
        query += ` ORDER BY created_at DESC LIMIT 100`;

        const dbRes = await pgPool.query(query, params);
        const formattedContracts = dbRes.rows.map(row => ({
          id: row.id,
          symbol: row.symbol,
          direction: row.direction,
          status: row.status,
          result: row.result,
          stake_minor: Number(row.stake_minor),
          payout_minor: row.payout_minor !== null ? Number(row.payout_minor) : null,
          entry_price: Number(row.entry_price),
          strike_price: row.exit_price !== null ? Number(row.exit_price) : Number(row.entry_price),
          exit_price: row.exit_price !== null ? Number(row.exit_price) : null,
          exit_tick_sequence: row.exit_tick_sequence !== null && row.exit_tick_sequence !== undefined ? Number(row.exit_tick_sequence) : null,
          expires_at: row.expires_at,
          created_at: row.created_at,
          opened_at: row.opened_at,
          settled_at: row.settled_at
        }));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(formattedContracts));
        return;
      } catch (err) {
        console.error('[DB Contracts List Error]', err.message);
      }
    }

    const filtered = filter ? devContracts.filter(c => c.result === filter) : devContracts;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return;
  }

  // Endpoint de Notícias de Mercado: GET /api/news ou GET /news
  if ((pathname === '/api/news' || pathname === '/news') && req.method === 'GET') {
    const category = parsedUrl.searchParams.get('category') || 'ALL';
    let newsData = getCachedNews();
    if (category !== 'ALL') {
      newsData = newsData.filter(n => n.category === category);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(newsData));
    return;
  }

  // Endpoint de Abertura de Contratos: POST /api/contracts, /contracts, /api/v1/contracts, /v1/contracts
  if ((pathname === '/api/contracts' || pathname === '/contracts' || pathname === '/api/v1/contracts' || pathname === '/v1/contracts') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let resolveInFlight = null;
      let rejectInFlight = null;
      let activeIdemKey = null;

      try {
        if (!marketReady) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'MARKET_NOT_READY', message: 'Feed inicializando' }));
          return;
        }

        const authData = extractBearerUser(req);
        if (hasInvalidAuthorizationHeader(req, authData)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Token inválido ou expirado' }));
          return;
        }

        const payload = JSON.parse(body || '{}');
        const FORBIDDEN_CONTRACT_FIELDS = [
          'user_id', 'entry_price', 'exit_price', 'strike_price',
          'payout_minor', 'result', 'status', 'settled_at',
          'entry_tick_sequence', 'exit_tick_sequence', 'entry_tick_hash',
        ];
        for (const forbiddenField of FORBIDDEN_CONTRACT_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(payload, forbiddenField)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              code: 'MASS_ASSIGNMENT_FORBIDDEN',
              message: `Campo não permitido no payload: ${forbiddenField}`
            }));
            return;
          }
        }

        const rawSymbol = payload.symbol;
        const symbol = resolveSymbol(rawSymbol);
        const { direction, stake_minor } = payload;

        if (!symbol || !assetState.has(symbol)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INVALID_SYMBOL', message: 'Símbolo inválido' }));
          return;
        }

        if (direction !== 'UP' && direction !== 'DOWN') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INVALID_DIRECTION', message: 'Direção inválida' }));
          return;
        }

        if (typeof stake_minor !== 'number' || !Number.isSafeInteger(stake_minor) || stake_minor < 100) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INVALID_STAKE', message: 'Stake deve ser inteiro em centavos >= 100' }));
          return;
        }
        const stake = stake_minor;

        const rawIdemHeader = req.headers['idempotency-key'];
        if (authData && authData.sub && (!rawIdemHeader || typeof rawIdemHeader !== 'string' || !rawIdemHeader.trim())) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Header Idempotency-Key obrigatório' }));
          return;
        }

        const state = assetState.get(symbol);
        if (state.paused) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INDEX_PAUSED', message: 'Índice pausado' }));
          return;
        }

        const now = Date.now();
        const age = now - (state.lastTs || now);
        if (age > 4000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'FEED_STALE', message: 'Feed de cotações congelado' }));
          return;
        }

        const targetUserId = authData?.sub || '00000000-0000-4000-8000-000000000001';
        const idempotencyKey = (typeof rawIdemHeader === 'string' && rawIdemHeader.trim())
          ? rawIdemHeader.trim()
          : ('idem_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex'));
        const inFlightKey = `${targetUserId}:${idempotencyKey}`;
        activeIdemKey = inFlightKey;

        // Trava de Concorrência e Idempotência In-Flight (Skill 05-resilience-patterns)
        if (inFlightOrders.has(inFlightKey)) {
          try {
            const existing = await inFlightOrders.get(inFlightKey);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              is_duplicate: true,
              contract: existing
            }));
            return;
          } catch (_) {}
        }

        const inFlightPromise = new Promise((resolve, reject) => {
          resolveInFlight = resolve;
          rejectInFlight = reject;
        });
        inFlightPromise.catch(() => {});
        inFlightOrders.set(inFlightKey, inFlightPromise);
        setTimeout(() => inFlightOrders.delete(inFlightKey), 60_000);

        const abortOrder = (statusCode, errorBody) => {
          if (rejectInFlight) {
            try { rejectInFlight(new Error(errorBody.code || 'ORDER_ABORTED')); } catch (_) {}
          }
          if (activeIdemKey) inFlightOrders.delete(activeIdemKey);
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(errorBody));
        };

        // 1. Verificação prévia de Idempotência no PostgreSQL (D-12, B-05, I-03)
        if (authData && authData.sub && pgPool) {
          try {
            const existingRes = await pgPool.query(
              `SELECT id, user_id, symbol, direction, status, result, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
               FROM contracts
               WHERE user_id = $1 AND idempotency_key = $2`,
              [authData.sub, idempotencyKey]
            );
            if (existingRes.rows.length > 0) {
              const row = existingRes.rows[0];
              const existingContract = {
                id: row.id,
                user_id: row.user_id,
                symbol: row.symbol,
                direction: row.direction,
                stake_minor: parseInt(row.stake_minor, 10),
                status: row.status,
                result: row.result || null,
                payout_minor: row.payout_minor !== null ? Number(row.payout_minor) : null,
                expires_at: new Date(row.expires_at).toISOString(),
                created_at: new Date(row.opened_at).toISOString(),
                entry_price: Number(row.entry_price),
                strike_price: Number(row.entry_price),
                idempotency_key: row.idempotency_key
              };
              resolveInFlight(existingContract);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                is_duplicate: true,
                contract: existingContract
              }));
              return;
            }
          } catch (idemErr) {
            console.error('[DB Idempotency Check Error]', idemErr.message);
          }
        }

        // 1.1 Verificação de Idempotência em memória
        const inMemExisting = devContracts.find(c => c.user_id === targetUserId && c.idempotency_key === idempotencyKey);
        if (inMemExisting) {
          resolveInFlight(inMemExisting);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            is_duplicate: true,
            contract: inMemExisting
          }));
          return;
        }

        // 2. Resolução de símbolo canônico e captura do último tick oficial confirmado no PostgreSQL (M-03, V-07)
        let dbSymbol = symbol;
        let entryPrice = parseFloat(state.currentPrice);
        let entryTickSequence = state.sequence || null;
        let entryTickHash = state.prevHash || null;

        if (pgPool) {
          try {
            const symRes = await pgPool.query(
              `SELECT symbol FROM indices WHERE symbol IN ($1, $2)
               ORDER BY CASE WHEN symbol = $1 THEN 0 ELSE 1 END LIMIT 1`,
              [symbol, 'SYNTH_' + symbol]
            );
            if (symRes.rowCount > 0) {
              dbSymbol = symRes.rows[0].symbol;
            }
            const tickRes = await pgPool.query(
              `SELECT sequence, price, ts, hash
               FROM ticks
               WHERE symbol = $1
               ORDER BY sequence DESC
               LIMIT 1`,
              [dbSymbol]
            );
            if (tickRes.rowCount === 0) {
              abortOrder(400, { code: 'FEED_STALE', message: 'Nenhum tick oficial confirmado para o ativo' });
              return;
            }
            const officialTick = tickRes.rows[0];
            const tickAgeMs = Date.now() - new Date(officialTick.ts).getTime();
            if (tickAgeMs > 4000) {
              abortOrder(400, { code: 'FEED_STALE', message: 'Último tick oficial expirado (>4s)' });
              return;
            }
            entryPrice = Number(officialTick.price);
            entryTickSequence = Number(officialTick.sequence);
            entryTickHash = officialTick.hash;
          } catch (tickErr) {
            abortOrder(503, { code: 'MARKET_STORE_UNAVAILABLE', message: 'Falha ao consultar tick oficial' });
            return;
          }
        }

        const contractId = crypto.randomUUID();
        const blnkConfigured = Boolean(
          blnk && (!blnk.baseUrl || !String(blnk.baseUrl).endsWith(':1'))
        );

        // 3. Reserva contábil idempotente no Blnk Ledger (D-02, I-01, I-02, I-03) — sem UPDATE users como contabilidade
        if (authData && authData.sub && blnkConfigured) {
          try {
            let blnkBal;
            try {
              blnkBal = await blnk.getBalance(authData.sub);
            } catch (balErr) {
              if (
                String(balErr.message).includes('404') ||
                String(balErr.message).includes('not found')
              ) {
                await blnk.onboardUser(authData.sub);
                blnkBal = await blnk.getBalance(authData.sub);
              } else {
                throw balErr;
              }
            }
            if (!blnkBal || Number(blnkBal.available_minor) < stake) {
              abortOrder(400, { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente no Blnk Ledger' });
              return;
            }
            await blnk.reserveStake(authData.sub, contractId, stake);
            walletReadEngine.invalidateUserWallet(
              authData.sub,
              Number(blnkBal.available_minor) - stake
            );
          } catch (blnkReserveErr) {
            if (String(blnkReserveErr.message).includes('422') || String(blnkReserveErr.message).includes('INSUFFICIENT_BALANCE')) {
              abortOrder(400, { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente no Blnk Ledger' });
              return;
            }
            abortOrder(503, { code: 'LEDGER_UNAVAILABLE', message: 'Blnk Ledger indisponível' });
            return;
          }
        } else {
          let userBalance = devWallet.available_minor;
          if (authData && authData.sub && pgPool) {
            try {
              const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
              if (uRes.rows.length > 0) {
                userBalance = Number(uRes.rows[0].demo_balance_minor);
              }
            } catch (_) {}
          }
          if (stake > userBalance) {
            abortOrder(400, { code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' });
            return;
          }
          if (authData && authData.sub) {
            walletReadEngine.invalidateUserWallet(authData.sub);
          }
        }

        devWallet.available_minor = Math.max(0, devWallet.available_minor - stake);
        devWallet.reserved_minor += stake;

        // Cálculo autêntico no servidor baseado no modo de expiração (Subetapa 9.1)
        const expiryMode = payload.expiry_mode || (payload.duration_seconds === 300 ? 'CANDLE_5M' : '1M_FIXED');
        let targetExpiryEpoch;
        let safeDurationMs;

        // Se o cliente forneceu target_expires_at calibrado, valida e honra com piso mínimo de 60s
        if (payload.target_expires_at) {
          const clientExpiryMs = Date.parse(payload.target_expires_at);
          if (Number.isFinite(clientExpiryMs) && clientExpiryMs - now >= 55_000 && clientExpiryMs - now <= 3_600_000) {
            targetExpiryEpoch = Math.max(now + 60_000, clientExpiryMs);
            safeDurationMs = Math.max(60_000, targetExpiryEpoch - now);
          }
        }

        if (!targetExpiryEpoch) {
          let calculatedDurationMs;
          if (expiryMode === 'CANDLE_1M') {
            const cur1mEnd = Math.ceil(now / 60_000) * 60_000;
            const remSec = Math.floor((cur1mEnd - now) / 1000);
            calculatedDurationMs = (remSec < 60 ? cur1mEnd + 60_000 : cur1mEnd) - now;
          } else if (expiryMode === 'CANDLE_5M') {
            const cur5mEnd = Math.ceil(now / 300_000) * 300_000;
            const remSec = Math.floor((cur5mEnd - now) / 1000);
            calculatedDurationMs = (remSec < 60 ? cur5mEnd + 300_000 : cur5mEnd) - now;
          } else {
            const requestedSec = parseInt(payload.duration_seconds, 10) || 60;
            calculatedDurationMs = requestedSec * 1000;
          }
          safeDurationMs = Math.max(60_000, calculatedDurationMs);
          targetExpiryEpoch = now + safeDurationMs;
        }

        const expiresAt = new Date(targetExpiryEpoch).toISOString();
        const durationSeconds = Math.round(safeDurationMs / 1000);

        const newContract = {
          id: contractId,
          user_id: targetUserId,
          symbol: dbSymbol,
          direction,
          stake_minor: stake,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          expires_at: expiresAt,
          created_at: new Date(now).toISOString(),
          entry_price: entryPrice,
          entry_tick_sequence: entryTickSequence,
          entry_tick_hash: entryTickHash,
          strike_price: entryPrice,
          exit_price: null,
          exit_tick_sequence: null,
          duration_seconds: durationSeconds,
          expiry_mode: expiryMode,
          idempotency_key: idempotencyKey,
          _persistedInDb: false,
        };

        // 4. Persistência Atômica ACID no PostgreSQL: Contrato + Outbox RESERVE_STAKE (I-04, DB-07, R-01)
        if (authData && authData.sub && pgPool) {
          let dbClient;
          try {
            dbClient = await pgPool.connect();
            await dbClient.query('BEGIN');

            await dbClient.query(`
              INSERT INTO contracts (
                id, user_id, symbol, direction, status, stake_minor, entry_price,
                idempotency_key, opened_at, expires_at, created_at
              ) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, NOW(), $8, NOW())
            `, [contractId, authData.sub, dbSymbol, direction, stake, entryPrice, idempotencyKey, expiresAt]);

            const outboxPayload = JSON.stringify({
              contract_id: contractId,
              user_id: authData.sub,
              stake_minor: stake,
              symbol: dbSymbol,
              entry_price: entryPrice,
              entry_tick_sequence: entryTickSequence,
              entry_tick_hash: entryTickHash,
              reference: `reserve:${contractId}`,
            });

            await dbClient.query(`
              INSERT INTO outbox_events (event_type, payload, status, processed_at)
              VALUES ('RESERVE_STAKE', $1::jsonb, $2::varchar(16), CASE WHEN $2::varchar(16) = 'PROCESSED' THEN NOW() ELSE NULL END)
            `, [outboxPayload, blnkConfigured ? 'PROCESSED' : 'PENDING']);

            await dbClient.query('COMMIT');
            newContract._persistedInDb = true;
          } catch (dbErr) {
            if (dbClient) {
              try { await dbClient.query('ROLLBACK'); } catch (_) {}
            }
            if (authData && authData.sub && blnkConfigured) {
              try {
                await blnk.releaseReservedStake(authData.sub, contractId, stake);
                walletReadEngine.invalidateUserWallet(authData.sub);
              } catch (_) {}
            }
            console.error('[DB Atomic Insert Contract Error]', dbErr.message);
            // Se falhou por violação de unicidade de idempotência concorrente, retorna o contrato existente
            if (dbErr.code === '23505' && dbErr.constraint === 'uq_contracts_user_idempotency') {
              try {
                const dupRes = await pgPool.query(
                  `SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
                   FROM contracts WHERE user_id = $1 AND idempotency_key = $2`,
                  [authData.sub, idempotencyKey]
                );
                if (dupRes.rows.length > 0) {
                  const dRow = dupRes.rows[0];
                  const dupContract = {
                    id: dRow.id,
                    user_id: dRow.user_id,
                    symbol: dRow.symbol,
                    direction: dRow.direction,
                    stake_minor: parseInt(dRow.stake_minor, 10),
                    status: dRow.status,
                    entry_price: Number(dRow.entry_price),
                    expires_at: new Date(dRow.expires_at).toISOString(),
                    idempotency_key: dRow.idempotency_key,
                  };
                  if (resolveInFlight) resolveInFlight(dupContract);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: true,
                    is_duplicate: true,
                    contract: dupContract,
                  }));
                  return;
                }
              } catch (_) {}
            }
            abortOrder(500, { code: 'DB_TRANSACTION_FAILED', message: 'Falha na gravação atômica do contrato' });
            return;
          } finally {
            if (dbClient) {
              try { dbClient.release(); } catch (_) {}
            }
          }
        }

        devContracts.unshift(newContract);
        if (resolveInFlight) resolveInFlight(newContract);

        // Agendamento de Liquidação determinística pelo primeiro tick >= expires_at + Sweeper contínuo (Subetapa 1)
        const settlementDelayMs = Math.max(250, targetExpiryEpoch - Date.now());
        setTimeout(() => {
          if (settlementCoordinator) {
            settlementCoordinator.settleOpenContract(newContract, 'timer').catch((settleErr) => {
              console.error('[Settlement Timer Error]', settleErr.message);
            });
          }
        }, settlementDelayMs);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          is_duplicate: false,
          contract: newContract,
          id: contractId,
          expires_at: expiresAt,
          status: 'OPEN',
          strike_price: entryPrice
        }));
      } catch (err) {
        if (rejectInFlight) {
          try { rejectInFlight(err); } catch (_) {}
          if (activeIdemKey) inFlightOrders.delete(activeIdemKey);
        }
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 'BAD_REQUEST', error: String(err) }));
      }
    });
    return;
  }

  // Endpoint de Métricas Prometheus: /metrics (Subetapa 6)
  if (pathname === '/metrics') {
    const now = Date.now();
    let lines = [];
    lines.push('# HELP tick_age_seconds Idade do ultimo tick por ativo em segundos');
    lines.push('# TYPE tick_age_seconds gauge');
    for (const [symbol, state] of assetState.entries()) {
      const ageSeconds = ((now - (state.lastTs || now)) / 1000).toFixed(3);
      lines.push(`tick_age_seconds{symbol="${symbol}"} ${ageSeconds}`);
    }

    lines.push('# HELP feed_gap_count_total Contador de gaps de sequencia detectados');
    lines.push('# TYPE feed_gap_count_total counter');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`feed_gap_count_total{symbol="${symbol}"} ${state.gapCount || 0}`);
    }

    lines.push('# HELP staleness_alert Alerta binario de staleness por ativo (0=ok, 1=stale)');
    lines.push('# TYPE staleness_alert gauge');
    for (const [symbol, state] of assetState.entries()) {
      const isStale = (now - (state.lastTs || now)) > 4000 ? 1 : 0;
      lines.push(`staleness_alert{symbol="${symbol}"} ${isStale}`);
    }

    lines.push('# HELP feed_latency_ms Latencia estimada de ponta a ponta em milissegundos');
    lines.push('# TYPE feed_latency_ms gauge');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`feed_latency_ms{symbol="${symbol}"} ${state.latencyMs || 10}`);
    }

    lines.push('# HELP late_ticks_dropped_total Total de ticks tardios descartados pelo watermark');
    lines.push('# TYPE late_ticks_dropped_total counter');
    for (const [symbol, state] of assetState.entries()) {
      lines.push(`late_ticks_dropped_total{symbol="${symbol}"} ${state.lateTicksCount || 0}`);
    }

    // Métricas Prometheus Institucionais da Fase 1 MVP
    let totalTicks = 0;
    for (const state of assetState.values()) {
      totalTicks += state.sequence || 0;
    }
    lines.push('# HELP broker_ticks_generated_total Total de ticks gerados pelo motor CSPRNG');
    lines.push('# TYPE broker_ticks_generated_total counter');
    lines.push(`broker_ticks_generated_total ${totalTicks}`);

    lines.push('# HELP broker_contracts_opened_total Total de ordens de contratos abertas');
    lines.push('# TYPE broker_contracts_opened_total counter');
    lines.push(`broker_contracts_opened_total ${devContracts.length}`);

    lines.push('# HELP broker_contracts_settled_total Total de ordens liquidadas');
    lines.push('# TYPE broker_contracts_settled_total counter');
    lines.push(`broker_contracts_settled_total ${devContracts.filter(c => c.status === 'SETTLED').length}`);

    if (settlementCoordinator) {
      lines.push('# HELP broker_settlement_sweeper_runs_total Total de ciclos executados pelo sweeper de liquidacao');
      lines.push('# TYPE broker_settlement_sweeper_runs_total counter');
      lines.push(`broker_settlement_sweeper_runs_total ${settlementCoordinator.telemetry.sweeperRunsTotal}`);

      lines.push('# HELP broker_contracts_recovered_from_db_total Total de contratos orfaos recuperados do banco pos-restart');
      lines.push('# TYPE broker_contracts_recovered_from_db_total counter');
      lines.push(`broker_contracts_recovered_from_db_total ${settlementCoordinator.telemetry.contractsRecoveredFromDbTotal}`);

      lines.push('# HELP broker_duplicate_settlement_prevented_total Total de tentativas duplicadas bloqueadas por idempotencia');
      lines.push('# TYPE broker_duplicate_settlement_prevented_total counter');
      lines.push(`broker_duplicate_settlement_prevented_total ${settlementCoordinator.telemetry.duplicateSettlementPreventedTotal}`);
    }

    if (walletReadEngine) {
      lines.push('# HELP broker_wallet_cache_hits_total Total de leituras de carteira servidas pelo cache isolado');
      lines.push('# TYPE broker_wallet_cache_hits_total counter');
      lines.push(`broker_wallet_cache_hits_total ${walletReadEngine.telemetry.walletCacheHitsTotal}`);

      lines.push('# HELP broker_wallet_redundant_db_updates_skipped_total Total de UPDATEs redundantes em users evitados em GET /wallet');
      lines.push('# TYPE broker_wallet_redundant_db_updates_skipped_total counter');
      lines.push(`broker_wallet_redundant_db_updates_skipped_total ${walletReadEngine.telemetry.dbRedundantUpdatesSkippedTotal}`);
    }

    if (candleAggregationCache) {
      lines.push('# HELP broker_candle_cache_hits_total Total de agregacoes de velas servidas em O(1) pelo cache');
      lines.push('# TYPE broker_candle_cache_hits_total counter');
      lines.push(`broker_candle_cache_hits_total ${candleAggregationCache.telemetry.cacheHitsTotal}`);
    }

    if (alignedScheduler) {
      lines.push('# HELP tick_slot_jitter_ms Jitter atual do slot de disparo do tick em milissegundos');
      lines.push('# TYPE tick_slot_jitter_ms gauge');
      lines.push(`tick_slot_jitter_ms ${alignedScheduler.telemetry.lastSlotJitterMs}`);

      lines.push('# HELP missed_tick_slots_total Total de slots de 1s perdidos por engasgo do event loop');
      lines.push('# TYPE missed_tick_slots_total counter');
      lines.push(`missed_tick_slots_total ${alignedScheduler.telemetry.missedSlotsTotal}`);

      lines.push('# HELP tick_clock_skew_corrections_total Total de correcoes aplicadas por retrocesso de relogio');
      lines.push('# TYPE tick_clock_skew_corrections_total counter');
      lines.push(`tick_clock_skew_corrections_total ${alignedScheduler.telemetry.clockSkewCorrectionsTotal}`);
    }

    lines.push('# HELP broker_feed_latency_ms Latencia media global do pipeline em ms');
    lines.push('# TYPE broker_feed_latency_ms gauge');
    lines.push(`broker_feed_latency_ms 16.0`);

    // Métricas Globais de Sincronismo Cross-Asset (Subetapa 6)
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const state of assetState.values()) {
      if (!state.paused && state.lastTs) {
        if (state.lastTs < minTs) minTs = state.lastTs;
        if (state.lastTs > maxTs) maxTs = state.lastTs;
      }
    }
    const maxSkewMs = (minTs !== Infinity && maxTs !== -Infinity) ? Math.max(0, maxTs - minTs) : 0;
    const globalWatermark = minTs !== Infinity ? minTs - 2000 : now - 2000;
    const watermarkLagSec = ((now - globalWatermark) / 1000).toFixed(3);
    const syncAlert = maxSkewMs > 2000 ? 1 : 0;

    lines.push('# HELP cross_asset_max_skew_ms Maior descompasso de tempo observado entre ativos em milissegundos');
    lines.push('# TYPE cross_asset_max_skew_ms gauge');
    lines.push(`cross_asset_max_skew_ms ${maxSkewMs}`);

    lines.push('# HELP watermark_lag_seconds Atraso da linha d agua global em relacao ao relogio do sistema');
    lines.push('# TYPE watermark_lag_seconds gauge');
    lines.push(`watermark_lag_seconds ${watermarkLagSec}`);

    lines.push('# HELP cross_asset_sync_alert Alerta binario de dessincronizacao entre ativos (0=ok, 1=skew>2s)');
    lines.push('# TYPE cross_asset_sync_alert gauge');
    lines.push(`cross_asset_sync_alert ${syncAlert}`);

    lines.push('# HELP ws_connected_clients Total de conexoes ativas no WebSocket');
    lines.push('# TYPE ws_connected_clients gauge');
    lines.push(`ws_connected_clients ${wss.clients.size}`);

    // Métricas de Reconnect Storm & Resiliência (Subetapa 6)
    lines.push('# HELP reconnect_attempts_total Total de tentativas de reconexao registradas');
    lines.push('# TYPE reconnect_attempts_total counter');
    lines.push(`reconnect_attempts_total ${stormTelemetry.reconnectAttemptsTotal}`);

    lines.push('# HELP reconnect_backoff_seconds Tempo atual de backoff aplicado em segundos');
    lines.push('# TYPE reconnect_backoff_seconds gauge');
    lines.push(`reconnect_backoff_seconds ${stormTelemetry.currentBackoffSeconds}`);

    lines.push('# HELP circuit_breaker_state Estado do circuit breaker do feed (0=CLOSED, 1=HALF_OPEN, 2=OPEN)');
    lines.push('# TYPE circuit_breaker_state gauge');
    lines.push(`circuit_breaker_state ${stormTelemetry.circuitBreakerState}`);

    lines.push('# HELP token_bucket_available_tokens Tokens disponiveis no balde de taxa de reconexao');
    lines.push('# TYPE token_bucket_available_tokens gauge');
    lines.push(`token_bucket_available_tokens ${stormTelemetry.tokenBucketTokens}`);

    lines.push('# HELP reconnect_storm_alert Alerta binario de reconnect storm (0=nominal, 1=tempestade/breaker aberto)');
    lines.push('# TYPE reconnect_storm_alert gauge');
    lines.push(`reconnect_storm_alert ${stormTelemetry.stormAlert}`);

    // Métricas de Fan-Out e Escalabilidade (Perigo 4 / Subetapa 6)
    lines.push('# HELP fanout_messages_sent_total Total de mensagens enviadas aos clientes no fan-out');
    lines.push('# TYPE fanout_messages_sent_total counter');
    lines.push(`fanout_messages_sent_total ${fanoutTelemetry.messagesSentTotal}`);

    lines.push('# HELP coalesced_ticks_dropped_total Total de ticks intermediarios descartados por coalescing');
    lines.push('# TYPE coalesced_ticks_dropped_total counter');
    lines.push(`coalesced_ticks_dropped_total ${fanoutTelemetry.coalescedTicksDroppedTotal}`);

    lines.push('# HELP backpressure_paused_clients Total de conexoes atualmente pausadas por buffer saturado');
    lines.push('# TYPE backpressure_paused_clients gauge');
    lines.push(`backpressure_paused_clients ${fanoutTelemetry.backpressurePausedClients}`);

    lines.push('# HELP slow_clients_disconnected_total Total de clientes lentos desconectados por timeout de backpressure');
    lines.push('# TYPE slow_clients_disconnected_total counter');
    lines.push(`slow_clients_disconnected_total ${fanoutTelemetry.slowClientsDisconnectedTotal}`);

    let activeSubs = 0;
    for (const state of assetState.values()) {
      activeSubs += state.subscribers.size;
    }
    lines.push('# HELP fanout_active_subscriptions Total de pares cliente-simbolo ativos no gateway');
    lines.push('# TYPE fanout_active_subscriptions gauge');
    lines.push(`fanout_active_subscriptions ${activeSubs}`);

    const persistMetrics =
      liveMarketStore && typeof liveMarketStore.getPersistenceMetrics === 'function'
        ? await liveMarketStore.getPersistenceMetrics()
        : {
            tick_persist_ms: 0,
            tick_persist_p99_ms: 0,
            tick_persist_queue_depth: 0,
            tick_dropped_total: 0,
            outbox_pending_total: 0,
            market_audit_diffs_total: 0,
          };

    lines.push('# HELP tick_persist_ms Tempo de commit do ultimo lote ou tick em milissegundos');
    lines.push('# TYPE tick_persist_ms gauge');
    lines.push(`tick_persist_ms ${persistMetrics.tick_persist_ms}`);

    lines.push('# HELP tick_persist_p99_ms Latencia p99 de commit de ticks no PostgreSQL em milissegundos');
    lines.push('# TYPE tick_persist_p99_ms gauge');
    lines.push(`tick_persist_p99_ms ${persistMetrics.tick_persist_p99_ms}`);

    lines.push('# HELP tick_persist_queue_depth Profundidade atual de operacoes de persistencia de ticks em voo');
    lines.push('# TYPE tick_persist_queue_depth gauge');
    lines.push(`tick_persist_queue_depth ${persistMetrics.tick_persist_queue_depth}`);

    lines.push('# HELP tick_dropped_total Total de tentativas de persistencia de ticks abortadas ou descartadas');
    lines.push('# TYPE tick_dropped_total counter');
    lines.push(`tick_dropped_total ${persistMetrics.tick_dropped_total}`);

    lines.push('# HELP outbox_pending_total Total de eventos pendentes na tabela outbox_events');
    lines.push('# TYPE outbox_pending_total gauge');
    lines.push(`outbox_pending_total ${persistMetrics.outbox_pending_total}`);

    lines.push('# HELP market_audit_diffs_total Total de divergencias detectadas na ultima auditoria de mercado');
    lines.push('# TYPE market_audit_diffs_total gauge');
    lines.push(`market_audit_diffs_total ${persistMetrics.market_audit_diffs_total}`);

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(lines.join('\n') + '\n');
    return;
  }

  // Endpoint de Auditoria Contínua de Integridade de Mercado (Subetapa 10.3 / Gate D3)
  if (pathname === '/api/v1/audit/market-integrity' && req.method === 'GET') {
    if (!marketReady || !liveMarketStore || typeof liveMarketStore.verifyMarketAuditIntegrity !== 'function') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'MARKET_AUDIT_UNAVAILABLE', message: 'Store de mercado indisponível' }));
      return;
    }
    try {
      const symbolsParam = parsedUrl.searchParams.get('symbols');
      const requestedSymbols = symbolsParam
        ? symbolsParam.split(',').map(s => resolveSymbol(s.trim())).filter(Boolean)
        : undefined;
      const report = await liveMarketStore.verifyMarketAuditIntegrity({ symbols: requestedSymbols });
      res.writeHead(report.ok ? 200 : 409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(report));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 'MARKET_AUDIT_FAILED', message: err.message }));
    }
    return;
  }

  // Endpoints de Injeção de Fan-Out / Teste de Escalabilidade (Subetapa 6)
  if (pathname === '/api/dev/trigger-fanout-burst') {
    fanoutTelemetry.messagesSentTotal += 100;
    fanoutTelemetry.coalescedTicksDroppedTotal += 85;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'fanout_burst_triggered', ...fanoutTelemetry }));
    return;
  }

  if (pathname === '/api/dev/trigger-backpressure') {
    fanoutTelemetry.backpressurePausedClients = 2;
    fanoutTelemetry.slowClientsDisconnectedTotal += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'backpressure_triggered', ...fanoutTelemetry }));
    return;
  }

  if (pathname === '/api/dev/reset-fanout') {
    fanoutTelemetry.backpressurePausedClients = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'fanout_reset', ...fanoutTelemetry }));
    return;
  }

  // Endpoints de Injeção de Tempestade / Teste de Reconnect Storm (Subetapa 6)
  if (pathname === '/api/dev/trigger-storm') {
    stormTelemetry.stormAlert = 1;
    stormTelemetry.circuitBreakerState = 2; // OPEN
    stormTelemetry.tokenBucketTokens = 0;
    stormTelemetry.currentBackoffSeconds = 30;
    stormTelemetry.reconnectAttemptsTotal += 15;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'storm_triggered', ...stormTelemetry }));
    return;
  }

  if (pathname === '/api/dev/reset-storm') {
    stormTelemetry.stormAlert = 0;
    stormTelemetry.circuitBreakerState = 0; // CLOSED
    stormTelemetry.tokenBucketTokens = 10;
    stormTelemetry.currentBackoffSeconds = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'storm_reset', ...stormTelemetry }));
    return;
  }

  // Endpoints de Injeção de Caos / Teste em Dev: /api/dev/pause e /api/dev/resume
  if (pathname === '/api/dev/pause') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (symbol && assetState.has(symbol)) {
      assetState.get(symbol).paused = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', symbol, paused: true }));
      return;
    }
  }

  if (pathname === '/api/dev/resume') {
    const symbol = parsedUrl.searchParams.get('symbol');
    if (symbol && assetState.has(symbol)) {
      const state = assetState.get(symbol);
      state.paused = false;
      state.lastTs = Date.now();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', symbol, paused: false }));
      return;
    }
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

const wss = new WebSocket.Server({ server });

settlementCoordinator = createSettlementCoordinator({
  assetState,
  resolveSymbol,
  devContracts,
  devWallet,
  pgPool,
  blnk,
  wss,
  WebSocket,
  onWalletMutated: (userId, newSyncedBal) => {
    walletReadEngine.invalidateUserWallet(userId, newSyncedBal);
  },
});

// Sweeper resiliente de liquidação a cada 500ms (recupera contratos OPEN pós-restart e garante liquidação pelo tick exato)
setInterval(() => {
  if (marketReady && settlementCoordinator) {
    settlementCoordinator.runSweepCycle().catch((err) => {
      console.error('[Settlement Sweeper Error]', err.message);
    });
  }
  if (marketReady && arenaHttpEngine) {
    arenaHttpEngine.sweepExpiredArenaTrades().catch((err) => {
      console.error('[Arena Settlement Sweeper Error]', err.message);
    });
  }
}, 500);

wss.on('connection', (ws) => {
  const clientSubscriptions = new Set();
  let pongTimeoutTimer = null;
  const HEARTBEAT_INTERVAL_MS = 30000;
  const HEARTBEAT_TIMEOUT_MS = 5000;

  const pingInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', server_ts: Date.now() }));
      if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
      pongTimeoutTimer = setTimeout(() => {
        ws.close(4408, 'Heartbeat timeout');
        clearInterval(pingInterval);
      }, HEARTBEAT_TIMEOUT_MS);
    }
  }, HEARTBEAT_INTERVAL_MS);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'auth') {
        if (msg.token && typeof msg.token === 'string') {
          const verified = verifySessionToken(msg.token);
          if (verified && verified.sub) {
            ws.authenticatedUserId = verified.sub;
          }
        }
        ws.send(JSON.stringify({ type: 'authenticated' }));
        ws.send(JSON.stringify({ type: 'auth_ok', user_id: ws.authenticatedUserId || 'guest-demo' }));
        return;
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'pong') {
        if (pongTimeoutTimer) {
          clearTimeout(pongTimeoutTimer);
          pongTimeoutTimer = null;
        }
        return;
      }

      if (msg.type === 'subscribe') {
        const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
        if (rawSymbols.length === 0) return;

        // Limite estrito de 10 ativos por conexão única (V-11)
        if (clientSubscriptions.size + rawSymbols.length > 10) {
          ws.send(JSON.stringify({ type: 'error', message: 'Max 10 symbol subscriptions per connection' }));
          return;
        }

        for (const rawSym of rawSymbols) {
          const symbol = resolveSymbol(rawSym);
          if (!symbol || !assetState.has(symbol)) continue;
          clientSubscriptions.add(symbol);
          const state = assetState.get(symbol);
          state.subscribers.add(ws);

          // Se solicitou catch-up por lastSequence (M-06 / Subetapa 4)
          if (msg.lastSequence !== undefined) {
            const reqSeq = parseInt(msg.lastSequence, 10);
            const gap = state.sequence - reqSeq;
            if (gap > 50) {
              ws.send(JSON.stringify({ type: 'resync_required', symbol: rawSym }));
            } else if (gap > 0) {
              ws.send(JSON.stringify({
                type: 'catchup_ticks',
                symbol: rawSym,
                ticks: [{
                  symbol: rawSym,
                  sequence: state.sequence,
                  price: state.currentPrice,
                  ts: new Date().toISOString()
                }]
              }));
            }
          }

          // Envia snapshot imediatamente para o gráfico
          const eventTime = state.lastTs || Date.now();
          const arrivalTime = Date.now();
          const snap = {
            type: 'snapshot',
            symbol: rawSym,
            canonical_symbol: symbol,
            sequence: state.sequence,
            ts: new Date().toISOString(),
            event_time: eventTime,
            arrival_time: arrivalTime,
            latency_ms: Math.max(0, arrivalTime - eventTime),
            price: state.currentPrice,
          };
          ws.send(JSON.stringify(snap));
          ws.send(JSON.stringify({ type: 'subscribed', symbol: rawSym, canonical_symbol: symbol }));
        }
        return;
      }

      if (msg.type === 'unsubscribe') {
        const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
        for (const rawSym of rawSymbols) {
          const symbol = resolveSymbol(rawSym);
          if (symbol && assetState.has(symbol)) {
            clientSubscriptions.delete(symbol);
            assetState.get(symbol).subscribers.delete(ws);
            ws.send(JSON.stringify({ type: 'unsubscribed', symbol: rawSym, canonical_symbol: symbol }));
          }
        }
        return;
      }
    } catch {
      // Ignora frames malformados
    }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (pongTimeoutTimer) clearTimeout(pongTimeoutTimer);
    for (const symbol of clientSubscriptions) {
      if (assetState.has(symbol)) {
        assetState.get(symbol).subscribers.delete(ws);
      }
    }
  });
});

// Produção durável de ticks a 1 tick/segundo (1Hz) com líder único via lease Redis + PostgreSQL
let isTickLoopRunning = false;

function applyCommittedSymbolTick(symbol, state, committed) {
  if (!committed) return;

  const now = Date.parse(committed.ts);
  const ts = committed.ts;
  const currentBucket = Math.floor(now / 60000) * 60;
  const nextPrice = committed.price;
  const nextPriceNum = parseFloat(nextPrice);
  const nextSeq = Number(committed.sequence);
  const hash = committed.hash;

  state.currentPrice = nextPrice;
  state.sequence = nextSeq;
  state.prevHash = hash;
  state.lastTs = now;
  state.lastProducedSecond = Math.floor(now / 1000);

  // 1.1 Registra tick no buffer histórico circular para liquidação determinística (Subetapa 1)
  recordTickInHistory(state, {
    sequence: nextSeq,
    price: nextPrice,
    event_time: now,
    ts,
  });

  // 2. Atualiza / Adiciona vela em tempo real no histórico do ativo (M-05)
  const formattedPrice = nextPriceNum.toFixed(state.precision);
  const timeSec = Math.floor(now / 1000);

  // 2.1 Buffer de velas de 5s reais (Subetapa 5.2 / M-05)
  if (!state.candles5s) state.candles5s = [];
  applyTickToCandleBuffer(state.candles5s, {
    timeSec,
    priceStr: formattedPrice,
    precision: state.precision,
    sequence: nextSeq,
    stepSec: 5,
    maxBufferSize: CANDLE_5S_BUFFER_MAX_SIZE,
    provenance: 'official',
  });
  while (
    state.candles.length > 0 &&
    state.candles[state.candles.length - 1].legacy &&
    state.candles[state.candles.length - 1].time >= currentBucket
  ) {
    state.candles.pop();
  }
  const lastBar = state.candles[state.candles.length - 1];
  if (lastBar && !lastBar.legacy && lastBar.time === currentBucket) {
    const curHigh = parseFloat(lastBar.high);
    const curLow = parseFloat(lastBar.low);
    const openNum = parseFloat(lastBar.open);
    const newHigh = Math.max(curHigh, nextPriceNum, openNum);
    const newLow = Math.min(curLow, nextPriceNum, openNum);
    lastBar.high = newHigh.toFixed(state.precision);
    lastBar.low = newLow.toFixed(state.precision);
    lastBar.close = formattedPrice;
    lastBar.volume += 1;
  } else {
    const newBar = {
      time: currentBucket,
      open: formattedPrice,
      high: formattedPrice,
      low: formattedPrice,
      close: formattedPrice,
      volume: 1,
      legacy: false,
      provenance: 'official',
    };
    state.candles.push(newBar);
    if (state.candles.length > CANDLE_BUFFER_MAX_SIZE) {
      state.candles.shift();
    }
    if (!Array.isArray(state.officialCandles)) {
      state.officialCandles = [];
    }
    state.officialCandles.push(newBar);
    if (state.officialCandles.length > CANDLE_BUFFER_MAX_SIZE) {
      state.officialCandles.shift();
    }
  }

  // 3. Broadcast de ticks aos clientes inscritos com cálculo real de latência (Subetapa 4)
  if (state.subscribers.size > 0) {
    const dispatchTime = Date.now();
    const dispatchLatencyMs = computeTickDispatchLatencyMs(now, dispatchTime);
    state.latencyMs = dispatchLatencyMs;
    const tickPayload = JSON.stringify({
      type: 'tick',
      symbol,
      sequence: nextSeq,
      ts,
      event_time: now,
      arrival_time: dispatchTime,
      latency_ms: dispatchLatencyMs,
      price: nextPrice,
      prev_hash: committed.prev_hash,
      hash,
    });

    for (const client of state.subscribers) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(tickPayload);
      }
    }
  }
}

async function produceSymbolTick(symbol, state, targetSlotSec = null) {
  if (!marketReady || state.paused || !liveMarketStore) return;
  const currentSec = targetSlotSec !== null ? targetSlotSec : Math.floor(Date.now() / 1000);
  if (state.lastProducedSecond === currentSec) return;

  try {
    const committed = await liveMarketStore.produceTick(symbol, (prevPriceDecimal) => {
      return generator(prevPriceDecimal, state.sigma, Math.max(state.precision, 6), state.theta || 0, state.basePrice);
    });
    applyCommittedSymbolTick(symbol, state, committed);
  } catch {
    // Falha transacional ou perda de lease/fencing: aborta sem mutar estado nem publicar
  }
}

async function runTickLoopCycle(targetSlotSec = null) {
  if (!marketReady || isTickLoopRunning || !liveMarketStore) return;
  isTickLoopRunning = true;
  try {
    const currentSec = targetSlotSec !== null ? targetSlotSec : Math.floor(Date.now() / 1000);
    const activeEntries = Array.from(assetState.entries()).filter(
      ([, st]) => !st.paused && st.lastProducedSecond !== currentSec
    );
    if (activeEntries.length === 0) return;

    if (typeof liveMarketStore.produceTicksBatch === 'function') {
      try {
        const batchItems = activeEntries.map(([sym, st]) => ({
          symbol: sym,
          computeNextPrice: (prevPriceDecimal) =>
            generator(prevPriceDecimal, st.sigma, Math.max(st.precision, 6), st.theta || 0, st.basePrice),
        }));
        const batchRes = await liveMarketStore.produceTicksBatch(batchItems);
        const committedBatch = Array.isArray(batchRes?.committedTicks)
          ? batchRes.committedTicks
          : Array.isArray(batchRes)
            ? batchRes
            : [];
        for (const committed of committedBatch) {
          const st = assetState.get(committed.symbol);
          if (st) {
            applyCommittedSymbolTick(committed.symbol, st, committed);
          }
        }
        return;
      } catch {
        // Fallback por símbolo caso uma falha isolada impeça o batch completo
      }
    }

    const entries = activeEntries.sort((a, b) => {
      const subDiff = b[1].subscribers.size - a[1].subscribers.size;
      if (subDiff !== 0) return subDiff;
      const aSynth = a[0].startsWith('VOL_') || a[0].startsWith('CRASH_') ? 1 : 0;
      const bSynth = b[0].startsWith('VOL_') || b[0].startsWith('CRASH_') ? 1 : 0;
      return bSynth - aSynth;
    });
    const BATCH_SIZE = 6;
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(([sym, st]) => produceSymbolTick(sym, st, targetSlotSec)));
    }
  } finally {
    isTickLoopRunning = false;
  }
}

async function bootstrapMarketState() {
  if (!liveMarketStore) {
    throw new Error('LIVE_MARKET_STORE_UNAVAILABLE');
  }
  const heads = await liveMarketStore.initialize(ASSETS_CONFIG);
  for (const item of ASSETS_CONFIG) {
    const state = assetState.get(item.symbol);
    let head = heads.get(item.symbol);
    if (!state || !head) {
      throw new Error(`BOOTSTRAP_MISSING_HEAD:${item.symbol}`);
    }
    if (FEATURE_UNIFIED_OU_ENGINE && typeof liveMarketStore.ensureHeadPriceContinuity === 'function') {
      const sanitizedHeadPrice = sanitizeBootPrice(head.price, item.price, item.precision);
      if (sanitizedHeadPrice !== Number(head.price).toFixed(item.precision)) {
        head = await liveMarketStore.ensureHeadPriceContinuity(item.symbol, sanitizedHeadPrice);
      }
    }
    if (head.sequence > 0 && typeof liveMarketStore.rebuildCandles === 'function') {
      await liveMarketStore.rebuildCandles(item.symbol, { interval: '1m' });
    }
    const officialCandles = await liveMarketStore.loadCandles(item.symbol, CANDLE_BUFFER_MAX_SIZE);
    const persistedTicks = head.sequence > 0
      ? await liveMarketStore.readTicksSince(item.symbol, Math.max(0, head.sequence - 10_000), 10_000)
      : [];
    state.tickHistory = [];
    state.candles5s = [];
    for (const pt of persistedTicks) {
      recordTickInHistory(state, {
        sequence: pt.sequence,
        price: pt.price,
        event_time: Date.parse(pt.ts),
        ts: pt.ts,
      });
      applyTickToCandleBuffer(state.candles5s, {
        timeSec: Math.floor(Date.parse(pt.ts) / 1000),
        priceStr: pt.price,
        precision: item.precision,
        sequence: pt.sequence,
        stepSec: 5,
        maxBufferSize: CANDLE_5S_BUFFER_MAX_SIZE,
        provenance: 'official',
      });
    }
    const formattedOfficial = officialCandles.map((c) => ({
      time: Number(c.time),
      open: Number(c.open).toFixed(item.precision),
      high: Number(c.high).toFixed(item.precision),
      low: Number(c.low).toFixed(item.precision),
      close: Number(c.close).toFixed(item.precision),
      volume: Number(c.volume),
      legacy: false,
      provenance: 'official',
    }));
    const nowSec = Math.floor(Date.now() / 1000);
    const currentMinuteSec = Math.floor(nowSec / 60) * 60;

    // Isola segmento oficial recente e contíguo
    const maxOfficialLagSec = FEATURE_UNIFIED_OU_ENGINE ? 120 : 86400;
    let contiguousOfficial = [];
    if (formattedOfficial.length > 0) {
      const lastCandle = formattedOfficial[formattedOfficial.length - 1];
      if (currentMinuteSec - lastCandle.time <= maxOfficialLagSec) {
        contiguousOfficial.unshift(lastCandle);
        for (let i = formattedOfficial.length - 2; i >= 0; i--) {
          const prev = formattedOfficial[i];
          const curr = contiguousOfficial[0];
          if (curr.time - prev.time <= 120 && curr.time - prev.time >= 60) {
            contiguousOfficial.unshift(prev);
          } else {
            break;
          }
        }
      }
    }

    const anchorMinuteSec = contiguousOfficial.length > 0
      ? contiguousOfficial[0].time - 60
      : currentMinuteSec - 60;
    const anchorPrice = contiguousOfficial.length > 0
      ? parseFloat(contiguousOfficial[0].open)
      : parseFloat(head.price || item.price);
    const legacyCount = Math.max(0, CANDLE_BUFFER_INITIAL_SEED - contiguousOfficial.length);
    let legacyBars = [];
    if (legacyCount > 0) {
      if (FEATURE_UNIFIED_OU_ENGINE) {
        const persistedSeeded = typeof liveMarketStore.loadSeededCandles === 'function'
          ? await liveMarketStore.loadSeededCandles(item.symbol, CANDLE_BUFFER_MAX_SIZE)
          : [];
        const seededMap = new Map();
        for (const c of persistedSeeded) {
          const t = Number(c.time);
          if (t <= anchorMinuteSec) {
            seededMap.set(t, {
              time: t,
              open: Number(c.open).toFixed(item.precision),
              high: Number(c.high).toFixed(item.precision),
              low: Number(c.low).toFixed(item.precision),
              close: Number(c.close).toFixed(item.precision),
              volume: Number(c.volume),
              legacy: true,
              provenance: 'legacy_visual',
            });
          }
        }
        // Incorpora eventuais velas oficiais antigas anteriores ao corte oficial atual para nunca perdê-las
        const olderOfficialToSave = [];
        for (const c of formattedOfficial) {
          if (c.time <= anchorMinuteSec) {
            const asSeed = {
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
              volume: c.volume,
              legacy: true,
              provenance: 'legacy_visual',
            };
            if (!seededMap.has(c.time)) {
              olderOfficialToSave.push(asSeed);
            }
            seededMap.set(c.time, asSeed);
          }
        }
        if (olderOfficialToSave.length > 0 && typeof liveMarketStore.saveSeededCandles === 'function') {
          await liveMarketStore.saveSeededCandles(item.symbol, olderOfficialToSave);
        }

        let seededList = Array.from(seededMap.values()).sort((a, b) => a.time - b.time);

        if (seededList.length > 0) {
          const lastSeeded = seededList[seededList.length - 1];
          // Se houve janela offline entre lastSeeded.time e anchorMinuteSec, preenche para frente a partir de lastSeeded.close
          if (lastSeeded.time < anchorMinuteSec && anchorMinuteSec - lastSeeded.time <= 86400) {
            const gapBars = generateForwardGapCandles(
              item.symbol,
              item.price,
              item.precision,
              item.sigma,
              item.theta,
              parseFloat(lastSeeded.close),
              lastSeeded.time + 60,
              anchorMinuteSec
            );
            if (gapBars.length > 0) {
              if (typeof liveMarketStore.saveSeededCandles === 'function') {
                await liveMarketStore.saveSeededCandles(item.symbol, gapBars);
              }
              seededList = [...seededList, ...gapBars];
              if (contiguousOfficial.length === 0 && typeof liveMarketStore.ensureHeadPriceContinuity === 'function') {
                head = await liveMarketStore.ensureHeadPriceContinuity(
                  item.symbol,
                  gapBars[gapBars.length - 1].close
                );
              }
            }
          }
        }

        // Verifica se a série persistida conecta suavemente com anchorMinuteSec / anchorPrice
        const lastAfterGap = seededList.length > 0 ? seededList[seededList.length - 1] : null;
        const junctionDiff = lastAfterGap
          ? Math.abs(anchorPrice - parseFloat(lastAfterGap.close))
          : Infinity;
        const maxJunctionDiff = lastAfterGap
          ? 3 * item.sigma * parseFloat(lastAfterGap.close)
          : 0;
        const isConnected =
          lastAfterGap &&
          lastAfterGap.time === anchorMinuteSec &&
          (contiguousOfficial.length === 0 || junctionDiff < maxJunctionDiff) &&
          seededList.length >= Math.min(legacyCount, 1440);

        if (isConnected) {
          legacyBars = seededList.slice(-legacyCount);
          if (contiguousOfficial.length === 0 && typeof liveMarketStore.ensureHeadPriceContinuity === 'function') {
            head = await liveMarketStore.ensureHeadPriceContinuity(item.symbol, lastAfterGap.close);
          }
        } else {
          legacyBars = generateSeededHistoricalCandlesUnified(
            item.symbol,
            item.price,
            item.precision,
            item.sigma,
            item.theta,
            legacyCount,
            anchorMinuteSec,
            anchorPrice
          );
          if (typeof liveMarketStore.saveSeededCandles === 'function') {
            await liveMarketStore.saveSeededCandles(item.symbol, legacyBars);
          }
        }
      } else {
        legacyBars = generateSeededHistoricalCandles(
          item.symbol,
          anchorPrice,
          item.precision,
          item.legacySigma || item.sigma,
          legacyCount,
          anchorMinuteSec
        );
      }
    }

    state.currentPrice = head.price;
    state.sequence = head.sequence;
    state.prevHash = head.hash;
    const headTsMs = head.ts ? Date.parse(head.ts) : Date.now();
    state.lastTs = head.sequence > 0 && Number.isFinite(headTsMs) ? headTsMs : 0;
    state.lastProducedSecond = head.sequence > 0 && Number.isFinite(headTsMs)
      ? Math.floor(headTsMs / 1000)
      : 0;
    state.officialCandles = [...formattedOfficial];
    state.candles = [...legacyBars, ...contiguousOfficial].slice(-CANDLE_BUFFER_MAX_SIZE);
  }
  marketReady = true;
}

let tickTimer = null;
let pruneTimer = null;

bootstrapMarketState()
  .then(() => {
    alignedScheduler = createAlignedTickScheduler({
      onTickSlot: async (slotSec) => {
        await runTickLoopCycle(slotSec);
      },
      intervalMs: 1000,
    });
    alignedScheduler.start();

    pruneTimer = setInterval(() => {
      if (liveMarketStore && typeof liveMarketStore.pruneMarketStorage === 'function') {
        liveMarketStore.pruneMarketStorage().catch(() => {});
      }
    }, 60_000);
    if (typeof pruneTimer.unref === 'function') pruneTimer.unref();

    server.listen(PORT, HOST, () => {
      console.log(`📡 [DevLiveFeed] WebSocket & REST Feed ativo em ws://${HOST}:${PORT}/ticks e http://${HOST}:${PORT}/candles (36 ativos)`);
    });
  })
  .catch((err) => {
    console.error('[DevLiveFeed Bootstrap Fatal]', err.message);
    process.exit(1);
  });

async function shutdownGracefully() {
  marketReady = false;
  if (alignedScheduler) alignedScheduler.stop();
  if (tickTimer) clearInterval(tickTimer);
  if (pruneTimer) clearInterval(pruneTimer);
  try {
    if (liveMarketStore) await liveMarketStore.close();
  } catch {}
  process.exit(0);
}

process.once('SIGTERM', shutdownGracefully);
process.once('SIGINT', shutdownGracefully);
