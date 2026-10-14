import { FastifyPluginAsync } from "fastify";
import { TournamentArenaService } from "../services/tournament-arena-service.js";
import type { PayoutTier } from "@broker/wallet-adapter";

export const arenaRoutes: FastifyPluginAsync = async (server) => {
  const arenaService = new TournamentArenaService(
    (server as any).pg,
    (server as any).redis,
    (server as any).blnkClient
  );

  const authPreHandler = (server as any).authenticate ? [(server as any).authenticate] : [];

  function mapArenaError(reply: any, err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("BONUS_ROLLOVER_INCOMPLETE")) {
      return reply.status(403).send({ error: "BONUS_ROLLOVER_INCOMPLETE", message: msg });
    }
    if (msg.includes("IDEMPOTENCY_KEY_CONFLICT") || msg.includes("SYBIL_DEVICE_CONFLICT")) {
      const code = msg.includes("SYBIL_DEVICE_CONFLICT") ? "SYBIL_DEVICE_CONFLICT" : "IDEMPOTENCY_KEY_CONFLICT";
      return reply.status(409).send({ error: code, message: msg });
    }
    if (msg.includes("TOURNAMENT_NOT_FOUND") || msg.includes("PARTICIPANT_NOT_FOUND") || msg.includes("TRANSACTION_NOT_FOUND")) {
      return reply.status(404).send({ error: "NOT_FOUND", message: msg });
    }
    if (
      msg.includes("INSUFFICIENT_BALANCE") ||
      msg.includes("INSUFFICIENT_TOURNAMENT_BALANCE") ||
      msg.includes("TOURNAMENT_TRADING_FROZEN") ||
      msg.includes("TOURNAMENT_EXPIRY_EXCEEDS_END") ||
      msg.includes("TOURNAMENT_TRADE_COOLDOWN") ||
      msg.includes("STAKE_EXCEEDS_20PCT_CAP") ||
      msg.includes("REBUY_WINDOW_CLOSED") ||
      msg.includes("MAX_REBUYS_REACHED") ||
      msg.includes("REBUY_NOT_ELIGIBLE") ||
      msg.includes("COLLUSION_MIRROR_TRADE_DETECTED")
    ) {
      const code = msg.split(":")[0].trim();
      return reply.status(422).send({ error: code, message: msg });
    }
    if (msg.includes("INVALID_MINOR_AMOUNT") || msg.includes("IDEMPOTENCY_VIOLATION")) {
      const code = msg.split(":")[0].trim();
      return reply.status(400).send({ error: code, message: msg });
    }
    return reply.status(500).send({ error: "INTERNAL_ERROR", message: msg });
  }

  // =========================================================================
  // 1. REAL WALLET CASHIER ROUTES (/api/v1/wallet/real/...)
  // =========================================================================

  server.get("/api/v1/wallet/real", { preHandler: authPreHandler }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });
    return arenaService.getRealBalanceSnapshot(user.id);
  });

  server.post("/api/v1/wallet/real/deposit", { preHandler: authPreHandler }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const idempotencyKey = request.headers["idempotency-key"] as string;
    const body = (request.body || {}) as {
      amount_minor?: number;
      method?: "PIX" | "CARD" | "CRYPTO" | "BANK";
      metadata?: Record<string, unknown>;
    };

    try {
      const res = await arenaService.requestRealDeposit({
        userId: user.id,
        amountMinor: Number(body.amount_minor),
        method: body.method || "PIX",
        idempotencyKey,
        metadata: body.metadata
      });
      return reply.status(res.isDuplicate ? 200 : 201).send(res);
    } catch (err) {
      return mapArenaError(reply, err);
    }
  });

  server.post("/api/v1/wallet/real/deposit/confirm", { preHandler: authPreHandler }, async (request, reply) => {
    const body = (request.body || {}) as { tx_id?: string };
    try {
      const res = await arenaService.confirmRealDeposit({ txId: String(body.tx_id || "") });
      return reply.status(200).send(res);
    } catch (err) {
      return mapArenaError(reply, err);
    }
  });

  server.post("/api/v1/wallet/real/withdraw", { preHandler: authPreHandler }, async (request, reply) => {
    const user = (request as any).user;
    if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const idempotencyKey = request.headers["idempotency-key"] as string;
    const body = (request.body || {}) as {
      amount_minor?: number;
      method?: "PIX" | "CARD" | "CRYPTO" | "BANK";
      destination_account?: string;
      attempt_from_bonus?: boolean;
    };

    try {
      const res = await arenaService.requestRealWithdrawal({
        userId: user.id,
        amountMinor: Number(body.amount_minor),
        method: body.method || "PIX",
        destinationAccount: body.destination_account || "pix_default",
        idempotencyKey,
        attemptFromBonus: Boolean(body.attempt_from_bonus)
      });
      return reply.status(res.isDuplicate ? 200 : 201).send(res);
    } catch (err) {
      return mapArenaError(reply, err);
    }
  });

  server.post<{ Params: { txId: string } }>(
    "/api/v1/wallet/real/withdraw/:txId/complete",
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const tx = await arenaService.completeRealWithdrawal(request.params.txId);
        return reply.status(200).send({ transaction: tx });
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.post<{ Params: { txId: string } }>(
    "/api/v1/wallet/real/withdraw/:txId/cancel",
    { preHandler: authPreHandler },
    async (request, reply) => {
      try {
        const tx = await arenaService.cancelRealWithdrawal(request.params.txId);
        return reply.status(200).send({ transaction: tx });
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  // =========================================================================
  // 2. ARENA BLITZ TOURNAMENT & DEV SEEDER ROUTES
  // =========================================================================

  server.get("/api/v1/arena/tournaments", async () => {
    return { tournaments: arenaService.listTournaments() };
  });

  const spawnHandler = async (request: any, reply: any) => {
    const body = (request.body || {}) as {
      title?: string;
      symbol?: string;
      payout_tier?: PayoutTier;
      buy_in_minor?: number;
      rebuy_price_minor?: number;
      guaranteed_pool_minor?: number;
      duration_seconds?: number;
      seed_count?: number;
    };

    try {
      const tournament = await arenaService.createTournament({
        title: body.title || "Binmax Volatility Blitz",
        symbol: body.symbol || "SYNTH_VOL_50",
        payoutTier: body.payout_tier || "TOP_10",
        buyInMinor: body.buy_in_minor ?? 500,
        rebuyPriceMinor: body.rebuy_price_minor ?? 300,
        guaranteedPoolMinor: body.guaranteed_pool_minor ?? 0,
        durationSeconds: body.duration_seconds ?? 900
      });

      const seedResult = await arenaService.seedArenaCompetitors(
        tournament.id,
        body.seed_count ?? 45
      );

      return reply.status(201).send({
        tournament: arenaService.getTournament(tournament.id),
        seed: seedResult
      });
    } catch (err) {
      return mapArenaError(reply, err);
    }
  };

  server.post("/api/v1/arena/tournaments/dev/spawn", spawnHandler);
  server.post("/api/v1/tournaments/dev/spawn", spawnHandler);

  const fastForwardHandler = async (request: any, reply: any) => {
    const body = (request.body || {}) as { remaining_seconds?: number };
    try {
      const updated = arenaService.fastForwardTournamentClock(
        request.params.id,
        body.remaining_seconds ?? 90
      );
      return reply.status(200).send({ tournament: updated });
    } catch (err) {
      return mapArenaError(reply, err);
    }
  };

  server.post("/api/v1/arena/tournaments/:id/dev/fast-forward", fastForwardHandler);
  server.post("/api/v1/tournaments/:id/dev/fast-forward", fastForwardHandler);

  server.post<{ Params: { id: string } }>(
    "/api/v1/arena/tournaments/:id/join",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const idempotencyKey = (request.headers["idempotency-key"] as string) || `join_${user.id}`;
      const body = (request.body || {}) as {
        display_name?: string;
        country_code?: string;
        device_fingerprint?: string;
      };

      try {
        const res = await arenaService.joinTournament({
          tournamentId: request.params.id,
          userId: user.id,
          displayName: body.display_name || user.name || "Trader",
          countryCode: body.country_code || "BR",
          deviceFingerprint: body.device_fingerprint || `fp_${user.id}`,
          ipAddress: request.ip,
          idempotencyKey
        });
        return reply.status(res.isDuplicate ? 200 : 201).send(res);
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.post<{ Params: { id: string } }>(
    "/api/v1/arena/tournaments/:id/rebuy",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const idempotencyKey = (request.headers["idempotency-key"] as string) || `rebuy_${Date.now()}`;
      try {
        const res = await arenaService.executeArenaRebuy({
          tournamentId: request.params.id,
          userId: user.id,
          idempotencyKey
        });
        return reply.status(200).send(res);
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.post<{ Params: { id: string } }>(
    "/api/v1/arena/tournaments/:id/trades",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const user = (request as any).user;
      if (!user) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const body = (request.body || {}) as {
        symbol?: string;
        direction?: "UP" | "DOWN";
        stake_t_minor?: number;
        duration_seconds?: number;
      };

      try {
        const order = await arenaService.openArenaTrade({
          tournamentId: request.params.id,
          userId: user.id,
          symbol: body.symbol || "SYNTH_VOL_50",
          direction: body.direction || "UP",
          stakeTMinor: Number(body.stake_t_minor),
          durationSeconds: body.duration_seconds ?? 60
        });
        return reply.status(201).send({ order });
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.post<{ Params: { id: string; tradeId: string } }>(
    "/api/v1/arena/tournaments/:id/trades/:tradeId/settle",
    { preHandler: authPreHandler },
    async (request, reply) => {
      const body = (request.body || {}) as { result?: "WIN" | "LOSS" | "DRAW" };
      try {
        const res = await arenaService.settleArenaTrade({
          tournamentId: request.params.id,
          tradeId: request.params.tradeId,
          result: body.result || "WIN"
        });
        return reply.status(200).send(res);
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.get<{ Params: { id: string } }>(
    "/api/v1/arena/tournaments/:id/leaderboard",
    async (request, reply) => {
      try {
        const userId = (request as any).user?.id;
        return arenaService.getLeaderboardSnapshot(request.params.id, userId);
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );

  server.post<{ Params: { id: string } }>(
    "/api/v1/arena/tournaments/:id/settle",
    async (request, reply) => {
      try {
        const res = await arenaService.settleArenaTournament(request.params.id);
        return reply.status(200).send(res);
      } catch (err) {
        return mapArenaError(reply, err);
      }
    }
  );
};
