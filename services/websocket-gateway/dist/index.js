import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { Redis } from "ioredis";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { RED_ZONE_COUNTRIES } from "@broker/shared";
import { CatchupHandler } from "./handlers/catchup-handler.js";
const PORT = parseInt(process.env.WS_PORT || "3001", 10);
const HOST = process.env.WS_HOST || "0.0.0.0";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || "http://localhost:8080";
const REALM = process.env.KEYCLOAK_REALM || "broker-demo";
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
const redisSub = new Redis(REDIS_URL);
const redisClient = new Redis(REDIS_URL);
const catchupHandler = new CatchupHandler(redisClient);
// Mapa de conexões ativas por usuário para aplicar o limite de 5 conexões (B-16)
const activeConnectionsByUser = new Map();
// Mapa de subscrições: symbol -> Set de sockets
const subscriptionsBySymbol = new Map();
// JWKS para validação RS256
let JWKS = null;
try {
    const jwksUri = new URL(`${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`);
    JWKS = createRemoteJWKSet(jwksUri);
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
        const { payload } = await jwtVerify(token, JWKS, {
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
    await app.register(websocket);
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
        // Interceptação de Geoblocking e Risco Regulatório no Handshake WSS
        const rawCountry = req.headers["cf-ipcountry"] || req.headers["x-country-code"] || req.headers["x-test-country"];
        const code = (rawCountry && typeof rawCountry === "string") ? rawCountry.trim().toUpperCase() : "BR";
        // Brasil é 100% livre: aceita conexão incondicionalmente
        if (code === "BR") {
            // Conexão permitida sem bloqueio
        }
        else if (RED_ZONE_COUNTRIES.includes(code)) {
            socket.close(4403, "Red zone regulatory block: retail trading prohibited");
            return;
        }
        else {
            const allowedCountries = ["BR", "MX", "CO", "AR", "CL", "PE"];
            if (/^[A-Z]{2}$/.test(code) && !allowedCountries.includes(code)) {
                socket.close(4403, "Geo-blocked: region not supported");
                return;
            }
        }
        let isAuthenticated = false;
        let currentUserId = null;
        const clientSubscriptions = new Set();
        let pongTimeoutTimer = null;
        const HEARTBEAT_INTERVAL_MS = 30000;
        const HEARTBEAT_TIMEOUT_MS = 5000;
        const pingInterval = setInterval(() => {
            if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: "ping" }));
                // Timeout estrito de 5s para o recebimento do pong (RFC 6455 / Padrão Indústria)
                if (pongTimeoutTimer)
                    clearTimeout(pongTimeoutTimer);
                pongTimeoutTimer = setTimeout(() => {
                    socket.close(4408, "Heartbeat timeout");
                    clearInterval(pingInterval);
                }, HEARTBEAT_TIMEOUT_MS);
            }
        }, HEARTBEAT_INTERVAL_MS);
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
                    if (pongTimeoutTimer) {
                        clearTimeout(pongTimeoutTimer);
                        pongTimeoutTimer = null;
                    }
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
                    // Limite de 5 conexões por usuário compartilhado no Redis (V-11)
                    let allowed = true;
                    try {
                        const count = await redisClient.incr(`ws:conn:${currentUserId}`);
                        if (count === 1) {
                            await redisClient.expire(`ws:conn:${currentUserId}`, 60);
                        }
                        else if (count > 5) {
                            await redisClient.decr(`ws:conn:${currentUserId}`);
                            allowed = false;
                        }
                        else {
                            await redisClient.expire(`ws:conn:${currentUserId}`, 60);
                        }
                    }
                    catch {
                        const userConns = activeConnectionsByUser.get(currentUserId) || new Set();
                        if (userConns.size >= 5)
                            allowed = false;
                    }
                    if (!allowed) {
                        socket.close(4429, "Too many concurrent connections for user");
                        return;
                    }
                    const userConns = activeConnectionsByUser.get(currentUserId) || new Set();
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
                // 2. Mensagem de Subscrição de Ativo (Suporta símbolo único ou lote multiplexado)
                if (msg.type === "subscribe") {
                    const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
                    if (rawSymbols.length === 0)
                        return;
                    if (clientSubscriptions.size + rawSymbols.length > 10) {
                        socket.send(JSON.stringify({ type: "error", message: "Max 10 symbol subscriptions per connection" }));
                        return;
                    }
                    for (const symbol of rawSymbols) {
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
                    }
                    return;
                }
                // 3. Unsubscribe (Suporta símbolo único ou lote multiplexado)
                if (msg.type === "unsubscribe") {
                    const rawSymbols = Array.isArray(msg.symbols) ? msg.symbols : (msg.symbol ? [msg.symbol] : []);
                    for (const symbol of rawSymbols) {
                        clientSubscriptions.delete(symbol);
                        subscriptionsBySymbol.get(symbol)?.delete(socket);
                        socket.send(JSON.stringify({ type: "unsubscribed", symbol }));
                    }
                    return;
                }
            }
            catch (err) {
                socket.send(JSON.stringify({ type: "error", message: "Malformed message" }));
            }
        });
        socket.on("close", () => {
            clearInterval(pingInterval);
            if (pongTimeoutTimer)
                clearTimeout(pongTimeoutTimer);
            clearTimeout(authTimeout);
            if (currentUserId) {
                redisClient.decr(`ws:conn:${currentUserId}`).catch(() => { });
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
