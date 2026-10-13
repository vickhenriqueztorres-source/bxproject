import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, AuthSession } from '../../apps/web/src/auth/auth-service';

describe('Settings & Profile Real Session Unit and Stress Tests (Etapa 1)', () => {
  const store = new Map<string, string>();
  const setItem = vi.fn((key: string, value: string) => {
    store.set(key, value);
  });
  const removeItem = vi.fn((key: string) => {
    store.delete(key);
  });

  const mockSession: AuthSession = {
    token: 'jwt-mock-token-xyz',
    user: {
      id: 'usr_real_001',
      name: 'Carlos Trader',
      email: 'carlos@binmax.test',
      country: 'ES',
      phoneCode: '+34',
      phoneNumber: '612345678',
      demoBalanceMinor: 1000000,
    },
  };

  beforeEach(() => {
    store.clear();
    setItem.mockClear();
    removeItem.mockClear();

    // Inicia com sessão válida armazenada
    store.set('binmax_auth_session', JSON.stringify(mockSession));

    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem,
        removeItem,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('1. AuthService.getProfile() - Recuperação de Perfil Real', () => {
    it('deve carregar dados reais do usuário da API e sincronizar na sessão local', async () => {
      const apiResponse = {
        id: 'usr_real_001',
        name: 'Carlos Trader Atualizado',
        email: 'carlos@binmax.test',
        country_code: 'MX',
        phone_code: '+52',
        phone_number: '5598765432',
        demo_balance_minor: 1250000,
      };

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => apiResponse,
      }));

      const user = await AuthService.getProfile();

      expect(user.id).toBe('usr_real_001');
      expect(user.name).toBe('Carlos Trader Atualizado');
      expect(user.country).toBe('MX');
      expect(user.phoneCode).toBe('+52');
      expect(user.phoneNumber).toBe('5598765432');
      expect(user.demoBalanceMinor).toBe(1250000);

      // Verifica se a sessão foi atualizada no storage
      const saved = JSON.parse(store.get('binmax_auth_session')!);
      expect(saved.user.name).toBe('Carlos Trader Atualizado');
      expect(saved.user.country).toBe('MX');
    });

    it('deve limpar sessão e lançar erro se backend retornar 401 Unauthorized', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Sessão expirada' }),
      }));

      await expect(AuthService.getProfile()).rejects.toThrow('Sessão inválida ou expirada');
      expect(store.has('binmax_auth_session')).toBe(false);
    });

    it('deve falhar de forma fechada se não houver sessão ativa', async () => {
      store.clear();
      await expect(AuthService.getProfile()).rejects.toThrow('Sessão expirada. Inicie sessão novamente.');
    });
  });

  describe('2. AuthService.updateProfile() - Persistência Segura', () => {
    it('deve enviar payload correto com token Bearer e atualizar sessão', async () => {
      let capturedUrl = '';
      let capturedOptions: RequestInit | undefined;

      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url, options) => {
        capturedUrl = String(url);
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            user: {
              id: 'usr_real_001',
              name: 'Novo Nome',
              email: 'carlos@binmax.test',
              country_code: 'BR',
              phone_code: '+55',
              phone_number: '11988887777',
              demo_balance_minor: 1000000,
            },
            token: 'jwt-refreshed-token',
          }),
        };
      }));

      const updated = await AuthService.updateProfile({
        name: 'Novo Nome',
        country: 'BR',
        phoneCode: '+55',
        phoneNumber: '11988887777',
      });

      expect(capturedUrl).toBe('/api/v1/auth/me');
      expect(capturedOptions?.method).toBe('PUT');
      const headers = capturedOptions?.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer jwt-mock-token-xyz');

      const body = JSON.parse(capturedOptions?.body as string);
      expect(body.name).toBe('Novo Nome');
      expect(body.country).toBe('BR');
      expect(body.phone_code).toBe('+55');
      expect(body.phone_number).toBe('11988887777');

      // Verifica dados retornados
      expect(updated.name).toBe('Novo Nome');
      expect(updated.country).toBe('BR');

      // Verifica que a nova sessão tem o token atualizado
      const saved = JSON.parse(store.get('binmax_auth_session')!);
      expect(saved.token).toBe('jwt-refreshed-token');
      expect(saved.user.name).toBe('Novo Nome');
    });

    it('deve rejeitar se a sessão expirou no backend (401)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Token expirado' }),
      }));

      await expect(
        AuthService.updateProfile({ name: 'Tentativa' })
      ).rejects.toThrow('Sessão expirada. Faça login novamente.');
      expect(store.has('binmax_auth_session')).toBe(false);
    });

    it('não permite manipulação de saldo via payload de perfil', async () => {
      // Invariante financeiro I-01: saldo só muda pelo ledger Blnk, nunca via profile
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_, options) => {
        const body = JSON.parse(options?.body as string);
        expect(body.demo_balance_minor).toBeUndefined();
        expect(body.balance).toBeUndefined();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            user: {
              ...mockSession.user,
              name: 'Valid Name',
            },
          }),
        };
      }));

      await AuthService.updateProfile({ name: 'Valid Name' });
    });
  });

  describe('3. AuthService.updatePassword() - Segurança de Credenciais', () => {
    it('deve enviar senha atual e nova senha protegidas', async () => {
      let capturedBody: any;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_, options) => {
        capturedBody = JSON.parse(options?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            message: 'Senha atualizada com sucesso',
          }),
        };
      }));

      const res = await AuthService.updatePassword({
        currentPassword: 'OldPassword123',
        newPassword: 'NewSecurePassword456!',
      });

      expect(res.success).toBe(true);
      expect(capturedBody.current_password).toBe('OldPassword123');
      expect(capturedBody.new_password).toBe('NewSecurePassword456!');
    });

    it('deve repassar mensagem de erro quando a senha atual estiver incorreta', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'La contraseña actual no es correcta' }),
      }));

      await expect(
        AuthService.updatePassword({
          currentPassword: 'WrongPassword',
          newPassword: 'NewSecurePassword456!',
        })
      ).rejects.toThrow('La contraseña actual no es correcta');
    });
  });

  describe('4. Teste de Caos e Estresse Concorrente (100 Ciclos)', () => {
    it('suporta 100 atualizações concorrentes sem corrupção de estado local', async () => {
      let callCount = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            user: {
              ...mockSession.user,
              name: `Trader Iteration ${callCount}`,
            },
            token: `token-iter-${callCount}`,
          }),
        };
      }));

      const promises = Array.from({ length: 100 }, (_, i) =>
        AuthService.updateProfile({ name: `Trader ${i}` })
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(100);

      // Garante que o storage permaneceu intacto e é um JSON válido
      const finalSession = JSON.parse(store.get('binmax_auth_session')!);
      expect(finalSession).toBeDefined();
      expect(finalSession.user.email).toBe('carlos@binmax.test');
      expect(finalSession.user.id).toBe('usr_real_001');
      expect(finalSession.token).toMatch(/^token-iter-\d+$/);
    });
  });
});
