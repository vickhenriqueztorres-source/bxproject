import crypto from 'node:crypto';

const TIER_WEIGHTS_BPS = {
  TOP_3: [5_000, 3_000, 2_000],
  TOP_10: [2_800, 1_800, 1_200, 900, 700, 600, 500, 500, 500, 500],
  TOP_20: [
    2_200, 1_400, 950, 700, 550, 450, 400, 350, 300, 300,
    240, 240, 240, 240, 240, 240, 240, 240, 240, 240,
  ],
  TOP_30: [
    1_900, 1_200, 820, 600, 460, 380, 340, 300, 260, 240,
    180, 180, 180, 180, 180, 180, 180, 180, 180, 180,
    170, 170, 170, 170, 170, 170, 170, 170, 170, 170,
  ],
};

function randomIntInclusive(min, max) {
  if (max <= min) return min;
  return crypto.randomInt(min, max + 1);
}

export function splitBuyInMinor(buyInMinor, rakeBps = 3000) {
  const rakeMinor = Math.floor((buyInMinor * rakeBps) / 10_000);
  const netPoolContributionMinor = buyInMinor - rakeMinor;
  return { netPoolContributionMinor, rakeMinor };
}

export function calculateExactPrizeDistribution(prizePoolMinor, tier) {
  if (prizePoolMinor <= 0) return [];
  const weights = TIER_WEIGHTS_BPS[tier] || TIER_WEIGHTS_BPS.TOP_3;
  const rawQuotas = weights.map((weightBps, index) => {
    const exactNumerator = prizePoolMinor * weightBps;
    const floorMinor = Math.floor(exactNumerator / 10_000);
    const remainder = exactNumerator % 10_000;
    return { rank: index + 1, weightBps, floorMinor, remainder };
  });

  const sumFloors = rawQuotas.reduce((acc, q) => acc + q.floorMinor, 0);
  let remainderMinor = prizePoolMinor - sumFloors;

  const sortedByRemainder = [...rawQuotas].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.rank - b.rank;
  });

  const bonusCentMap = new Map();
  for (let i = 0; i < remainderMinor; i++) {
    const target = sortedByRemainder[i % sortedByRemainder.length];
    bonusCentMap.set(target.rank, (bonusCentMap.get(target.rank) ?? 0) + 1);
  }

  return rawQuotas.map((q) => ({
    rank: q.rank,
    weightBps: q.weightBps,
    amountMinor: q.floorMinor + (bonusCentMap.get(q.rank) ?? 0),
  }));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function resolveArenaUser(req, extractBearerUser) {
  if (typeof extractBearerUser === 'function') {
    const auth = extractBearerUser(req);
    if (auth && auth.sub) {
      return {
        id: String(auth.sub),
        name: auth.name || auth.email || 'Trader',
        role: auth.role || 'TRADER',
      };
    }
  }
  return {
    id: 'usr_trader_demo_1',
    name: 'Você (Trader)',
    role: 'TRADER',
  };
}

export function createArenaHttpEngine({ pgPool, resolveSymbol }) {
  let initialized = false;
  let initPromise = null;

  async function ensureSchemaAndSeed() {
    if (!pgPool) return;
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        const existing = await pgPool.query(`SELECT COUNT(*)::int AS cnt FROM arena_tournaments`);
        if ((existing.rows[0]?.cnt ?? 0) === 0) {
          const now = Date.now();
          const defaultTournaments = [
            {
              id: 'tour_blitz_500',
              code: 'ARENA_BLITZ_104',
              title: 'Arena Blitz #104 — VOL_100',
              symbol: 'VOL_100',
              payout_tier: 'TOP_10',
              buy_in_minor: 500,
              rebuy_price_minor: 500,
              ends_at: new Date(now + 12 * 60_000).toISOString(),
            },
            {
              id: 'tour_blitz_1000',
              code: 'ARENA_PRO_42',
              title: 'Arena Pro #42 — VOL_100',
              symbol: 'VOL_100',
              payout_tier: 'TOP_3',
              buy_in_minor: 1_000,
              rebuy_price_minor: 1_000,
              ends_at: new Date(now + 14 * 60_000).toISOString(),
            },
            {
              id: 'tour_blitz_2500',
              code: 'ARENA_HIGH_09',
              title: 'High Roller #09 — VOL_100',
              symbol: 'VOL_100',
              payout_tier: 'TOP_3',
              buy_in_minor: 2_500,
              rebuy_price_minor: 2_500,
              ends_at: new Date(now + 15 * 60_000).toISOString(),
            },
          ];

          for (const t of defaultTournaments) {
            const { netPoolContributionMinor } = splitBuyInMinor(t.buy_in_minor, 3000);
            const seedPlayersCount = 6;
            const totalPool = netPoolContributionMinor * seedPlayersCount;
            const startsAt = new Date(now).toISOString();
            const freezeRebuysAt = new Date(now + 7 * 60_000).toISOString();
            const freezeTradesAt = new Date(now + 14 * 60_000).toISOString();

            await pgPool.query(
              `INSERT INTO arena_tournaments (
                 id, code, title, symbol, payout_tier, status,
                 buy_in_minor, rebuy_price_minor, max_rebuys_per_user, max_stake_pct,
                 initial_t_balance_minor, house_rake_bps, prize_pool_bps,
                 guaranteed_pool_minor, current_pool_minor,
                 ghost_bot_enabled, ghost_bot_name, ghost_bot_score_minor,
                 starts_at, freeze_rebuys_at, freeze_trades_at, ends_at
               ) VALUES (
                 $1, $2, $3, $4, $5, 'RUNNING',
                 $6, $7, 3, 20,
                 100000, 3000, 7000,
                 0, $8,
                 TRUE, 'Alpha_Quant', 108500,
                 $9, $10, $11, $12
               ) ON CONFLICT (id) DO NOTHING`,
              [
                t.id,
                t.code,
                t.title,
                t.symbol,
                t.payout_tier,
                t.buy_in_minor,
                t.rebuy_price_minor,
                totalPool,
                startsAt,
                freezeRebuysAt,
                freezeTradesAt,
                t.ends_at,
              ]
            );

            const rivalNames = [
              'Lucas_V100',
              'SofiaQuant',
              'MateoFX',
              'ValeriaScalp',
              'DiegoTicks',
              'CamilaAlpha',
            ];
            for (let i = 0; i < seedPlayersCount; i++) {
              const pUserId = `seed_trader_${t.id}_${i + 1}`;
              const bal = 100_000 + (i - 2) * 8_500 + randomIntInclusive(0, 1_999);
              await pgPool.query(
                `INSERT INTO arena_participants (
                   id, tournament_id, user_id, display_name, country_code,
                   is_synthetic_seed, seed_archetype, device_fingerprint,
                   current_t_balance_minor, reserved_t_stake_minor, rebuy_count,
                   consecutive_wins, streak_bonus_earned_minor, total_trades,
                   winning_trades, tie_breaker_seq, status
                 ) VALUES (
                   $1, $2, $3, $4, 'BR',
                   TRUE, 'SCALPER', $5,
                   $6, 0, 0,
                   0, 0, $7,
                   $8, $9, 'ACTIVE'
                 ) ON CONFLICT (tournament_id, user_id) DO NOTHING`,
                [
                  `part_${t.id}_${i + 1}`,
                  t.id,
                  pUserId,
                  rivalNames[i] || `Trader_${i + 1}`,
                  `fp_seed_${t.id}_${i + 1}`,
                  bal,
                  4 + i,
                  2 + (i % 3),
                  i + 1,
                ]
              );
            }
          }
        }
        initialized = true;
      } catch (err) {
        initPromise = null;
        throw err;
      }
    })();

    return initPromise;
  }

  async function ensureUserWallet(userId) {
    await pgPool.query(
      `INSERT INTO arena_real_balances (
         user_id, available_minor, reserved_minor, bonus_margin_minor, updated_at
       ) VALUES ($1, 25000, 0, 0, NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    const res = await pgPool.query(`SELECT * FROM arena_real_balances WHERE user_id = $1`, [userId]);
    const row = res.rows[0];
    return {
      user_id: row.user_id,
      currency: 'USD',
      available_minor: Number(row.available_minor),
      reserved_minor: Number(row.reserved_minor),
      bonus_margin_minor: Number(row.bonus_margin_minor),
      updated_at: new Date(row.updated_at).toISOString(),
    };
  }

  async function buildLeaderboard(tournamentId, currentUserId) {
    const tRes = await pgPool.query(`SELECT * FROM arena_tournaments WHERE id = $1`, [tournamentId]);
    if (tRes.rowCount === 0) return [];
    const tournament = tRes.rows[0];
    const pRes = await pgPool.query(
      `SELECT * FROM arena_participants
       WHERE tournament_id = $1
       ORDER BY current_t_balance_minor DESC, tie_breaker_seq ASC`,
      [tournamentId]
    );

    const distribution = calculateExactPrizeDistribution(
      Number(tournament.current_pool_minor),
      tournament.payout_tier
    );
    const prizeByRank = new Map(distribution.map((d) => [d.rank, d]));

    return pRes.rows.map((p, idx) => {
      const rank = idx + 1;
      const currentT = Number(p.current_t_balance_minor);
      const initT = Number(tournament.initial_t_balance_minor);
      const roiBps = Math.round(((currentT - initT) / initT) * 10_000);
      const prizeAllocation = prizeByRank.get(rank);
      return {
        rank,
        user_id: p.user_id,
        display_name: p.display_name,
        is_bot: Boolean(p.is_synthetic_seed),
        current_t_balance_minor: currentT,
        roi_bps: roiBps,
        trades_count: Number(p.total_trades),
        wins_count: Number(p.winning_trades),
        consecutive_wins: Number(p.consecutive_wins),
        rebuys_used: Number(p.rebuy_count),
        projected_prize_minor: prizeAllocation?.amountMinor ?? 0,
        weight_bps: prizeAllocation?.weightBps ?? 0,
        is_in_the_money: (prizeAllocation?.amountMinor ?? 0) > 0,
        is_current_user: p.user_id === currentUserId,
      };
    });
  }

  function formatTournamentRow(row) {
    return {
      id: row.id,
      code: row.code,
      title: row.title,
      symbol: row.symbol,
      status: row.status,
      payout_tier: row.payout_tier,
      buy_in_minor: Number(row.buy_in_minor),
      rebuy_price_minor: Number(row.rebuy_price_minor),
      rake_bps: Number(row.house_rake_bps),
      prize_pool_minor: Number(row.current_pool_minor),
      current_pool_minor: Number(row.current_pool_minor),
      initial_t_balance_minor: Number(row.initial_t_balance_minor),
      max_stake_pct: Number(row.max_stake_pct),
      max_rebuys_per_user: Number(row.max_rebuys_per_user),
      ghost_bot_name: row.ghost_bot_name,
      ghost_bot_score_minor: Number(row.ghost_bot_score_minor),
      starts_at: new Date(row.starts_at).toISOString(),
      ends_at: new Date(row.ends_at).toISOString(),
      settled_at: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    };
  }

  function formatParticipantRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      tournament_id: row.tournament_id,
      user_id: row.user_id,
      display_name: row.display_name,
      current_t_balance_minor: Number(row.current_t_balance_minor),
      reserved_t_stake_minor: Number(row.reserved_t_stake_minor),
      rebuy_count: Number(row.rebuy_count),
      total_trades: Number(row.total_trades),
      winning_trades: Number(row.winning_trades),
      consecutive_wins: Number(row.consecutive_wins),
      streak_bonus_earned_minor: Number(row.streak_bonus_earned_minor),
      status: row.status,
    };
  }

  function formatOrderRow(row) {
    return {
      id: row.id,
      tournament_id: row.tournament_id,
      participant_id: row.participant_id,
      user_id: row.user_id,
      symbol: row.symbol,
      direction: row.direction,
      stake_t_minor: Number(row.stake_t_minor),
      status: row.status,
      result: row.result,
      entry_price: Number(row.entry_price),
      entry_tick_sequence: Number(row.entry_tick_sequence),
      exit_price: row.exit_price !== null ? Number(row.exit_price) : null,
      exit_tick_sequence: row.exit_tick_sequence !== null ? Number(row.exit_tick_sequence) : null,
      base_profit_t_minor: Number(row.base_profit_t_minor),
      streak_bonus_t_minor: Number(row.streak_bonus_t_minor),
      opened_at: new Date(row.opened_at).toISOString(),
      expires_at: new Date(row.expires_at).toISOString(),
      settled_at: row.settled_at ? new Date(row.settled_at).toISOString() : null,
    };
  }

  async function settleSingleArenaOrder(orderRow, tickRow) {
    const entryPrice = Number(orderRow.entry_price);
    const exitPrice = Number(tickRow.price);
    const exitTickSequence = Number(tickRow.sequence);
    const stakeMinor = Number(orderRow.stake_t_minor);
    const payoutBps = 8500;

    let result;
    if (exitPrice === entryPrice) {
      result = 'DRAW';
    } else if (
      (orderRow.direction === 'UP' && exitPrice > entryPrice) ||
      (orderRow.direction === 'DOWN' && exitPrice < entryPrice)
    ) {
      result = 'WIN';
    } else {
      result = 'LOSS';
    }

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const lockOrder = await client.query(
        `SELECT * FROM arena_trade_orders WHERE id = $1 AND status = 'OPEN' FOR UPDATE`,
        [orderRow.id]
      );
      if (lockOrder.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const partRes = await client.query(
        `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2 FOR UPDATE`,
        [orderRow.tournament_id, orderRow.user_id]
      );
      if (partRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const part = partRes.rows[0];

      let baseProfitMinor = 0;
      let momentumBonusMinor = 0;
      let consecutiveWins = Number(part.consecutive_wins);
      let streakBonusEarned = Number(part.streak_bonus_earned_minor);
      let winningTrades = Number(part.winning_trades);
      const totalTrades = Number(part.total_trades) + 1;
      let currentTBalance = Number(part.current_t_balance_minor);
      const reservedT = Math.max(0, Number(part.reserved_t_stake_minor) - stakeMinor);

      if (result === 'WIN') {
        winningTrades += 1;
        consecutiveWins += 1;
        baseProfitMinor = Math.floor((stakeMinor * payoutBps) / 10_000);
        if (consecutiveWins > 0 && consecutiveWins % 3 === 0) {
          momentumBonusMinor = 15_000;
          streakBonusEarned += momentumBonusMinor;
        }
        currentTBalance += stakeMinor + baseProfitMinor + momentumBonusMinor;
      } else if (result === 'DRAW') {
        currentTBalance += stakeMinor;
      } else {
        consecutiveWins = 0;
      }

      const updatedOrderRes = await client.query(
        `UPDATE arena_trade_orders
         SET status = 'SETTLED',
             result = $2,
             exit_price = $3,
             exit_tick_sequence = $4,
             base_profit_t_minor = $5,
             streak_bonus_t_minor = $6,
             settled_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [orderRow.id, result, exitPrice, exitTickSequence, baseProfitMinor, momentumBonusMinor]
      );

      const updatedPartRes = await client.query(
        `UPDATE arena_participants
         SET current_t_balance_minor = $3,
             reserved_t_stake_minor = $4,
             total_trades = $5,
             winning_trades = $6,
             consecutive_wins = $7,
             streak_bonus_earned_minor = $8,
             last_trade_at = NOW(),
             updated_at = NOW()
         WHERE tournament_id = $1 AND user_id = $2
         RETURNING *`,
        [
          orderRow.tournament_id,
          orderRow.user_id,
          currentTBalance,
          reservedT,
          totalTrades,
          winningTrades,
          consecutiveWins,
          streakBonusEarned,
        ]
      );

      await client.query('COMMIT');
      return {
        order: formatOrderRow(updatedOrderRes.rows[0]),
        participant: formatParticipantRow(updatedPartRes.rows[0]),
        baseProfitMinor,
        momentumBonusMinor,
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  async function sweepExpiredArenaTrades() {
    if (!pgPool) return 0;
    await ensureSchemaAndSeed();
    const openRes = await pgPool.query(
      `SELECT * FROM arena_trade_orders
       WHERE status = 'OPEN' AND expires_at <= NOW()
       ORDER BY expires_at ASC
       LIMIT 100`
    );
    let settledCount = 0;
    for (const orderRow of openRes.rows) {
      const canonicalSym =
        typeof resolveSymbol === 'function'
          ? resolveSymbol(orderRow.symbol) || orderRow.symbol
          : orderRow.symbol;
      const tickRes = await pgPool.query(
        `SELECT sequence, price, ts
         FROM ticks
         WHERE (symbol = $1 OR symbol = $2) AND ts >= $3
         ORDER BY ts ASC, sequence ASC
         LIMIT 1`,
        [orderRow.symbol, canonicalSym, orderRow.expires_at]
      );
      if (tickRes.rowCount > 0) {
        const settled = await settleSingleArenaOrder(orderRow, tickRes.rows[0]);
        if (settled) settledCount += 1;
      }
    }
    return settledCount;
  }

  async function handleRequest(req, res, { pathname, extractBearerUser }) {
    if (
      !pathname.startsWith('/api/v1/arena/') &&
      !pathname.startsWith('/api/v1/wallet/real')
    ) {
      return false;
    }

    await ensureSchemaAndSeed();
    const user = resolveArenaUser(req, extractBearerUser);

    // 1. GET /api/v1/wallet/real
    if (pathname === '/api/v1/wallet/real' && req.method === 'GET') {
      const wallet = await ensureUserWallet(user.id);
      const txRes = await pgPool.query(
        `SELECT * FROM arena_wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [user.id]
      );
      sendJson(res, 200, { wallet, transactions: txRes.rows });
      return true;
    }

    // 2. POST /api/v1/wallet/real/deposit
    if (pathname === '/api/v1/wallet/real/deposit' && req.method === 'POST') {
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey) {
        sendJson(res, 400, { error: 'IDEMPOTENCY_KEY_REQUIRED' });
        return true;
      }
      const body = await readJsonBody(req);
      const amountMinor = Number(body.amount_minor);
      const method = body.method || 'PIX';
      if (!Number.isInteger(amountMinor) || amountMinor < 500) {
        sendJson(res, 400, { error: 'INVALID_DEPOSIT_REQUEST' });
        return true;
      }
      await ensureUserWallet(user.id);
      const existingTx = await pgPool.query(
        `SELECT * FROM arena_wallet_transactions WHERE user_id = $1 AND type = 'DEPOSIT' AND idempotency_key = $2`,
        [user.id, idempotencyKey]
      );
      if (existingTx.rowCount > 0) {
        const wallet = await ensureUserWallet(user.id);
        sendJson(res, 201, { transaction: existingTx.rows[0], wallet });
        return true;
      }
      const txId = `wtx_dep_${crypto.randomUUID()}`;
      const ins = await pgPool.query(
        `INSERT INTO arena_wallet_transactions (
           id, user_id, type, method, amount_minor, fee_minor, status, idempotency_key, metadata
         ) VALUES ($1, $2, 'DEPOSIT', $3, $4, 0, 'PENDING', $5, '{}'::jsonb)
         RETURNING *`,
        [txId, user.id, method, amountMinor, idempotencyKey]
      );
      const wallet = await ensureUserWallet(user.id);
      sendJson(res, 201, { transaction: ins.rows[0], wallet });
      return true;
    }

    // 3. POST /api/v1/wallet/real/deposit/confirm
    if (pathname === '/api/v1/wallet/real/deposit/confirm' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const txId = body.tx_id;
      if (!txId) {
        sendJson(res, 400, { error: 'TX_ID_REQUIRED' });
        return true;
      }
      const txRes = await pgPool.query(
        `SELECT * FROM arena_wallet_transactions WHERE id = $1`,
        [txId]
      );
      if (txRes.rowCount === 0) {
        sendJson(res, 404, { error: 'DEPOSIT_TX_NOT_FOUND' });
        return true;
      }
      const tx = txRes.rows[0];
      if (tx.user_id !== user.id && user.role !== 'ADMIN') {
        sendJson(res, 403, { error: 'FORBIDDEN_BOLA' });
        return true;
      }
      if (tx.status !== 'COMPLETED') {
        await pgPool.query(
          `UPDATE arena_wallet_transactions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
          [txId]
        );
        await pgPool.query(
          `UPDATE arena_real_balances
           SET available_minor = available_minor + $2, updated_at = NOW()
           WHERE user_id = $1`,
          [tx.user_id, Number(tx.amount_minor) - Number(tx.fee_minor)]
        );
      }
      const updatedTx = await pgPool.query(
        `SELECT * FROM arena_wallet_transactions WHERE id = $1`,
        [txId]
      );
      const wallet = await ensureUserWallet(tx.user_id);
      sendJson(res, 200, { transaction: updatedTx.rows[0], wallet });
      return true;
    }

    // 4. GET /api/v1/arena/tournaments
    if (pathname === '/api/v1/arena/tournaments' && req.method === 'GET') {
      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments ORDER BY buy_in_minor ASC`
      );
      const tournaments = tRes.rows.map(formatTournamentRow);
      const wallet = await ensureUserWallet(user.id);
      sendJson(res, 200, {
        server_time: new Date().toISOString(),
        tournaments,
        wallet,
      });
      return true;
    }

    // 5. GET /api/v1/arena/tournaments/:id
    const detailMatch = pathname.match(/^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)$/);
    if (detailMatch && req.method === 'GET') {
      const tournamentId = detailMatch[1];
      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments WHERE id = $1`,
        [tournamentId]
      );
      if (tRes.rowCount === 0) {
        sendJson(res, 404, { error: 'TOURNAMENT_NOT_FOUND' });
        return true;
      }
      const tournament = formatTournamentRow(tRes.rows[0]);
      const leaderboard = await buildLeaderboard(tournamentId, user.id);
      const myPartRes = await pgPool.query(
        `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, user.id]
      );
      const ledgerRes = await pgPool.query(
        `SELECT * FROM arena_ledger_events WHERE tournament_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [tournamentId]
      );
      const prizeDistribution = calculateExactPrizeDistribution(
        tournament.prize_pool_minor,
        tournament.payout_tier
      );
      sendJson(res, 200, {
        server_time: new Date().toISOString(),
        tournament,
        my_participation: formatParticipantRow(myPartRes.rows[0]),
        leaderboard,
        prize_distribution: prizeDistribution,
        ledger_events: ledgerRes.rows,
      });
      return true;
    }

    // 6. GET /api/v1/arena/tournaments/:id/leaderboard
    const lbMatch = pathname.match(
      /^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)\/leaderboard$/
    );
    if (lbMatch && req.method === 'GET') {
      const tournamentId = lbMatch[1];
      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments WHERE id = $1`,
        [tournamentId]
      );
      if (tRes.rowCount === 0) {
        sendJson(res, 404, { error: 'TOURNAMENT_NOT_FOUND' });
        return true;
      }
      const tournament = formatTournamentRow(tRes.rows[0]);
      const leaderboard = await buildLeaderboard(tournamentId, user.id);
      const prizeDistribution = calculateExactPrizeDistribution(
        tournament.prize_pool_minor,
        tournament.payout_tier
      );
      sendJson(res, 200, {
        server_time: new Date().toISOString(),
        tournament_id: tournament.id,
        status: tournament.status,
        prize_pool_minor: tournament.prize_pool_minor,
        ends_at: tournament.ends_at,
        prize_distribution: prizeDistribution,
        leaderboard,
      });
      return true;
    }

    // 7. POST /api/v1/arena/tournaments/:id/join
    const joinMatch = pathname.match(/^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)\/join$/);
    if (joinMatch && req.method === 'POST') {
      const tournamentId = joinMatch[1];
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey) {
        sendJson(res, 400, { error: 'IDEMPOTENCY_KEY_REQUIRED' });
        return true;
      }
      const body = await readJsonBody(req);
      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments WHERE id = $1`,
        [tournamentId]
      );
      if (tRes.rowCount === 0) {
        sendJson(res, 404, { error: 'TOURNAMENT_NOT_FOUND' });
        return true;
      }
      const tRow = tRes.rows[0];
      const existingPart = await pgPool.query(
        `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, user.id]
      );
      if (existingPart.rowCount > 0) {
        const ledgerRes = await pgPool.query(
          `SELECT * FROM arena_ledger_events WHERE tournament_id = $1 AND user_id = $2 AND event_type = 'BUY_IN' LIMIT 1`,
          [tournamentId, user.id]
        );
        sendJson(res, 201, {
          participant: formatParticipantRow(existingPart.rows[0]),
          tournament: formatTournamentRow(tRow),
          ledgerEvent: ledgerRes.rows[0] || null,
        });
        return true;
      }

      const wallet = await ensureUserWallet(user.id);
      const buyInMinor = Number(tRow.buy_in_minor);
      if (wallet.available_minor < buyInMinor) {
        sendJson(res, 422, { error: 'INSUFFICIENT_REAL_BALANCE' });
        return true;
      }

      const { netPoolContributionMinor, rakeMinor } = splitBuyInMinor(
        buyInMinor,
        Number(tRow.house_rake_bps)
      );

      await pgPool.query(
        `UPDATE arena_real_balances
         SET available_minor = available_minor - $2,
             updated_at = NOW()
         WHERE user_id = $1`,
        [user.id, buyInMinor]
      );

      const updT = await pgPool.query(
        `UPDATE arena_tournaments
         SET current_pool_minor = current_pool_minor + $2
         WHERE id = $1
         RETURNING *`,
        [tournamentId, netPoolContributionMinor]
      );

      const partId = `part_${tournamentId}_${user.id}`;
      const insPart = await pgPool.query(
        `INSERT INTO arena_participants (
           id, tournament_id, user_id, display_name, country_code,
           is_synthetic_seed, device_fingerprint,
           current_t_balance_minor, reserved_t_stake_minor, rebuy_count,
           consecutive_wins, streak_bonus_earned_minor, total_trades,
           winning_trades, tie_breaker_seq, status
         ) VALUES (
           $1, $2, $3, $4, 'BR',
           FALSE, $5,
           $6, 0, 0,
           0, 0, 0,
           0, 100, 'ACTIVE'
         ) RETURNING *`,
        [
          partId,
          tournamentId,
          user.id,
          body.display_name || user.name,
          body.device_fingerprint || `fp_${user.id}_${Date.now()}`,
          Number(tRow.initial_t_balance_minor),
        ]
      );

      const ledgerId = crypto.randomUUID();
      const insLedger = await pgPool.query(
        `INSERT INTO arena_ledger_events (
           id, tournament_id, user_id, event_type,
           gross_amount_minor, rake_amount_minor, escrow_amount_minor,
           currency, blnk_rake_ref, blnk_escrow_ref, idempotency_key
         ) VALUES ($1, $2, $3, 'BUY_IN', $4, $5, $6, 'USD', $7, $8, $9)
         ON CONFLICT (idempotency_key) DO UPDATE SET gross_amount_minor = EXCLUDED.gross_amount_minor
         RETURNING *`,
        [
          ledgerId,
          tournamentId,
          user.id,
          buyInMinor,
          rakeMinor,
          netPoolContributionMinor,
          `blnk_rake_${ledgerId}`,
          `blnk_escrow_${ledgerId}`,
          `join:${tournamentId}:${user.id}:${idempotencyKey}`,
        ]
      );

      sendJson(res, 201, {
        participant: formatParticipantRow(insPart.rows[0]),
        tournament: formatTournamentRow(updT.rows[0]),
        ledgerEvent: insLedger.rows[0],
      });
      return true;
    }

    // 8. POST /api/v1/arena/tournaments/:id/rebuy
    const rebuyMatch = pathname.match(/^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)\/rebuy$/);
    if (rebuyMatch && req.method === 'POST') {
      const tournamentId = rebuyMatch[1];
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey) {
        sendJson(res, 400, { error: 'IDEMPOTENCY_KEY_REQUIRED' });
        return true;
      }
      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments WHERE id = $1`,
        [tournamentId]
      );
      if (tRes.rowCount === 0) {
        sendJson(res, 404, { error: 'TOURNAMENT_NOT_FOUND' });
        return true;
      }
      const tRow = tRes.rows[0];
      const partRes = await pgPool.query(
        `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, user.id]
      );
      if (partRes.rowCount === 0) {
        sendJson(res, 400, { error: 'NOT_ENROLLED_IN_TOURNAMENT' });
        return true;
      }
      const part = partRes.rows[0];
      if (Number(part.rebuy_count) >= Number(tRow.max_rebuys_per_user)) {
        sendJson(res, 400, { error: 'MAX_REBUYS_REACHED' });
        return true;
      }

      const rebuyMinor = Number(tRow.rebuy_price_minor);
      const { netPoolContributionMinor, rakeMinor } = splitBuyInMinor(
        rebuyMinor,
        Number(tRow.house_rake_bps)
      );

      const updT = await pgPool.query(
        `UPDATE arena_tournaments
         SET current_pool_minor = current_pool_minor + $2
         WHERE id = $1
         RETURNING *`,
        [tournamentId, netPoolContributionMinor]
      );

      const updPart = await pgPool.query(
        `UPDATE arena_participants
         SET current_t_balance_minor = $3,
             rebuy_count = rebuy_count + 1,
             consecutive_wins = 0,
             updated_at = NOW()
         WHERE tournament_id = $1 AND user_id = $2
         RETURNING *`,
        [tournamentId, user.id, Number(tRow.initial_t_balance_minor)]
      );

      const ledgerId = crypto.randomUUID();
      const insLedger = await pgPool.query(
        `INSERT INTO arena_ledger_events (
           id, tournament_id, user_id, event_type,
           gross_amount_minor, rake_amount_minor, escrow_amount_minor,
           currency, blnk_rake_ref, blnk_escrow_ref, idempotency_key
         ) VALUES ($1, $2, $3, 'REBUY', $4, $5, $6, 'USD', $7, $8, $9)
         ON CONFLICT (idempotency_key) DO UPDATE SET gross_amount_minor = EXCLUDED.gross_amount_minor
         RETURNING *`,
        [
          ledgerId,
          tournamentId,
          user.id,
          rebuyMinor,
          rakeMinor,
          netPoolContributionMinor,
          `blnk_rake_${ledgerId}`,
          `blnk_escrow_${ledgerId}`,
          `rebuy:${tournamentId}:${user.id}:${idempotencyKey}`,
        ]
      );

      sendJson(res, 200, {
        participant: formatParticipantRow(updPart.rows[0]),
        tournament: formatTournamentRow(updT.rows[0]),
        ledgerEvent: insLedger.rows[0],
      });
      return true;
    }

    // 9. POST /api/v1/arena/tournaments/:id/trades
    const tradesMatch = pathname.match(
      /^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)\/trades$/
    );
    if (tradesMatch && req.method === 'POST') {
      const tournamentId = tradesMatch[1];
      const body = await readJsonBody(req);
      const direction = body.direction === 'DOWN' ? 'DOWN' : 'UP';
      const stakeTMinor = Number(body.stake_t_minor);
      const durationSeconds = Number(body.duration_seconds) || 5;

      const tRes = await pgPool.query(
        `SELECT * FROM arena_tournaments WHERE id = $1`,
        [tournamentId]
      );
      if (tRes.rowCount === 0) {
        sendJson(res, 404, { error: 'TOURNAMENT_NOT_FOUND' });
        return true;
      }
      const tRow = tRes.rows[0];
      const partRes = await pgPool.query(
        `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2`,
        [tournamentId, user.id]
      );
      if (partRes.rowCount === 0) {
        sendJson(res, 400, { error: 'NOT_ENROLLED_IN_TOURNAMENT' });
        return true;
      }
      const part = partRes.rows[0];
      const currentT = Number(part.current_t_balance_minor);
      const maxStakeMinor = Math.floor((currentT * Number(tRow.max_stake_pct)) / 100);
      if (stakeTMinor > maxStakeMinor) {
        sendJson(res, 400, { error: `MAX_STAKE_EXCEEDED: max ${maxStakeMinor}` });
        return true;
      }
      if (stakeTMinor > currentT) {
        sendJson(res, 400, { error: 'INSUFFICIENT_T_DOLLAR_BALANCE' });
        return true;
      }

      const rawSymbol = body.symbol || tRow.symbol || 'VOL_100';
      const canonicalSym =
        typeof resolveSymbol === 'function' ? resolveSymbol(rawSymbol) || rawSymbol : rawSymbol;

      const tickRes = await pgPool.query(
        `SELECT sequence, price, ts
         FROM ticks
         WHERE symbol = $1 OR symbol = $2
         ORDER BY ts DESC, sequence DESC
         LIMIT 1`,
        [rawSymbol, canonicalSym]
      );
      if (tickRes.rowCount === 0) {
        sendJson(res, 409, { error: 'OFFICIAL_TICK_NOT_AVAILABLE' });
        return true;
      }
      const officialTick = tickRes.rows[0];
      const entryPrice = Number(officialTick.price);
      const entryTickSequence = Number(officialTick.sequence);

      const updPart = await pgPool.query(
        `UPDATE arena_participants
         SET current_t_balance_minor = current_t_balance_minor - $3,
             reserved_t_stake_minor = reserved_t_stake_minor + $3,
             updated_at = NOW()
         WHERE tournament_id = $1 AND user_id = $2
         RETURNING *`,
        [tournamentId, user.id, stakeTMinor]
      );

      const orderId = `ato_${crypto.randomUUID()}`;
      const openedAt = new Date();
      const expiresAt = new Date(openedAt.getTime() + durationSeconds * 1_000);
      const insOrder = await pgPool.query(
        `INSERT INTO arena_trade_orders (
           id, tournament_id, participant_id, user_id, symbol, direction,
           stake_t_minor, entry_price, entry_tick_sequence,
           opened_at, expires_at, status, base_profit_t_minor, streak_bonus_t_minor
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9,
           $10, $11, 'OPEN', 0, 0
         ) RETURNING *`,
        [
          orderId,
          tournamentId,
          part.id,
          user.id,
          canonicalSym,
          direction,
          stakeTMinor,
          entryPrice,
          entryTickSequence,
          openedAt.toISOString(),
          expiresAt.toISOString(),
        ]
      );

      sendJson(res, 201, {
        order: formatOrderRow(insOrder.rows[0]),
        participant: formatParticipantRow(updPart.rows[0]),
        maxNextStakeMinor: Math.floor(
          (Number(updPart.rows[0].current_t_balance_minor) * Number(tRow.max_stake_pct)) / 100
        ),
      });
      return true;
    }

    // 10. POST /api/v1/arena/tournaments/:id/trades/:tradeId/settle
    const settleTradeMatch = pathname.match(
      /^\/api\/v1\/arena\/tournaments\/([a-zA-Z0-9_-]+)\/trades\/([a-zA-Z0-9_-]+)\/settle$/
    );
    if (settleTradeMatch && req.method === 'POST') {
      const tournamentId = settleTradeMatch[1];
      const tradeId = settleTradeMatch[2];
      const oRes = await pgPool.query(
        `SELECT * FROM arena_trade_orders WHERE id = $1 AND tournament_id = $2`,
        [tradeId, tournamentId]
      );
      if (oRes.rowCount === 0) {
        sendJson(res, 404, { error: 'ARENA_TRADE_NOT_FOUND' });
        return true;
      }
      const orderRow = oRes.rows[0];
      if (orderRow.user_id !== user.id && user.role !== 'ADMIN') {
        sendJson(res, 403, { error: 'FORBIDDEN_BOLA' });
        return true;
      }
      if (orderRow.status === 'SETTLED') {
        const partRes = await pgPool.query(
          `SELECT * FROM arena_participants WHERE tournament_id = $1 AND user_id = $2`,
          [tournamentId, orderRow.user_id]
        );
        sendJson(res, 200, {
          order: formatOrderRow(orderRow),
          participant: formatParticipantRow(partRes.rows[0]),
          baseProfitMinor: Number(orderRow.base_profit_t_minor),
          momentumBonusMinor: Number(orderRow.streak_bonus_t_minor),
        });
        return true;
      }

      const canonicalSym =
        typeof resolveSymbol === 'function'
          ? resolveSymbol(orderRow.symbol) || orderRow.symbol
          : orderRow.symbol;
      const tickRes = await pgPool.query(
        `SELECT sequence, price, ts
         FROM ticks
         WHERE (symbol = $1 OR symbol = $2) AND ts >= $3
         ORDER BY ts ASC, sequence ASC
         LIMIT 1`,
        [orderRow.symbol, canonicalSym, orderRow.expires_at]
      );
      if (tickRes.rowCount === 0) {
        sendJson(res, 409, { error: 'OFFICIAL_SETTLEMENT_TICK_NOT_AVAILABLE' });
        return true;
      }
      const settled = await settleSingleArenaOrder(orderRow, tickRes.rows[0]);
      sendJson(res, 200, settled);
      return true;
    }

    return false;
  }

  return {
    ensureSchemaAndSeed,
    handleRequest,
    sweepExpiredArenaTrades,
  };
}
