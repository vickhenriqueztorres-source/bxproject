"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authPlugin = void 0;
const fastify_plugin_1 = __importDefault(require("fastify-plugin"));
const jose_1 = require("jose");
const authPluginCallback = async (fastify, opts) => {
    const keycloakUrl = opts.keycloakUrl || process.env.KEYCLOAK_URL || "http://keycloak:8080";
    const realm = opts.realm || process.env.KEYCLOAK_REALM || "broker-demo";
    const jwksUri = new URL(`${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`);
    const JWKS = (0, jose_1.createRemoteJWKSet)(jwksUri);
    fastify.decorate("authenticate", async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.status(401).send({ error: "UNAUTHORIZED", message: "Missing or invalid Authorization header" });
        }
        const token = authHeader.substring(7);
        try {
            const { payload } = await (0, jose_1.jwtVerify)(token, JWKS, {
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
};
exports.authPlugin = (0, fastify_plugin_1.default)(authPluginCallback, {
    name: "auth-plugin"
});
