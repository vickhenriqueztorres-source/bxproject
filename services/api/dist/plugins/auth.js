import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify } from "jose";
const authPluginCallback = async (fastify, opts) => {
    const keycloakUrl = opts.keycloakUrl || process.env.KEYCLOAK_URL || "http://keycloak:8080";
    const realm = opts.realm || process.env.KEYCLOAK_REALM || "broker-demo";
    const jwksUri = new URL(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`);
    const JWKS = createRemoteJWKSet(jwksUri);
    fastify.decorate("authenticate", async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
        }
        const token = authHeader.substring(7);
        // 1. Tenta validação de token nativo Binmax (HS256)
        const secret = process.env.JWT_SECRET || "binmax-platform-master-key-32-chars-long!";
        try {
            const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
                algorithms: ["HS256"]
            });
            const roles = payload.roles || ["trader"];
            request.user = {
                id: payload.sub,
                roles,
                email: payload.email
            };
            return;
        }
        catch {
            // Token não é nativo HS256, tenta Keycloak JWKS RS256 abaixo
        }
        // 2. Fallback para Keycloak OIDC JWKS (RS256)
        try {
            const { payload } = await jwtVerify(token, JWKS, {
                issuer: `${keycloakUrl}/realms/${realm}`,
                algorithms: ["RS256"] // S-02: Algoritmo fixo RS256
            });
            const roles = payload.realm_access?.roles || [];
            request.user = {
                id: payload.sub,
                roles,
                email: payload.email
            };
        }
        catch {
            return reply.status(401).send({ error: "UNAUTHORIZED", message: "Token validation failed or expired" });
        }
    });
    // S-03: Decorator RBAC - Negar por padrão
    fastify.decorate("requireRole", (requiredRole) => {
        return async (request, reply) => {
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
