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

    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${keycloakUrl}/realms/${realm}`,
        algorithms: ["RS256"] // S-02: Algoritmo fixo RS256
      });

      const roles = (payload.realm_access as { roles?: string[] })?.roles || [];
      request.user = {
        id: payload.sub as string,
        roles,
        email: payload.email as string | undefined
      };
    } catch {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Token validation failed or expired" });
    }
  });
};

export const authPlugin = fp(authPluginCallback, {
  name: "auth-plugin"
});
