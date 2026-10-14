import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AuthService as BackendAuthService } from '../../services/api/src/services/auth-service';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-jwt-secret-min-32-chars-long-valid!';

describe('Audit: Auth Security, Chaos & Financial Invariants (S-01 a S-06, I-01)', () => {
  function createMockPg() {
    const users: any[] = [];
    const tokens: any[] = [];

    return {
      query: async (sql: string, params: any[] = []) => {
        const norm = sql.replace(/\s+/g, ' ').trim();

        if (norm.startsWith('SELECT id FROM users WHERE email = $1')) {
          const found = users.filter((u) => u.email === params[0]);
          return { rows: found.map((u) => ({ id: u.id })) };
        }

        if (norm.startsWith('INSERT INTO users')) {
          const id = `user-${users.length + 1}`;
          const u = {
            id,
            name: params[0],
            email: params[1],
            password_hash: params[2],
            password_salt: params[3],
            country_code: params[4],
            demo_balance_minor: params[5],
            failed_login_attempts: 0,
            locked_until: null
          };
          users.push(u);
          return { rows: [u] };
        }

        if (norm.includes('FROM users WHERE email = $1')) {
          const found = users.find((u) => u.email === params[0]);
          return { rows: found ? [found] : [] };
        }

        if (norm.startsWith('UPDATE users SET failed_login_attempts = $1')) {
          const user = users.find((u) => u.id === params[2]);
          if (user) {
            user.failed_login_attempts = params[0];
            user.locked_until = params[1];
          }
          return { rows: [] };
        }

        if (norm.startsWith('UPDATE users SET failed_login_attempts = 0')) {
          const user = users.find((u) => u.id === params[0]);
          if (user) {
            user.failed_login_attempts = 0;
            user.locked_until = null;
          }
          return { rows: [] };
        }

        if (norm.startsWith('INSERT INTO password_recovery_tokens')) {
          const id = `tok-${tokens.length + 1}`;
          const t = {
            id,
            user_id: params[0],
            token: params[1],
            expires_at: params[2],
            used_at: null
          };
          tokens.push(t);
          return { rows: [t] };
        }

        if (norm.includes('FROM password_recovery_tokens WHERE token = $1')) {
          const found = tokens.find((t) => t.token === params[0]);
          return { rows: found ? [found] : [] };
        }

        if (norm.startsWith('UPDATE users SET password_hash = $1')) {
          const user = users.find((u) => u.id === params[2]);
          if (user) {
            user.password_hash = params[0];
            user.password_salt = params[1];
          }
          return { rows: [] };
        }

        if (norm.startsWith('UPDATE password_recovery_tokens SET used_at = NOW()')) {
          const t = tokens.find((tok) => tok.id === params[0]);
          if (t) t.used_at = new Date();
          return { rows: [] };
        }

        return { rows: [] };
      }
    };
  }

  it('S-01: Passwords are NEVER stored in plain text and use unique salts', async () => {
    const service = new BackendAuthService(createMockPg() as any);
    const pass = 'PlainPassword123';

    const salt1 = service.generateSalt();
    const salt2 = service.generateSalt();
    assert.notEqual(salt1, salt2, 'Salts must be cryptographically random and unique');

    const hash1 = service.hashPassword(pass, salt1);
    const hash2 = service.hashPassword(pass, salt2);

    assert.notEqual(hash1, hash2, 'Identical passwords with different salts must produce completely distinct hashes');
    assert.ok(!hash1.includes(pass), 'Hash must never contain the plain password');
  });

  it('I-01 / D-18: Demo account is provisioned with integer cents (1000000 minor = $10,000.00)', async () => {
    const service = new BackendAuthService(createMockPg() as any);
    const res = await service.register({
      name: 'Financial Invariant User',
      email: 'invariant@binmax.com',
      password: 'StrongPassword123'
    });

    assert.equal(res.success, true);
    if (res.success) {
      assert.equal(res.data.user.demo_balance_minor, 1000000);
      assert.equal(Number.isInteger(res.data.user.demo_balance_minor), true, 'Balance must be an integer (cents)');
    }
  });

  it('S-05: Brute Force Protection: 5 failed logins triggers account lockout', async () => {
    const service = new BackendAuthService(createMockPg() as any);
    await service.register({
      name: 'Victim User',
      email: 'victim@binmax.com',
      password: 'CorrectPassword123'
    });

    for (let i = 1; i <= 4; i++) {
      const fail = await service.login({ email: 'victim@binmax.com', password: 'WrongPassword' });
      assert.equal(fail.success, false);
      if (!fail.success) {
        assert.equal(fail.error.error, 'INVALID_CREDENTIALS');
      }
    }

    // 5th failure
    const lock = await service.login({ email: 'victim@binmax.com', password: 'WrongPassword' });
    assert.equal(lock.success, false);
    if (!lock.success) {
      assert.equal(lock.error.error, 'ACCOUNT_LOCKED');
      assert.equal(lock.error.status, 429);
      assert.ok(lock.error.retry_after_seconds! > 0);
    }
  });

  it('C-01: Expired tokens (>15 minutes) are strictly rejected', async () => {
    const mockPg = createMockPg();
    const service = new BackendAuthService(mockPg as any);

    await service.register({
      name: 'Expiry User',
      email: 'expiry@binmax.com',
      password: 'OldPassword123'
    });

    const recovery = await service.requestPasswordRecovery('expiry@binmax.com');
    assert.ok(recovery?.token);

    // Simula expiração: Altera a data do token no mock para 20 minutos atrás
    const oldDate = new Date(Date.now() - 20 * 60 * 1000);
    // Cria serviço com token expirado
    const expiredService = new BackendAuthService({
      query: async (sql: string, params: any[]) => {
        const norm = sql.replace(/\s+/g, ' ');
        if (norm.includes('FROM password_recovery_tokens WHERE token = $1')) {
          return {
            rows: [
              {
                id: 'tok-expired',
                user_id: 'user-1',
                expires_at: oldDate,
                used_at: null
              }
            ]
          };
        }
        return mockPg.query(sql, params);
      }
    } as any);

    const resetResult = await expiredService.resetPassword({
      token: recovery.token,
      newPassword: 'NewPassword999'
    });

    assert.equal(resetResult, false, 'Expired token must be rejected');
  });
});
