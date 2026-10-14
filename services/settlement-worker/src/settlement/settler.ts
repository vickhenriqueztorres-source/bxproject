import pg from "pg";
const { Pool } = pg;
type Pool = pg.Pool;
import { Redis } from "ioredis";
import { PayoutCalculator, Direction } from "./payout-calculator.js";
import { BlnkClient } from "@broker/wallet-adapter";
import { isMarketOpen } from "./calendar.js";

export interface SettlerOptions {
  maxExitTickLagMs?: number; // Padrão: 30000ms (30s)
}

export class ContractSettler {
  private pool: Pool;
  private redis: Redis;
  private blnkClient: BlnkClient;
  private consumerName: string;
  private maxExitTickLagMs: number;

  readonly STREAM_KEY = "stream:contracts:expiring";
  readonly GROUP_NAME = "cg:settlement";

  constructor(
    pool: Pool,
    redis: Redis,
    blnkClient: BlnkClient,
    consumerName: string,
    options: SettlerOptions = {}
  ) {
    this.pool = pool;
    this.redis = redis;
    this.blnkClient = blnkClient;
    this.consumerName = consumerName;
    this.maxExitTickLagMs = options.maxExitTickLagMs ?? 30_000;
  }

  /**
   * Processa a liquidação de um contrato específico com bloqueio pessimista (B-08, DB-07, I-04)
   */
  async settleContract(contractId: string): Promise<{ success: boolean; reason?: string }> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Bloqueio pessimista com SKIP LOCKED para prevenir concorrência entre workers
      const lockRes = await client.query(
        `SELECT id, user_id, symbol, direction, status, stake_minor, entry_price, entry_tick_sequence, opened_at, expires_at
         FROM contracts
         WHERE id = $1
         FOR UPDATE SKIP LOCKED;`,
        [contractId]
      );

      if (lockRes.rows.length === 0) {
        // Outro worker já bloqueou ou contrato não existe
        await client.query("COMMIT");
        return { success: false, reason: "ALREADY_LOCKED_OR_NOT_FOUND" };
      }

      const contract = lockRes.rows[0];

      // Idempotência e Máquina de Estados (Perigo 5 — Técnicas 3 e 4):
      if (contract.status === "SETTLED") {
        await client.query("COMMIT");
        await this.redis.zrem("contracts:pending", contractId);
        return { success: true, reason: "ALREADY_SETTLED" };
      }

      if (contract.status === "CANCELLED") {
        await client.query("COMMIT");
        await this.redis.zrem("contracts:pending", contractId);
        return { success: true, reason: "ALREADY_CANCELLED" };
      }

      if (contract.status !== "OPEN" && contract.status !== "EXPIRING") {
        await client.query("ROLLBACK");
        return { success: false, reason: "INVALID_CONTRACT_STATE_TRANSITION" };
      }

      // 2. Validação de Sessão de Mercado (Perigo 7 / Técnica 4)
      if (!isMarketOpen(contract.symbol, contract.expires_at)) {
        await client.query("ROLLBACK");
        return { success: false, reason: "MARKET_CLOSED_AT_EXPIRY" };
      }

      // 3. Busca rigorosa do primeiro tick oficial gravado no PostgreSQL onde ts >= expires_at (B-08)
      const tickRes = await client.query(
        `SELECT symbol, sequence, price, ts
         FROM ticks
         WHERE symbol = $1
           AND ts >= $2
         ORDER BY sequence ASC
         LIMIT 1;`,
        [contract.symbol, contract.expires_at]
      );

      if (tickRes.rows.length === 0) {
        // O tick oficial de saída ainda não foi gravado! ROLLBACK para retentar no próximo ciclo (sem inventar preço)
        await client.query("ROLLBACK");
        return { success: false, reason: "EXIT_TICK_NOT_YET_AVAILABLE" };
      }

      const exitTick = tickRes.rows[0];

      // Perigo 5 (Técnica 2): Asserção estrita anti-cross-asset (tick.symbol === contract.symbol)
      if (exitTick.symbol && exitTick.symbol !== contract.symbol) {
        await client.query("ROLLBACK");
        return { success: false, reason: "CROSS_ASSET_TICK_MISMATCH" };
      }

      // Perigo 5 (Técnica 2): Validação de progressão monotônica de sequência em relação à entrada
      const exitSeq = BigInt(exitTick.sequence);
      if (
        contract.entry_tick_sequence !== undefined &&
        contract.entry_tick_sequence !== null &&
        exitSeq < BigInt(contract.entry_tick_sequence)
      ) {
        await client.query("ROLLBACK");
        return { success: false, reason: "EXIT_TICK_SEQUENCE_REGRESSION" };
      }

      // Perigo 5 (Técnica 2): Validação temporal do tick de saída (ts >= expires_at e não stale)
      const expiresAtMs = new Date(contract.expires_at).getTime();
      const exitTickMs = new Date(exitTick.ts).getTime();
      if (Number.isFinite(expiresAtMs) && Number.isFinite(exitTickMs)) {
        const exitTickLagMs = exitTickMs - expiresAtMs;
        if (exitTickLagMs < -5) {
          await client.query("ROLLBACK");
          return { success: false, reason: "EXIT_TICK_BEFORE_EXPIRY" };
        }
        if (exitTickLagMs > this.maxExitTickLagMs) {
          await client.query("ROLLBACK");
          return { success: false, reason: "STALE_EXIT_TICK" };
        }
      }

      if (!isMarketOpen(contract.symbol, exitTick.ts)) {
        await client.query("ROLLBACK");
        return { success: false, reason: "TICK_OUT_OF_SESSION" };
      }

      const exitPrice = exitTick.price.toString();

      // 3. Determinação de resultado e cálculo de payout com inteiros (D-19)
      const result = PayoutCalculator.determineResult(
        contract.direction as Direction,
        contract.entry_price.toString(),
        exitPrice
      );

      const stakeMinor = parseInt(contract.stake_minor, 10);
      const calc = PayoutCalculator.calculatePayout(result, stakeMinor);

      // 4. Atualização atômica do status do contrato no PostgreSQL
      await client.query(
        `UPDATE contracts
         SET status = 'SETTLED',
             result = $1,
             exit_price = $2,
             exit_tick_sequence = $3,
             payout_minor = $4,
             settled_at = NOW()
         WHERE id = $5;`,
        [result, exitPrice, exitSeq.toString(), calc.payout_minor, contractId]
      );

      // 5. Inserção do evento de auditoria no Transactional Outbox
      const outboxPayload = JSON.stringify({
        contract_id: contractId,
        user_id: contract.user_id,
        symbol: contract.symbol,
        direction: contract.direction,
        entry_price: contract.entry_price.toString(),
        exit_price: exitPrice,
        exit_tick_sequence: exitSeq.toString(),
        result,
        stake_minor: stakeMinor,
        payout_minor: calc.payout_minor,
        profit_minor: calc.profit_minor
      });

      await client.query(
        `INSERT INTO outbox_events (event_type, payload, status)
         VALUES ('CONTRACT_SETTLED', $1, 'PENDING');`,
        [outboxPayload]
      );

      await client.query("COMMIT");

      // 6. Pós-Commit: remove do Sorted Set de pendências
      await this.redis.zrem("contracts:pending", contractId);

      // 7. Liberação contábil no Blnk Ledger (partidas dobradas)
      try {
        await this.blnkClient.settleContract(
          contractId,
          contract.user_id,
          result,
          stakeMinor,
          calc.payout_minor
        );
      } catch (blnkErr) {
        console.error(`[Settler] Warning: Blnk ledger settlement failed for ${contractId}:`, blnkErr);
      }

      // 8. Publica no Redis Pub/Sub para notificação imediata do WebSocket Gateway
      await this.redis.publish(`market:events:${contract.symbol}`, JSON.stringify({
        event: "CONTRACT_SETTLED",
        contract_id: contractId,
        user_id: contract.user_id,
        result,
        stake_minor: stakeMinor,
        payout_minor: calc.payout_minor,
        profit_minor: calc.profit_minor,
        exit_price: exitPrice
      }));

      return { success: true };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Consome lote do Redis Stream com XREADGROUP e processa cada contrato
   */
  async processBatch(count: number = 20, blockMs: number = 1000): Promise<number> {
    const raw = await this.redis.xreadgroup(
      "GROUP",
      this.GROUP_NAME,
      this.consumerName,
      "COUNT",
      count,
      "BLOCK",
      blockMs,
      "STREAMS",
      this.STREAM_KEY,
      ">"
    );

    if (!raw || !Array.isArray(raw)) return 0;

    let processedCount = 0;

    for (const [_stream, entries] of raw as any[]) {
      for (const [msgId, fields] of entries) {
        let contractId = "";
        for (let i = 0; i < fields.length; i += 2) {
          if (fields[i] === "contract_id") {
            contractId = fields[i + 1];
            break;
          }
        }

        if (contractId) {
          const outcome = await this.settleContract(contractId);
          // Se liquidou com sucesso ou já estava liquidado, confirma mensagem no Stream
          if (outcome.success) {
            await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
            processedCount++;
          }
          // Se o tick ainda não estava disponível, NÃO damos XACK (reprocessará após tick chegar)
        } else {
          await this.redis.xack(this.STREAM_KEY, this.GROUP_NAME, msgId);
        }
      }
    }

    return processedCount;
  }
}
