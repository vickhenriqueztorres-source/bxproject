# SUBETAPA 01 — Backend & Shared: Schema com Piso Inviolável de 30 Segundos

---

## 1. Objetivo Técnico
Permitir que o cliente solicite durações de contrato suportadas (`duration_seconds`: entre 30 e 300 segundos, padrão 60 segundos), enquanto o servidor impõe **validação estrita e piso mínimo inviolável de 30 segundos** para garantir a margem de lucro da casa e imunidade contra ataques de front-running e desvios de latência.

---

## 2. Especificação de Mudanças

### 2.1. Pacote Compartilhado (`packages/shared/src/types.ts`)
- Atualizar `OpenContractSchema`:
  ```typescript
  export const OpenContractSchema = z.object({
    symbol: z.string().min(1).max(32),
    direction: z.enum(["UP", "DOWN"]),
    stake_minor: z.number().int().min(100).max(10000), // US$ 1,00 a US$ 100,00 em centavos
    duration_seconds: z.number().int().min(30).max(300).optional(), // 30s a 5min (Piso de 30s)
  }).strict();
  ```

### 2.2. Serviço de Contratos (`services/api/src/services/contract-service.ts`)
- No método `openContract`:
  ```typescript
  // Validação e aplicação do piso inviolável de segurança de 30 segundos
  const requestedDuration = dto.duration_seconds ?? 60;
  const safeDurationSeconds = Math.max(30, Math.min(300, requestedDuration));
  const expiresAt = new Date(baseTime.getTime() + safeDurationSeconds * 1000);
  ```

---

## 3. Matriz de Testes da Subetapa 01
1. **Teste Unitário de Schema**:
   - `duration_seconds: 60` -> Válido.
   - `duration_seconds: 30` -> Válido (limite inferior seguro).
   - `duration_seconds: 29` ou menor (ex: 5s, 10s) -> Rejeitado pelo schema com `VALIDATION_ERROR`.
   - `duration_seconds` omitido -> Válido, assume default 60s.
2. **Teste de Proteção do Piso**:
   - Garantir que qualquer contrato criado no banco tenha `expires_at >= opened_at + 30s`.
