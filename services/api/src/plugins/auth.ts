import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      id: string;
      roles: string[];
      email?: string;
    };
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (requiredRole: string) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface AuthPluginOptions {
  keycloakUrl?: string;
  realm?: string;
}

const authPluginCallback: FastifyPluginAsync<AuthPluginOptions> = async (fastify, opts) => {
  const keycloakUrl = opts.keycloakUrl || process.env.KEYCLOAK_URL || "http://keycloak:8080";
  const realm = opts.realm || process.env.KEYCLOAK_REALM || "broker-demo";
  const jwksUri = new URL(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`);
  const JWKS = createRemoteJWKSet(jwksUri);

  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.substring(7);

    // 1. Tenta validação de token nativo Binmax (HS256)
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
          algorithms: ["HS256"], issuer: "binmax-native", audience: "broker-api", typ: "Bearer"
        });
        if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Missing subject");
        const roles = Array.isArray(payload.roles) ? payload.roles.filter((role): role is string => typeof role === "string") : [];
        request.user = {
          id: payload.sub,
          roles,
          email: typeof payload.email === "string" ? payload.email : undefined
        };
        return;
      } catch {
        // Token não é nativo válido; tenta Keycloak JWKS RS256 abaixo.
      }
    }

    // 2. Keycloak OIDC: never treat its subject as the financial principal.
    let oidcPayload;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${keycloakUrl}/realms/${realm}`,
        audience: process.env.KEYCLOAK_AUDIENCE || "broker-api",
        typ: "Bearer",
        algorithms: ["RS256"] // S-02: Algoritmo fixo RS256
      });

      if (typeof payload.sub !== "string" || !payload.sub) throw new Error("Missing subject");
      oidcPayload = payload;
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Token validation failed or expired" });
    }

    let principalId: string | undefined;
    try {
      const result = await fastify.pg.query<{ principal_id: string }>(
        `SELECT principal_id FROM identity_subject_links WHERE issuer = $1 AND sub = $2`,
        [`${keycloakUrl}/realms/${realm}`, oidcPayload.sub]
      );
      principalId = result.rows[0]?.principal_id;
    } catch {
      return reply.status(503).send({ error: "IDENTITY_UNAVAILABLE" });
    }
    if (!principalId) {
      return reply.status(401).send({ error: "IDENTITY_NOT_LINKED" });
    }

    const realmAccess = oidcPayload.realm_access as { roles?: unknown } | undefined;
    const roles = Array.isArray(realmAccess?.roles)
      ? realmAccess.roles.filter((role): role is string => typeof role === "string")
      : [];
    request.user = {
      id: principalId,
      roles,
      email: typeof oidcPayload.email === "string" ? oidcPayload.email : undefined
    };
  });

  // S-03: Decorator RBAC - Negar por padrão
  fastify.decorate("requireRole", (requiredRole: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user || !request.user.roles.includes(requiredRole)) {
        return reply.status(403).send({
          error: "FORBIDDEN",
          message: `Access denied: missing required role '${requiredRole}'`
        });
      }
    };
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: "auth-plugin"
});
