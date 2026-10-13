import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getUserAnalytics,
  type UserAnalyticsResponse,
} from '../api/client';
import { AnalysisPage } from './AnalysisPage';

describe('Auditoria Analítica Real e Telemetria Operacional (Etapa 6)', () => {
  const localStore = new Map<string, string>();
  const sessionStore = new Map<string, string>();

  const mockLocalStorage = {
    getItem: (k: string) => localStore.get(k) ?? null,
    setItem: (k: string, v: string) => localStore.set(k, v),
    removeItem: (k: string) => localStore.delete(k),
    clear: () => localStore.clear(),
    key: (i: number) => Array.from(localStore.keys())[i] ?? null,
    length: 0,
  };

  const mockSessionStorage = {
    getItem: (k: string) => sessionStore.get(k) ?? null,
    setItem: (k: string, v: string) => sessionStore.set(k, v),
    removeItem: (k: string) => sessionStore.delete(k),
    clear: () => sessionStore.clear(),
    key: (i: number) => Array.from(sessionStore.keys())[i] ?? null,
    length: 0,
  };

  beforeEach(() => {
    localStore.clear();
    sessionStore.clear();

    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('sessionStorage', mockSessionStorage);

    vi.stubGlobal('window', {
      location: {
        pathname: '/analisis',
        search: '',
        href: 'http://localhost:5173/analisis',
      },
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    });

    localStore.set(
      'binmax_auth_session',
      JSON.stringify({
        token: 'test-analytics-bearer-token',
        user: { id: 'usr-analytics-999', email: 'analytics@binmax.test', demoBalanceMinor: 1000000 },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. API de Análise e Métricas de Performance', () => {
    it('getUserAnalytics() consulta /api/v1/analytics/performance com período selecionado', async () => {
      const mockAnalyticsRes: UserAnalyticsResponse = {
        has_data: true,
        period: '7d',
        total_ops: 10,
        win_ops: 7,
        loss_ops: 3,
        draw_ops: 0,
        win_rate: 70.0,
        net_profit_minor: 45000, // +$450.00
        current_streak: 3,
        max_streak: 5,
        max_win_minor: 18500,
        max_loss_minor: 10000,
        avg_trade_profit_minor: 4500,
        daily: [
          { day: 'Lun', date: '12 oct', profit: 250, ops: 4 },
          { day: 'Mar', date: '13 oct', profit: 200, ops: 6 },
        ],
        assets: [
          { symbol: 'SYNTH_VOL_50', name: 'Índice Volatilidad 50', winRate: 75.0, ops: 8, profit: '+$380.00' },
        ],
        hourly: [
          { slot: '20-24', rate: 80, ops: 5, isBest: true },
        ],
        best_time_window: '20-24',
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockAnalyticsRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await getUserAnalytics('7d');
      expect(res.has_data).toBe(true);
      expect(res.total_ops).toBe(10);
      expect(res.win_rate).toBe(70.0);
      expect(res.net_profit_minor).toBe(45000);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/analytics/performance?period=7d');
      expect(options.headers['Authorization']).toContain('test-analytics-bearer-token');
    });

    it('getUserAnalytics() trata resposta vazia quando usuário não possui contratos', async () => {
      const emptyAnalyticsRes: UserAnalyticsResponse = {
        has_data: false,
        period: '30d',
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
        hourly: [],
        best_time_window: null,
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => emptyAnalyticsRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await getUserAnalytics('30d');
      expect(res.has_data).toBe(false);
      expect(res.total_ops).toBe(0);
      expect(res.win_rate).toBe(0);
      expect(res.net_profit_minor).toBe(0);
    });
  });

  describe('2. Renderização de AnalysisPage', () => {
    it('renderiza AnalysisPage no servidor com cabeçalho institucional e seletores', () => {
      const html = renderToString(<AnalysisPage />);
      expect(html).toContain('Análisis y Métricas Personales');
      expect(html).toContain('Auditoría Cuantitativa');
      expect(html).toContain('7 días');
      expect(html).toContain('30 días');
      expect(html).toContain('Histórico completo');
      expect(html).toContain('Tasa de acierto global');
      expect(html).toContain('Resultado neto auditado');
    });
  });
});
