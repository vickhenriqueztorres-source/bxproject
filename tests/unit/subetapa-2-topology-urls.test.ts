import { describe, it, expect } from 'vitest';
import {
  sanitizeApiBaseUrl,
  resolveApiUrl,
  resolveWsUrl,
} from '../../apps/web/src/api/config';

describe('Subetapa 2 — Blindagem de Topologia de URL (VITE_API_URL / VITE_WS_URL)', () => {
  it('[Topologia 1: Mesmo Host / Nginx VPS] Sem VITE_API_URL e sem VITE_WS_URL usa caminhos relativos /api e wss://<host>/ws', () => {
    expect(resolveApiUrl('/v1/wallet', {})).toBe('/api/v1/wallet');
    expect(resolveApiUrl('/api/v1/wallet', {})).toBe('/api/v1/wallet');
    expect(resolveApiUrl('/candles?symbol=VOL_50&interval=1m', {})).toBe(
      '/api/candles?symbol=VOL_50&interval=1m'
    );

    const wsSameHost = resolveWsUrl(
      {},
      { protocol: 'https:', host: 'binmaxbroker.com' }
    );
    expect(wsSameHost).toBe('wss://binmaxbroker.com/ws');

    const wsLocalHttp = resolveWsUrl(
      {},
      { protocol: 'http:', host: 'localhost:5173' }
    );
    expect(wsLocalHttp).toBe('ws://localhost:5173/ws');
  });

  it('[Topologia 2: Deploy Separado Cloudflare Pages] Com VITE_API_URL resolve endpoints remotos sem duplicar /api/api e deriva WSS automaticamente', () => {
    const envWithTrailingSlash = {
      VITE_API_URL: 'https://api.binmaxbroker.com/',
    };
    expect(resolveApiUrl('/v1/wallet', envWithTrailingSlash)).toBe(
      'https://api.binmaxbroker.com/api/v1/wallet'
    );
    expect(resolveApiUrl('/api/v1/auth/login', envWithTrailingSlash)).toBe(
      'https://api.binmaxbroker.com/api/v1/auth/login'
    );

    // Mesmo se o operador configurar VITE_API_URL terminando em /api, não duplica /api/api
    const envWithApiSuffix = {
      VITE_API_URL: 'https://api.binmaxbroker.com/api/',
    };
    expect(resolveApiUrl('/v1/contracts', envWithApiSuffix)).toBe(
      'https://api.binmaxbroker.com/api/v1/contracts'
    );

    // Deriva automaticamente o WebSocket do host da API quando VITE_WS_URL não é informado
    expect(
      resolveWsUrl(envWithTrailingSlash, {
        protocol: 'https:',
        host: 'binmax.pages.dev',
      })
    ).toBe('wss://api.binmaxbroker.com/ws');

    // E respeita VITE_WS_URL explícito quando fornecido
    expect(
      resolveWsUrl(
        {
          VITE_API_URL: 'https://api.binmaxbroker.com',
          VITE_WS_URL: 'wss://ws.binmaxbroker.com/ticks/',
        },
        { protocol: 'https:', host: 'binmax.pages.dev' }
      )
    ).toBe('wss://ws.binmaxbroker.com/ticks');
  });

  it('[Segurança S-04: Anti-SSRF / Anti-XSS Client-Side] Bloqueia esquemas maliciosos em VITE_API_URL e VITE_WS_URL', () => {
    expect(sanitizeApiBaseUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeApiBaseUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(sanitizeApiBaseUrl('file:///etc/passwd')).toBe('');
    expect(sanitizeApiBaseUrl('ftp://malicious.server/api')).toBe('');

    expect(
      resolveApiUrl('/v1/wallet', {
        VITE_API_URL: 'javascript:fetch("https://evil.com")',
      })
    ).toBe('/api/v1/wallet');

    expect(
      resolveWsUrl(
        { VITE_WS_URL: 'javascript:alert(1)' },
        { protocol: 'https:', host: 'binmaxbroker.com' }
      )
    ).toBe('wss://binmaxbroker.com/ws');
  });

  it('[Estresse & Caos] 10.000 resoluções consecutivas de URLs malformadas e concorrentes em < 100ms sem exceção', () => {
    const t0 = performance.now();
    const malformedInputs = [
      '',
      '   ',
      'http://',
      'https://///',
      '://broken',
      'https://api.binmaxbroker.com/api///',
    ];

    let failures = 0;
    for (let i = 0; i < 10_000; i++) {
      const candidate = malformedInputs[i % malformedInputs.length];
      const apiRes = resolveApiUrl('v1/wallet', { VITE_API_URL: candidate });
      const wsRes = resolveWsUrl(
        { VITE_API_URL: candidate, VITE_WS_URL: candidate },
        { protocol: 'https:', host: 'binmaxbroker.com' }
      );
      if (!apiRes.endsWith('/api/v1/wallet') || !wsRes.startsWith('wss://')) {
        failures += 1;
      }
    }
    const elapsed = performance.now() - t0;
    expect(failures).toBe(0);
    expect(elapsed).toBeLessThan(100);
  });
});
