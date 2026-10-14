import { OpenContractSchema, COUNTRY_STAKE_LIMITS } from "@broker/shared";
import { ContractService } from "../services/contract-service.js";
export const contractRoutes = async (server) => {
    const contractService = new ContractService(server.pg, server.redis);
    // POST /api/v1/contracts (Abertura de contrato UP/DOWN)
    const preHandlers = [server.authenticate];
    if (typeof server.enforceTradingEnabled === 'function') {
        preHandlers.push(server.enforceTradingEnabled);
    }
    server.post("/api/v1/contracts", {
        preHandler: preHandlers
    }, async (request, reply) => {
        const user = request.user;
        if (!user) {
            return reply.status(401).send({ error: "UNAUTHORIZED", message: "User not authenticated" });
        }
        const idempotencyKey = request.headers["idempotency-key"];
        if (!idempotencyKey) {
            return reply.status(400).send({
                error: "BAD_REQUEST",
                message: "Header 'Idempotency-Key' is required (D-12, B-05)"
            });
        }
        // Validação estrita com Zod (rejeita qualquer campo extra)
        const parseResult = OpenContractSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                error: "VALIDATION_ERROR",
                details: parseResult.error.format()
            });
        }
        // Validação de Stake Mínimo e Máximo por País (Seção 6.1)
        const countryCode = (request.geoContext?.country || "BR");
        const limits = COUNTRY_STAKE_LIMITS[countryCode] || { min_stake_minor: 100, max_stake_minor: 10000 };
        if (parseResult.data.stake_minor < limits.min_stake_minor || parseResult.data.stake_minor > limits.max_stake_minor) {
            return reply.status(400).send({
                error: "STAKE_OUT_OF_BOUNDS",
                message: `Stake fora dos limites permitidos para o país ${countryCode} (${limits.min_stake_minor} a ${limits.max_stake_minor} minor units)`
            });
        }
        try {
            const { contract, isDuplicate } = await contractService.openContract(user.id, idempotencyKey, parseResult.data);
            if (!isDuplicate) {
                try {
                    const { RegionalMetricsService } = await import("../services/metrics.js");
                    RegionalMetricsService.getInstance().incrementContractCreated(parseResult.data.symbol, parseResult.data.direction, request.geoContext?.country || "BR");
                }
                catch {
                    // Ignora erro de métrica
                }
            }
            const statusCode = isDuplicate ? 200 : 201;
            return reply.status(statusCode).send({
                success: true,
                is_duplicate: isDuplicate,
                contract
            });
        }
        catch (err) {
            if (err.message?.includes("KILLSWITCH_ACTIVE")) {
                return reply.status(503).send({
                    error: "KILLSWITCH_ACTIVE",
                    message: "Kill switch ativo: feed de cotações instável ou desatualizado. Abertura bloqueada."
                });
            }
            if (err.message?.includes("FEED_STALE")) {
                return reply.status(503).send({
                    error: "FEED_STALE",
                    message: "Cotação desatualizada. Abertura bloqueada por segurança."
                });
            }
            if (err.message?.includes("TICK_UNAVAILABLE")) {
                return reply.status(503).send({
                    error: "TICK_UNAVAILABLE",
                    message: "Cotação indisponível para o ativo solicitado."
                });
            }
            if (err.message?.includes("RISK_LIMIT_EXCEEDED")) {
                return reply.status(422).send({
                    error: "RISK_LIMIT_EXCEEDED",
                    message: "Max platform risk cap (3% of float) reached for this candle and direction"
                });
            }
            server.log.error(err, "Failed to open contract");
            return reply.status(500).send({ error: "INTERNAL_ERROR", message: "Failed to process contract order" });
        }
    });
    // GET /api/v1/contracts (Histórico de ordens do usuário)
    server.get("/api/v1/contracts", {
        preHandler: [server.authenticate]
    }, async (request, reply) => {
        const user = request.user;
        if (!user) {
            return reply.status(401).send({ error: "UNAUTHORIZED" });
        }
        const contracts = await contractService.listUserContracts(user.id);
        return { contracts };
    });
    // GET /api/v1/contracts/:id (Detalhes de contrato com proteção BOLA/IDOR - S-04)
    server.get("/api/v1/contracts/:id", {
        preHandler: [server.authenticate]
    }, async (request, reply) => {
        const user = request.user;
        if (!user) {
            return reply.status(401).send({ error: "UNAUTHORIZED" });
        }
        const contract = await contractService.getContractById(user.id, request.params.id);
        if (!contract) {
            // Retorna 404 para evitar inferência de existência de recursos de outros usuários (S-04)
            return reply.status(404).send({ error: "NOT_FOUND", message: "Contract not found" });
        }
        return { contract };
    });
};
