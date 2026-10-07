"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractRoutes = void 0;
const shared_1 = require("@broker/shared");
const contract_service_js_1 = require("../services/contract-service.js");
const contractRoutes = async (server) => {
    const contractService = new contract_service_js_1.ContractService(server.pg, server.redis);
    // POST /api/v1/contracts (Abertura de contrato UP/DOWN)
    server.post("/api/v1/contracts", {
        preHandler: [server.authenticate]
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
        const parseResult = shared_1.OpenContractSchema.safeParse(request.body);
        if (!parseResult.success) {
            return reply.status(400).send({
                error: "VALIDATION_ERROR",
                details: parseResult.error.format()
            });
        }
        try {
            const { contract, isDuplicate } = await contractService.openContract(user.id, idempotencyKey, parseResult.data);
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
exports.contractRoutes = contractRoutes;
