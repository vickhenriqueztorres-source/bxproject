# Subetapa 2: Fastify Backend Auth (JWKS RS256, RBAC e Barreira BOLA/IDOR)

**Agentes Responsáveis:** `security-reviewer`, `backend-implementation-agent`  
**Skills:** `04-security-iam`, `08-database-foundation`, `06-testing-quality`  
**Controles Auditados:** S-02 (JWT Validation), S-03 (RBAC), S-04 (BOLA/IDOR), S-05 (Mass Assignment)

---

## 1. Objetivo Técnico
Garantir que a API oficial (`services/api`) valide rigorosamente todos os tokens recebidos no cabeçalho `Authorization: Bearer <token>`:
1. Validação estrita via JWKS remoto (`createRemoteJWKSet` da biblioteca `jose`).
2. Algoritmo travado exclusivamente em `RS256` — rejeição imediata de tokens não assinados (`alg: none`) ou de chave simétrica (ataque CVE clássico de troca de algoritmo HMAC).
3. Verificação de `issuer` e expiração (`exp` com tolerância máxima de 30 segundos).
4. Extração confiável do `sub` como `user_id` e permissões de `realm_access.roles`.
5. Proteção rigorosa contra **BOLA / IDOR (S-04)**: toda consulta ao banco de dados deve filtrar por `WHERE id = $1 AND user_id = $2`. Recursos de outro usuário retornam **404 Not Found** para não divulgar a existência do registro.
6. Proteção contra **Mass Assignment (S-05)**: schemas Zod estritos rejeitam qualquer tentativa de injetar `balance`, `user_id`, `payout` ou `role`.

---

## 2. Passo a Passo da Implementação

### 2.1 Plugin de Autenticação (`services/api/src/plugins/auth.ts`)
```typescript
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";

const authPluginCallback: FastifyPluginAsync = async (fastify) => {
  const keycloakUrl = process.env.KEYCLOAK_URL || "http://keycloak:8080";
  const realm = process.env.KEYCLOAK_REALM || "broker-demo";
  const jwksUri = new URL(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`);
  const JWKS = createRemoteJWKSet(jwksUri);

  fastify.decorate("authenticate", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid token" });
    }

    const token = authHeader.substring(7);
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${keycloakUrl}/realms/${realm}`,
        algorithms: ["RS256"] // S-02: Algoritmo restrito a RS256
      });

      request.user = {
        id: payload.sub as string,
        roles: (payload.realm_access as any)?.roles || [],
        email: payload.email as string
      };
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Token validation failed or expired" });
    }
  });

  // Decorator de Guard RBAC (S-03)
  fastify.decorate("requireRole", (requiredRole: string) => {
    return async (request, reply) => {
      if (!request.user?.roles.includes(requiredRole)) {
        return reply.status(403).send({ error: "FORBIDDEN", message: `Requires role ${requiredRole}` });
      }
    };
  });
};

export const authPlugin = fp(authPluginCallback, { name: "auth-plugin" });
```

### 2.2 Barreira Anti-BOLA / IDOR nas Rotas
```typescript
// Exemplo em services/api/src/routes/contracts.ts
server.get("/api/v1/contracts/:id", { preHandler: [server.authenticate] }, async (req, reply) => {
  const contract = await contractService.getContractById(req.params.id, req.user.id);
  if (!contract) {
    // S-04: Retorna 404 (nunca 403) para não revelar existência a atacantes
    return reply.status(404).send({ error: "NOT_FOUND", message: "Contract not found" });
  }
  return { contract };
});
```

---

## 3. Matriz de Testes & Validação de Segurança
1. **Teste S-02.1 (Ataque `alg: none`):** Enviar JWT forjado sem assinatura. A API deve rejeitar com `401 Unauthorized`.
2. **Teste S-02.2 (Ataque HMAC Swap):** Assinar JWT com chave simétrica usando o segredo público. A API deve rejeitar com `401 Unauthorized`.
3. **Teste S-02.3 (Token Expirado):** Enviar JWT com `exp` no passado. A API deve rejeitar com `401 Unauthorized`.
4. **Teste S-04.1 (Tentativa de IDOR):** Usuário A solicita o contrato do Usuário B. A API deve retornar `404 Not Found`.

---

## 4. Critério de Aceite da Subetapa 2
- [x] Plugin JWKS ativo com validação estrita de algoritmo `RS256`.
- [x] Decorator de RBAC `requireRole` disponível.
- [x] Proteção BOLA/IDOR implementada e testada com retorno 404.
- [x] Schemas Zod impedindo Mass Assignment.
