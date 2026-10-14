import { BlnkClient } from "@broker/wallet-adapter";
export const walletRoutes = async (server) => {
    const blnkClient = new BlnkClient(process.env.BLNK_URL || "http://localhost:5001");
    // GET /api/v1/wallet (Saldo da carteira demo no Blnk)
    server.get("/api/v1/wallet", {
        preHandler: [server.authenticate]
    }, async (request, reply) => {
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
                    precision: 100,
                    ...balance,
                    total_equity_minor: balance.available_minor + balance.reserved_minor
                };
            }
            catch (err) {
                if (!(err instanceof Error) || !err.message.startsWith("BLNK_HTTP_ERROR_404")) {
                    throw err;
                }
                // Onboarding do usuário: cria contas e injeta US$ 10.000 demo
                await blnkClient.onboardUser(user.id);
                const balance = await blnkClient.getBalance(user.id);
                return {
                    user_id: user.id,
                    currency: "USD",
                    precision: 100,
                    ...balance,
                    total_equity_minor: balance.available_minor + balance.reserved_minor
                };
            }
        }
        catch (err) {
            server.log.error(err, "Failed to retrieve wallet balance from Blnk");
            return reply.status(503).send({ error: "WALLET_UNAVAILABLE" });
        }
    });
};
