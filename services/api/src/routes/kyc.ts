import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DynamicComplianceService } from "../services/compliance-kyc.js";

const SubmitTier1BodySchema = z.object({
  document_type: z.string().min(2).max(32),
  document_number: z.string().min(4).max(64),
  nationality_country: z.string().length(2),
  issuer_country: z.string().length(2)
});

const PreDepositCheckBodySchema = z.object({
  amount_minor: z.number().int().positive()
});

export const kycRoutes: FastifyPluginAsync = async (server) => {
  const complianceService = new DynamicComplianceService(server.pg, server.redis);

  /**
   * Endpoint protegido: Consulta do perfil de compliance e tier do próprio usuário
   */
  server.get(
    "/api/v1/kyc/me",
    {
      preHandler: [server.authenticate]
    },
    async (request) => {
      const userId = (request.user as any).id;
      const country = request.regulatoryContext?.country || "BR";
      const profile = await complianceService.getProfile(userId, country);
      return { profile };
    }
  );

  /**
   * Endpoint protegido: Submissão de documento para upgrade para Tier 1 com Anti-Red Zone Exclusion
   */
  server.post(
    "/api/v1/kyc/submit-tier1",
    {
      preHandler: [server.authenticate]
    },
    async (request, reply) => {
      const userId = (request.user as any).id;
      const parsed = SubmitTier1BodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Dados de documento inválidos",
          details: parsed.error.issues
        });
      }

      const result = await complianceService.submitTier1Document(userId, {
        documentType: parsed.data.document_type,
        documentNumber: parsed.data.document_number,
        nationalityCountry: parsed.data.nationality_country,
        issuerCountry: parsed.data.issuer_country
      });

      if (result.status === "REJECTED") {
        return reply.status(403).send({
          error: "KYC_REJECTED",
          message: result.reason,
          status: result.status,
          tier: result.tier
        });
      }

      return {
        success: true,
        status: result.status,
        tier: result.tier
      };
    }
  );

  /**
   * Endpoint protegido: Verificação de limites e elegibilidade pré-depósito
   */
  server.post(
    "/api/v1/kyc/pre-deposit-check",
    {
      preHandler: [server.authenticate]
    },
    async (request, reply) => {
      const userId = (request.user as any).id;
      const parsed = PreDepositCheckBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: "Valor de depósito inválido",
          details: parsed.error.issues
        });
      }

      const country = request.regulatoryContext?.country || "UNKNOWN";
      const check = await complianceService.evaluateDepositEligibility(
        userId,
        parsed.data.amount_minor,
        country
      );

      if (!check.allowed) {
        return reply.status(403).send({
          error: "DEPOSIT_NOT_ALLOWED",
          reason: check.reason,
          tier: check.tier,
          requested_minor: check.requestedMinor,
          limit_minor: check.limitMinor
        });
      }

      return {
        allowed: true,
        tier: check.tier,
        status: check.status,
        requested_minor: check.requestedMinor,
        cumulative_minor: check.cumulativeMinor,
        limit_minor: check.limitMinor
      };
    }
  );
};
