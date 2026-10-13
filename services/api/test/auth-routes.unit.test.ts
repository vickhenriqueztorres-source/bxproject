import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import { authRoutes } from "../src/routes/auth.js";
import { authPlugin } from "../src/plugins/auth.js";

const previousJwtSecret = process.env.JWT_SECRET;
const previousAppPublicUrl = process.env.APP_PUBLIC_URL;
before(() => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.APP_PUBLIC_URL = "http://localhost:5173";
});
after(() => {
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
  if (previousAppPublicUrl === undefined) delete process.env.APP_PUBLIC_URL;
  else process.env.APP_PUBLIC_URL = previousAppPublicUrl;
});

describe("Subetapa 01: Auth Routes & Password Lifecycle", () => {
  interface MockUser {
    id: string;
    name: string;
    email: string;
    password_hash: string;
    password_salt: string;
    country_code: string;
    demo_balance_minor: number;
    failed_login_attempts: number;
    locked_until: Date | null;
  }

  interface MockToken {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
  }

  interface MockVerificationCode {
    id: string;
    user_id: string;
    code: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
  }

  let usersTable: MockUser[] = [];
  let tokensTable: MockToken[] = [];
  let verifCodesTable: MockVerificationCode[] = [];
  let sentRecoveryLinks: string[] = [];
  let sentWelcomeEmails: { email: string; name: string }[] = [];
  let sentVerificationEmails: { email: string; code: string; link: string; country?: string; name?: string }[] = [];

  beforeEach(() => {
    usersTable = [];
    tokensTable = [];
    verifCodesTable = [];
    sentRecoveryLinks = [];
    sentWelcomeEmails = [];
    sentVerificationEmails = [];
  });

  function createMockPg() {
    return {
      query: async (sql: string, params: any[] = []) => {
        const normalized = sql.replace(/\s+/g, " ").trim();

        if (normalized.startsWith("WITH claimed AS ( UPDATE password_recovery_tokens")) {
          const tok = tokensTable.find((item) => item.token === params[0] &&
            item.used_at === null && item.expires_at > new Date());
          const user = tok ? usersTable.find((item) => item.id === tok.user_id) : undefined;
          if (!tok || !user) return { rows: [], rowCount: 0 };
          tok.used_at = new Date();
          user.password_hash = params[1];
          user.password_salt = params[2];
          user.failed_login_attempts = 0;
          user.locked_until = null;
          return { rows: [{ id: user.id }], rowCount: 1 };
        }

        if (normalized.includes("UPDATE email_verification_codes") && normalized.includes("UPDATE users")) {
          let matchedUser: MockUser | undefined;
          if (normalized.includes("WHERE token = $1")) {
            const vc = verifCodesTable.find((v) => v.token === params[0] && v.used_at === null && v.expires_at > new Date());
            if (vc) {
              vc.used_at = new Date();
              matchedUser = usersTable.find((u) => u.id === vc.user_id);
            }
          } else {
            const code = params[0];
            const email = params[1];
            const user = usersTable.find((u) => u.email === email);
            if (user) {
              const vc = verifCodesTable.find((v) => v.user_id === user.id && v.code === code && v.used_at === null && v.expires_at > new Date());
              if (vc) {
                vc.used_at = new Date();
                matchedUser = user;
              }
            }
          }

          if (matchedUser) {
            matchedUser.email_verified = true;
            matchedUser.demo_balance_minor = 1000000;
            return {
              rowCount: 1,
              rows: [{
                id: matchedUser.id,
                name: matchedUser.name,
                email: matchedUser.email,
                country_code: matchedUser.country_code,
                demo_balance_minor: matchedUser.demo_balance_minor,
                email_verified: true
              }]
            };
          }
          return { rowCount: 0, rows: [] };
        }

        // 1. SELECT id FROM users WHERE email = $1
        if (normalized.startsWith("SELECT id FROM users WHERE email = $1")) {
          const found = usersTable.filter((u) => u.email === params[0]);
          return { rows: found.map((u) => ({ id: u.id })) };
        }

        // 2. INSERT INTO users
        if (normalized.startsWith("INSERT INTO users")) {
          const id = `user-${usersTable.length + 1}`;
          const newUser: MockUser = {
            id,
            name: params[0],
            email: params[1],
            password_hash: params[2],
            password_salt: params[3],
            country_code: params[4],
            demo_balance_minor: params[5],
            failed_login_attempts: 0,
            locked_until: null,
            email_verified: false
          };
          usersTable.push(newUser);
          return { rows: [newUser] };
        }

        // 2.5 INSERT INTO email_verification_codes
        if (normalized.startsWith("INSERT INTO email_verification_codes")) {
          const id = `verif-${verifCodesTable.length + 1}`;
          const row: MockVerificationCode = {
            id,
            user_id: params[0],
            code: params[1],
            token: params[2],
            expires_at: params[3],
            used_at: null
          };
          verifCodesTable.push(row);
          return { rows: [row] };
        }

        // 3. SELECT ... FROM users WHERE email = $1
        if (normalized.includes("FROM users WHERE email = $1")) {
          const found = usersTable.find((u) => u.email === params[0]);
          return { rows: found ? [found] : [] };
        }

        // 4. UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3
        if (normalized.includes("UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3")) {
          const user = usersTable.find((u) => u.id === params[2]);
          if (user) {
            user.failed_login_attempts = params[0];
            user.locked_until = params[1];
          }
          return { rows: [] };
        }

        // 5. UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1
        if (normalized.startsWith("UPDATE users SET failed_login_attempts = 0")) {
          const user = usersTable.find((u) => u.id === params[0]);
          if (user) {
            user.failed_login_attempts = 0;
            user.locked_until = null;
          }
          return { rows: [] };
        }

        // 6. INSERT INTO password_recovery_tokens
        if (normalized.startsWith("INSERT INTO password_recovery_tokens")) {
          const id = `token-${tokensTable.length + 1}`;
          const row: MockToken = {
            id,
            user_id: params[0],
            token: params[1],
            expires_at: params[2],
            used_at: null
          };
          tokensTable.push(row);
          return { rows: [row] };
        }

        // 7. SELECT ... FROM password_recovery_tokens WHERE token = $1
        if (normalized.includes("FROM password_recovery_tokens WHERE token = $1")) {
          const found = tokensTable.find((t) => t.token === params[0]);
          return { rows: found ? [found] : [] };
        }

        // 8. UPDATE users SET password_hash = $1, password_salt = $2 ... WHERE id = $3
        if (normalized.includes("SET password_hash = $1, password_salt = $2")) {
          const user = usersTable.find((u) => u.id === params[2]);
          if (user) {
            user.password_hash = params[0];
            user.password_salt = params[1];
            user.failed_login_attempts = 0;
            user.locked_until = null;
          }
          return { rows: [] };
        }

        // 9. UPDATE password_recovery_tokens SET used_at = NOW() WHERE id = $1
        if (normalized.includes("UPDATE password_recovery_tokens SET used_at = NOW() WHERE id = $1")) {
          const tok = tokensTable.find((t) => t.id === params[0]);
          if (tok) {
            tok.used_at = new Date();
          }
          return { rows: [] };
        }

        // 10. SELECT ... FROM users WHERE id = $1
        if (normalized.includes("FROM users WHERE id = $1")) {
          const user = usersTable.find((u) => u.id === params[0]);
          return { rows: user ? [user] : [] };
        }

        return { rows: [] };
      }
    };
  }

  async function buildApp() {
    const app = Fastify();
    app.decorate("pg", createMockPg());
    await app.register(authPlugin);
    await app.register(authRoutes, {
      sendRecoveryEmail: async (_email, link) => { sentRecoveryLinks.push(link); },
      sendWelcomeEmail: async (email, name) => { sentWelcomeEmails.push({ email, name }); },
      sendVerificationEmail: async (email, code, link, country, name) => {
        sentVerificationEmails.push({ email, code, link, country, name });
      }
    });
    return app;
  }

  it("1.1 POST /api/v1/auth/register creates user, returns token and provisions $10,000", async () => {
    const app = await buildApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Carlos Trader",
        email: "carlos@binmax.com",
        password: "SecretPassword123",
        country: "MX"
      }
    });

    assert.equal(res.statusCode, 201);
    const body = JSON.parse(res.payload);
    assert.ok(body.token, "Must return session token");
    assert.equal(body.user.name, "Carlos Trader");
    assert.equal(body.user.email, "carlos@binmax.com");
    assert.equal(body.user.country, "MX");
    assert.equal(sentVerificationEmails.length, 1);
    assert.equal(sentVerificationEmails[0].email, "carlos@binmax.com");
    assert.equal(sentVerificationEmails[0].name, "Carlos Trader");
    assert.equal(sentVerificationEmails[0].code.length, 6);

    await app.close();
  });

  it("1.2 POST /api/v1/auth/register rejects duplicate email with 409", async () => {
    const app = await buildApp();

    // Primeiro cadastro
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Carlos Trader",
        email: "carlos@binmax.com",
        password: "SecretPassword123"
      }
    });

    // Segundo cadastro com mesmo email
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Outro Nome",
        email: "carlos@binmax.com",
        password: "AnotherPassword"
      }
    });

    assert.equal(res.statusCode, 409);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "EMAIL_ALREADY_EXISTS");

    await app.close();
  });

  it("1.3 POST /api/v1/auth/register rejects invalid email or short password with 400", async () => {
    const app = await buildApp();

    const resShortPass = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Carlos Trader",
        email: "carlos@binmax.com",
        password: "123" // Menor que 6
      }
    });
    assert.equal(resShortPass.statusCode, 400);

    const resBadEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Carlos Trader",
        email: "carlos-sem-arroba",
        password: "ValidPassword123"
      }
    });
    assert.equal(resBadEmail.statusCode, 400);

    await app.close();
  });

  it("2.1 POST /api/v1/auth/login succeeds with correct password and returns token", async () => {
    const app = await buildApp();

    // Registra
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Lucia Diaz",
        email: "lucia@binmax.com",
        password: "MySecurePassword"
      }
    });

    // Login com sucesso
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "lucia@binmax.com",
        password: "MySecurePassword"
      }
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.payload);
    assert.ok(body.token);
    assert.equal(body.user.email, "lucia@binmax.com");
    assert.equal(body.user.demo_balance_minor, 1000000);

    await app.close();
  });

  it("2.2 POST /api/v1/auth/login rejects incorrect password with 401", async () => {
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Lucia Diaz",
        email: "lucia@binmax.com",
        password: "MySecurePassword"
      }
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "lucia@binmax.com",
        password: "WRONG_PASSWORD"
      }
    });

    assert.equal(res.statusCode, 401);
    const body = JSON.parse(res.payload);
    assert.equal(body.error, "INVALID_CREDENTIALS");

    await app.close();
  });

  it("2.3 POST /api/v1/auth/login locks account after 5 consecutive failures (429)", async () => {
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Brute Force Target",
        email: "target@binmax.com",
        password: "TargetPassword123"
      }
    });

    // 4 falhas consecutivas (deve retornar 401)
    for (let i = 1; i <= 4; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "target@binmax.com", password: `wrong_${i}` }
      });
      assert.equal(res.statusCode, 401);
    }

    // 5ª tentativa falha -> Bloqueio temporário (429)
    const res5 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "target@binmax.com", password: "wrong_5" }
    });
    assert.equal(res5.statusCode, 429);
    const body5 = JSON.parse(res5.payload);
    assert.equal(body5.error, "ACCOUNT_LOCKED");
    assert.ok(res5.headers["retry-after"]);

    // Mesmo com senha certa depois do bloqueio, rejeita com 429
    const resLocked = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "target@binmax.com", password: "TargetPassword123" }
    });
    assert.equal(resLocked.statusCode, 429);

    await app.close();
  });

  it("3.1 Password recovery: requests 15m token and resets password successfully", async () => {
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Recovery User",
        email: "recover@binmax.com",
        password: "OldPassword123"
      }
    });

    // Solicita recuperação
    const reqRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/recovery/request",
      payload: { email: "recover@binmax.com" }
    });
    assert.equal(reqRes.statusCode, 200);
    const reqBody = JSON.parse(reqRes.payload);
    assert.equal(Object.hasOwn(reqBody, "token"), false);
    assert.equal(sentRecoveryLinks.length, 1);
    const recoveryToken = new URL(sentRecoveryLinks[0]).hash.match(/^#token=([0-9a-f]{64})$/)?.[1];
    assert.ok(recoveryToken, "Token should be delivered in the email link");

    // Redefine a senha com o token recebido
    const resetRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/recovery/reset",
      payload: {
        token: recoveryToken,
        new_password: "BrandNewPassword456"
      }
    });
    assert.equal(resetRes.statusCode, 200);

    // Tentar login com senha antiga deve falhar
    const oldLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "recover@binmax.com", password: "OldPassword123" }
    });
    assert.equal(oldLogin.statusCode, 401);

    // Login com a nova senha deve ter sucesso
    const newLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "recover@binmax.com", password: "BrandNewPassword456" }
    });
    assert.equal(newLogin.statusCode, 200);

    // Tentar reutilizar o mesmo token deve falhar com 400
    const reuseRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/recovery/reset",
      payload: {
        token: recoveryToken,
        new_password: "AnotherPassword789"
      }
    });
    assert.equal(reuseRes.statusCode, 400);

    await app.close();
  });

  it("4.1 GET /api/v1/auth/me validates Bearer token and returns profile", async () => {
    const app = await buildApp();

    const regRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Authenticated User",
        email: "auth@binmax.com",
        password: "ValidPassword999",
        country: "CO"
      }
    });
    const { token } = JSON.parse(regRes.payload);

    // Sem header Authorization -> 401
    const anonRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me"
    });
    assert.equal(anonRes.statusCode, 401);

    // Com Bearer token válido -> 200
    const authMeRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert.equal(authMeRes.statusCode, 200);
    const meBody = JSON.parse(authMeRes.payload);
    assert.equal(meBody.email, "auth@binmax.com");
    assert.equal(meBody.country, "CO");
    await app.close();
  });

  it("5.1 POST /api/v1/auth/verify-email verifies user with 6-digit code and unlocks demo balance", async () => {
    const app = await buildApp();

    // 1. Cadastra usuário
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Trader Brasil",
        email: "brasil@binmax.com",
        password: "ValidPassword123",
        country: "BR"
      }
    });

    assert.equal(sentVerificationEmails.length, 1);
    const code = sentVerificationEmails[0].code;
    assert.equal(code.length, 6);

    // 2. Verifica com código errado -> 400
    const failRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      payload: {
        email: "brasil@binmax.com",
        code: "000000"
      }
    });
    assert.equal(failRes.statusCode, 400);

    // 3. Verifica com código correto -> 200
    const okRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/verify-email",
      payload: {
        email: "brasil@binmax.com",
        code
      }
    });
    assert.equal(okRes.statusCode, 200);
    const body = JSON.parse(okRes.payload);
    assert.equal(body.success, true);
    assert.equal(body.user.email_verified, true);
    assert.equal(body.user.demo_balance_minor, 1000000);

    // 4. Confirma envio do e-mail comemorativo de boas-vindas com conta verificada
    assert.equal(sentWelcomeEmails.length, 1);
    assert.equal(sentWelcomeEmails[0].email, "brasil@binmax.com");

    await app.close();
  });

  it("5.2 POST /api/v1/auth/resend-verification issues a new code for unverified account", async () => {
    const app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        name: "Trader Global",
        email: "global@binmax.com",
        password: "ValidPassword123",
        country: "US"
      }
    });

    assert.equal(sentVerificationEmails.length, 1);

    const resendRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/resend-verification",
      payload: {
        email: "global@binmax.com"
      }
    });

    assert.equal(resendRes.statusCode, 200);
    assert.equal(sentVerificationEmails.length, 2);
    assert.equal(sentVerificationEmails[1].email, "global@binmax.com");
    assert.equal(sentVerificationEmails[1].code.length, 6);

    await app.close();
  });
});
