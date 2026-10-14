import crypto from "node:crypto";
import pg from "pg";
import { SignJWT, jwtVerify } from "jose";

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  country: string;
  demo_balance_minor: number;
  phone_code?: string;
  phone_number?: string;
  email_verified?: boolean;
}

export interface AuthSuccess {
  token: string;
  user: UserPublic;
}

export interface AuthError {
  error: string;
  message: string;
  status: number;
  retry_after_seconds?: number;
}

export type AuthResult =
  | { success: true; data: AuthSuccess }
  | { success: false; error: AuthError };

export class AuthService {
  private pg: pg.Pool;
  private jwtSecret: Uint8Array | null;

  constructor(pgPool: pg.Pool) {
    this.pg = pgPool;
    const secret = process.env.JWT_SECRET;
    this.jwtSecret = secret ? new TextEncoder().encode(secret) : null;
  }

  public hashPassword(password: string, salt: string): string {
    return crypto.createHash("sha256").update(password + salt).digest("hex");
  }

  public generateSalt(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  public async createToken(user: { id: string; email: string; name: string }): Promise<string> {
    if (!this.jwtSecret) throw new Error("JWT_SECRET is required for legacy authentication");
    return await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      roles: ["trader"]
    })
      .setProtectedHeader({ alg: "HS256", typ: "Bearer" })
      .setIssuer("binmax-native")
      .setAudience("broker-api")
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(this.jwtSecret);
  }

  public async verifyToken(token: string): Promise<{ id: string; email: string; name: string; roles: string[] } | null> {
    if (!this.jwtSecret) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, {
        algorithms: ["HS256"], issuer: "binmax-native", audience: "broker-api", typ: "Bearer"
      });
      return {
        id: payload.sub as string,
        email: (payload.email as string) || "",
        name: (payload.name as string) || "",
        roles: (payload.roles as string[]) || ["trader"]
      };
    } catch {
      return null;
    }
  }

  public async register(input: {
    name: string;
    email: string;
    password: string;
    country?: string;
  }): Promise<AuthResult> {
    if (!this.jwtSecret) {
      return { success: false, error: { error: "AUTH_UNAVAILABLE", message: "Autenticación temporalmente no disponible", status: 503 } };
    }
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const password = input.password;
    const country = (input.country?.trim() || "ES").toUpperCase().slice(0, 2);

    if (!name || name.length < 2) {
      return {
        success: false,
        error: { error: "VALIDATION_ERROR", message: "El nombre debe tener al menos 2 caracteres", status: 400 }
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return {
        success: false,
        error: { error: "VALIDATION_ERROR", message: "Formato de correo electrónico inválido", status: 400 }
      };
    }

    if (!password || password.length < 6) {
      return {
        success: false,
        error: { error: "VALIDATION_ERROR", message: "La contraseña debe tener al menos 6 caracteres", status: 400 }
      };
    }

    // Verifica existência
    const existing = await this.pg.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return {
        success: false,
        error: { error: "EMAIL_ALREADY_EXISTS", message: "El correo electrónico ya está registrado", status: 409 }
      };
    }

    const salt = this.generateSalt();
    const hash = this.hashPassword(password, salt);
    const demoBalance = 1000000; // US$ 10.000,00 demo provisioned

    const insertResult = await this.pg.query(
      `INSERT INTO users (name, email, password_hash, password_salt, country_code, demo_balance_minor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, country_code, demo_balance_minor`,
      [name, email, hash, salt, country, demoBalance]
    ).catch((error: unknown) => {
      if (error instanceof pg.DatabaseError && error.code === "23505" && error.constraint === "users_email_key") {
        return null;
      }
      throw error;
    });

    if (!insertResult) {
      return {
        success: false,
        error: { error: "EMAIL_ALREADY_EXISTS", message: "El correo electrónico ya está registrado", status: 409 }
      };
    }

    const userRow = insertResult.rows[0];
    const user: UserPublic = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      country: userRow.country_code,
      demo_balance_minor: Number(userRow.demo_balance_minor)
    };

    const token = await this.createToken(user);

    return {
      success: true,
      data: { token, user }
    };
  }

  public async login(input: { email: string; password: string }): Promise<AuthResult> {
    if (!this.jwtSecret) {
      return { success: false, error: { error: "AUTH_UNAVAILABLE", message: "Autenticación temporalmente no disponible", status: 503 } };
    }
    const email = input.email?.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      return {
        success: false,
        error: { error: "VALIDATION_ERROR", message: "Email y contraseña requeridos", status: 400 }
      };
    }

    const userResult = await this.pg.query(
      `SELECT id, name, email, password_hash, password_salt, country_code, demo_balance_minor,
              failed_login_attempts, locked_until
       FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return {
        success: false,
        error: { error: "INVALID_CREDENTIALS", message: "Email o contraseña incorrectos", status: 401 }
      };
    }

    const userRow = userResult.rows[0];

    // Verificar bloqueio temporário por tentativas
    if (userRow.locked_until) {
      const lockedUntil = new Date(userRow.locked_until);
      const now = new Date();
      if (lockedUntil > now) {
        const remainingSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000);
        return {
          success: false,
          error: {
            error: "ACCOUNT_LOCKED",
            message: `Demasiados intentos fallidos. Cuenta bloqueada temporalmente por ${Math.ceil(remainingSeconds / 60)} minutos.`,
            status: 429,
            retry_after_seconds: remainingSeconds
          }
        };
      }
    }

    const inputHash = this.hashPassword(password, userRow.password_salt);
    if (inputHash !== userRow.password_hash) {
      const nextAttempts = (userRow.failed_login_attempts || 0) + 1;
      let lockedUntil: Date | null = null;

      if (nextAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      }

      await this.pg.query(
        "UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3",
        [nextAttempts, lockedUntil, userRow.id]
      );

      if (nextAttempts >= 5) {
        return {
          success: false,
          error: {
            error: "ACCOUNT_LOCKED",
            message: "Demasiados intentos fallidos. Cuenta bloqueada temporalmente por 15 minutos.",
            status: 429,
            retry_after_seconds: 900
          }
        };
      }

      return {
        success: false,
        error: { error: "INVALID_CREDENTIALS", message: "Email o contraseña incorrectos", status: 401 }
      };
    }

    // Sucesso: Zera contadores de falha
    await this.pg.query(
      "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1",
      [userRow.id]
    );

    const user: UserPublic = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      country: userRow.country_code,
      demo_balance_minor: Number(userRow.demo_balance_minor)
    };

    const token = await this.createToken(user);

    return {
      success: true,
      data: { token, user }
    };
  }

  public async requestPasswordRecovery(emailInput: string): Promise<{ token: string; expires_at: Date } | null> {
    const email = emailInput?.trim().toLowerCase();
    if (!email) return null;

    const userResult = await this.pg.query("SELECT id FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) {
      return null;
    }

    const userId = userResult.rows[0].id;
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await this.pg.query(
      `INSERT INTO password_recovery_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, token, expiresAt]
    );

    return { token, expires_at: expiresAt };
  }

  public async resetPassword(
    inputOrToken: { token: string; newPassword: string } | string,
    maybePassword?: string
  ): Promise<boolean> {
    const token = typeof inputOrToken === "object" ? inputOrToken.token?.trim() : inputOrToken?.trim();
    const newPassword = typeof inputOrToken === "object" ? inputOrToken.newPassword : maybePassword;

    if (!token || !newPassword || newPassword.length < 6) {
      return false;
    }

    const newSalt = this.generateSalt();
    const newHash = this.hashPassword(newPassword, newSalt);
    const updated = await this.pg.query(
      `WITH claimed AS (
         UPDATE password_recovery_tokens
         SET used_at = NOW()
         WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()
         RETURNING user_id
       )
       UPDATE users
       SET password_hash = $2, password_salt = $3,
           failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = (SELECT user_id FROM claimed)
       RETURNING id`,
      [token, newHash, newSalt]
    );

    return updated.rowCount === 1;
  }

  public async getUserById(userId: string): Promise<UserPublic | null> {
    const result = await this.pg.query(
      "SELECT id, name, email, country_code, phone_code, phone_number, demo_balance_minor, email_verified FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      country: row.country_code,
      phone_code: row.phone_code || "+34",
      phone_number: row.phone_number || "",
      demo_balance_minor: Number(row.demo_balance_minor),
      email_verified: Boolean(row.email_verified)
    };
  }

  public async updateProfile(
    userId: string,
    data: { name?: string; country?: string; phone_code?: string; phone_number?: string; phoneCode?: string; phoneNumber?: string }
  ): Promise<UserPublic> {
    const name = data.name ? data.name.trim() : null;
    if (name !== null && name.length < 2) {
      throw new Error("El nombre debe tener al menos 2 caracteres");
    }
    const country = data.country ? data.country.trim().toUpperCase().slice(0, 2) : null;
    const phoneCode = data.phone_code || data.phoneCode ? (data.phone_code || data.phoneCode)!.trim() : null;
    const phoneNumber = data.phone_number || data.phoneNumber ? (data.phone_number || data.phoneNumber)!.trim() : null;

    const result = await this.pg.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           country_code = COALESCE($2, country_code),
           phone_code = COALESCE($3, phone_code),
           phone_number = COALESCE($4, phone_number),
           updated_at = NOW()
       WHERE id = $5
       RETURNING id, name, email, country_code, phone_code, phone_number, demo_balance_minor, email_verified`,
      [name, country, phoneCode, phoneNumber, userId]
    );

    if (result.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      country: row.country_code,
      phone_code: row.phone_code || "+34",
      phone_number: row.phone_number || "",
      demo_balance_minor: Number(row.demo_balance_minor),
      email_verified: Boolean(row.email_verified)
    };
  }

  public async updatePassword(
    userId: string,
    data: { currentPassword?: string; newPassword?: string; current_password?: string; new_password?: string }
  ): Promise<{ success: boolean; message: string }> {
    const currentPassword = data.currentPassword || data.current_password;
    const newPassword = data.newPassword || data.new_password;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
    }

    const userRes = await this.pg.query(
      "SELECT id, password_hash, password_salt FROM users WHERE id = $1",
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new Error("USER_NOT_FOUND");
    }

    const row = userRes.rows[0];
    const currentHash = this.hashPassword(currentPassword, row.password_salt);
    if (currentHash !== row.password_hash) {
      throw new Error("La contraseña actual no es correcta");
    }

    const newSalt = this.generateSalt();
    const newHash = this.hashPassword(newPassword, newSalt);

    await this.pg.query(
      "UPDATE users SET password_hash = $1, password_salt = $2, updated_at = NOW() WHERE id = $3",
      [newHash, newSalt, userId]
    );

    return { success: true, message: "Contraseña actualizada exitosamente" };
  }

  public async requestEmailVerification(userId: string): Promise<{ code: string; token: string; expires_at: Date }> {
    const code = crypto.randomInt(100000, 1000000).toString();
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await this.pg.query(
      `INSERT INTO email_verification_codes (user_id, code, token, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, code, token, expiresAt]
    );

    return { code, token, expires_at: expiresAt };
  }

  public async verifyEmail(input: {
    code?: string;
    token?: string;
    email?: string;
  }): Promise<{ success: boolean; user?: UserPublic; error?: string }> {
    const code = input.code?.trim();
    const token = input.token?.trim();
    const email = input.email?.trim().toLowerCase();

    if (!code && !token) {
      return { success: false, error: "VALIDATION_ERROR" };
    }

    let query: string;
    let params: any[];

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
    } else {
      if (!email) {
        return { success: false, error: "EMAIL_REQUIRED" };
      }
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
    }

    const res = await this.pg.query(query, params);
    if (!res || res.rowCount === 0) {
      return { success: false, error: "INVALID_OR_EXPIRED_CODE" };
    }

    const row = res.rows[0];
    return {
      success: true,
      user: {
        id: row.id,
        name: row.name,
        email: row.email,
        country: row.country_code,
        demo_balance_minor: Number(row.demo_balance_minor),
        email_verified: Boolean(row.email_verified)
      }
    };
  }

  public async resendVerificationCode(emailInput: string): Promise<{
    code: string;
    token: string;
    user: { id: string; name: string; email: string; country: string };
  } | null> {
    const email = emailInput?.trim().toLowerCase();
    if (!email) return null;

    const userResult = await this.pg.query(
      "SELECT id, name, email, country_code, email_verified FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].email_verified) {
      return null;
    }

    const userRow = userResult.rows[0];
    const { code, token } = await this.requestEmailVerification(userRow.id);

    return {
      code,
      token,
      user: {
        id: userRow.id,
        name: userRow.name,
        email: userRow.email,
        country: userRow.country_code
      }
    };
  }
}
