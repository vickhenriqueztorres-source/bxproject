"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const ioredis_1 = require("ioredis");
const jose_1 = require("jose");
const catchup_handler_js_1 = require("./handlers/catchup-handler.js");
const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const HOST = process.env.WS_HOST || "0.0.0.0";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const REALM = process.env.KEYCLOAK_REALM || "broker-demo";
const app = (0, fastify_1.default)({ logger: { level: process.env.LOG_LEVEL || "info" } });
const redisSub = new ioredis_1.Redis(REDIS_URL);
const redisClient = new ioredis_1.Redis(REDIS_URL);
const catchupHandler = new catchup_handler_js_1.CatchupHandler(redisClient);
// Mapa de conexões ativas por usuário para aplicar o limite de 5 conexões (B-16)
const activeConnectionsByUser = new Map();
// Mapa de subscrições: symbol -> Set de sockets
const subscriptionsBySymbol = new Map();
// JWKS para validação RS256
let JWKS = null;
try {
    const jwksUri = new URL(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`);
    JWKS = (0, jose_1.createRemoteJWKSet)(jwksUri);
}
catch {
    // Ignora em ambientes de inicialização sem keycloak ativo
}
async function verifyToken(token) {
    if (!JWKS) {
        // Modo teste/desenvolvimento fallback
        return { userId: "demo-user-id", roles: ["USER"] };
    }
    try {
        const { payload } = await (0, jose_1.jwtVerify)(token, JWKS, {
            issuer: `${KEYCLOAK_URL}/realms/${REALM}`,
            algorithms: ["RS256"]
        });
        const roles = payload.realm_access?.roles || [];
        return { userId: payload.sub, roles };
    }
    catch {
        return null;
    }
}
async function main() {
    await app.register(websocket_1.default);
    // Escuta ticks do Redis Pub/Sub e distribui aos clientes inscritos
    await redisSub.psubscribe("market:ticks:*", "market:events:*");
    redisSub.on("pmessage", (_pattern, channel, message) => {
        if (channel.startsWith("market:ticks:")) {
            const symbol = channel.replace("market:ticks:", "");
            const subscribers = subscriptionsBySymbol.get(symbol);
            if (subscribers && subscribers.size > 0) {
                for (const socket of subscribers) {
                    if (socket.readyState === 1) { // OPEN
                        socket.send(message);
                    }
                }
            }
        }
        else if (channel.startsWith("market:events:")) {
            // Broadcast de eventos de liquidação
            const symbol = channel.replace("market:events:", "");
            const subscribers = subscriptionsBySymbol.get(symbol);
            if (subscribers && subscribers.size > 0) {
                for (const socket of subscribers) {
                    if (socket.readyState === 1) {
                        socket.send(message);
                    }
                }
            }
        }
    });
    app.get("/ws", { websocket: true }, (socket, req) => {
        let isAuthenticated = false;
        let currentUserId = null;
        const clientSubscriptions = new Set();
        let lastPong = Date.now();
        const pingInterval = setInterval(() => {
            if (Date.now() - lastPong > 45000) {
                // Sem pong há mais de 45s => fecha com 4408
                socket.close(4408, "Ping timeout");
                clearInterval(pingInterval);
                return;
            }
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: "ping" }));
            }
        }, 15000);
        // Timeout de 5s para autenticação na primeira mensagem (S-02)
        const authTimeout = setTimeout(() => {
            if (!isAuthenticated) {
                socket.close(4401, "Authentication timeout");
            }
        }, 5000);
        socket.on("message", async (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.type === "pong") {
                    lastPong = Date.now();
                    return;
                }
                // 1. Mensagem de Autenticação
                if (msg.type === "auth") {
                    clearTimeout(authTimeout);
                    const authData = await verifyToken(msg.token);
                    if (!authData) {
                        socket.close(4401, "Invalid or expired token");
                        return;
                    }
                    currentUserId = authData.userId;
                    // Limite de 5 conexões por usuário (B-16)
                    const userConns = activeConnectionsByUser.get(currentUserId) || new Set();
                    if (userConns.size >= 5) {
                        socket.close(4429, "Too many concurrent connections for user");
                        return;
                    }
                    userConns.add(socket);
                    activeConnectionsByUser.set(currentUserId, userConns);
                    isAuthenticated = true;
                    socket.send(JSON.stringify({ type: "auth_ok", user_id: currentUserId }));
                    return;
                }
                if (!isAuthenticated) {
                    socket.close(4401, "Must authenticate first");
                    return;
                }
                // 2. Mensagem de Subscrição de Ativo
                if (msg.type === "subscribe") {
                    const symbol = msg.symbol;
                    if (!symbol)
                        return;
                    if (clientSubscriptions.size >= 10) {
                        socket.send(JSON.stringify({ type: "error", message: "Max 10 symbol subscriptions per connection" }));
                        return;
                    }
                    clientSubscriptions.add(symbol);
                    if (!subscriptionsBySymbol.has(symbol)) {
                        subscriptionsBySymbol.set(symbol, new Set());
                    }
                    subscriptionsBySymbol.get(symbol).add(socket);
                    // Se solicitou catch-up por lastSequence (M-06)
                    if (msg.lastSequence !== undefined) {
                        const catchup = await catchupHandler.getCatchupTicks(symbol, BigInt(msg.lastSequence));
                        if (catchup.resyncRequired) {
                            socket.send(JSON.stringify({ type: "resync_required", symbol }));
                        }
                        else if (catchup.ticks.length > 0) {
                            socket.send(JSON.stringify({ type: "catchup_ticks", symbol, ticks: catchup.ticks }));
                        }
                    }
                    socket.send(JSON.stringify({ type: "subscribed", symbol }));
                    return;
                }
                // 3. Unsubscribe
                if (msg.type === "unsubscribe") {
                    const symbol = msg.symbol;
                    clientSubscriptions.delete(symbol);
                    subscriptionsBySymbol.get(symbol)?.delete(socket);
                    socket.send(JSON.stringify({ type: "unsubscribed", symbol }));
                }
            }
            catch (err) {
                socket.send(JSON.stringify({ type: "error", message: "Malformed message" }));
            }
        });
        socket.on("close", () => {
            clearInterval(pingInterval);
            clearTimeout(authTimeout);
            if (currentUserId) {
                const userConns = activeConnectionsByUser.get(currentUserId);
                if (userConns) {
                    userConns.delete(socket);
                    if (userConns.size === 0) {
                        activeConnectionsByUser.delete(currentUserId);
                    }
                }
            }
            for (const symbol of clientSubscriptions) {
                subscriptionsBySymbol.get(symbol)?.delete(socket);
            }
        });
    });
    try {
        await app.listen({ port: PORT, host: HOST });
        console.log(`[WebSocketGateway] Listening on ws://${HOST}:${PORT}/ws`);
    }
    catch (err) {
        console.error("[WebSocketGateway] Startup error:", err);
        process.exit(1);
    }
}
main();
