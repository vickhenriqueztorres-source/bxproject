import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { CountryCode, CountryCodeSchema, PHASE2_COUNTRIES } from "@broker/shared";
import { COUNTRY_METADATA } from "../services/geoblock.js";

const UpdateFlagBodySchema = z.object({
  flag_key: z.string().min(1).max(64),
  enabled: z.boolean()
});

const UpdateStatusBodySchema = z.object({
  is_active: z.boolean()
});

export const geoRoutes: FastifyPluginAsync = async (server) => {
  /**
   * Endpoint público: Verificação de rota geográfica, zona regulatória e espelho sugerido
   */
  server.get("/api/v1/geo/route-check", async (request) => {
    const reg = request.regulatoryContext;
    return {
      country: reg.country,
      zone: reg.zone,
      hard_blocked: reg.hardBlocked,
      regulator_authority: reg.regulatorAuthority,
      suggested_mirror: reg.suggestedMirror
    };
  });

  /**
   * Endpoint público: Detecção de país e configuração regional
   */
  server.get("/api/v1/geo/detect", async (request) => {
    const geo = request.geoContext;
    let flags: Record<string, boolean> = {};

    if (geo.allowed) {
      flags = await server.featureFlagsService.getCountryFlags(geo.country);
    }

    return {
      country: geo.country,
      allowed: geo.allowed,
      default_currency: geo.defaultCurrency,
      default_locale: geo.defaultLocale,
      timezone: geo.timezone,
      flags
    };
  });

  /**
   * Endpoint público (Region Router): Resolução unificada de geolocalização e contexto regional
   */
  server.get("/api/v1/geo/resolve", async (request) => {
    const geo = request.geoContext;
    const isCountryActive = geo.allowed ? await server.featureFlagsService.isCountryActive(geo.country) : false;
    const systemFlags = await server.featureFlagsService.getSystemFlags();

    return {
      country: geo.country,
      allowed: geo.allowed && isCountryActive,
      is_active: isCountryActive,
      defaultCurrency: geo.defaultCurrency,
      defaultLocale: geo.defaultLocale,
      timezone: geo.timezone,
      flags: systemFlags
    };
  });

  /**
   * Endpoint público: Lista unificada das 10 Feature Flags do sistema
   */
  server.get("/api/v1/flags", async () => {
    const flags = await server.featureFlagsService.getSystemFlags();
    return { flags };
  });

  /**
   * Endpoint público: Lista de países suportados na Fase 2
   */
  server.get("/api/v1/geo/countries", async () => {
    const countries = [];

    for (const code of PHASE2_COUNTRIES) {
      const meta = COUNTRY_METADATA[code];
      const isActive = await server.featureFlagsService.isCountryActive(code);
      countries.push({
        code,
        name: meta.name,
        default_currency: meta.currency,
        default_locale: meta.locale,
        is_active: isActive
      });
    }

    return { countries };
  });

  /**
   * Endpoint público: Consulta de feature flags de um país
   */
  server.get<{ Params: { country: string } }>("/api/v1/flags/:country", async (request, reply) => {
    const country = request.params.country.toUpperCase();
    const parsed = CountryCodeSchema.safeParse(country);

    if (!parsed.success) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: `País '${country}' não faz parte da Fase 2.`
      });
    }

    const flags = await server.featureFlagsService.getCountryFlags(country);
    const isActive = await server.featureFlagsService.isCountryActive(country);

    return {
      country,
      is_active: isActive,
      flags
    };
  });

  /**
   * Endpoint protegido (ADMIN): Lista detalhada de todos os países e flags para o Painel Admin
   */
  server.get(
    "/api/v1/admin/countries",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async () => {
      const list = await server.featureFlagsService.getAllCountriesWithFlags();
      return { countries: list };
    }
  );

  /**
   * Endpoint protegido (ADMIN): Chaveamento de feature flag por país em runtime
   */
  server.put<{ Params: { country: string }; Body: { flag_key: string; enabled: boolean } }>(
    "/api/v1/admin/countries/:country/flags",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request, reply) => {
      const country = request.params.country.toUpperCase();
      const parsedCountry = CountryCodeSchema.safeParse(country);
      if (!parsedCountry.success) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: `País '${country}' inválido.` });
      }

      const parsedBody = UpdateFlagBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "Payload inválido.", details: parsedBody.error.issues });
      }

      await server.featureFlagsService.setCountryFlag(
        parsedCountry.data as CountryCode,
        parsedBody.data.flag_key,
        parsedBody.data.enabled
      );

      return {
        success: true,
        country: parsedCountry.data,
        flag_key: parsedBody.data.flag_key,
        enabled: parsedBody.data.enabled,
        updated_at: new Date().toISOString()
      };
    }
  );

  /**
   * Endpoint protegido (ADMIN): Ativação / Desativação de país em runtime
   */
  server.put<{ Params: { country: string }; Body: { is_active: boolean } }>(
    "/api/v1/admin/countries/:country/status",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request, reply) => {
      const country = request.params.country.toUpperCase();
      const parsedCountry = CountryCodeSchema.safeParse(country);
      if (!parsedCountry.success) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: `País '${country}' inválido.` });
      }

      const parsedBody = UpdateStatusBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({ error: "BAD_REQUEST", message: "Payload inválido.", details: parsedBody.error.issues });
      }

      await server.featureFlagsService.setCountryActive(
        parsedCountry.data as CountryCode,
        parsedBody.data.is_active
      );

      return {
        success: true,
        country: parsedCountry.data,
        is_active: parsedBody.data.is_active,
        updated_at: new Date().toISOString()
      };
    }
  );

  /**
   * Endpoint protegido (ADMIN): Chaveamento de System Feature Flag em runtime sem deploy
   */
  server.put<{ Params: { flagKey: string }; Body: { enabled: boolean } }>(
    "/api/v1/admin/flags/:flagKey",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request, reply) => {
      const flagKey = request.params.flagKey;
      const enabled = Boolean(request.body.enabled);

      await server.featureFlagsService.setSystemFlag(flagKey, enabled);

      return {
        success: true,
        flag_key: flagKey,
        enabled,
        updated_at: new Date().toISOString()
      };
    }
  );
};
