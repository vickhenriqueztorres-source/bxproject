import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { MirrorDomainService } from "../services/mirror-domains.js";

const RotateDomainBodySchema = z.object({
  blocked_domain: z.string().min(3).max(255),
  target_country: z.string().length(2).optional()
});

const AddMirrorBodySchema = z.object({
  domain_name: z.string().min(3).max(255),
  target_country: z.string().length(2).nullable().optional(),
  priority: z.number().int().min(1).max(1000).default(100),
  status: z.enum(["ACTIVE", "STANDBY", "BLOCKED", "DEAD"]).default("STANDBY")
});

export const mirrorRoutes: FastifyPluginAsync = async (server) => {
  const mirrorService = new MirrorDomainService(server.pg, server.redis);

  /**
   * Endpoint público: Lista de espelhos disponíveis para o país da requisição
   */
  server.get("/api/v1/geo/mirrors", async (request) => {
    const country = request.regulatoryContext?.country || "UNKNOWN";
    const mirrors = await mirrorService.listMirrors(country !== "UNKNOWN" ? country : undefined);
    const active = await mirrorService.getActiveMirror(country !== "UNKNOWN" ? country : undefined);

    return {
      detected_country: country,
      active_mirror: active?.domain_name || null,
      available_mirrors: mirrors.filter(m => m.status === "ACTIVE" || m.status === "STANDBY")
    };
  });

  /**
   * Endpoint administrativo: Listagem operacional de todos os domínios espelho
   */
  server.get(
    "/api/v1/admin/mirrors",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request) => {
      const countryQuery = (request.query as any)?.country;
      const mirrors = await mirrorService.listMirrors(countryQuery);
      return { mirrors };
    }
  );

  /**
   * Endpoint administrativo: Acionamento forçado de rotação de domínio por bloqueio
   */
  server.post(
    "/api/v1/admin/mirrors/rotate",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request, reply) => {
      const parsed = RotateDomainBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Payload inválido para rotação de domínio",
          details: parsed.error.issues
        });
      }

      try {
        const result = await mirrorService.rotateDomain(
          parsed.data.blocked_domain,
          parsed.data.target_country
        );

        return {
          success: true,
          action: "DOMAIN_ROTATED",
          previous_domain: result.previousDomain,
          new_active_domain: result.currentDomain,
          target_country: result.targetCountry,
          rotated_at: result.rotatedAt
        };
      } catch (err: any) {
        return reply.status(409).send({
          error: "ROTATION_FAILED",
          message: err.message || "Falha ao rotacionar domínio espelho"
        });
      }
    }
  );

  /**
   * Endpoint administrativo: Cadastro de novo domínio espelho na rede
   */
  server.post(
    "/api/v1/admin/mirrors",
    {
      preHandler: [server.authenticate, server.requireRole("ADMIN")]
    },
    async (request, reply) => {
      const parsed = AddMirrorBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Payload inválido para cadastro de espelho",
          details: parsed.error.issues
        });
      }

      const created = await mirrorService.addMirror(parsed.data);
      return reply.status(201).send({
        success: true,
        mirror: created
      });
    }
  );
};
