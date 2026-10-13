import { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { GeoBlockService, GeoContext } from "../services/geoblock.js";
import { FeatureFlagsService } from "../services/feature-flags.js";

import { RegionalMetricsService } from "../services/metrics.js";

declare module "fastify" {
  interface FastifyRequest {
    geoContext: GeoContext;
  }
  interface FastifyInstance {
    featureFlagsService: FeatureFlagsService;
    enforceGeoblock: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    enforceTradingEnabled: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const geoblockPlugin: FastifyPluginAsync = fp(async (server) => {
  const flagsService = new FeatureFlagsService(server.pg, server.redis);
  server.decorate("featureFlagsService", flagsService);

  const metrics = RegionalMetricsService.getInstance();

  // Hook global que injeta geoContext em toda requisição e computa métricas
  server.addHook("preHandler", async (request: FastifyRequest) => {
    request.geoContext = GeoBlockService.resolveGeoContext(request);
    metrics.incrementRequest(request.geoContext.country, request.url, 200);
  });

  // Decorator de barreira de Geoblocking
  server.decorate("enforceGeoblock", async (request: FastifyRequest, reply: FastifyReply) => {
    // Brasil é 100% livre: nunca bloqueia
    if (request.geoContext.country === "BR") {
      return;
    }

    if (!request.geoContext.allowed) {
      metrics.incrementGeoblockRejection(request.geoContext.country, "UNSUPPORTED_REGION");
      return reply.status(403).send({
        error: "GEO_BLOCKED",
        message: "Country not supported in Phase 2",
        country: request.geoContext.country
      });
    }

    const isActive = await flagsService.isCountryActive(request.geoContext.country);
    if (!isActive) {
      metrics.incrementGeoblockRejection(request.geoContext.country, "COUNTRY_DISABLED");
      return reply.status(403).send({
        error: "COUNTRY_DISABLED",
        message: "Access temporarily disabled for your country",
        country: request.geoContext.country
      });
    }
  });

  // Decorator de verificação de permissão de negociação / trading
  server.decorate("enforceTradingEnabled", async (request: FastifyRequest, reply: FastifyReply) => {
    // Brasil é 100% livre: trading sempre permitido
    if (request.geoContext.country === "BR") {
      return;
    }

    // 1. Primeiro aplica barreira de geoblocking
    if (!request.geoContext.allowed) {
      return reply.status(403).send({
        error: "GEO_BLOCKED",
        message: "Country not supported in Phase 2",
        country: request.geoContext.country
      });
    }

    const isActive = await flagsService.isCountryActive(request.geoContext.country);
    if (!isActive) {
      return reply.status(403).send({
        error: "COUNTRY_DISABLED",
        message: "Access temporarily disabled for your country",
        country: request.geoContext.country
      });
    }

    // 2. Verifica se a flag trading_enabled está ativa
    const tradingEnabled = await flagsService.isFeatureEnabled(request.geoContext.country, "trading_enabled");
    if (!tradingEnabled) {
      return reply.status(403).send({
        error: "FEATURE_DISABLED",
        message: "Trading contracts are currently disabled in your country",
        country: request.geoContext.country,
        feature: "trading_enabled"
      });
    }
  });
});
