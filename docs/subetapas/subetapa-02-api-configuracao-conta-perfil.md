# Subetapa 02 — Implementação dos Endpoints de Configuração de Conta e Perfil (`PUT /me` e `PUT /password`)

**Agente Responsável:** `backend-implementation-agent`  
**Revisor de Segurança:** `security-reviewer`  
**QA & Concorrência:** `qa-resilience-agent`  
**Skills Chave:** `01-project-context`, `04-security-iam`, `08-database-foundation`  

---

## 1. Objetivo da Subetapa

Implementar, testar e blindar os endpoints oficiais de **gestão de perfil e atualização de credenciais** tanto na suíte Fastify (`services/api`) quanto no servidor Node (`scripts/dev-live-feed.mjs`), permitindo que a tela de Ajustes (`/ajustes`) salve com sucesso dados de perfil (nome, país, código de telefone, número de telefone) e alteração de senha de forma 100% segura, com proteção contra mass assignment e sem erros de banco de dados.

---

## 2. Diagnóstico & O Que Deve Ser Corrigido

1. **Implementação de `PUT /api/v1/auth/me` e `PUT /v1/auth/me` no Fastify (`services/api`):**
   - No `AuthService` (`services/api/src/services/auth-service.ts`), adicionar o método:
     ```ts
     updateProfile(userId: string, data: { name?: string; country?: string; phone_code?: string; phone_number?: string }): Promise<UserPublic>
     ```
   - Sanitização de entradas: `name` (min 2 caracteres), `country` (2 letras maiúsculas ISO), `phone_code` (máx 8 caracteres), `phone_number` (máx 32 caracteres).
   - Bloqueio estrito de mass assignment: qualquer tentativa de enviar `demo_balance_minor`, `balance`, `roles`, `email_verified` ou `id` no payload deve ser explicitamente ignorada ou rejeitada.
2. **Implementação de `PUT /api/v1/auth/password` e `PUT /v1/auth/password`:**
   - Adicionar o método:
     ```ts
     updatePassword(userId: string, data: { current_password: string; new_password: string }): Promise<boolean>
     ```
   - Validação da senha atual contra o hash existente no banco de dados.
   - Geração de novo salt criptográfico via `crypto.randomBytes(16)` e recálculo do hash SHA-256.
   - Atualização no banco com reset de contadores de falha de login.
3. **Alinhamento em `scripts/dev-live-feed.mjs`:**
   - Garantir que as queries SQL usem o schema correto da tabela `users` (colunas `phone_code`, `phone_number`, `updated_at`).
   - Retornar o novo token JWT e o objeto do usuário atualizado no formato esperado pelo frontend:
     ```json
     {
       "success": true,
       "message": "Perfil guardado con éxito",
       "user": { ... },
       "token": "..."
     }
     ```

---

## 3. Arquivos Alvo

- `services/api/src/routes/auth.ts`
- `services/api/src/services/auth-service.ts`
- `scripts/dev-live-feed.mjs`

---

## 4. Bateria de Testes Obrigatórios da Subetapa

### 4.1. Testes de Estresse (Stress Testing)
- **Cenário ST-01 (100 Ciclos Concorrentes):** 100 requisições simultâneas de alteração de nome de perfil disparadas para o mesmo usuário.
  - *Critério:* Todas processam sem deadlock e sem corrupção de dados; a última escrita persiste com consistência atômica.
- **Cenário ST-02:** Verificação de tempo de resposta sob carga (< 50ms por requisição).

### 4.2. Testes de Segurança (Security Testing)
- **Cenário SEC-01 (Tentativa de Adulteração de Saldo via Perfil):**
  - Payload contendo `{ "name": "Hacker", "demo_balance_minor": 999999999 }`.
  - *Critério:* O saldo permanece inalterado no banco de dados; apenas o nome é atualizado (invariante I-01).
- **Cenário SEC-02 (Validação de Senha Atual Incorreta):**
  - Payload com `current_password` errada.
  - *Critério:* Rejeição imediata com código 400 e mensagem clara; a senha do usuário não é alterada.
- **Cenário SEC-03 (Proteção BOLA/IDOR):**
  - Requisição sem cabeçalho `Authorization` ou com token inválido.
  - *Critério:* Rejeição estrita com 401 Unauthorized. O usuário autenticado só pode modificar seus próprios registros (`WHERE id = user.id`).

### 4.3. Testes de Caos (Chaos Testing)
- **Cenário CH-01:** Payload contendo campos incompletos, nulos ou caracteres especiais (injeção SQL, caracteres nulos `\0`, emojis).
  - *Critério:* Sanitização adequada; nenhuma exceção não tratada; integridade do PostgreSQL mantida.

---

## 5. Critérios de Aceite para Aprovação e Avanço

- [ ] Rota `PUT /api/v1/auth/me` responde com 200 e objeto atualizado.
- [ ] Rota `PUT /api/v1/auth/password` atualiza a senha de forma segura com novo salt.
- [ ] Teste unitário de alteração de perfil e senha passando com 100% de sucesso.
- [ ] Nenhum erro de banco de dados nos logs da API.
