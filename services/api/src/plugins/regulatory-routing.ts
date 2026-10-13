import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { RegulatoryZoneService, RegulatoryRoutingContext } from "../services/regulatory-zones.js";

declare module "fastify" {
  interface FastifyRequest {
    regulatoryContext: RegulatoryRoutingContext;
  }
  interface FastifyInstance {
    regulatoryService: RegulatoryZoneService;
    enforceRegulatoryClearance: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const regulatoryRoutingPlugin: FastifyPluginAsync = fp(async (server) => {
  const regulatoryService = new RegulatoryZoneService(server.pg, server.redis);
  server.decorate("regulatoryService", regulatoryService);

  // Decorator de verificação de conformidade regulatória explícita
  server.decorate("enforceRegulatoryClearance", async (request: FastifyRequest, reply: FastifyReply) => {
    // Brasil é 100% livre: nunca bloqueia
    if (request.regulatoryContext?.country === "BR") {
      return;
    }

    if (request.regulatoryContext?.hardBlocked || request.regulatoryContext?.zone === "RED") {
      return reply.status(403).send({
        error: "GEO_BLOCKED_RED_ZONE",
        message: "Access prohibited due to strict retail regulatory restrictions in your jurisdiction.",
        country: request.regulatoryContext.country,
        zone: "RED",
        regulatory_authority: request.regulatoryContext.regulatorAuthority
      });
    }
  });

  // Hook global de injeção de contexto e headers de roteamento
  server.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    const context = await regulatoryService.resolveRoutingContext(request);
    request.regulatoryContext = context;

    // Headers de roteamento e auditoria transparente
    reply.header("X-Regulatory-Zone", context.zone);
    reply.header("X-Target-Mirror", context.suggestedMirror);
    reply.header("X-Detected-Country", context.country);

    // Brasil é 100% livre: nunca bloqueia requisição
    if (context.country === "BR") {
      return;
    }

    // Hard Geo-block automático para rotas operacionais críticas de trading, carteira e KYC
    const isPublicExempt = 
      request.url.startsWith("/api/v1/health") || 
      request.url.startsWith("/api/v1/geo/route-check") ||
      request.url.startsWith("/metrics");

    if (!isPublicExempt && (context.hardBlocked || context.zone === "RED")) {
      return reply.status(403).send({
        error: "GEO_BLOCKED_RED_ZONE",
        message: "Access prohibited due to strict retail regulatory restrictions in your jurisdiction.",
        country: context.country,
        zone: "RED",
        regulatory_authority: context.regulatorAuthority
      });
    }
  });
});
