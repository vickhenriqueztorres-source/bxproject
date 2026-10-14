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
        } catch (err) {
          if (!(err instanceof Error) || !err.message.startsWith("BLNK_HTTP_ERROR_404")) {
            throw err;
          }
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
        server.log.error(err, "Failed to retrieve wallet balance from Blnk, attempting PostgreSQL fallback");
        try {
          const pgRes = await server.pg.query(
            "SELECT demo_balance_minor FROM users WHERE id = $1",
            [user.id]
          );
          if (pgRes.rows.length > 0) {
            return {
              user_id: user.id,
              currency: "USD",
              available_minor: Number(pgRes.rows[0].demo_balance_minor),
              reserved_minor: 0
            };
          }
        } catch (dbErr) {
          server.log.error(dbErr, "PostgreSQL wallet fallback query failed");
        }
        return reply.status(503).send({ error: "WALLET_UNAVAILABLE" });
      }
    }
  );
};
