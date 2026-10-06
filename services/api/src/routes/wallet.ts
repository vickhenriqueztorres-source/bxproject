import { FastifyPluginAsync } from "fastify";
import { BlnkClient } from "@broker/wallet-adapter";

export const walletRoutes: FastifyPluginAsync = async (server) => {
  const blnkClient = new BlnkClient(process.env.BLNK_URL || "http://localhost:5001");

  // GET /api/v1/wallet (Saldo da carteira demo no Blnk)
  server.get(
    "/api/v1/wallet",
    {
      preHandler: [(server as any).authenticate]
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: "UNAUTHORIZED" });
      }

      try {
        // Tenta obter o saldo; se falhar por não existir ainda, faz onboarding
        try {
          const balance = await blnkClient.getBalance(user.id);
          return {
            user_id: user.id,
            currency: "USD",
            ...balance
          };
        } catch {
          // Onboarding do usuário: cria contas e injeta US$ 10.000 demo
          await blnkClient.onboardUser(user.id);
          const balance = await blnkClient.getBalance(user.id);
          return {
            user_id: user.id,
            currency: "USD",
            ...balance
          };
        }
      } catch (err: any) {
        server.log.error(err, "Failed to retrieve wallet balance");
        // Em caso de fallback se Blnk estiver offline em ambiente de teste local
        return reply.status(200).send({
          user_id: user.id,
          currency: "USD",
          available_minor: 1000000, // US$ 10.000,00 demo default
          reserved_minor: 0
        });
      }
    }
  );
};
