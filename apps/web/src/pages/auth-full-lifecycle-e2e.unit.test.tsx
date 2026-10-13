import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from '../auth/auth-service';

// Mock localStorage no ambiente Node do Vitest
const storageMap = new Map<string, string>();
let latestRecoveryToken = '';
const mockLocalStorage = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => { storageMap.set(key, String(val)); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
  get length() { return storageMap.size; },
  key: (i: number) => Array.from(storageMap.keys())[i] ?? null,
};

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  });
}
if (!globalThis.window) {
  (globalThis as any).window = globalThis;
}
(globalThis as any).window.localStorage = mockLocalStorage;

function mockAuthApi(): void {
  latestRecoveryToken = '';
  const users = new Map<string, { name: string; password: string; country: string; attempts: number; locked: boolean }>();
  const recovery = new Map<string, string>();
  let sequence = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    const json = (value: object, status = 200) => new Response(JSON.stringify(value), { status });
    if (url.endsWith('/register')) {
      if (users.has(body.email)) return json({}, 409);
      users.set(body.email, { name: body.name, password: body.password, country: body.country, attempts: 0, locked: false });
      return json({ token: `api-${++sequence}`, user: { id: `user-${sequence}`, name: body.name, email: body.email, country: body.country, demo_balance_minor: 1000000 } }, 201);
    }
    if (url.endsWith('/login')) {
      const user = users.get(body.email);
      if (user?.locked) return json({ message: 'Cuenta bloqueada temporalmente' }, 429);
      if (!user || user.password !== body.password) {
        if (user && ++user.attempts >= 5) user.locked = true;
        return user?.locked ? json({ message: 'Cuenta bloqueada temporalmente' }, 429) : json({}, 401);
      }
      return json({ token: `api-${++sequence}`, user: { id: `user-${sequence}`, name: user.name, email: body.email, country: user.country, demo_balance_minor: 1000000 } });
    }
    if (url.endsWith('/recovery/request')) {
      const token = `recovery-${++sequence}`;
      recovery.set(token, body.email);
      latestRecoveryToken = token;
      return json({ success: true });
    }
    if (url.endsWith('/recovery/reset')) {
      const email = recovery.get(body.token);
      if (!email) return json({ message: 'El enlace es inválido o ha expirado' }, 400);
      users.get(email)!.password = body.new_password;
      recovery.delete(body.token);
      return json({ success: true });
    }
    throw new Error(`Ruta inesperada: ${url}`);
  }));
}

describe('Subetapa 04: fluxos unitários com API de autenticação simulada', () => {
  beforeEach(() => {
    storageMap.clear();
    mockAuthApi();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('4.1 Ciclo de Vida de Sessão com Respostas da API', () => {
    it('executa registro -> sessão -> logout -> login -> recuperação -> redefinição -> nova senha', async () => {
      const email = 'test-trader@binmax.com';
      const initialPassword = 'StrongPass@2026';
      const newPassword = 'NewStrongPass@2026';

      // 1. Registro de nova conta
      const regSession = await AuthService.register({
        name: 'Trader E2E Teste',
        email,
        password: initialPassword,
        country: 'MX'
      });

      expect(regSession).toBeDefined();
      expect(regSession.token).toBeTruthy();
      expect(regSession.user.email).toBe(email);
      expect(regSession.user.name).toBe('Trader E2E Teste');
      expect(regSession.user.country).toBe('MX');
      // Preservação do invariante financeiro de $10.000 (1000000 centavos)
      expect(regSession.user.demoBalanceMinor).toBe(1000000);
      expect(AuthService.isAuthenticated()).toBe(true);

      // 2. Logout seguro
      AuthService.clearSession();
      expect(AuthService.isAuthenticated()).toBe(false);
      expect(AuthService.getSession()).toBeNull();

      // 3. Login com a senha inicial cadastrada
      const loginSession = await AuthService.login({
        email,
        password: initialPassword
      });
      expect(loginSession.user.email).toBe(email);
      expect(AuthService.isAuthenticated()).toBe(true);

      // 4. Solicitação de recuperação de senha (emissão de token de 15 minutos)
      const recoveryReq = await AuthService.requestPasswordRecovery(email);
      expect(recoveryReq.success).toBe(true);
      expect(recoveryReq.token).toBeUndefined();
      const token = latestRecoveryToken;

      // 5. Redefinição da senha para newPassword
      const resetResult = await AuthService.resetPassword({
        token,
        newPassword
      });
      expect(resetResult.success).toBe(true);

      // 6. Tentativa de login com a senha antiga DEVE FALHAR
      await expect(
        AuthService.login({
          email,
          password: initialPassword
        })
      ).rejects.toThrow('Email o contraseña incorrectos');

      // 7. Tentativa de login com a nova senha DEVE TER SUCESSO
      const newLoginSession = await AuthService.login({
        email,
        password: newPassword
      });
      expect(newLoginSession.user.email).toBe(email);
      expect(newLoginSession.user.demoBalanceMinor).toBe(1000000);
      expect(AuthService.isAuthenticated()).toBe(true);
    });
  });

  describe('4.2 Sequência de Requisições', () => {
    it('executa 50 cadastros e logins sequenciais com respostas da API isoladas', async () => {
      const totalUsers = 50;

      // 50 cadastros com emails distintos
      for (let i = 1; i <= totalUsers; i++) {
        const session = await AuthService.register({
          name: `Trader Concorrente ${i}`,
          email: `concorrente_${i}@binmax.com`,
          password: `Password_${i}_@2026`,
          country: i % 2 === 0 ? 'BR' : 'ES'
        });
        expect(session.user.demoBalanceMinor).toBe(1000000);
      }

      // 50 logins sequenciais rápidos
      for (let i = 1; i <= totalUsers; i++) {
        const loginRes = await AuthService.login({
          email: `concorrente_${i}@binmax.com`,
          password: `Password_${i}_@2026`
        });
        expect(loginRes.user.email).toBe(`concorrente_${i}@binmax.com`);
        expect(loginRes.user.name).toBe(`Trader Concorrente ${i}`);
      }
    });
  });

  describe('4.3 Respostas de Negação da API', () => {
    it('rejeita reuso de token de recuperação previamente utilizado', async () => {
      await AuthService.register({
        name: 'Caos User',
        email: 'caos@binmax.com',
        password: 'OriginalPass123'
      });

      const recovery = await AuthService.requestPasswordRecovery('caos@binmax.com');
      expect(recovery.token).toBeUndefined();
      const token = latestRecoveryToken;

      // Primeiro uso -> Sucesso
      await AuthService.resetPassword({ token, newPassword: 'FirstResetPass123' });

      // Segundo uso com o mesmo token -> Rejeitado
      await expect(
        AuthService.resetPassword({ token, newPassword: 'SecondResetPass123' })
      ).rejects.toThrow(/inválido o ha expirado/);
    });

    it('bloqueia temporariamente após 5 tentativas de invasão / brute-force', async () => {
      await AuthService.register({
        name: 'Vitima Brute Force',
        email: 'vitima@binmax.com',
        password: 'CorrectPass123'
      });

      // 4 tentativas falhas
      for (let i = 1; i <= 4; i++) {
        await expect(
          AuthService.login({ email: 'vitima@binmax.com', password: `errada_${i}` })
        ).rejects.toThrow('Email o contraseña incorrectos');
      }

      // 5ª tentativa falha desencadeia bloqueio
      await expect(
        AuthService.login({ email: 'vitima@binmax.com', password: 'errada_5' })
      ).rejects.toThrow(/bloqueada temporalmente/);

      // Bloqueio persiste
      await expect(
        AuthService.login({ email: 'vitima@binmax.com', password: 'CorrectPass123' })
      ).rejects.toThrow(/bloqueada temporalmente/);
    });
  });

  describe('4.4 Texto de Entrada', () => {
    it('preserva texto de nome retornado pela API sem interpretá-lo', async () => {
      // Injeção de tags script e SQL no nome
      const payload = {
        name: "<script>alert('xss')</script> SELECT * FROM users;",
        email: 'security-test@binmax.com',
        password: 'ValidPassword123'
      };

      const session = await AuthService.register(payload);
      expect(session).toBeDefined();
      expect(session.user.email).toBe('security-test@binmax.com');
      // Garante que o sistema tratou a string sem executar código
      expect(session.user.name).toContain("<script>alert('xss')</script>");
    });
  });
});
