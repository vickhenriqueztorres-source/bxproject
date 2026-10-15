/**
 * AuthService - Serviço Central de Autenticação da Binmax
 * 
 * Responsável por:
 * 1. Conexão oficial com endpoints /api/v1/auth e /v1/auth
 * 2. Sessão confirmada pela API de autenticação
 * 3. Falha fechada quando a API não confirma cadastro, login ou recuperação
 */

import { resolveApiUrl } from '../api/config';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  country: string;
  phoneCode?: string;
  phoneNumber?: string;
  demoBalanceMinor: number;
}

export interface UpdateProfilePayload {
  name?: string;
  country?: string;
  phoneCode?: string;
  phoneNumber?: string;
}

export interface UpdatePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  country?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
}

const STORAGE_SESSION_KEY = 'binmax_auth_session';

export class AuthService {
  /**
   * Registro de novo usuário
   */
  public static async register(data: RegisterPayload): Promise<AuthSession> {
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    const password = data.password;
    const country = (data.country || 'ES').toUpperCase().slice(0, 2);

    if (!name || name.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error('Formato de correo electrónico inválido');
    }
    if (!password || password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    // Cadastro só conclui quando a API confirma a identidade.
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, country })
      });
    } catch {
      throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
    }

    if (response.status === 201) {
      let result: { token: string; user: { id: string; name: string; email: string; country?: string; demo_balance_minor?: number } };
      try {
        result = await response.json();
      } catch {
        throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
      }
      if (!result || typeof result.token !== 'string' || !result.token ||
          !result.user || typeof result.user.id !== 'string' || !result.user.id ||
          typeof result.user.name !== 'string' || typeof result.user.email !== 'string' ||
          typeof result.user.demo_balance_minor !== 'number' ||
          !Number.isSafeInteger(result.user.demo_balance_minor) || result.user.demo_balance_minor < 0) {
        throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
      }
      const session: AuthSession = {
        token: result.token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          country: result.user.country || country,
          demoBalanceMinor: result.user.demo_balance_minor
        }
      };
      this.setSession(session);
      return session;
    }

    if (response.status === 409) {
      throw new Error('El correo electrónico ya está registrado');
    }

    if (response.status >= 400 && response.status < 500) {
      const err: unknown = await response.json().catch(() => ({}));
      const message = typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
        ? err.message : 'Error en los datos de registro';
      throw new Error(message);
    }

    throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
  }

  /**
   * Início de Sessão (Login)
   */
  public static async login(data: LoginPayload): Promise<AuthSession> {
    const email = data.email?.trim().toLowerCase();
    const password = data.password;

    if (!email || !password) {
      throw new Error('Email y contraseña requeridos');
    }

    // Login só conclui quando a API confirma as credenciais.
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch {
      throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
    }

    if (response.status === 200) {
      let result: { token: string; user: { id: string; name: string; email: string; country?: string; demo_balance_minor?: number } };
      try {
        result = await response.json();
      } catch {
        throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
      }
      if (!result || typeof result.token !== 'string' || !result.token ||
          !result.user || typeof result.user.id !== 'string' || !result.user.id ||
          typeof result.user.name !== 'string' || typeof result.user.email !== 'string' ||
          typeof result.user.demo_balance_minor !== 'number' ||
          !Number.isSafeInteger(result.user.demo_balance_minor) || result.user.demo_balance_minor < 0) {
        throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
      }
      const session: AuthSession = {
        token: result.token,
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          country: result.user.country || 'ES',
          demoBalanceMinor: result.user.demo_balance_minor
        }
      };
      this.setSession(session);
      return session;
    }

    if (response.status === 429) {
      const err: unknown = await response.json().catch(() => ({}));
      const message = typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
        ? err.message : 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente por 15 minutos.';
      throw new Error(message);
    }

    if (response.status === 401) {
      throw new Error('Email o contraseña incorrectos');
    }

    throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
  }

  /**
   * Solicitação de Recuperação de Senha
   */
  public static async requestPasswordRecovery(emailInput: string): Promise<{ success: boolean; token?: string }> {
    const email = emailInput?.trim().toLowerCase();
    if (!email) {
      throw new Error('Email requerido');
    }

    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/recovery/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch {
      throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
    }
    if (!response.ok) {
      throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
    }
    return { success: true };
  }

  /**
   * Redefinição de Senha com Token
   */
  public static async resetPassword(data: ResetPasswordPayload): Promise<{ success: boolean }> {
    const token = data.token?.trim();
    const newPassword = data.newPassword;

    if (!token || !newPassword || newPassword.length < 6) {
      throw new Error('Token válido y nueva contraseña de al menos 6 caracteres requeridos');
    }

    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/recovery/reset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      });
    } catch {
      throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
    }
    if (response.ok) {
      return { success: true };
    }
    if (response.status === 400) {
      const err: unknown = await response.json().catch(() => ({}));
      const message = typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string'
        ? err.message : 'El enlace de recuperación es inválido o ha expirado (límite de 15 minutos).';
      throw new Error(message);
    }
    throw new Error('No se pudo completar la autenticación. Intenta de nuevo.');
  }

  /**
   * Verificação de E-mail (OTP de 6 dígitos ou token)
   */
  public static async verifyEmail(params: { code?: string; token?: string; email?: string }): Promise<{ success: boolean; user?: AuthUser; message?: string }> {
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/verify-email'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Código de activación inválido o expirado.');
    }
    return data;
  }

  /**
   * Reenvio de Código de Verificação
   */
  public static async resendVerification(email: string): Promise<{ success: boolean; message?: string }> {
    let response: Response;
    try {
      response = await fetch(resolveApiUrl('/v1/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
    } catch {
      throw new Error('No se pudo conectar con el servidor.');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || 'Error al reenviar código.');
    }
    return data;
  }

  /**
   * Gestão de Sessão do Usuário
   */
  public static getSession(): AuthSession | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public static setSession(session: AuthSession): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }

  public static clearSession(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(STORAGE_SESSION_KEY);
    } catch {
      // ignore
    }
  }

  public static isAuthenticated(): boolean {
    const session = this.getSession();
    return !!(session && session.token && session.user);
  }

  /**
   * Obtém o perfil atualizado do usuário autenticado a partir do backend
   */
  public static async getProfile(): Promise<AuthUser> {
    const session = this.getSession();
    if (!session?.token) {
      throw new Error('Sessão expirada. Inicie sessão novamente.');
    }

    const response = await fetch(resolveApiUrl('/v1/auth/me'), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      this.clearSession();
      throw new Error('Sessão inválida ou expirada');
    }

    if (!response.ok) {
      throw new Error('Não foi possível obter os dados do perfil');
    }

    const data = await response.json();
    const updatedUser: AuthUser = {
      id: data.id,
      name: data.name,
      email: data.email,
      country: data.country || data.country_code || 'ES',
      phoneCode: data.phone_code || '+34',
      phoneNumber: data.phone_number || '',
      demoBalanceMinor: data.demo_balance_minor ?? session.user.demoBalanceMinor ?? 1000000
    };

    // Atualiza cache local da sessão mantendo o token
    this.setSession({
      token: session.token,
      user: updatedUser
    });

    return updatedUser;
  }

  /**
   * Salva alterações do perfil no backend e atualiza a sessão local
   */
  public static async updateProfile(payload: UpdateProfilePayload): Promise<AuthUser> {
    const session = this.getSession();
    if (!session?.token) {
      throw new Error('Sessão expirada. Inicie sessão novamente.');
    }

    const response = await fetch(resolveApiUrl('/v1/auth/me'), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: payload.name,
        country: payload.country,
        phone_code: payload.phoneCode,
        phone_number: payload.phoneNumber
      })
    });

    if (response.status === 401) {
      this.clearSession();
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Erro ao salvar alterações no perfil');
    }

    const updatedUser: AuthUser = {
      id: result.user?.id || session.user.id,
      name: result.user?.name || payload.name || session.user.name,
      email: result.user?.email || session.user.email,
      country: result.user?.country || payload.country || session.user.country,
      phoneCode: result.user?.phone_code || payload.phoneCode || session.user.phoneCode || '+34',
      phoneNumber: result.user?.phone_number || payload.phoneNumber || session.user.phoneNumber || '',
      demoBalanceMinor: result.user?.demo_balance_minor ?? session.user.demoBalanceMinor ?? 1000000
    };

    this.setSession({
      token: result.token || session.token,
      user: updatedUser
    });

    return updatedUser;
  }

  /**
   * Atualiza a senha do usuário com verificação da senha atual
   */
  public static async updatePassword(payload: UpdatePasswordPayload): Promise<{ success: boolean; message: string }> {
    const session = this.getSession();
    if (!session?.token) {
      throw new Error('Sessão expirada. Inicie sessão novamente.');
    }

    const response = await fetch(resolveApiUrl('/v1/auth/password'), {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        current_password: payload.currentPassword,
        new_password: payload.newPassword
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || 'Erro ao atualizar a senha');
    }

    return {
      success: true,
      message: result.message || 'Senha atualizada com sucesso'
    };
  }
}
