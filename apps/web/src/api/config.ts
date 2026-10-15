/**
 * Resolvedor Centralizado e Blindado de Topologia de URL (Subetapa 2 — Item 1B)
 * Garante funcionamento idêntico tanto em proxy reverso no mesmo host (Nginx VPS)
 * quanto em deploy desacoplado (Cloudflare Pages / Workers em outro domínio),
 * bloqueando protocolos inseguros (SSRF/XSS client-side) e evitando duplicação /api/api.
 */

export interface EnvTopologyConfig {
  VITE_API_URL?: string;
  VITE_WS_URL?: string;
}

export interface LocationLike {
  protocol?: string;
  host?: string;
  origin?: string;
}

function getDefaultEnv(): EnvTopologyConfig {
  try {
    const metaEnv = (import.meta as unknown as { env?: EnvTopologyConfig })?.env;
    if (metaEnv) return metaEnv;
  } catch {
    // ignore
  }
  return {};
}

function getDefaultLocation(): LocationLike | null {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.host) {
      return window.location;
    }
  } catch {
    // ignore
  }
  return null;
}

const sanitizedBaseCache = new Map<string, string>();

/**
 * Valida e normaliza a URL base da API em O(1) (com cache).
 * Aceita apenas http:// ou https:// absolutos válidos com host real.
 * Remove barras finais e sufixo '/api' duplicado.
 */
export function sanitizeApiBaseUrl(rawUrl?: string | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  const cached = sanitizedBaseCache.get(trimmed);
  if (cached !== undefined) return cached;

  // Pré-validação rápida sem throw: exige http(s):// seguido de hostname válido
  if (!/^https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(trimmed)) {
    sanitizedBaseCache.set(trimmed, '');
    return '';
  }

  let result = '';
  try {
    const parsed = new URL(trimmed);
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.hostname) {
      let cleanPath = parsed.pathname.replace(/\/+$/, '');
      if (cleanPath.toLowerCase().endsWith('/api')) {
        cleanPath = cleanPath.slice(0, -4);
      }
      result = `${parsed.origin}${cleanPath}`;
    }
  } catch {
    result = '';
  }

  if (sanitizedBaseCache.size < 256) {
    sanitizedBaseCache.set(trimmed, result);
  }
  return result;
}

/**
 * Resolve qualquer rota de API (ex: '/v1/wallet' ou '/api/v1/wallet' ou '/api/candles?symbol=VOL_50')
 * para a URL final correta conforme a topologia de deploy.
 */
export function resolveApiUrl(
  path: string,
  envOverride?: EnvTopologyConfig
): string {
  const rawPath = typeof path === 'string' && path.trim() ? path.trim() : '/';
  const normalizedSubpath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;

  const apiPath =
    normalizedSubpath === '/api' || normalizedSubpath.startsWith('/api/') || normalizedSubpath.startsWith('/api?')
      ? normalizedSubpath
      : `/api${normalizedSubpath}`;

  const env = envOverride ?? getDefaultEnv();
  const base = sanitizeApiBaseUrl(env.VITE_API_URL);

  return base ? `${base}${apiPath}` : apiPath;
}

/**
 * Resolve a URL do WebSocket respeitando:
 * 1. VITE_WS_URL explícito (ws:// ou wss://)
 * 2. Derivação automática a partir de VITE_API_URL (quando hospedado em domínio separado como Cloudflare Pages)
 * 3. Mesmo host via window.location (Nginx da VPS + Cloudflare Proxy)
 * 4. Fallback local 'ws://localhost:3001/ws' para testes em Node/SSR
 */
export function resolveWsUrl(
  envOverride?: EnvTopologyConfig,
  locationOverride?: LocationLike | null
): string {
  const env = envOverride ?? getDefaultEnv();
  const rawWs = typeof env.VITE_WS_URL === 'string' ? env.VITE_WS_URL.trim() : '';

  if (rawWs && /^wss?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/.*)?$/i.test(rawWs)) {
    try {
      const parsedWs = new URL(rawWs);
      if ((parsedWs.protocol === 'ws:' || parsedWs.protocol === 'wss:') && parsedWs.hostname) {
        return rawWs.replace(/\/+$/, '');
      }
    } catch {
      // Cai para derivação segura
    }
  }

  // Se VITE_API_URL estiver configurado para outro host, deriva o WebSocket automaticamente
  const apiBase = sanitizeApiBaseUrl(env.VITE_API_URL);
  if (apiBase) {
    const isHttps = apiBase.startsWith('https://');
    const hostPart = apiBase.replace(/^https?:\/\//i, '').split('/')[0];
    if (hostPart) {
      return `${isHttps ? 'wss:' : 'ws:'}//${hostPart}/ws`;
    }
  }

  const loc = locationOverride !== undefined ? locationOverride : getDefaultLocation();
  if (loc && loc.host) {
    const wsProtocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${loc.host}/ws`;
  }

  return 'ws://localhost:3001/ws';
}
