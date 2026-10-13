# Subetapa 02: Cliente de Autenticação no Frontend (`apps/web/src/auth/auth-service.ts`)

**Responsáveis:** `surgical-frontend-agent`, `security-reviewer`, `financial-correctness-reviewer`  
**Escopo de Arquivos:**
- `apps/web/src/auth/auth-service.ts`
- `apps/web/src/auth/auth-service.unit.test.ts`
- `apps/web/src/auth/oidc.ts`

---

## 1. Objetivo Técnico
Construir o serviço singleton `AuthService` no frontend, responsável por gerenciar a comunicação com o backend em `/v1/auth`, armazenar a sessão ativa do usuário (token bearer, dados de perfil, saldo de prática), e fornecer um motor resiliente híbrido que persiste cadastros de usuários localmente caso a API esteja em modo standalone.

---

## 2. Requisitos e Invariantes

### 2.1 Interface e Métodos do `AuthService`
```ts
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  country: string;
  demoBalanceMinor: number;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export class AuthService {
  static async register(data: RegisterPayload): Promise<AuthSession>;
  static async login(data: LoginPayload): Promise<AuthSession>;
  static async requestPasswordRecovery(email: string): Promise<{ success: boolean; token?: string }>;
  static async resetPassword(data: ResetPasswordPayload): Promise<{ success: boolean }>;
  static getSession(): AuthSession | null;
  static setSession(session: AuthSession): void;
  static clearSession(): void;
  static isAuthenticated(): boolean;
}
```

### 2.2 Usuário Demo Inicial Semeado
Para assegurar teste imediato em qualquer ambiente:
- Email: `demo@binmax.com`
- Senha: `Demo@123456`
- Nome: `Trader Demo Binmax`
- Saldo inicial: `$10.000,00` (`1000000` minor)

---

## 3. Testes Obrigatórios
1. **Registro:** Chamada com sucesso persistindo sessão com US$ 10.000.
2. **Login com Usuário Demo:** Autenticação com credencial inicial semeada.
3. **Persistência de Sessão:** Recuperação correta do token e dados do usuário logado.
4. **Logout:** Limpeza segura da sessão e do token de autorização.
