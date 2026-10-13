# Subetapa 01: Schemas de Banco de Dados & Endpoints de Autenticação no Backend (`services/api`)

**Responsáveis:** `backend-implementation-agent`, `security-reviewer`, `financial-correctness-reviewer`  
**Escopo de Arquivos:**
- `db/migrations/0040_users_and_auth.up.sql`
- `services/api/src/routes/auth.ts`
- `services/api/src/services/auth-service.ts`
- `services/api/src/index.ts`
- `services/api/test/auth-routes.unit.test.ts`

---

## 1. Objetivo Técnico
Disponibilizar no backend Fastify os endpoints oficiais de autenticação sob o prefixo `/v1/auth`, com suporte a hashing de senha seguro (SHA-256/PBKDF2 com salt aleatório), emissão de tokens de sessão, controle de tentativas de login, solicitação de recuperação de senha com tokens de 15 minutos e provisionamento automático de US$ 10.000 em conta demonstrativa.

---

## 2. Requisitos e Invariantes

### 2.1 Schema do Banco de Dados
1. **Tabela `users`:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `name VARCHAR(120) NOT NULL`
   - `email VARCHAR(255) NOT NULL UNIQUE`
   - `password_hash VARCHAR(255) NOT NULL`
   - `password_salt VARCHAR(64) NOT NULL`
   - `country_code CHAR(2) NOT NULL DEFAULT 'ES'`
   - `demo_balance_minor BIGINT NOT NULL DEFAULT 1000000` (US$ 10.000,00)
   - `failed_login_attempts INT NOT NULL DEFAULT 0`
   - `locked_until TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
   - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

2. **Tabela `password_recovery_tokens`:**
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - `token VARCHAR(128) NOT NULL UNIQUE`
   - `expires_at TIMESTAMPTZ NOT NULL`
   - `used_at TIMESTAMPTZ`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### 2.2 Endpoints da API
- `POST /v1/auth/register`:
  - Body: `{ name: string, email: string, password: string, country: string }`
  - Validações: Email válido, senha >= 6 caracteres, nome >= 2 caracteres.
  - Comportamento: Rejeita e-mail duplicado com status `409 CONFLICT`. Emite token de sessão e provisiona saldo de `1000000` minor (US$ 10.000). Retorna status `201 CREATED`.
- `POST /v1/auth/login`:
  - Body: `{ email: string, password: string }`
  - Validações: Bloqueio automático se `locked_until` ativo. Incrementa `failed_login_attempts` em caso de senha incorreta. Zera contador em caso de sucesso.
  - Retorno: `{ token: string, user: { id, name, email, country, demo_balance_minor } }`.
- `POST /v1/auth/recovery/request`:
  - Body: `{ email: string }`
  - Gera token criptográfico único (`crypto.randomBytes(32).toString('hex')`) com validade exata de 15 minutos (`NOW() + INTERVAL '15 minutes'`).
- `POST /v1/auth/recovery/reset`:
  - Body: `{ token: string, new_password: string }`
  - Valida token: deve existir, não ter sido usado (`used_at IS NULL`) e não ter expirado (`expires_at > NOW()`).
  - Atualiza a senha com novo salt e marca o token como usado.

---

## 3. Testes Obrigatórios
1. **Registro:** Criação com sucesso, rejeição de e-mail duplicado e validação de tamanho mínimo de senha.
2. **Login:** Sucesso com credenciais corretas, rejeição com credenciais erradas e bloqueio temporário após 5 falhas consecutivas.
3. **Recuperação de Senha:** Solicitação de token, validação de expiração e redefinição de senha com sucesso.
