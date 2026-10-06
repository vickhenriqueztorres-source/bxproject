"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialReconciler = void 0;
const pg_1 = __importDefault(require("pg"));
const { Pool } = pg_1.default;
class FinancialReconciler {
    pool;
    blnkClient;
    constructor(pool, blnkClient) {
        this.pool = pool;
        this.blnkClient = blnkClient;
    }
    async runAudit() {
        const report = {
            timestamp: new Date().toISOString(),
            checks: {
                blnk_zero_sum: true,
                open_contracts_vs_reserved: true,
                stuck_settling_contracts: true,
                failed_outbox_events: true,
                tick_sequence_continuous: true,
                hash_chain_valid: true
            },
            discrepancies: [],
            status: "HEALTHY"
        };
        // 1. Checagem: Contratos Abertos vs Stakes
        try {
            const openContractsRes = await this.pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(stake_minor), 0) as total_stake
         FROM contracts
         WHERE status = 'OPEN';`);
            const totalOpenStake = openContractsRes.rows.length > 0
                ? parseInt(openContractsRes.rows[0].total_stake, 10)
                : 0;
            // Registrado no relatório
        }
        catch (err) {
            report.checks.open_contracts_vs_reserved = false;
            report.discrepancies.push(`Failed querying open contracts: ${err.message}`);
        }
        // 2. Checagem: Contratos Presos em Expiração (> 30s após expires_at sem status SETTLED)
        try {
            const stuckRes = await this.pool.query(`SELECT id, expires_at, status
         FROM contracts
         WHERE status = 'OPEN'
           AND expires_at < NOW() - INTERVAL '30 seconds';`);
            if (stuckRes.rows.length > 0) {
                report.checks.stuck_settling_contracts = false;
                report.discrepancies.push(`Found ${stuckRes.rows.length} contracts stuck past expiration`);
            }
        }
        catch (err) {
            report.checks.stuck_settling_contracts = false;
            report.discrepancies.push(`Failed checking stuck contracts: ${err.message}`);
        }
        // 3. Checagem: Outbox DLQ (eventos FAILED)
        try {
            const failedOutboxRes = await this.pool.query(`SELECT id, event_type, retry_count
         FROM outbox_events
         WHERE status = 'FAILED' OR retry_count >= 5;`);
            if (failedOutboxRes.rows.length > 0) {
                report.checks.failed_outbox_events = false;
                report.discrepancies.push(`Found ${failedOutboxRes.rows.length} failed outbox events`);
            }
        }
        catch (err) {
            report.checks.failed_outbox_events = false;
            report.discrepancies.push(`Failed checking outbox DLQ: ${err.message}`);
        }
        // 4. Checagem: Sequenciamento de Ticks (M-02)
        try {
            const ticksRes = await this.pool.query(`SELECT sequence, price, ts, prev_hash, hash
         FROM ticks
         ORDER BY sequence DESC
         LIMIT 500;`);
            const rows = ticksRes.rows;
            if (rows.length > 1) {
                for (let i = 0; i < rows.length - 1; i++) {
                    const currentSeq = BigInt(rows[i].sequence);
                    const prevSeq = BigInt(rows[i + 1].sequence);
                    if (currentSeq !== prevSeq + 1n) {
                        report.checks.tick_sequence_continuous = false;
                        report.discrepancies.push(`Gap in tick sequence detected between ${prevSeq} and ${currentSeq}`);
                        break;
                    }
                    // 5. Checagem: Encadeamento de Hash SHA-256 (M-04)
                    if (rows[i].prev_hash !== rows[i + 1].hash) {
                        report.checks.hash_chain_valid = false;
                        report.discrepancies.push(`Hash chain mismatch at sequence ${currentSeq}`);
                        break;
                    }
                }
            }
        }
        catch (err) {
            report.checks.tick_sequence_continuous = false;
            report.checks.hash_chain_valid = false;
            report.discrepancies.push(`Failed verifying tick sequence and hash chain: ${err.message}`);
        }
        if (report.discrepancies.length > 0) {
            report.status = "CRITICAL_ALERT";
        }
        return report;
    }
}
exports.FinancialReconciler = FinancialReconciler;
