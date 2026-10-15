import http from 'node:http';
import https from 'node:https';
import { createRequire } from 'node:module';
import {
  createPriceGenerator,
  canonicalHash,
  nextSequence,
  genesisHash,
} from '../services/tick-engine/core.mjs';

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
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  if (signature !== expectedSig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
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

const PORT = 3001;
const HOST = '127.0.0.1';

// Catálogo com os 36 ativos e configurações calibradas por classe de ativo
const ASSETS_CONFIG = [
  // Forex OTC (18) - Menor volatilidade, micro-tendências e ruído refinado
  { symbol: 'EURUSD_OTC', price: 1.08542, precision: 5, sigma: 0.00018 },
  { symbol: 'GBPUSD_OTC', price: 1.29415, precision: 5, sigma: 0.00020 },
  { symbol: 'USDJPY_OTC', price: 153.820, precision: 3, sigma: 0.00018 },
  { symbol: 'USDCHF_OTC', price: 0.86510, precision: 5, sigma: 0.00017 },
  { symbol: 'AUDUSD_OTC', price: 0.65820, precision: 5, sigma: 0.00019 },
  { symbol: 'USDCAD_OTC', price: 1.38450, precision: 5, sigma: 0.00018 },
  { symbol: 'NZDUSD_OTC', price: 0.59820, precision: 5, sigma: 0.00019 },
  { symbol: 'EURGBP_OTC', price: 0.83850, precision: 5, sigma: 0.00016 },
  { symbol: 'EURJPY_OTC', price: 166.950, precision: 3, sigma: 0.00020 },
  { symbol: 'GBPJPY_OTC', price: 199.120, precision: 3, sigma: 0.00022 },
  { symbol: 'EURCAD_OTC', price: 1.50280, precision: 5, sigma: 0.00019 },
  { symbol: 'EURAUD_OTC', price: 1.64890, precision: 5, sigma: 0.00020 },
  { symbol: 'GBPAUD_OTC', price: 1.96620, precision: 5, sigma: 0.00021 },
  { symbol: 'GBPCAD_OTC', price: 1.79210, precision: 5, sigma: 0.00020 },
  { symbol: 'AUDCAD_OTC', price: 0.91120, precision: 5, sigma: 0.00018 },
  { symbol: 'AUDJPY_OTC', price: 101.250, precision: 3, sigma: 0.00019 },
  { symbol: 'CADJPY_OTC', price: 111.120, precision: 3, sigma: 0.00019 },
  { symbol: 'NZDJPY_OTC', price: 92.050, precision: 3, sigma: 0.00019 },

  // Cripto OTC (8) - Alta volatilidade, barras de impulso e sombras dinâmicas
  { symbol: 'BTCUSD_OTC', price: 64850.00, precision: 2, sigma: 0.00065 },
  { symbol: 'ETHUSD_OTC', price: 3450.00, precision: 2, sigma: 0.00075 },
  { symbol: 'SOLUSD_OTC', price: 152.40, precision: 2, sigma: 0.00090 },
  { symbol: 'BNBUSD_OTC', price: 585.00, precision: 2, sigma: 0.00055 },
  { symbol: 'XRPUSD_OTC', price: 0.5420, precision: 4, sigma: 0.00085 },
  { symbol: 'ADAUSD_OTC', price: 0.3540, precision: 4, sigma: 0.00085 },
  { symbol: 'DOGEUSD_OTC', price: 0.1240, precision: 4, sigma: 0.00110 },
  { symbol: 'AVAXUSD_OTC', price: 28.40, precision: 2, sigma: 0.00095 },

  // Commodities OTC (4) - Tendências orgânicas e volatilidade média
  { symbol: 'XAUUSD_OTC', price: 2652.80, precision: 2, sigma: 0.00030 },
  { symbol: 'XAGUSD_OTC', price: 31.750, precision: 3, sigma: 0.00045 },
  { symbol: 'USOIL_OTC', price: 72.40, precision: 2, sigma: 0.00040 },
  { symbol: 'UKOIL_OTC', price: 76.20, precision: 2, sigma: 0.00040 },

  // Sintéticos (6) - Padrão Ouro Opções Binárias
  { symbol: 'VOL_10', price: 100.5420, precision: 4, sigma: 0.00015 },
  { symbol: 'VOL_25', price: 250.8410, precision: 4, sigma: 0.00030 },
  { symbol: 'VOL_50', price: 500.1250, precision: 4, sigma: 0.00060 },
  { symbol: 'VOL_75', price: 750.3200, precision: 4, sigma: 0.00085 },
  { symbol: 'VOL_100', price: 1000.4500, precision: 4, sigma: 0.00110 },
  { symbol: 'CRASH_BOOM_100', price: 1000.8200, precision: 4, sigma: 0.00130 },
];

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

// PRNG determinístico por seed (Mulberry32)
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

// Gera histórico de velas realista com passeio estocástico individual por ativo (24 horas)
function generateSeededHistoricalCandles(symbol, basePrice, precision, sigma, count = CANDLE_BUFFER_INITIAL_SEED) {
  const rand = createSeededRandom(symbol + '_prime_market_v3');
  const nowMinute = Math.floor(Date.now() / 60000) * 60;
  const bars = [];
  let currentClose = basePrice;

  // Passeio browniano reverso a partir do preço base para continuidade exata com os ticks
  for (let i = 0; i < count; i++) {
    const t = nowMinute - (i * 60);
    const z = nextGaussian(rand);
    // Variação percentual estocástica de 1 minuto
    const step = z * (currentClose * sigma);
    const openVal = Math.max(currentClose * 0.01, currentClose - step);
    const bodyTop = Math.max(openVal, currentClose);
    const bodyBottom = Math.min(openVal, currentClose);

    // Sombras dinâmicas (wicks) independentes
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
    });

    currentClose = openVal;
  }
  return bars;
}

const generator = createPriceGenerator();

// Inicialização dos 36 ativos com velas históricas e feeds
const assetState = new Map();
for (const item of ASSETS_CONFIG) {
  const gHash = genesisHash(item.symbol);
  const initialCandles = generateSeededHistoricalCandles(
    item.symbol,
    item.price,
    item.precision,
    item.sigma,
    CANDLE_BUFFER_INITIAL_SEED
  );

  assetState.set(item.symbol, {
    symbol: item.symbol,
    basePrice: item.price,
    currentPrice: item.price.toFixed(item.precision),
    precision: item.precision,
    sigma: item.sigma,
    sequence: 1,
    prevHash: gHash,
    candles: initialCandles,
    subscribers: new Set(),
    lastTs: Date.now(),
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

// Resolução de intervalo em segundos (Subetapa 2)
function parseIntervalSeconds(intervalStr) {
  if (!intervalStr) return 60;
  if (intervalStr === '5s') return 5;
  if (intervalStr === '15s') return 15;
  if (intervalStr === '30s') return 30;
  if (intervalStr === '1m') return 60;
  if (intervalStr === '5m') return 300;
  if (intervalStr === '15m') return 900;
  if (intervalStr === '30m') return 1800;
  if (intervalStr === '1h') return 3600;
  return 60;
}

// Agrega velas base (1m) para timeframe superior em alta velocidade (Subetapa 2)
function aggregateCandlesToInterval(baseBars, intervalSec) {
  if (!baseBars || baseBars.length === 0 || intervalSec <= 60) return baseBars;
  const map = new Map();
  for (const b of baseBars) {
    const bucket = Math.floor(b.time / intervalSec) * intervalSec;
    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, {
        time: bucket,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      });
    } else {
      const curHigh = parseFloat(existing.high);
      const curLow = parseFloat(existing.low);
      const bHigh = parseFloat(b.high);
      const bLow = parseFloat(b.low);
      if (bHigh > curHigh) existing.high = b.high;
      if (bLow < curLow) existing.low = b.low;
      existing.close = b.close;
      existing.volume += b.volume;
    }
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

  // Endpoint REST de velas: /candles ou /api/candles (com suporte a paginação 'before', 'interval' e 'limit' ampliado)
  if (pathname === '/candles' || pathname === '/api/candles') {
    const rawSymbol = parsedUrl.searchParams.get('symbol') || 'VOL_50';
    const symbol = resolveSymbol(rawSymbol);
    const state = assetState.get(symbol);
    if (!state) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Asset not found' }));
      return;
    }
    const intervalStr = parsedUrl.searchParams.get('interval') || '1m';
    const intervalSec = parseIntervalSeconds(intervalStr);
    const rawLimit = parseInt(parsedUrl.searchParams.get('limit') || '1440', 10);
    const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 1440 : rawLimit), CANDLE_BUFFER_MAX_SIZE);

    let matched = state.candles;
    const beforeParam = parsedUrl.searchParams.get('before');
    if (beforeParam) {
      const beforeSec = parseInt(beforeParam, 10);
      if (!isNaN(beforeSec) && beforeSec > 0) {
        const cutIdx = findCutoffIndexBefore(state.candles, beforeSec);
        matched = cutIdx >= 0 ? state.candles.slice(0, cutIdx + 1) : [];
      }
    }

    if (intervalSec > 60) {
      matched = aggregateCandlesToInterval(matched, intervalSec);
    }

    const data = matched.slice(-limit);
    const hasMore = matched.length > limit;

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'X-Total-Bars': String(data.length),
      'X-Has-More': String(hasMore),
      'Cache-Control': 'public, max-age=5',
    });
    res.end(JSON.stringify(data));
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
    const contractId = contractMatch[3];
    let found = null;

    if (pgPool) {
      try {
        const queryRes = await pgPool.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
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
      found = devContracts.find(c => c.id === contractId);
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
          if (testHash === mUser.password_hash) {
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

  // Endpoint de Carteira: /api/wallet, /wallet, /api/v1/wallet, /v1/wallet (Blnk Ledger Oficial - D-02, I-01)
  if (pathname === '/api/wallet' || pathname === '/wallet' || pathname === '/api/v1/wallet' || pathname === '/v1/wallet') {
    const authData = extractBearerUser(req);
    if (authData && authData.sub) {
      let resolvedBalance = null;

      // 1. Tenta obter o saldo oficial do Blnk Ledger
      if (blnk) {
        try {
          let blnkBalance;
          try {
            blnkBalance = await blnk.getBalance(authData.sub);
          } catch (bErr) {
            if (bErr.message?.includes('404') || bErr.message?.includes('not found') || bErr.message?.includes('BLNK_HTTP_ERROR_404')) {
              await blnk.onboardUser(authData.sub);
              blnkBalance = await blnk.getBalance(authData.sub);
            } else {
              throw bErr;
            }
          }
          if (blnkBalance && Number.isSafeInteger(Number(blnkBalance.available_minor))) {
            resolvedBalance = {
              currency: 'USD',
              available_minor: Number(blnkBalance.available_minor),
              reserved_minor: Number(blnkBalance.reserved_minor || 0)
            };
            // Espelha atomicamente no PostgreSQL para consistência forte
            if (pgPool) {
              pgPool.query('UPDATE users SET demo_balance_minor = $1, updated_at = NOW() WHERE id = $2', [resolvedBalance.available_minor, authData.sub]).catch(() => {});
            }
          }
        } catch (err) {
          console.warn('[Blnk Wallet Error, attempting PostgreSQL fallback]:', err.message);
        }
      }

      // 2. Fallback resiliente no PostgreSQL (I-01, D-05)
      if (!resolvedBalance && pgPool) {
        try {
          const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
          if (uRes.rows.length > 0) {
            resolvedBalance = {
              currency: 'USD',
              available_minor: Number(uRes.rows[0].demo_balance_minor),
              reserved_minor: 0
            };
          }
        } catch (dbErr) {
          console.error('[DB Wallet Fallback Error]:', dbErr.message);
        }
      }

      // 3. Fallback em memória para ambiente de teste
      if (!resolvedBalance) {
        for (const mUser of memoryUsers.values()) {
          if (mUser.id === authData.sub) {
            resolvedBalance = {
              currency: 'USD',
              available_minor: Number(mUser.demo_balance_minor || 1000000),
              reserved_minor: 0
            };
            break;
          }
        }
      }

      if (resolvedBalance) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resolvedBalance));
        return;
      }
    }

    // Modo Convidado / Anônimo não autenticado
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(devWallet));
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
        const idempotencyKey = req.headers['idempotency-key'] || payload.idempotency_key || ('idem_dep_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

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
        const idempotencyKey = req.headers['idempotency-key'] || payload.idempotency_key || ('idem_wth_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));

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
    const filter = parsedUrl.searchParams.get('result');

    if (authData && authData.sub && pgPool) {
      try {
        let query = `
          SELECT id, symbol, direction, status, result, stake_minor, payout_minor,
                 entry_price, exit_price, opened_at, expires_at, settled_at, created_at
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
        const payload = JSON.parse(body || '{}');
        const rawSymbol = payload.symbol;
        const symbol = resolveSymbol(rawSymbol);
        const dbSymbol = (rawSymbol && rawSymbol.startsWith('SYNTH_')) ? rawSymbol : (symbol.startsWith('VOL_') || symbol.startsWith('CRASH_') ? 'SYNTH_' + symbol : symbol);
        const { direction, stake_minor } = payload;
        const stake = parseInt(stake_minor, 10);

        if (!symbol || !assetState.has(symbol)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INVALID_SYMBOL', message: 'Símbolo inválido' }));
          return;
        }

        const state = assetState.get(symbol);
        if (state.paused) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INDEX_PAUSED', message: 'Índice pausado' }));
          return;
        }

        // Validação de Staleness (Perigo 1)
        const now = Date.now();
        const age = now - (state.lastTs || now);
        if (age > 4000) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'FEED_STALE', message: 'Feed de cotações congelado' }));
          return;
        }

        const authData = extractBearerUser(req);
        const idempotencyKey = req.headers['idempotency-key'] || ('idem_' + Date.now() + '_' + crypto.randomBytes(6).toString('hex'));
        activeIdemKey = idempotencyKey;

        // Trava de Concorrência e Idempotência In-Flight (Skill 05-resilience-patterns)
        if (inFlightOrders.has(idempotencyKey)) {
          try {
            const existing = await inFlightOrders.get(idempotencyKey);
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
        inFlightOrders.set(idempotencyKey, inFlightPromise);
        setTimeout(() => inFlightOrders.delete(idempotencyKey), 60_000);

        // 1. Verificação prévia de Idempotência no PostgreSQL (D-12, B-05, I-03)
        if (authData && authData.sub && pgPool) {
          try {
            const existingRes = await pgPool.query(
              `SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
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

        // 1.1 Verificação de Idempotência em memória (resiliência de contingência)
        const targetUserId = authData?.sub || '00000000-0000-4000-8000-000000000001';
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

        let userBalance = devWallet.available_minor;

        if (authData && authData.sub && pgPool) {
          try {
            const uRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
            if (uRes.rows.length > 0) {
              userBalance = Number(uRes.rows[0].demo_balance_minor);
            }
          } catch (err) {
            console.error('[DB Balance Check Error - Failing Closed]', err.message);
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'BALANCE_CHECK_UNAVAILABLE', message: 'Não foi possível verificar saldo' }));
            return;
          }
        }

        if (!Number.isFinite(stake) || stake < 100 || stake > userBalance) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' }));
          return;
        }

        // 1. Dedução atômica persistida no PostgreSQL para o usuário autenticado (I-01 a I-03)
        if (authData && authData.sub && pgPool) {
          try {
            const deductRes = await pgPool.query(
              'UPDATE users SET demo_balance_minor = demo_balance_minor - $1, updated_at = NOW() WHERE id = $2 AND demo_balance_minor >= $1 RETURNING demo_balance_minor',
              [stake, authData.sub]
            );
            if (deductRes.rows.length === 0) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ code: 'INSUFFICIENT_BALANCE', message: 'Saldo insuficiente' }));
              return;
            }
          } catch (dbDeductErr) {
            console.error('[DB Stake Deduct Error]', dbDeductErr.message);
          }
        }

        devWallet.available_minor = Math.max(0, devWallet.available_minor - stake);
        devWallet.reserved_minor += stake;

        const contractId = crypto.randomUUID();

        // 2. Reserva contábil no Blnk Ledger
        if (blnk && authData && authData.sub) {
          blnk.reserveStake(authData.sub, contractId, stake).catch(e => {
            console.warn('[Blnk Reserve Warning]:', e.message);
          });
        }
        const entryPrice = parseFloat(state.currentPrice);

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
            // 1M_FIXED ou turbo: segundos corridos a partir da recepção
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
          user_id: authData?.sub || '00000000-0000-4000-8000-000000000001',
          symbol: dbSymbol,
          direction: direction === 'DOWN' ? 'DOWN' : 'UP',
          stake_minor: stake,
          status: 'OPEN',
          result: null,
          payout_minor: null,
          expires_at: expiresAt,
          created_at: new Date(now).toISOString(),
          entry_price: entryPrice,
          strike_price: entryPrice,
          exit_price: null,
          duration_seconds: durationSeconds,
          expiry_mode: expiryMode,
          idempotency_key: idempotencyKey
        };

        // 2. Persistência Atômica ACID no PostgreSQL: Contrato + Outbox RESERVE_STAKE (I-04, DB-07, R-01)
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
            `, [contractId, authData.sub, dbSymbol, direction === 'DOWN' ? 'DOWN' : 'UP', stake, entryPrice, idempotencyKey, expiresAt]);

            const outboxPayload = JSON.stringify({
              contract_id: contractId,
              user_id: authData.sub,
              stake_minor: stake,
              symbol: dbSymbol
            });

            await dbClient.query(`
              INSERT INTO outbox_events (event_type, payload, status)
              VALUES ('RESERVE_STAKE', $1, 'PENDING')
            `, [outboxPayload]);

            await dbClient.query('COMMIT');
          } catch (dbErr) {
            if (dbClient) {
              try { await dbClient.query('ROLLBACK'); } catch (_) {}
            }
            console.error('[DB Atomic Insert Contract Error]', dbErr.message);
            // Se falhou por violação de unicidade de idempotência concorrente, tenta retornar o existente
            if (dbErr.code === '23505' && dbErr.constraint === 'uq_contracts_user_idempotency') {
              try {
                const dupRes = await pgPool.query(
                  `SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
                   FROM contracts WHERE user_id = $1 AND idempotency_key = $2`,
                  [authData.sub, idempotencyKey]
                );
                if (dupRes.rows.length > 0) {
                  const dRow = dupRes.rows[0];
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({
                    success: true,
                    is_duplicate: true,
                    contract: {
                      id: dRow.id,
                      user_id: dRow.user_id,
                      symbol: dRow.symbol,
                      direction: dRow.direction,
                      stake_minor: parseInt(dRow.stake_minor, 10),
                      status: dRow.status,
                      entry_price: Number(dRow.entry_price),
                      expires_at: new Date(dRow.expires_at).toISOString()
                    }
                  }));
                  return;
                }
              } catch (_) {}
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ code: 'DB_TRANSACTION_FAILED', message: 'Falha na gravação atômica do contrato' }));
            return;
          } finally {
            if (dbClient) {
              try { dbClient.release(); } catch (_) {}
            }
          }
        }

        devContracts.unshift(newContract);
        if (resolveInFlight) resolveInFlight(newContract);

        // Reserva contábil de stake no Blnk Ledger (I-02, I-03) disparada de forma assíncrona
        // A garantia de consistência reside no evento atômico RESERVE_STAKE na outbox_events do PostgreSQL (Subetapa 9.2)
        if (blnk && authData && authData.sub) {
          blnk.reserveStake(authData.sub, contractId, stake).catch((reserveErr) => {
            console.error('[Blnk Stake Reservation Async Error]', reserveErr.message);
          });
        }

        // Agendamento de Liquidação oficial contra o tick autêntico do símbolo (Subetapa 9.3)
        const settlementDelayMs = Math.max(1000, targetExpiryEpoch - Date.now());
        setTimeout(async () => {
          const target = devContracts.find(c => c.id === contractId);
          if (target && target.status === 'OPEN') {
            const curState = assetState.get(symbol);
            const exitPrice = parseFloat(curState ? curState.currentPrice : entryPrice);
            const isUp = target.direction === 'UP';
            const won = (isUp && exitPrice > entryPrice) || (!isUp && exitPrice < entryPrice);
            const draw = exitPrice === entryPrice;
            const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
            const payoutMinor = won ? Math.round(stake * 1.85) : draw ? stake : 0;

            target.status = 'SETTLED';
            target.result = result;
            target.payout_minor = payoutMinor;
            target.exit_price = exitPrice;
            target.strike_price = exitPrice;

            devWallet.reserved_minor = Math.max(0, devWallet.reserved_minor - stake);
            devWallet.available_minor += payoutMinor;

            // 1. Atualização do saldo do usuário no PostgreSQL (I-01, I-04, I-05)
            let updatedUserBalance = null;
            if (pgPool && authData && authData.sub) {
              try {
                if (payoutMinor > 0) {
                  const creditRes = await pgPool.query(`
                    UPDATE users
                    SET demo_balance_minor = demo_balance_minor + $1, updated_at = NOW()
                    WHERE id = $2
                    RETURNING demo_balance_minor
                  `, [payoutMinor, authData.sub]);
                  if (creditRes.rows.length > 0) {
                    updatedUserBalance = Number(creditRes.rows[0].demo_balance_minor);
                  }
                } else {
                  // LOSS: A stake já foi debitada na abertura. Consulta o saldo atual persistido
                  const balRes = await pgPool.query('SELECT demo_balance_minor FROM users WHERE id = $1', [authData.sub]);
                  if (balRes.rows.length > 0) {
                    updatedUserBalance = Number(balRes.rows[0].demo_balance_minor);
                  }
                }
              } catch (dbErr) {
                console.error('[DB Settlement Balance Update Error]', dbErr.message);
              }
            }

            // 2. Liquidação contábil oficial no Blnk Ledger (D-19, I-02, I-04, I-05)
            if (blnk && authData && authData.sub) {
              try {
                await blnk.settleContract(contractId, authData.sub, result, stake, payoutMinor);
                const bal = await blnk.getBalance(authData.sub);
                if (bal && Number.isSafeInteger(Number(bal.available_minor))) {
                  updatedUserBalance = Number(bal.available_minor);
                }
              } catch (blnkSettleErr) {
                console.warn('[Blnk Settlement Warning]', blnkSettleErr.message);
              }
            }

            // 3. Persiste estado final do contrato no PostgreSQL
            if (pgPool && authData && authData.sub) {
              try {
                await pgPool.query(`
                  UPDATE contracts
                  SET status = 'SETTLED', result = $1, payout_minor = $2, exit_price = $3, settled_at = NOW()
                  WHERE id = $4
                `, [result, payoutMinor, exitPrice, contractId]);
              } catch (dbErr) {
                console.error('[DB Settlement Update Error]', dbErr.message);
              }
            }

            // 4. Broadcast de liquidação e saldo aos clientes conectados
            const finalBroadcastBal = updatedUserBalance !== null ? updatedUserBalance : devWallet.available_minor;
            for (const client of wss.clients) {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'wallet_balance', available_minor: finalBroadcastBal }));
                client.send(
                  JSON.stringify({
                    type: 'contract_settled',
                    contract_id: contractId,
                    result,
                    stake_minor: stake,
                    payout_minor: payoutMinor,
                    symbol: target.symbol,
                    direction: target.direction,
                  })
                );
              }
            }
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

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(lines.join('\n') + '\n');
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
        ws.send(JSON.stringify({ type: 'authenticated' }));
        ws.send(JSON.stringify({ type: 'auth_ok', user_id: 'guest-demo' }));
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

// Intervalo de geração estocástica de ticks a 1 tick/segundo (1Hz) e agregação de velas
setInterval(() => {
  const now = Date.now();
  const ts = new Date(now).toISOString();
  const currentBucket = Math.floor(now / 60000) * 60;

  for (const [symbol, state] of assetState.entries()) {
    if (state.paused) continue;
    state.lastTs = now;

    // 1. Gera próximo tick estocástico via Box-Muller CSPRNG + Reversão à Média (Ornstein-Uhlenbeck)
    const rawNext = generator(state.currentPrice, state.sigma, state.precision);
    const currentNum = parseFloat(state.currentPrice);
    const rawNextNum = parseFloat(rawNext);
    const theta = 0.004;
    const ouPull = state.basePrice ? theta * (state.basePrice - currentNum) : 0;
    const nextPriceNum = Math.max((state.basePrice || currentNum) * 0.1, rawNextNum + ouPull);
    const nextPrice = nextPriceNum.toFixed(state.precision);
    const nextSeq = nextSequence(state.sequence);
    const hash = canonicalHash(state.prevHash, symbol, nextSeq, ts, nextPrice);

    state.currentPrice = nextPrice;
    state.sequence = nextSeq;
    state.prevHash = hash;

    // 2. Atualiza / Adiciona vela em tempo real no histórico do ativo
    const lastBar = state.candles[state.candles.length - 1];
    if (lastBar && lastBar.time === currentBucket) {
      // Atualiza extremos da vela em formação respeitando invariantes de OHLC
      const curHigh = parseFloat(lastBar.high);
      const curLow = parseFloat(lastBar.low);
      const openNum = parseFloat(lastBar.open);
      const newHigh = Math.max(curHigh, nextPriceNum, openNum);
      const newLow = Math.min(curLow, nextPriceNum, openNum);
      lastBar.high = newHigh.toFixed(state.precision);
      lastBar.low = newLow.toFixed(state.precision);
      lastBar.close = nextPrice;
      lastBar.volume += 1;
    } else {
      // Nova vela de 1 minuto com extremos consistentes com open e close
      const prevClose = lastBar ? lastBar.close : nextPrice;
      const prevCloseNum = parseFloat(prevClose);
      const highVal = Math.max(prevCloseNum, nextPriceNum);
      const lowVal = Math.min(prevCloseNum, nextPriceNum);
      const newBar = {
        time: currentBucket,
        open: prevClose,
        high: highVal.toFixed(state.precision),
        low: lowVal.toFixed(state.precision),
        close: nextPrice,
        volume: 1,
      };
      state.candles.push(newBar);
      if (state.candles.length > CANDLE_BUFFER_MAX_SIZE) {
        state.candles.shift();
      }
    }

    // 3. Broadcast de ticks aos clientes inscritos
    if (state.subscribers.size > 0) {
      const tickPayload = JSON.stringify({
        type: 'tick',
        symbol,
        sequence: nextSeq,
        ts,
        event_time: now,
        arrival_time: now,
        latency_ms: 0,
        price: nextPrice,
        hash,
      });

      for (const client of state.subscribers) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(tickPayload);
        }
      }
    }
  }
}, 1000);

server.listen(PORT, HOST, () => {
  console.log(`📡 [DevLiveFeed] WebSocket & REST Feed ativo em ws://${HOST}:${PORT}/ticks e http://${HOST}:${PORT}/candles (36 ativos)`);
});
