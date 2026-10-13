import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from './auth-service';

type TestGlobal = { localStorage?: Storage; window?: TestGlobal };
declare const globalThis: TestGlobal;

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

function mockAuthApi(): void {
  latestRecoveryToken = '';
  const users = new Map<string, { name: string; email: string; password: string; country: string; failed: number; locked: boolean }>();
  users.set('demo@binmax.com', { name: 'Trader Demo Binmax', email: 'demo@binmax.com', password: 'Demo@123456', country: 'ES', failed: 0, locked: false });
  const recoveryTokens = new Map<string, string>();
  let nextId = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    const json = (payload: object, status = 200) => new Response(JSON.stringify(payload), { status });
    if (url.endsWith('/register')) {
      if (users.has(body.email)) return json({}, 409);
      users.set(body.email, { name: body.name, email: body.email, password: body.password, country: body.country, failed: 0, locked: false });
      return json({ token: `remote-${++nextId}`, user: { id: `remote-${nextId}`, name: body.name, email: body.email, country: body.country, demo_balance_minor: 1000000 } }, 201);
    }
    if (url.endsWith('/login')) {
      const user = users.get(body.email);
      if (user?.locked) return json({ message: 'Cuenta bloqueada temporalmente' }, 429);
      if (!user || user.password !== body.password) {
        if (user && ++user.failed >= 5) user.locked = true;
        return user?.locked ? json({ message: 'Cuenta bloqueada temporalmente' }, 429) : json({}, 401);
      }
      user.failed = 0;
      return json({ token: `remote-${++nextId}`, user: { id: `remote-${nextId}`, name: user.name, email: user.email, country: user.country, demo_balance_minor: 1000000 } });
    }
    if (url.endsWith('/recovery/request')) {
      const token = `recovery-${++nextId}`;
      recoveryTokens.set(token, body.email);
      latestRecoveryToken = token;
      return json({ success: true });
    }
    if (url.endsWith('/recovery/reset')) {
      const email = recoveryTokens.get(body.token);
      if (!email) return json({ message: 'El enlace es inválido o ha expirado' }, 400);
      users.get(email)!.password = body.new_password;
      recoveryTokens.delete(body.token);
      return json({ success: true });
    }
    throw new Error(`Ruta inesperada: ${url}`);
  }));
}

if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
    configurable: true
  });
}
if (!globalThis.window) {
  globalThis.window = globalThis;
}
globalThis.window.localStorage = mockLocalStorage;

describe('Subetapa 02: Frontend AuthService Unit Tests', () => {
  beforeEach(() => {
    storageMap.clear();
    mockAuthApi();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('2.1 Login com usuário demo inicial semeado (demo@binmax.com / Demo@123456)', async () => {
    const session = await AuthService.login({
      email: 'demo@binmax.com',
      password: 'Demo@123456'
    });

    expect(session).toBeDefined();
    expect(session.token).toBeTruthy();
    expect(session.user.email).toBe('demo@binmax.com');
    expect(session.user.name).toBe('Trader Demo Binmax');
    expect(session.user.demoBalanceMinor).toBe(1000000); // US$ 10.000,00

    expect(AuthService.isAuthenticated()).toBe(true);
    const stored = AuthService.getSession();
    expect(stored?.user.email).toBe('demo@binmax.com');
  });

  it('2.2 Rejeita login com senha incorreta e bloqueia após 5 falhas consecutivas', async () => {
    // 4 falhas
    for (let i = 1; i <= 4; i++) {
      await expect(
        AuthService.login({
          email: 'demo@binmax.com',
          password: `wrong_pass_${i}`
        })
      ).rejects.toThrow('Email o contraseña incorrectos');
    }

    // 5ª falha -> bloqueio
    await expect(
      AuthService.login({
        email: 'demo@binmax.com',
        password: 'wrong_pass_5'
      })
    ).rejects.toThrow(/bloqueada temporalmente/);

    // Tentativa com senha correta enquanto bloqueada também é rejeitada
    await expect(
      AuthService.login({
        email: 'demo@binmax.com',
        password: 'Demo@123456'
      })
    ).rejects.toThrow(/bloqueada temporalmente/);
  });

  it('2.3 Registra novo usuário com $10.000 de saldo e persiste sessão', async () => {
    const session = await AuthService.register({
      name: 'Maria Trader',
      email: 'maria@binmax.com',
      password: 'MariaPassword123',
      country: 'CL'
    });

    expect(session.token).toBeTruthy();
    expect(session.user.name).toBe('Maria Trader');
    expect(session.user.email).toBe('maria@binmax.com');
    expect(session.user.country).toBe('CL');
    expect(session.user.demoBalanceMinor).toBe(1000000);

    expect(AuthService.isAuthenticated()).toBe(true);

    // Faz logout e depois login com a credencial recém-criada
    AuthService.clearSession();
    expect(AuthService.isAuthenticated()).toBe(false);

    const reLoginSession = await AuthService.login({
      email: 'maria@binmax.com',
      password: 'MariaPassword123'
    });
    expect(reLoginSession.user.email).toBe('maria@binmax.com');
  });

  it('2.4 Rejeita registro duplicado e validações mínimas', async () => {
    await AuthService.register({
      name: 'Jorge Santos',
      email: 'jorge@binmax.com',
      password: 'JorgePassword123'
    });

    // Email repetido
    await expect(
      AuthService.register({
        name: 'Outro Jorge',
        email: 'jorge@binmax.com',
        password: 'AnotherPassword123'
      })
    ).rejects.toThrow(/registrado/);

    // Senha muito curta
    await expect(
      AuthService.register({
        name: 'Curto',
        email: 'curto@binmax.com',
        password: '123'
      })
    ).rejects.toThrow(/contraseña/);

    // Nome vazio
    await expect(
      AuthService.register({
        name: ' ',
        email: 'vazio@binmax.com',
        password: 'Password123'
      })
    ).rejects.toThrow(/nombre/);
  });

  it('2.5 Ciclo completo de recuperação de senha: token de 15m e nova senha', async () => {
    await AuthService.register({
      name: 'Recuperavel User',
      email: 'recuperavel@binmax.com',
      password: 'PasswordAntiga123'
    });

    // Solicita recuperação
    const recoveryRes = await AuthService.requestPasswordRecovery('recuperavel@binmax.com');
    expect(recoveryRes.success).toBe(true);
    expect(recoveryRes.token).toBeUndefined();
    expect(latestRecoveryToken).toBeTruthy();

    // Redefine com nova senha
    const resetRes = await AuthService.resetPassword({
      token: latestRecoveryToken,
      newPassword: 'PasswordNova456'
    });
    expect(resetRes.success).toBe(true);

    // Senha antiga falha
    await expect(
      AuthService.login({
        email: 'recuperavel@binmax.com',
        password: 'PasswordAntiga123'
      })
    ).rejects.toThrow('Email o contraseña incorrectos');

    // Senha nova funciona
    const loginOk = await AuthService.login({
      email: 'recuperavel@binmax.com',
      password: 'PasswordNova456'
    });
    expect(loginOk.user.email).toBe('recuperavel@binmax.com');

    // Token reutilizado falha
    await expect(
      AuthService.resetPassword({
        token: latestRecoveryToken,
        newPassword: 'AnotherPassword789'
      })
    ).rejects.toThrow(/inválido o ha expirado/);
  });

  it('2.6 Gestão segura de sessão e logout', () => {
    expect(AuthService.isAuthenticated()).toBe(false);

    AuthService.setSession({
      token: 'test_token_123',
      user: {
        id: 'usr-1',
        name: 'Tester',
        email: 'test@binmax.com',
        country: 'ES',
        demoBalanceMinor: 1000000
      }
    });

    expect(AuthService.isAuthenticated()).toBe(true);
    expect(AuthService.getSession()?.token).toBe('test_token_123');

    AuthService.clearSession();
    expect(AuthService.isAuthenticated()).toBe(false);
    expect(AuthService.getSession()).toBeNull();
  });
});

describe('[DEF-T13-1] API indisponível não autentica por dados locais', () => {
  beforeEach(() => storageMap.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('cadastro falha sem criar usuário ou sessão local', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(AuthService.register({ name: 'Cliente Teste', email: 'novo@example.test', password: 'StrongPassword123' })).rejects.toBeInstanceOf(Error);
    expect(storageMap.size).toBe(0);
  });

  it('login falha mesmo com usuário legado salvo no navegador', async () => {
    storageMap.set('binmax_auth_users_db', JSON.stringify([{
      id: 'local-user', name: 'Cliente Teste', email: 'local@example.test',
      passwordHash: 'irrelevant', passwordSalt: 'salt', country: 'ES', demoBalanceMinor: 1000000,
      failedLoginAttempts: 0, lockedUntil: null,
    }]));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const before = [...storageMap];
    await expect(AuthService.login({ email: 'local@example.test', password: 'StrongPassword123' })).rejects.toBeInstanceOf(Error);
    expect([...storageMap]).toEqual(before);
    expect(AuthService.getSession()).toBeNull();
  });

  it.each([
    { action: 'register', status: 201 },
    { action: 'login', status: 200 },
  ])('$action não cria sessão quando a API omite o token', async ({ action, status }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: {
      id: 'remote-user', name: 'Cliente Teste', email: 'novo@example.test', country: 'ES', demo_balance_minor: 1000000,
    } }), { status })));
    const operation = action === 'register'
      ? AuthService.register({ name: 'Cliente Teste', email: 'novo@example.test', password: 'StrongPassword123' })
      : AuthService.login({ email: 'novo@example.test', password: 'StrongPassword123' });
    await expect(operation).rejects.toBeInstanceOf(Error);
    expect(storageMap.size).toBe(0);
  });
});
