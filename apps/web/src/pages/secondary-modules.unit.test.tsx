import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  getKycStatus,
  submitKycDocument,
  getTournaments,
  joinTournament,
  getPromotions,
  activatePromotion,
  type KycStatusResponse,
  type TournamentItem,
  type PromotionItem,
} from '../api/client';
import { VerificationPage } from './VerificationPage';
import { TournamentsPage } from './TournamentsPage';
import { PromotionsPage } from './PromotionsPage';

describe('Módulos Secundários Reais (KYC, Torneios e Promoções) - Etapa 5', () => {
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
        pathname: '/verificacion',
        search: '',
        href: 'http://localhost:5173/verificacion',
      },
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    });

    localStore.set(
      'binmax_auth_session',
      JSON.stringify({
        token: 'test-secondary-bearer-token',
        user: { id: 'usr-sec-123', email: 'sec@binmax.test', demoBalanceMinor: 1000000 },
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. API e Módulo de KYC (getKycStatus & submitKycDocument)', () => {
    it('getKycStatus() consulta endpoint /api/v1/kyc/status com Bearer Token', async () => {
      const mockStatus: KycStatusResponse = {
        identity_status: 'IN_REVIEW',
        address_status: 'PENDING',
        document_type: 'PASSPORT',
        document_number: 'AB123456',
        uploaded_files: [{ name: 'passport_scan.pdf', category: 'identity', uploaded_at: '2026-10-13T12:00:00Z' }],
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockStatus,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await getKycStatus();
      expect(res.identity_status).toBe('IN_REVIEW');
      expect(res.address_status).toBe('PENDING');
      expect(res.uploaded_files?.length).toBe(1);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/kyc/status');
      expect(options.headers['Authorization']).toContain('test-secondary-bearer-token');
    });

    it('submitKycDocument() envia dados de documento para /api/v1/kyc/submit', async () => {
      const mockSubmitRes: KycStatusResponse = {
        identity_status: 'IN_REVIEW',
        address_status: 'PENDING',
        document_type: 'PASSPORT',
        uploaded_files: [{ name: 'dni_frontal.png', category: 'identity', uploaded_at: '2026-10-13T12:00:00Z' }],
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockSubmitRes,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await submitKycDocument({
        category: 'identity',
        file_name: 'dni_frontal.png',
        document_type: 'PASSPORT',
      });

      expect(res.identity_status).toBe('IN_REVIEW');
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/kyc/submit');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.category).toBe('identity');
      expect(body.file_name).toBe('dni_frontal.png');
    });

    it('VerificationPage renderiza corretamente em servidor sem erros', () => {
      const html = renderToString(<VerificationPage />);
      expect(html).toContain('Verificación de cuenta');
      expect(html).toContain('Identidad');
      expect(html).toContain('Dirección');
      expect(html).toContain('Tu progreso');
    });
  });

  describe('2. API e Módulo de Torneios (getTournaments & joinTournament)', () => {
    it('getTournaments() consulta /api/v1/tournaments e traz lista formatada', async () => {
      const mockTournaments: TournamentItem[] = [
        {
          id: 'copa-binmax',
          name: 'Copa BINMAX Real',
          status: 'EN_VIVO',
          prizeFormatted: '$5,000 USD',
          participants: 1248,
          timeRemaining: 'Termina en 02:15:30',
          rules: {
            period: '24 horas',
            depositRequired: 'No requerido',
            operationType: 'Contratos 60s',
            criteria: 'Rentabilidad',
            minOperations: 10,
          },
          prizes: [{ position: '1º Lugar', prize: '$2,500 USD' }],
          leaderboard: [],
          userJoined: false,
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockTournaments,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await getTournaments();
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('copa-binmax');
      expect(res[0].prizeFormatted).toBe('$5,000 USD');

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/tournaments');
    });

    it('joinTournament() envia inscrição via POST /api/v1/tournaments/:id/join', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, tournament_id: 'copa-binmax', joined: true }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await joinTournament('copa-binmax');
      expect(res.success).toBe(true);
      expect(res.tournament_id).toBe('copa-binmax');
      expect(res.joined).toBe(true);

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/tournaments/copa-binmax/join');
      expect(options.method).toBe('POST');
    });

    it('TournamentsPage renderiza corretamente em servidor sem erros', () => {
      const html = renderToString(<TournamentsPage />);
      expect(html).toContain('Torneos de Trading Cuantitativo');
      expect(html).toContain('Copa BINMAX');
      expect(html).toContain('Reglas del Torneo');
    });
  });

  describe('3. API e Módulo de Promoções (getPromotions & activatePromotion)', () => {
    it('getPromotions() consulta /api/v1/promotions com status ativo por usuário', async () => {
      const mockPromos: PromotionItem[] = [
        {
          id: 'promo-cashback',
          title: 'Cashback Semanal del 10%',
          badge: 'GESTIÓN DE RIESGO',
          value: 'Hasta $5,000 USD',
          subtext: 'Liquidación lunes',
          description: 'Reembolso auditado',
          requirements: ['Acreditación semanal'],
          actionText: 'Activar protección',
          isActive: true,
        },
      ];

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPromos,
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await getPromotions();
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('promo-cashback');
      expect(res[0].isActive).toBe(true);

      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/promotions');
    });

    it('activatePromotion() envia ativação via POST /api/v1/promotions/:id/activate', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, promo_id: 'promo-cashback', status: 'ACTIVE' }),
      });
      vi.stubGlobal('fetch', fetchSpy);

      const res = await activatePromotion('promo-cashback');
      expect(res.success).toBe(true);
      expect(res.promo_id).toBe('promo-cashback');
      expect(res.status).toBe('ACTIVE');

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/api/v1/promotions/promo-cashback/activate');
      expect(options.method).toBe('POST');
    });

    it('PromotionsPage renderiza corretamente em servidor sem erros', () => {
      const html = renderToString(<PromotionsPage />);
      expect(html).toContain('Promociones y Beneficios Institucionales');
      expect(html).toContain('Bono de Bienvenida para Práctica');
      expect(html).toContain('Cashback Semanal del 10%');
    });
  });
});
