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

  // Hook global que injeta geoContext em toda requisição e computa métricas e latência real
  server.addHook("preHandler", async (request: FastifyRequest) => {
    (request as any)._startMs = performance.now();
    request.geoContext = GeoBlockService.resolveGeoContext(request);
  });

  server.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const country = request.geoContext?.country || GeoBlockService.extractCountry(request);
    const startMs = (request as any)._startMs;
    const latencyMs = typeof startMs === "number" ? performance.now() - startMs : 5;
    metrics.incrementRequest(country, request.url, reply.statusCode);
    metrics.recordApiLatency(request.url, latencyMs, country);
  });

  // Decorator de barreira de Geoblocking
  server.decorate("enforceGeoblock", async (request: FastifyRequest, reply: FastifyReply) => {
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
    // 1. Primeiro aplica barreira de geoblocking
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

    // 2. Verifica se a flag trading_enabled está ativa para o país
    const tradingEnabled = await flagsService.isFeatureEnabled(request.geoContext.country, "trading_enabled");
    if (!tradingEnabled) {
      return reply.status(403).send({
        error: "FEATURE_DISABLED",
        message: "Trading contracts are currently disabled in your country",
        country: request.geoContext.country,
        feature: "trading_enabled"
      });
    }

    // 3. Verifica as flags globais otc_enabled e synthetic_enabled (Seção 3.2) quando símbolo é informado
    const bodySymbol = typeof (request.body as any)?.symbol === "string" ? (request.body as any).symbol.toUpperCase() : null;
    if (bodySymbol) {
      const sysFlags = await flagsService.getSystemFlags();
      if (bodySymbol.endsWith("_OTC") && sysFlags.otc_enabled === false) {
        return reply.status(403).send({
          error: "FEATURE_DISABLED",
          message: "OTC demo market is currently disabled by feature flag",
          country: request.geoContext.country,
          feature: "otc_enabled"
        });
      }
      if (!bodySymbol.endsWith("_OTC") && sysFlags.synthetic_enabled === false) {
        return reply.status(403).send({
          error: "FEATURE_DISABLED",
          message: "Synthetic indices market is currently disabled by feature flag",
          country: request.geoContext.country,
          feature: "synthetic_enabled"
        });
      }
    }
  });
});
