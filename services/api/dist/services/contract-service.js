"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractService = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
const risk_manager_js_1 = require("./risk-manager.js");
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
        // 2. Obtém o último tick oficial gravado no PostgreSQL (ou cache)
        const tickRes = await this.pool.query(`SELECT price, ts FROM ticks WHERE symbol = $1 ORDER BY sequence DESC LIMIT 1;`, [dto.symbol]);
        let entryPrice = "100.000000";
        let baseTime = new Date();
        if (tickRes.rows.length > 0) {
            entryPrice = tickRes.rows[0].price.toString();
            baseTime = new Date(tickRes.rows[0].ts);
        }
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
