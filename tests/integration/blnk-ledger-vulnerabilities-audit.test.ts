import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import Fastify from "../../services/api/node_modules/fastify/fastify.js";
import { BlnkClient } from "../../services/wallet-adapter/src/blnk-client.ts";
import { ContractService } from "../../services/api/src/services/contract-service.ts";
import { contractRoutes } from "../../services/api/src/routes/contracts.ts";
import { walletRoutes } from "../../services/api/src/routes/wallet.ts";
import { PayoutCalculator } from "../../services/settlement-worker/src/settlement/payout-calculator.ts";
import { ContractSettler } from "../../services/settlement-worker/src/settlement/settler.ts";
import {
  FinancialReconciler,
  LedgerTransactionEntry
} from "../../services/settlement-worker/src/reconciliation/financial-reconciler.ts";
import { OpenContractSchema, COUNTRY_STAKE_LIMITS } from "../../services/api/node_modules/@broker/shared/dist/index.js";

import { describe as nodeDescribe, it as nodeIt } from "node:test";

interface BlnkAccountRecord {
  name: string;
  number: string;
  ledger_id: string;
  currency: string;
  balance: number;
  credit_balance: number;
  debit_balance: number;
}

interface BalanceHistorySample {
  userId: string;
  available_minor: number;
  reserved_minor: number;
  reason: string;
}

/**
 * Servidor HTTP Blnk Ledger em memória para testes de integração reais via fetch()
 * Aplica rigorosamente Double-Entry (I-02), Append-Only (I-01), Idempotência por reference (I-03)
 * e proteção contra saldo negativo (allow_overdraft: false).
 */
async function startBlnkTestServer() {
  const ledgers = new Map<string, { id: string; name: string }>();
  const accounts = new Map<string, BlnkAccountRecord>();
  const transactions: LedgerTransactionEntry[] = [];
  const transactionsByRef = new Map<string, LedgerTransactionEntry>();
  const balanceHistory: BalanceHistorySample[] = [];

  const ensureAccount = (number: string, currency = "USD"): BlnkAccountRecord => {
    let acc = accounts.get(number);
    if (!acc) {
      acc = {
        name: number,
        number,
        ledger_id: "broker_demo",
        currency,
        balance: 0,
        credit_balance: 0,
        debit_balance: 0
      };
      accounts.set(number, acc);
    }
    return acc;
  };

  // Inicializa contas institucionais da plataforma
  ensureAccount("@broker_float", "USD");
  ensureAccount("@house_revenue", "USD");
  ensureAccount("@house_payout", "USD");

  const recordUserSnapshot = (accountNumber: string, reason: string) => {
    const match = /^@user_(.+):(available|reserved)$/.exec(accountNumber);
    if (!match) return;
    const userId = match[1];
    const avail = accounts.get(`@user_${userId}:available`)?.balance ?? 0;
    const res = accounts.get(`@user_${userId}:reserved`)?.balance ?? 0;
    balanceHistory.push({
      userId,
      available_minor: avail,
      reserved_minor: res,
      reason
    });
  };

  const readJsonBody = (req: http.IncomingMessage): Promise<any> =>
    new Promise((resolve, reject) => {
      let raw = "";
      req.on("data", (chunk) => {
        raw += chunk.toString();
      });
      req.on("end", () => {
        try {
          resolve(raw ? JSON.parse(raw) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const path = decodeURIComponent(url.pathname);

      if (req.method === "POST" && path === "/ledgers") {
        const body = await readJsonBody(req);
        if (ledgers.has(body.id)) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Ledger already exists" }));
          return;
        }
        ledgers.set(body.id, { id: body.id, name: body.name });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ledger_id: body.id }));
        return;
      }

      if (req.method === "POST" && path === "/accounts") {
        const body = await readJsonBody(req);
        if (body.currency !== "USD") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "SILENT_CONVERSION_FORBIDDEN: Only USD accounts allowed" }));
          return;
        }
        if (accounts.has(body.number)) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Account already exists" }));
          return;
        }
        const created = ensureAccount(body.number, body.currency);
        created.name = body.name || body.number;
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(created));
        return;
      }

      if (req.method === "GET" && path.startsWith("/balances/")) {
        const accountNumber = path.slice("/balances/".length);
        const acc = accounts.get(accountNumber);
        if (!acc) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: `Account ${accountNumber} not found` }));
          return;
        }
        recordUserSnapshot(accountNumber, `GET /balances/${accountNumber}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            balance: acc.balance,
            credit_balance: acc.credit_balance,
            debit_balance: acc.debit_balance,
            currency: acc.currency
          })
        );
        return;
      }

      if (req.method === "POST" && path === "/transactions") {
        const body = await readJsonBody(req);

        // Prevenção 1, 2 e 3 no servidor Blnk
        if ("rate" in body || "exchange_rate" in body) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "SILENT_CONVERSION_FORBIDDEN" }));
          return;
        }
        if (body.currency !== "USD" || body.precision !== 100) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "INVALID_CURRENCY_OR_PRECISION" }));
          return;
        }
        if (typeof body.amount !== "number" || !Number.isSafeInteger(body.amount) || body.amount <= 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "INVALID_MINOR_AMOUNT" }));
          return;
        }
        if (!body.source || !body.destination || body.source === body.destination) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "DOUBLE_ENTRY_VIOLATION" }));
          return;
        }
        if (!body.reference || typeof body.reference !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "IDEMPOTENCY_VIOLATION" }));
          return;
        }

        // Prevenção 5: Idempotência estrita por reference
        if (transactionsByRef.has(body.reference)) {
          res.writeHead(409, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "CONFLICT: Transaction reference already applied",
              reference: body.reference
            })
          );
          return;
        }

        const sourceAcc = ensureAccount(body.source, "USD");
        const destAcc = ensureAccount(body.destination, "USD");

        // Modo de Falha 2: Saldo NUNCA fica negativo quando allow_overdraft === false
        if (!body.allow_overdraft && sourceAcc.balance < body.amount) {
          res.writeHead(422, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: `INSUFFICIENT_BALANCE: Account ${body.source} has ${sourceAcc.balance}, required ${body.amount}`
            })
          );
          return;
        }

        // Partidas dobradas atômicas: Débito na origem === Crédito no destino
        sourceAcc.debit_balance += body.amount;
        sourceAcc.balance -= body.amount;

        destAcc.credit_balance += body.amount;
        destAcc.balance += body.amount;

        const txEntry: LedgerTransactionEntry = {
          reference: body.reference,
          source: body.source,
          destination: body.destination,
          amount: body.amount,
          debit: body.amount,
          credit: body.amount,
          currency: body.currency,
          precision: body.precision,
          status: "APPLIED"
        };

        transactions.push(txEntry);
        transactionsByRef.set(body.reference, txEntry);

        recordUserSnapshot(body.source, `TX ${body.reference}`);
        recordUserSnapshot(body.destination, `TX ${body.reference}`);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            transaction_id: `tx_${transactions.length}`,
            ...txEntry
          })
        );
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    accounts,
    transactions,
    transactionsByRef,
    balanceHistory,
    getAlgebraicTotalSum(): number {
      let sum = 0;
      for (const acc of accounts.values()) {
        sum += acc.balance;
      }
      return sum;
    },
    getTotalReservedBalanceMinor(): number {
      let reserved = 0;
      for (const [key, acc] of accounts.entries()) {
        if (key.endsWith(":reserved")) {
          reserved += acc.balance;
        }
      }
      return reserved;
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      })
  };
}

/**
 * Cria ambiente integrado com PostgreSQL transacional em memória, Redis e Fastify real
 */
function createStatefulDbAndRedis() {
  const contracts = new Map<string, any>();
  const outboxEvents: any[] = [];
  const ticks: any[] = [
    {
      symbol: "SYNTH_VOL_50",
      sequence: "100",
      price: "100.000000",
      ts: new Date(),
      prev_hash: "genesis-hash-099",
      hash: "hash-seq-100"
    },
    {
      symbol: "SYNTH_VOL_50",
      sequence: "99",
      price: "99.950000",
      ts: new Date(Date.now() - 1000),
      prev_hash: "genesis-hash-098",
      hash: "genesis-hash-099"
    }
  ];

  const executeQuery = async (
    sql: string,
    params: any[] = [],
    stagedContracts?: Map<string, any>,
    stagedOutbox?: any[]
  ) => {
    const clean = sql.replace(/\s+/g, " ").trim();
    const targetContracts = stagedContracts ?? contracts;
    const targetOutbox = stagedOutbox ?? outboxEvents;

    if (clean === "BEGIN" || clean === "COMMIT" || clean === "ROLLBACK") {
      return { rows: [] };
    }

    if (clean.includes("FROM contracts WHERE user_id = $1 AND idempotency_key = $2")) {
      const [userId, idemKey] = params;
      for (const c of targetContracts.values()) {
        if (c.user_id === userId && c.idempotency_key === idemKey) {
          return { rows: [{ ...c }] };
        }
      }
      return { rows: [] };
    }

    if (clean.includes("FROM index_state WHERE symbol = $1")) {
      const sym = params[0];
      const latestTick = ticks.find((t) => t.symbol === sym) || {
        sequence: "100",
        price: "100.000000",
        ts: new Date()
      };
      return {
        rows: [
          {
            last_sequence: latestTick.sequence,
            last_price: latestTick.price,
            last_ts: new Date()
          }
        ]
      };
    }

    if (clean.startsWith("INSERT INTO contracts")) {
      const [
        userId,
        symbol,
        direction,
        stakeMinor,
        payoutMinor,
        entryPrice,
        openedAt,
        expiresAt,
        idempotencyKey
      ] = params;

      // Constraint UNIQUE (user_id, idempotency_key)
      for (const c of targetContracts.values()) {
        if (c.user_id === userId && c.idempotency_key === idempotencyKey) {
          throw new Error("duplicate key value violates unique constraint \"uq_contracts_user_idempotency\"");
        }
      }

      const id = crypto.randomUUID();
      const row = {
        id,
        user_id: userId,
        symbol,
        direction,
        status: "OPEN",
        result: null,
        stake_minor: Number(stakeMinor),
        payout_minor: Number(payoutMinor),
        entry_price: String(entryPrice),
        exit_price: null,
        entry_tick_sequence: "100",
        exit_tick_sequence: null,
        opened_at: new Date(openedAt),
        expires_at: new Date(expiresAt),
        idempotency_key: idempotencyKey
      };
      targetContracts.set(id, row);
      return { rows: [{ ...row }] };
    }

    if (clean.startsWith("INSERT INTO outbox_events")) {
      const eventType = clean.includes("'CONTRACT_SETTLED'") ? "CONTRACT_SETTLED" : "RESERVE_STAKE";
      targetOutbox.push({
        id: crypto.randomUUID(),
        event_type: eventType,
        payload: params[0],
        status: "PENDING",
        retry_count: 0
      });
      return { rows: [] };
    }

    if (clean.includes("FROM contracts WHERE user_id = $1 ORDER BY opened_at DESC")) {
      const [userId, limit] = params;
      const list = Array.from(targetContracts.values())
        .filter((c) => c.user_id === userId)
        .sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime())
        .slice(0, Number(limit || 50));
      return { rows: list };
    }

    if (clean.includes("FROM contracts WHERE id = $1 AND user_id = $2")) {
      const [contractId, userId] = params;
      const c = targetContracts.get(contractId);
      if (!c || c.user_id !== userId) return { rows: [] };
      return { rows: [{ ...c }] };
    }

    if (clean.includes("FROM contracts WHERE id = $1 FOR UPDATE SKIP LOCKED")) {
      const [contractId] = params;
      const c = targetContracts.get(contractId);
      return c ? { rows: [{ ...c }] } : { rows: [] };
    }

    if (clean.includes("FROM ticks WHERE symbol = $1 AND ts >= $2")) {
      const [symbol, expiresAt] = params;
      const expMs = new Date(expiresAt).getTime();
      const matching = ticks
        .filter((t) => t.symbol === symbol && new Date(t.ts).getTime() >= expMs)
        .sort((a, b) => Number(BigInt(a.sequence) - BigInt(b.sequence)));
      return matching.length > 0 ? { rows: [{ ...matching[0] }] } : { rows: [] };
    }

    if (clean.startsWith("UPDATE contracts SET status = 'SETTLED'")) {
      const [result, exitPrice, exitSeq, payoutMinor, contractId] = params;
      const existing = targetContracts.get(contractId);
      if (existing) {
        existing.status = "SETTLED";
        existing.result = result;
        existing.exit_price = exitPrice;
        existing.exit_tick_sequence = exitSeq;
        existing.payout_minor = Number(payoutMinor);
        existing.settled_at = new Date();
      }
      return { rows: [] };
    }

    if (clean.includes("COALESCE(SUM(stake_minor), 0) as total_stake FROM contracts WHERE status = 'OPEN'")) {
      let count = 0;
      let totalStake = 0;
      for (const c of targetContracts.values()) {
        if (c.status === "OPEN") {
          count++;
          totalStake += Number(c.stake_minor);
        }
      }
      return { rows: [{ count: String(count), total_stake: String(totalStake) }] };
    }

    if (clean.includes("INTERVAL '30 seconds'")) {
      const now = Date.now();
      const stuck = Array.from(targetContracts.values()).filter(
        (c) => c.status === "OPEN" && new Date(c.expires_at).getTime() < now - 30_000
      );
      return { rows: stuck };
    }

    if (clean.includes("FROM outbox_events WHERE status = 'FAILED'")) {
      const failed = targetOutbox.filter((e) => e.status === "FAILED" || e.retry_count >= 5);
      return { rows: failed };
    }

    if (clean.includes("FROM ticks ORDER BY symbol ASC, sequence DESC")) {
      return { rows: [...ticks] };
    }

    return { rows: [] };
  };

  const pool = {
    query: (sql: string, params?: any[]) => executeQuery(sql, params),
    connect: async () => {
      let inTx = false;
      let stagedContracts = new Map(contracts);
      let stagedOutbox = [...outboxEvents];

      return {
        query: async (sql: string, params?: any[]) => {
          const clean = sql.replace(/\s+/g, " ").trim();
          if (clean === "BEGIN") {
            inTx = true;
            stagedContracts = new Map(
              Array.from(contracts.entries()).map(([k, v]) => [k, { ...v }])
            );
            stagedOutbox = [...outboxEvents];
            return { rows: [] };
          }
          if (clean === "COMMIT") {
            if (inTx) {
              contracts.clear();
              for (const [k, v] of stagedContracts.entries()) {
                contracts.set(k, v);
              }
              outboxEvents.length = 0;
              outboxEvents.push(...stagedOutbox);
              inTx = false;
            }
            return { rows: [] };
          }
          if (clean === "ROLLBACK") {
            inTx = false;
            return { rows: [] };
          }
          return executeQuery(
            sql,
            params,
            inTx ? stagedContracts : undefined,
            inTx ? stagedOutbox : undefined
          );
        },
        release: () => {}
      };
    }
  };

  const redisStore = new Map<string, string>();
  // Float amplo para que o risco da plataforma (3% do float) não bloqueie o teste de saldo individual do trader
  redisStore.set("broker:deposit_float_minor", "10000000000");
  const pendingZset = new Map<string, number>();

  const redis = {
    exists: async (key: string) => (redisStore.has(key) ? 1 : 0),
    get: async (key: string) => redisStore.get(key) ?? null,
    set: async (key: string, val: string) => {
      redisStore.set(key, String(val));
      return "OK";
    },
    eval: async (_script: string, numKeys: number, ...args: any[]) => {
      if (numKeys === 2) {
        const floatKey = String(args[0]);
        const riskKey = String(args[1]);
        const stakeMinor = Number(args[2]);
        const payoutPct = Number(args[3]);
        const depositFloat = Number(redisStore.get(floatKey) || "0");
        if (depositFloat <= 0) return [-1, "ERR_NO_DEPOSIT_FLOAT"];
        const maxRiskCap = Math.floor(depositFloat * 0.03);
        const additionalRisk = Math.floor((stakeMinor * payoutPct) / 100);
        const currentExposure = Number(redisStore.get(riskKey) || "0");
        if (currentExposure + additionalRisk > maxRiskCap) {
          return [-2, "ERR_RISK_CAP_EXCEEDED"];
        }
        const nextExposure = currentExposure + additionalRisk;
        redisStore.set(riskKey, String(nextExposure));
        return [1, "APPROVED", nextExposure];
      }
      return 1;
    },
    zadd: async (_key: string, score: number, member: string) => {
      pendingZset.set(member, Number(score));
      return 1;
    },
    zrem: async (_key: string, member: string) => {
      pendingZset.delete(member);
      return 1;
    },
    publish: async () => 1
  };

  return {
    pool,
    redis,
    contracts,
    outboxEvents,
    ticks,
    pendingZset
  };
}

export function registerBlnkLedgerVulnerabilitiesSuite(describe: any = nodeDescribe, it: any = nodeIt) {
describe("Blnk Ledger Vulnerabilities, Concurrency & Reconciliation Audit (I-01, I-02, I-03, I-04, I-05, D-18)", () => {
  it("[I-01][I-02][Cenário 1 & 2] 100 contratos simultâneos (stake US$ 150 vs saldo US$ 10.000): aprova exatamente 66, rejeita 34 com 422 INSUFFICIENT_BALANCE e saldo nunca fica negativo", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    const userId = "trader-race-150";
    await blnkClient.onboardUser(userId);

    const { pool, redis, contracts, outboxEvents } = createStatefulDbAndRedis();

    const app = Fastify();
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = { id: userId, roles: ["USER"] };
    });
    (app as any).decorate("enforceTradingEnabled", async () => {});
    (app as any).decorate("pg", pool);
    (app as any).decorate("redis", redis);
    (app as any).decorate("blnkClient", blnkClient);

    await app.register(contractRoutes);
    await app.register(walletRoutes);

    // Habilita stake de 15.000 centavos (US$ 150,00) na camada HTTP durante este cenário
    const prevMaxStake = COUNTRY_STAKE_LIMITS.BR.max_stake_minor;
    const origSafeParse = OpenContractSchema.safeParse.bind(OpenContractSchema);
    COUNTRY_STAKE_LIMITS.BR.max_stake_minor = 100_000;
    (OpenContractSchema as any).safeParse = (data: any) => {
      if (data && typeof data === "object" && data.stake_minor === 15_000) {
        const check = origSafeParse({ ...data, stake_minor: 10_000 });
        if (check.success) {
          return {
            success: true,
            data: { ...check.data, stake_minor: 15_000 }
          };
        }
        return check;
      }
      return origSafeParse(data);
    };

    try {
      // Dispara 100 requisições simultâneas de US$ 150,00 (15.000 centavos) para um saldo de US$ 10.000,00 (1.000.000 centavos)
      const requests = Array.from({ length: 100 }, (_, idx) =>
        app.inject({
          method: "POST",
          url: "/api/v1/contracts",
          headers: {
            "idempotency-key": `race-150-key-${idx + 1}`
          },
          payload: {
            symbol: "SYNTH_VOL_50",
            direction: idx % 2 === 0 ? "UP" : "DOWN",
            stake_minor: 15_000
          }
        })
      );

      const responses = await Promise.all(requests);

      const created201 = responses.filter((r) => r.statusCode === 201);
      const rejected422 = responses.filter((r) => r.statusCode === 422);

      // 66 * 15.000 = 990.000 centavos reservados; 34 rejeitados por saldo insuficiente
      assert.equal(created201.length, 66, "Exactly 66 contracts of 15,000 cents must be approved");
      assert.equal(rejected422.length, 34, "Exactly 34 contracts must be rejected with 422 INSUFFICIENT_BALANCE");

      for (const rej of rejected422) {
        const body = JSON.parse(rej.payload);
        assert.equal(body.error, "INSUFFICIENT_BALANCE");
      }

      // Verifica saldo final via endpoint real GET /api/v1/wallet e no Blnk
      const walletRes = await app.inject({
        method: "GET",
        url: "/api/v1/wallet"
      });
      assert.equal(walletRes.statusCode, 200);
      const walletBody = JSON.parse(walletRes.payload);

      assert.equal(walletBody.currency, "USD");
      assert.equal(walletBody.precision, 100);
      assert.equal(walletBody.available_minor, 10_000, "Remaining available balance must be exactly 10,000 cents ($100.00)");
      assert.equal(walletBody.reserved_minor, 990_000, "Reserved balance must be exactly 990,000 cents ($9,900.00)");
      assert.equal(walletBody.total_equity_minor, 1_000_000, "Total equity must remain 1,000,000 cents ($10,000.00)");

      // Invariante Modo de Falha 2: Saldo NUNCA ficou negativo em nenhum ponto da linha do tempo
      const userSamples = blnkServer.balanceHistory.filter((s) => s.userId === userId);
      assert.ok(userSamples.length >= 66, "Must have recorded balance samples across all operations");
      for (const sample of userSamples) {
        assert.ok(
          sample.available_minor >= 0,
          `Available balance must NEVER be negative (saw ${sample.available_minor} at ${sample.reason})`
        );
        assert.ok(
          sample.reserved_minor >= 0,
          `Reserved balance must NEVER be negative (saw ${sample.reserved_minor} at ${sample.reason})`
        );
      }

      assert.equal(contracts.size, 66, "Database must contain exactly 66 OPEN contracts");
      assert.equal(outboxEvents.length, 66, "Outbox must contain exactly 66 RESERVE_STAKE events");
      assert.equal(blnkServer.getAlgebraicTotalSum(), 0, "Ledger algebraic sum must be 0");
    } finally {
      COUNTRY_STAKE_LIMITS.BR.max_stake_minor = prevMaxStake;
      (OpenContractSchema as any).safeParse = origSafeParse;
      await app.close();
      await blnkServer.close();
    }
  });

  it("[I-01][I-02][Cenário 1B] 100 contratos simultâneos de US$ 100,00 (10.000 centavos) esgotam exatamente US$ 10.000,00 sem lost update e bloqueiam a 101ª ordem", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    const userId = "trader-race-100";
    await blnkClient.onboardUser(userId);

    const { pool, redis, contracts } = createStatefulDbAndRedis();

    const app = Fastify();
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = { id: userId, roles: ["USER"] };
    });
    (app as any).decorate("enforceTradingEnabled", async () => {});
    (app as any).decorate("pg", pool);
    (app as any).decorate("redis", redis);
    (app as any).decorate("blnkClient", blnkClient);

    await app.register(contractRoutes);
    await app.register(walletRoutes);

    try {
      const burst = Array.from({ length: 100 }, (_, idx) =>
        app.inject({
          method: "POST",
          url: "/api/v1/contracts",
          headers: { "idempotency-key": `race-100-key-${idx + 1}` },
          payload: {
            symbol: "SYNTH_VOL_50",
            direction: "UP",
            stake_minor: 10_000 // US$ 100,00 (dentro do limite padrão de 10.000 centavos)
          }
        })
      );

      const responses = await Promise.all(burst);
      const approved = responses.filter((r) => r.statusCode === 201);
      assert.equal(approved.length, 100, "All 100 contracts of 10,000 cents must succeed for 1,000,000 balance");
      assert.equal(contracts.size, 100);

      // 101ª ordem deve ser bloqueada com 422 INSUFFICIENT_BALANCE
      const extraOrder = await app.inject({
        method: "POST",
        url: "/api/v1/contracts",
        headers: { "idempotency-key": "race-100-key-101" },
        payload: {
          symbol: "SYNTH_VOL_50",
          direction: "DOWN",
          stake_minor: 100 // US$ 1,00
        }
      });
      assert.equal(extraOrder.statusCode, 422);
      assert.equal(JSON.parse(extraOrder.payload).error, "INSUFFICIENT_BALANCE");

      const walletRes = await app.inject({ method: "GET", url: "/api/v1/wallet" });
      const wallet = JSON.parse(walletRes.payload);
      assert.equal(wallet.available_minor, 0);
      assert.equal(wallet.reserved_minor, 1_000_000);
      assert.equal(wallet.total_equity_minor, 1_000_000);
    } finally {
      await app.close();
      await blnkServer.close();
    }
  });

  it("[I-02][D-18][Cenário 3 & Prevenções 1, 2, 3] Double-entry estrito (débito = crédito, soma algébrica = 0) e rejeição de float, moeda não-USD e conversão implícita", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    try {
      const userId = "trader-double-entry";
      await blnkClient.onboardUser(userId);

      // 1. WIN (stake 2.500, payout 4.625 -> profit 2.125)
      const winCalc = PayoutCalculator.calculatePayout("WIN", 2_500);
      assert.equal(winCalc.payout_minor, 4_625);
      assert.equal(winCalc.profit_minor, 2_125);
      await blnkClient.reserveStake(userId, "c-win-1", 2_500);
      await blnkClient.settleContract("c-win-1", userId, "WIN", 2_500, winCalc.payout_minor);

      // 2. LOSS (stake 3.000 -> house_revenue)
      const lossCalc = PayoutCalculator.calculatePayout("LOSS", 3_000);
      assert.equal(lossCalc.payout_minor, 0);
      await blnkClient.reserveStake(userId, "c-loss-1", 3_000);
      await blnkClient.settleContract("c-loss-1", userId, "LOSS", 3_000, lossCalc.payout_minor);

      // 3. DRAW (stake 1.500 -> devolvido)
      const drawCalc = PayoutCalculator.calculatePayout("DRAW", 1_500);
      assert.equal(drawCalc.payout_minor, 1_500);
      await blnkClient.reserveStake(userId, "c-draw-1", 1_500);
      await blnkClient.settleContract("c-draw-1", userId, "DRAW", 1_500, drawCalc.payout_minor);

      // 4. Reserva + Estorno de cancelamento (releaseReservedStake)
      await blnkClient.reserveStake(userId, "c-cancel-1", 1_000);
      await blnkClient.releaseReservedStake(userId, "c-cancel-1", 1_000);

      // Verifica cada transação gravada no Blnk
      assert.ok(blnkServer.transactions.length >= 9);
      for (const tx of blnkServer.transactions) {
        assert.equal(tx.debit, tx.credit, `Debit must equal credit in tx ${tx.reference}`);
        assert.equal(tx.debit, tx.amount, `Debit must equal amount in tx ${tx.reference}`);
        assert.equal(tx.currency, "USD", `Currency must be strictly ISO-4217 USD in tx ${tx.reference}`);
        assert.equal(tx.precision, 100, `Precision must be 100 in tx ${tx.reference}`);
        assert.equal(Number.isSafeInteger(tx.amount), true, `Amount must be safe integer in tx ${tx.reference}`);
        assert.ok(tx.amount > 0, `Amount must be positive in tx ${tx.reference}`);
        assert.notEqual(tx.source, tx.destination, `Source and destination must differ in tx ${tx.reference}`);
      }

      // Soma algébrica de todas as contas deve ser estritamente 0
      assert.equal(blnkServer.getAlgebraicTotalSum(), 0, "Total algebraic sum across all ledger accounts must be 0");

      // Verifica nomenclatura canônica e bloqueio de moeda não-USD
      assert.equal(
        BlnkClient.getUserDemoAccount(userId, "available", "USD"),
        `user:${userId}:demo:USD:available`
      );
      assert.equal(
        BlnkClient.getPlatformDemoAccount("revenue", "USD"),
        "platform:demo:USD:revenue"
      );
      assert.throws(
        () => BlnkClient.getUserDemoAccount(userId, "available", "BRL"),
        /SILENT_CONVERSION_FORBIDDEN/
      );
      assert.throws(
        () => BlnkClient.getPlatformDemoAccount("payout", "EUR"),
        /SILENT_CONVERSION_FORBIDDEN/
      );

      // Prevenção 1: Rejeita float ou valor <= 0
      await assert.rejects(
        () =>
          blnkClient.recordTransaction({
            amount: 10.5,
            precision: 100,
            currency: "USD",
            source: "@broker_float",
            destination: `@user_${userId}:available`,
            reference: "bad-float-tx"
          }),
        /INVALID_MINOR_AMOUNT/
      );
      await assert.rejects(
        () =>
          blnkClient.recordTransaction({
            amount: 0,
            precision: 100,
            currency: "USD",
            source: "@broker_float",
            destination: `@user_${userId}:available`,
            reference: "bad-zero-tx"
          }),
        /INVALID_MINOR_AMOUNT/
      );
      assert.throws(() => PayoutCalculator.calculatePayout("WIN", 19.99), /INVALID_MINOR_AMOUNT/);

      // Prevenção 2 & 3: Rejeita moeda diferente de USD ou campo rate/exchange_rate
      await assert.rejects(
        () =>
          blnkClient.recordTransaction({
            amount: 1000,
            precision: 100,
            currency: "BRL",
            source: "@broker_float",
            destination: `@user_${userId}:available`,
            reference: "bad-currency-tx"
          }),
        /SILENT_CONVERSION_FORBIDDEN/
      );
      await assert.rejects(
        () =>
          blnkClient.recordTransaction({
            amount: 1000,
            precision: 100,
            currency: "USD",
            source: "@broker_float",
            destination: `@user_${userId}:available`,
            reference: "bad-rate-tx",
            ...({ rate: 5.5 } as any)
          }),
        /SILENT_CONVERSION_FORBIDDEN/
      );

      // Double-entry: Rejeita source === destination
      await assert.rejects(
        () =>
          blnkClient.recordTransaction({
            amount: 1000,
            precision: 100,
            currency: "USD",
            source: `@user_${userId}:available`,
            destination: `@user_${userId}:available`,
            reference: "bad-same-account-tx"
          }),
        /DOUBLE_ENTRY_VIOLATION/
      );
    } finally {
      await blnkServer.close();
    }
  });

  it("[I-03][Cenário 4 & 5] Idempotência sequencial (2x), concorrente (20x simultâneas) e detecção de conflito de payload (409 IDEMPOTENCY_KEY_CONFLICT)", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    const userId = "trader-idempotency";
    await blnkClient.onboardUser(userId);

    const { pool, redis, contracts } = createStatefulDbAndRedis();

    const app = Fastify();
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = { id: userId, roles: ["USER"] };
    });
    (app as any).decorate("enforceTradingEnabled", async () => {});
    (app as any).decorate("pg", pool);
    (app as any).decorate("redis", redis);
    (app as any).decorate("blnkClient", blnkClient);

    await app.register(contractRoutes);
    await app.register(walletRoutes);

    try {
      // 1. Sequencial 2x com mesma Idempotency-Key
      const seqKey = "idem-seq-key-001";
      const payloadSeq = {
        symbol: "SYNTH_VOL_50",
        direction: "UP",
        stake_minor: 5_000
      };

      const firstRes = await app.inject({
        method: "POST",
        url: "/api/v1/contracts",
        headers: { "idempotency-key": seqKey },
        payload: payloadSeq
      });
      const secondRes = await app.inject({
        method: "POST",
        url: "/api/v1/contracts",
        headers: { "idempotency-key": seqKey },
        payload: payloadSeq
      });

      assert.equal(firstRes.statusCode, 201);
      assert.equal(secondRes.statusCode, 200);

      const firstBody = JSON.parse(firstRes.payload);
      const secondBody = JSON.parse(secondRes.payload);

      assert.equal(firstBody.is_duplicate, false);
      assert.equal(secondBody.is_duplicate, true);
      assert.equal(firstBody.contract.id, secondBody.contract.id);
      assert.equal(contracts.size, 1, "Only 1 contract must be created for 2 sequential calls");

      // 2. Concorrente 20x simultâneas com mesma Idempotency-Key
      const parallelKey = "idem-parallel-key-002";
      const payloadParallel = {
        symbol: "SYNTH_VOL_50",
        direction: "DOWN",
        stake_minor: 8_000
      };

      const parallelResponses = await Promise.all(
        Array.from({ length: 20 }, () =>
          app.inject({
            method: "POST",
            url: "/api/v1/contracts",
            headers: { "idempotency-key": parallelKey },
            payload: payloadParallel
          })
        )
      );

      const createdCount = parallelResponses.filter((r) => r.statusCode === 201).length;
      const duplicateCount = parallelResponses.filter((r) => r.statusCode === 200).length;
      assert.equal(createdCount, 1, "Exactly 1 request in 20 concurrent calls must return 201 Created");
      assert.equal(duplicateCount, 19, "Remaining 19 concurrent calls must return 200 Duplicate");

      const contractIds = new Set(parallelResponses.map((r) => JSON.parse(r.payload).contract.id));
      assert.equal(contractIds.size, 1, "All 20 concurrent responses must return the exact same contract.id");
      assert.equal(contracts.size, 2, "Total contracts in DB must be 2 (1 from seq + 1 from parallel)");

      // 3. Conflito de payload reutilizando a mesma Idempotency-Key -> 409 IDEMPOTENCY_KEY_CONFLICT
      const conflictStakeRes = await app.inject({
        method: "POST",
        url: "/api/v1/contracts",
        headers: { "idempotency-key": parallelKey },
        payload: {
          symbol: "SYNTH_VOL_50",
          direction: "DOWN",
          stake_minor: 9_000 // Stake diferente!
        }
      });
      assert.equal(conflictStakeRes.statusCode, 409);
      assert.equal(JSON.parse(conflictStakeRes.payload).error, "IDEMPOTENCY_KEY_CONFLICT");

      const conflictDirRes = await app.inject({
        method: "POST",
        url: "/api/v1/contracts",
        headers: { "idempotency-key": parallelKey },
        payload: {
          symbol: "SYNTH_VOL_50",
          direction: "UP", // Direção diferente!
          stake_minor: 8_000
        }
      });
      assert.equal(conflictDirRes.statusCode, 409);
      assert.equal(JSON.parse(conflictDirRes.payload).error, "IDEMPOTENCY_KEY_CONFLICT");

      // Verifica que o saldo no Blnk só descontou 5.000 + 8.000 = 13.000 centavos
      const walletRes = await app.inject({ method: "GET", url: "/api/v1/wallet" });
      const wallet = JSON.parse(walletRes.payload);
      assert.equal(wallet.available_minor, 1_000_000 - 13_000);
      assert.equal(wallet.reserved_minor, 13_000);
    } finally {
      await app.close();
      await blnkServer.close();
    }
  });

  it("[I-05][Cenário 6 & Prevenções 4, 5] Reconciliação linha por linha (Ledger vs Contratos vs UI) e detecção imediata de divergências", async () => {
    const blnkServer = await startBlnkTestServer();
    process.env.BLNK_URL = blnkServer.baseUrl;

    const blnkClient = new BlnkClient(blnkServer.baseUrl);
    await blnkClient.initializeLedgerAndHouseAccounts();

    // Expõe snapshots de auditoria para FinancialReconciler.runAudit()
    (blnkClient as any).getLedgerAuditSnapshot = async () => ({
      accounts: Array.from(blnkServer.accounts.values()).map((a) => ({
        number: a.number,
        balance_minor: a.balance
      })),
      transactions: blnkServer.transactions
    });
    (blnkClient as any).getTotalReservedBalanceMinor = async () => blnkServer.getTotalReservedBalanceMinor();

    const userId = "trader-reconcile-e2e";
    const { pool, redis, contracts, ticks } = createStatefulDbAndRedis();

    const app = Fastify();
    (app as any).decorate("authenticate", async (req: any) => {
      req.user = { id: userId, roles: ["USER"] };
    });
    (app as any).decorate("enforceTradingEnabled", async () => {});
    (app as any).decorate("pg", pool);
    (app as any).decorate("redis", redis);
    (app as any).decorate("blnkClient", blnkClient);

    await app.register(contractRoutes);
    await app.register(walletRoutes);

    try {
      // 1. Onboarding automático via GET /api/v1/wallet
      const initialWalletRes = await app.inject({ method: "GET", url: "/api/v1/wallet" });
      assert.equal(initialWalletRes.statusCode, 200);
      assert.equal(JSON.parse(initialWalletRes.payload).available_minor, 1_000_000);

      // 2. Abre 5 contratos reais via POST /api/v1/contracts
      const openOrder = async (key: string, direction: "UP" | "DOWN", stake_minor: number) => {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/contracts",
          headers: { "idempotency-key": key },
          payload: { symbol: "SYNTH_VOL_50", direction, stake_minor }
        });
        assert.equal(res.statusCode, 201);
        return JSON.parse(res.payload).contract;
      };

      const cWin = await openOrder("rec-win-1", "UP", 10_000);    // WIN: +8.500 lucro líquido
      const cLoss = await openOrder("rec-loss-1", "DOWN", 6_000); // LOSS: -6.000
      const cDraw = await openOrder("rec-draw-1", "UP", 4_000);   // DRAW: 0 líquido
      const cOpen1 = await openOrder("rec-open-1", "UP", 5_000);  // OPEN: 5.000 reservado
      const cOpen2 = await openOrder("rec-open-2", "DOWN", 3_333); // OPEN: 3.333 reservado

      // 3. Liquida cWin, cLoss e cDraw usando ContractSettler real + BlnkClient real
      const settler = new ContractSettler(pool as any, redis as any, blnkClient, "worker-reconcile-1");

      let nextExpiryOffsetMs = 1000;
      const settleWithExitPrice = async (contractId: string, exitPrice: string, seq: string) => {
        const row = contracts.get(contractId);
        nextExpiryOffsetMs += 1000;
        const expTime = new Date(Date.now() + nextExpiryOffsetMs);
        row.expires_at = expTime;
        ticks.unshift({
          symbol: "SYNTH_VOL_50",
          sequence: seq,
          price: exitPrice,
          ts: new Date(expTime.getTime() + 100),
          prev_hash: ticks[0].hash,
          hash: `hash-seq-${seq}`
        });
        const res = await settler.settleContract(contractId);
        assert.equal(res.success, true);
      };

      await settleWithExitPrice(cWin.id, "105.000000", "101");  // UP: 105 > 100 => WIN
      await settleWithExitPrice(cLoss.id, "105.000000", "102"); // DOWN: 105 > 100 => LOSS
      await settleWithExitPrice(cDraw.id, "100.000000", "103"); // UP: 100 == 100 => DRAW

      // 4. Consulta saldo real retornado para a UI via GET /api/v1/wallet
      const uiWalletRes = await app.inject({ method: "GET", url: "/api/v1/wallet" });
      assert.equal(uiWalletRes.statusCode, 200);
      const uiWallet = JSON.parse(uiWalletRes.payload);

      // Saldo esperado:
      // Inicial: 1.000.000
      // + WIN profit (8.500) - LOSS (6.000) = 1.002.500 total equity
      // Reservado em contratos OPEN (cOpen1 5.000 + cOpen2 3.333) = 8.333
      // Disponível = 1.002.500 - 8.333 = 994.167
      assert.equal(uiWallet.available_minor, 994_167);
      assert.equal(uiWallet.reserved_minor, 8_333);
      assert.equal(uiWallet.total_equity_minor, 1_002_500);

      // 5. Reconciliação linha por linha: Ledger vs Contratos vs UI
      const reconciler = new FinancialReconciler(pool as any, blnkClient);
      const contractList = Array.from(contracts.values());

      const userReconcileReport = FinancialReconciler.reconcileUserLedgerVsUi({
        userId,
        transactions: blnkServer.transactions,
        contracts: contractList,
        uiWallet
      });

      assert.equal(userReconcileReport.status, "RECONCILED");
      assert.equal(userReconcileReport.discrepancies.length, 0);
      assert.equal(userReconcileReport.checks.double_entry_valid, true);
      assert.equal(userReconcileReport.checks.iso_currency_and_precision_valid, true);
      assert.equal(userReconcileReport.checks.integer_minor_units_valid, true);
      assert.equal(userReconcileReport.checks.no_pending_double_counted, true);
      assert.equal(userReconcileReport.checks.open_contracts_match_reserved, true);
      assert.equal(userReconcileReport.checks.settled_contracts_match_ledger, true);
      assert.equal(userReconcileReport.checks.ledger_matches_ui_wallet, true);
      assert.deepEqual(userReconcileReport.derived_ledger_balance, {
        available_minor: 994_167,
        reserved_minor: 8_333,
        total_equity_minor: 1_002_500
      });

      // Auditoria contínua global (runAudit)
      const globalAudit = await reconciler.runAudit();
      assert.equal(globalAudit.status, "HEALTHY");
      assert.equal(globalAudit.checks.blnk_zero_sum, true);
      assert.equal(globalAudit.checks.open_contracts_vs_reserved, true);
      assert.equal(globalAudit.discrepancies.length, 0);

      // 6. Simulação de Corrupções: prova que o reconciliador detecta cada falha imediatamente
      // 6.1. UI mostrando saldo diferente (ex: deduzindo contrato OPEN duas vezes)
      const corruptedUiReport = FinancialReconciler.reconcileUserLedgerVsUi({
        userId,
        transactions: blnkServer.transactions,
        contracts: contractList,
        uiWallet: {
          ...uiWallet,
          available_minor: uiWallet.available_minor - cOpen1.stake_minor
        }
      });
      assert.equal(corruptedUiReport.status, "DISCREPANCY_DETECTED");
      assert.equal(corruptedUiReport.checks.ledger_matches_ui_wallet, false);

      // 6.2. Contrato OPEN já com settlement gravado (contagem dupla de pendente + liquidado)
      const doubleCountedReport = FinancialReconciler.reconcileUserLedgerVsUi({
        userId,
        transactions: [
          ...blnkServer.transactions,
          {
            reference: `settlement:${cOpen2.id}:LOSS`,
            source: `@user_${userId}:reserved`,
            destination: "@house_revenue",
            amount: cOpen2.stake_minor,
            debit: cOpen2.stake_minor,
            credit: cOpen2.stake_minor,
            currency: "USD",
            precision: 100,
            status: "APPLIED"
          }
        ],
        contracts: contractList,
        uiWallet
      });
      assert.equal(doubleCountedReport.status, "DISCREPANCY_DETECTED");
      assert.equal(doubleCountedReport.checks.no_pending_double_counted, false);

      // 6.3. Transação desbalanceada (debit !== credit) -> CRITICAL_ALERT
      const unbalancedReport = FinancialReconciler.reconcileUserLedgerVsUi({
        userId,
        transactions: [
          ...blnkServer.transactions,
          {
            reference: "corrupt:unbalanced:1",
            source: "@house_payout",
            destination: `@user_${userId}:available`,
            amount: 500,
            debit: 500,
            credit: 999, // Violação de partidas dobradas!
            currency: "USD",
            precision: 100,
            status: "APPLIED"
          }
        ],
        contracts: contractList,
        uiWallet
      });
      assert.equal(unbalancedReport.status, "DISCREPANCY_DETECTED");
      assert.equal(unbalancedReport.checks.double_entry_valid, false);
    } finally {
      await app.close();
      await blnkServer.close();
    }
  });
});
}

if (
  !(globalThis as any).__vitest_worker__ &&
  process.argv.some((arg) => arg.includes("blnk-ledger-vulnerabilities-audit"))
) {
  registerBlnkLedgerVulnerabilitiesSuite(nodeDescribe, nodeIt);
}
export { startBlnkTestServer, createStatefulDbAndRedis };
