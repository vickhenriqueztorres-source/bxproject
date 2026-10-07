"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractService = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const risk_manager_js_1 = require("./risk-manager.js");
const trading_calendar_js_1 = require("./trading-calendar.js");
class ContractService {
    pool;
    redis;
    riskManager;
    constructor(pool, redis) {
        this.pool = pool;
        this.redis = redis;
        this.riskManager = new risk_manager_js_1.RiskManager(redis);
    }
    /**
     * Abre um contrato com checagem de idempotência, teto de risco e persistência ACID (B-01, B-05, I-03)
     */
    async openContract(userId, idempotencyKey, dto) {
        // 1. Verifica se já existe contrato com esta Idempotency-Key para o usuário
        const existingRes = await this.pool.query(`SELECT id, user_id, symbol, direction, status, stake_minor, payout_minor, entry_price, opened_at, expires_at, idempotency_key
       FROM contracts
       WHERE user_id = $1 AND idempotency_key = $2;`, [userId, idempotencyKey]);
        if (existingRes.rows.length > 0) {
            const row = existingRes.rows[0];
            return {
                contract: {
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
                },
                isDuplicate: true
            };
        }
        // 2. Verificação imediata de Kill Switch no Redis (<1ms) - Subetapa 5
        if (await this.riskManager.isKillSwitchActive(dto.symbol)) {
            throw new Error(`KILLSWITCH_ACTIVE: Kill switch ativo para ${dto.symbol} por instabilidade no feed.`);
        }
        // 2.1. Validação de Sessão de Mercado (Perigo 7 / Técnica 4)
        if (!(0, trading_calendar_js_1.isMarketOpen)(dto.symbol, new Date())) {
            throw new Error(`MARKET_CLOSED: Mercado fechado para o ativo ${dto.symbol} no momento da abertura.`);
        }
        // Obtém o último estado atômico gravado em index_state com validação estrita de staleness (M-02, B-01)
        const stateRes = await this.pool.query(`SELECT last_sequence, last_price, last_ts FROM index_state WHERE symbol = $1;`, [dto.symbol]);
        if (stateRes.rows.length === 0 || Number(stateRes.rows[0].last_sequence) <= 0) {
            throw new Error(`TICK_UNAVAILABLE: Nenhum tick oficial registrado para o ativo ${dto.symbol}`);
        }
        const lastTs = new Date(stateRes.rows[0].last_ts);
        const tickAgeMs = Date.now() - lastTs.getTime();
        const MAX_TICK_AGE_MS = 5000;
        if (tickAgeMs > MAX_TICK_AGE_MS) {
            // Dispara Kill Switch automático por 10s no Redis e emite auditoria estruturada
            await this.riskManager.activateKillSwitch(dto.symbol, "STALE_FEED", 10);
            console.warn(JSON.stringify({
                event: "KILL_SWITCH_TRIGGERED",
                symbol: dto.symbol,
                reason: "STALE_FEED",
                tick_age_ms: tickAgeMs,
                timestamp: new Date().toISOString()
            }));
            throw new Error(`KILLSWITCH_ACTIVE: Cotação para ${dto.symbol} desatualizada há ${tickAgeMs}ms (limite: ${MAX_TICK_AGE_MS}ms). Kill switch acionado.`);
        }
        const entryPrice = stateRes.rows[0].last_price.toString();
        const baseTime = lastTs;
        // Expiração em 60 segundos (D-10)
        const expiresAt = new Date(baseTime.getTime() + 60000);
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
            return { contract, isDuplicate: false };
        }
        catch (err) {
            await client.query("ROLLBACK");
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
exports.ContractService = ContractService;
