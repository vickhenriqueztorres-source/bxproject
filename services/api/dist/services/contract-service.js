import pg from "pg";
const { Pool } = pg;
import { RiskManager } from "./risk-manager.js";
import { isMarketOpen } from "./trading-calendar.js";
import { RegionalMetricsService } from "./metrics.js";
/**
 * Perigo 1 (Método 3): Threshold de Staleness configurável por classe/símbolo.
 * - Índices Sintéticos de alta frequência (R_10, R_25, R_50, R_75, R_100, SYNTH*, VOL*, CRASH*, BOOM*): 5000ms (tolerância de execução backend)
 * - Forex OTC: 5000ms
 * - Criptomoedas: 5000ms
 * - Commodities / Ações de menor liquidez (XAUUSD, AAPL*, TSLA*): 8000ms
 * Suporta overrides granulares por símbolo em runtime via setSymbolStalenessThreshold.
 */
const customBackendStalenessThresholds = new Map();
export function setSymbolStalenessThreshold(symbol, thresholdMs) {
    if (thresholdMs > 0) {
        customBackendStalenessThresholds.set(symbol.toUpperCase(), thresholdMs);
    }
}
export function getSymbolStalenessThresholdMs(symbol) {
    const upper = (symbol || "").toUpperCase();
    const custom = customBackendStalenessThresholds.get(upper);
    if (custom !== undefined)
        return custom;
    if (upper.startsWith("XAU") ||
        upper.startsWith("XAG") ||
        upper.startsWith("AAPL") ||
        upper.startsWith("TSLA") ||
        upper.startsWith("MSFT")) {
        return 8000;
    }
    return 5000;
}
export class ContractService {
    pool;
    redis;
    riskManager;
    blnkClient;
    static userLocks = new Map();
    static userBalancesMinor = new Map();
    static userReservedMinor = new Map();
    static explicitBalanceOverrides = new Set();
    static idempotencyCache = new Map();
    constructor(pool, redis, blnkClient) {
        this.pool = pool;
        this.redis = redis;
        this.riskManager = new RiskManager(redis);
        this.blnkClient = blnkClient;
    }
    static setUserBalanceForTesting(userId, balanceMinor, reservedMinor = 0) {
        if (!Number.isSafeInteger(balanceMinor) || balanceMinor < 0) {
            throw new Error("INVALID_MINOR_AMOUNT: balanceMinor must be a non-negative safe integer");
        }
        if (!Number.isSafeInteger(reservedMinor) || reservedMinor < 0) {
            throw new Error("INVALID_MINOR_AMOUNT: reservedMinor must be a non-negative safe integer");
        }
        ContractService.userBalancesMinor.set(userId, balanceMinor);
        ContractService.userReservedMinor.set(userId, reservedMinor);
        ContractService.explicitBalanceOverrides.add(userId);
        for (const key of ContractService.idempotencyCache.keys()) {
            if (key.startsWith(`${userId}:`)) {
                ContractService.idempotencyCache.delete(key);
            }
        }
    }
    setUserBalanceForTesting(userId, balanceMinor, reservedMinor = 0) {
        ContractService.setUserBalanceForTesting(userId, balanceMinor, reservedMinor);
    }
    static getUserBalanceSnapshot(userId) {
        const available = ContractService.userBalancesMinor.get(userId) ?? 1_000_000;
        const reserved = ContractService.userReservedMinor.get(userId) ?? 0;
        return {
            user_id: userId,
            currency: "USD",
            precision: 100,
            available_minor: available,
            reserved_minor: reserved,
            total_equity_minor: available + reserved
        };
    }
    getUserBalanceSnapshot(userId) {
        return ContractService.getUserBalanceSnapshot(userId);
    }
    async withUserLock(userId, fn) {
        const prevLock = ContractService.userLocks.get(userId) ?? Promise.resolve();
        let releaseLock;
        const currentLock = new Promise((resolve) => {
            releaseLock = resolve;
        });
        const chainedLock = prevLock.then(() => currentLock, () => currentLock);
        ContractService.userLocks.set(userId, chainedLock);
        await prevLock.catch(() => { });
        try {
            return await fn();
        }
        finally {
            releaseLock();
            if (ContractService.userLocks.get(userId) === chainedLock) {
                ContractService.userLocks.delete(userId);
            }
        }
    }
    /**
     * Abre um contrato com checagem de idempotência, teto de risco, saldo disponível e persistência ACID (B-01, B-05, I-03, I-04)
     */
    async openContract(userId, idempotencyKey, dto) {
        if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0) {
            throw new Error("IDEMPOTENCY_VIOLATION: Header 'Idempotency-Key' is required");
        }
        if (typeof dto.stake_minor !== "number" || !Number.isSafeInteger(dto.stake_minor) || dto.stake_minor <= 0) {
            throw new Error("INVALID_MINOR_AMOUNT: stake_minor must be a positive safe integer in minor units (cents)");
        }
        return this.withUserLock(userId, async () => {
            const cacheKey = `${userId}:${idempotencyKey}`;
            // 1. Verifica se já existe contrato com esta Idempotency-Key para o usuário (SQL + Cache em memória)
            const existingRes = await this.pool.query(`SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
         FROM contracts
         WHERE user_id = $1 AND idempotency_key = $2;`, [userId, idempotencyKey]);
            let existingContract;
            if (existingRes.rows.length > 0) {
                const row = existingRes.rows[0];
                existingContract = {
                    id: row.id,
                    user_id: row.user_id,
                    symbol: row.symbol,
                    direction: row.direction,
                    status: row.status,
                    stake_minor: parseInt(row.stake_minor, 10),
                    payout_minor: parseInt(row.payout_minor, 10),
                    entry_price: row.entry_price.toString(),
                    opened_at: new Date(row.opened_at),
                    expires_at: new Date(row.expires_at),
                    idempotency_key: row.idempotency_key
                };
            }
            else if (ContractService.idempotencyCache.has(cacheKey)) {
                existingContract = ContractService.idempotencyCache.get(cacheKey);
            }
            if (existingContract) {
                if (existingContract.symbol !== dto.symbol ||
                    existingContract.direction !== dto.direction ||
                    Number(existingContract.stake_minor) !== Number(dto.stake_minor)) {
                    throw new Error("IDEMPOTENCY_KEY_CONFLICT: Idempotency-Key already used with different payload");
                }
                return {
                    contract: existingContract,
                    isDuplicate: true
                };
            }
            // 1.5. Verifica saldo disponível do usuário (garante que saldo NUNCA fique negativo)
            if (this.blnkClient &&
                typeof this.blnkClient.getBalance === "function" &&
                !ContractService.explicitBalanceOverrides.has(userId)) {
                const blnkBal = await this.blnkClient.getBalance(userId);
                ContractService.userBalancesMinor.set(userId, Math.trunc(Number(blnkBal.available_minor)));
                ContractService.userReservedMinor.set(userId, Math.trunc(Number(blnkBal.reserved_minor)));
            }
            else if (!ContractService.userBalancesMinor.has(userId)) {
                ContractService.userBalancesMinor.set(userId, 1_000_000);
                ContractService.userReservedMinor.set(userId, 0);
            }
            const availableBalanceMinor = ContractService.userBalancesMinor.get(userId);
            const reservedBalanceMinor = ContractService.userReservedMinor.get(userId) ?? 0;
            if (availableBalanceMinor < dto.stake_minor) {
                throw new Error("INSUFFICIENT_BALANCE: Available balance is insufficient for stake");
            }
            // 2. Verificação imediata de Kill Switch no Redis (<1ms) - Subetapa 5
            if (await this.riskManager.isKillSwitchActive(dto.symbol)) {
                throw new Error(`KILLSWITCH_ACTIVE: Kill switch ativo para ${dto.symbol} por instabilidade no feed.`);
            }
            // 2.1. Validação de Sessão de Mercado (Perigo 7 / Técnica 4)
            if (!isMarketOpen(dto.symbol, new Date())) {
                throw new Error(`MARKET_CLOSED: Mercado fechado para o ativo ${dto.symbol} no momento da abertura.`);
            }
            // Obtém o último estado atômico gravado em index_state com validação estrita de staleness (M-02, B-01)
            const stateRes = await this.pool.query(`SELECT last_sequence, last_price, last_ts FROM index_state WHERE symbol = $1;`, [dto.symbol]);
            if (stateRes.rows.length === 0 || Number(stateRes.rows[0].last_sequence) <= 0) {
                throw new Error(`TICK_UNAVAILABLE: Nenhum tick oficial registrado para o ativo ${dto.symbol}`);
            }
            const lastTs = new Date(stateRes.rows[0].last_ts);
            const tickAgeMs = Date.now() - lastTs.getTime();
            const MAX_TICK_AGE_MS = getSymbolStalenessThresholdMs(dto.symbol);
            const metrics = RegionalMetricsService.getInstance();
            metrics.recordTickAgeSeconds(dto.symbol, Math.max(0, tickAgeMs) / 1000);
            if (tickAgeMs > MAX_TICK_AGE_MS) {
                metrics.setStalenessAlert(dto.symbol, true);
                // Dispara Kill Switch automático por 10s no Redis e emite auditoria estruturada
                await this.riskManager.activateKillSwitch(dto.symbol, "STALE_FEED", 10);
                console.warn(JSON.stringify({
                    event: "KILL_SWITCH_TRIGGERED",
                    symbol: dto.symbol,
                    reason: "STALE_FEED",
                    tick_age_ms: tickAgeMs,
                    threshold_ms: MAX_TICK_AGE_MS,
                    timestamp: new Date().toISOString()
                }));
                throw new Error(`KILLSWITCH_ACTIVE: Cotação para ${dto.symbol} desatualizada há ${tickAgeMs}ms (limite: ${MAX_TICK_AGE_MS}ms). Kill switch acionado.`);
            }
            metrics.setStalenessAlert(dto.symbol, false);
            const entryPrice = stateRes.rows[0].last_price.toString();
            const baseTime = lastTs;
            // Expiração com piso inviolável de 60s (D-10 / Piso Mínimo de Operação 60s)
            const requestedDuration = dto.duration_seconds ?? 60;
            const safeDurationSeconds = Math.max(60, Math.min(300, requestedDuration));
            const expiresAt = new Date(baseTime.getTime() + safeDurationSeconds * 1000);
            // 3. Validação do teto de risco de 3% no Redis
            const riskCheck = await this.riskManager.checkAndReserveRisk({
                symbol: dto.symbol,
                direction: dto.direction,
                expiryBucket: expiresAt,
                stakeMinor: dto.stake_minor
            });
            if (!riskCheck.approved) {
                if (riskCheck.reason === "KILLSWITCH_ACTIVE") {
                    throw new Error(`KILLSWITCH_ACTIVE: Kill switch ativo para ${dto.symbol}`);
                }
                throw new Error(`RISK_LIMIT_EXCEEDED: ${riskCheck.reason}`);
            }
            // Payout fixo em 85% de lucro (total retorno = stake + 85% stake = 185% de stake)
            const payoutMinor = Math.floor(dto.stake_minor + (dto.stake_minor * 85) / 100);
            // Reserva atômica de saldo em memória antes do commit
            ContractService.userBalancesMinor.set(userId, availableBalanceMinor - dto.stake_minor);
            ContractService.userReservedMinor.set(userId, reservedBalanceMinor + dto.stake_minor);
            // 4. Inserção transacional no PostgreSQL (Contrato + Outbox RESERVE_STAKE)
            const client = await this.pool.connect();
            try {
                await client.query("BEGIN");
                const insertSql = `
          INSERT INTO contracts (
            user_id, symbol, direction, status, stake_minor, payout_minor, 
            entry_price, opened_at, expires_at, idempotency_key
          ) VALUES (
            $1, $2, $3, 'OPEN', $4, $5, $6, $7, $8, $9
          )
          RETURNING id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key;
        `;
                const insertRes = await client.query(insertSql, [
                    userId,
                    dto.symbol,
                    dto.direction,
                    dto.stake_minor,
                    payoutMinor,
                    entryPrice,
                    baseTime,
                    expiresAt,
                    idempotencyKey
                ]);
                const contractRow = insertRes.rows[0];
                // Inserção no Transactional Outbox para reserva de saldo no Blnk
                const outboxSql = `
          INSERT INTO outbox_events (event_type, payload, status)
          VALUES ('RESERVE_STAKE', $1, 'PENDING');
        `;
                const outboxPayload = JSON.stringify({
                    contract_id: contractRow.id,
                    user_id: userId,
                    stake_minor: dto.stake_minor
                });
                await client.query(outboxSql, [outboxPayload]);
                if (this.blnkClient && typeof this.blnkClient.reserveStake === "function") {
                    await this.blnkClient.reserveStake(userId, contractRow.id, dto.stake_minor);
                }
                await client.query("COMMIT");
                // 5. Adiciona ao Redis Sorted Set de pendências de expiração
                await this.redis.zadd("contracts:pending", expiresAt.getTime(), contractRow.id);
                const contract = {
                    id: contractRow.id,
                    user_id: contractRow.user_id,
                    symbol: contractRow.symbol,
                    direction: contractRow.direction,
                    status: contractRow.status,
                    stake_minor: parseInt(contractRow.stake_minor, 10),
                    payout_minor: parseInt(contractRow.payout_minor, 10),
                    entry_price: contractRow.entry_price.toString(),
                    opened_at: new Date(contractRow.opened_at),
                    expires_at: new Date(contractRow.expires_at),
                    idempotency_key: contractRow.idempotency_key
                };
                ContractService.idempotencyCache.set(cacheKey, contract);
                return { contract, isDuplicate: false };
            }
            catch (err) {
                await client.query("ROLLBACK");
                // Restaura o saldo em memória
                ContractService.userBalancesMinor.set(userId, availableBalanceMinor);
                ContractService.userReservedMinor.set(userId, reservedBalanceMinor);
                // Compensação: libera o risco que havia sido reservado no Redis
                await this.riskManager.releaseRisk({
                    symbol: dto.symbol,
                    direction: dto.direction,
                    expiryBucket: expiresAt,
                    stakeMinor: dto.stake_minor
                });
                throw err;
            }
            finally {
                client.release();
            }
        });
    }
    /**
     * Consulta contratos do usuário autenticado (Prevenção BOLA/IDOR - S-04)
     */
    async listUserContracts(userId, limit = 50) {
        const res = await this.pool.query(`SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, exit_price, opened_at, expires_at, idempotency_key
       FROM contracts
       WHERE user_id = $1
       ORDER BY opened_at DESC
       LIMIT $2;`, [userId, limit]);
        return res.rows.map(row => ({
            id: row.id,
            user_id: row.user_id,
            symbol: row.symbol,
            direction: row.direction,
            status: row.status,
            stake_minor: parseInt(row.stake_minor, 10),
            payout_minor: parseInt(row.payout_minor, 10),
            entry_price: row.entry_price.toString(),
            exit_price: row.exit_price ? row.exit_price.toString() : undefined,
            opened_at: new Date(row.opened_at),
            expires_at: new Date(row.expires_at),
            idempotency_key: row.idempotency_key
        }));
    }
    /**
     * Consulta detalhes de um contrato com escopo de segurança obrigatório (S-04)
     */
    async getContractById(userId, contractId) {
        const res = await this.pool.query(`SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, exit_price, opened_at, expires_at, idempotency_key
       FROM contracts
       WHERE id = $1 AND user_id = $2;`, [contractId, userId]);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        return {
            id: row.id,
            user_id: row.user_id,
            symbol: row.symbol,
            direction: row.direction,
            status: row.status,
            stake_minor: parseInt(row.stake_minor, 10),
            payout_minor: parseInt(row.payout_minor, 10),
            entry_price: row.entry_price.toString(),
            exit_price: row.exit_price ? row.exit_price.toString() : undefined,
            opened_at: new Date(row.opened_at),
            expires_at: new Date(row.expires_at),
            idempotency_key: row.idempotency_key
        };
    }
}
