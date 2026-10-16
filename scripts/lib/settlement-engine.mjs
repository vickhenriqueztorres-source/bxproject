/**
 * Motor Determinístico de Liquidação de Contratos (Subetapa 1)
 * Skills aplicadas:
 * - 02-financial-invariants (I-01, I-02, I-03, I-04, I-05)
 * - 03-synthetic-market-engine (M-03: Primeiro tick oficial com event_time >= expires_at)
 * - 05-resilience-patterns (R-02, R-03: Sweeper com recuperação pós-restart e backoff de banco)
 */

import { getAssetConfig } from './ou-engine.mjs';

export const TICK_HISTORY_MAX_SIZE = 900; // 15 minutos de ticks de 1s por ativo

/**
 * Registra cada tick gerado no histórico circular do ativo em memória
 * para garantir captura exata do primeiro tick com event_time >= expires_at.
 */
export function recordTickInHistory(state, tickEntry) {
  if (!state) return;
  if (!Array.isArray(state.tickHistory)) {
    state.tickHistory = [];
  }
  state.tickHistory.push({
    sequence: Number(tickEntry.sequence),
    price: String(tickEntry.price),
    priceNum: parseFloat(tickEntry.price),
    event_time: Number(tickEntry.event_time),
    ts: String(tickEntry.ts),
  });
  if (state.tickHistory.length > TICK_HISTORY_MAX_SIZE) {
    state.tickHistory.shift();
  }
}

/**
 * Localiza por busca binária O(log N) o primeiro tick oficial do ativo
 * cujo event_time >= expiresAtMs (Invariante M-03 / Regra 3.3).
 *
 * @param {object} state Estado do ativo em assetState
 * @param {number} expiresAtMs Timestamp epoch (ms) do vencimento do contrato
 * @param {number|string} fallbackPrice Preço de contingência caso histórico esteja vazio
 * @returns {{ exitPrice: number, tickSequence: number|null, tickEventTime: number|null, source: string }}
 */
export function resolveExitPriceAtExpiry(state, expiresAtMs, fallbackPrice) {
  const safeFallback = Number.isFinite(Number(fallbackPrice)) ? Number(fallbackPrice) : 0;
  if (!state) {
    return {
      exitPrice: safeFallback,
      tickSequence: null,
      tickEventTime: null,
      source: 'fallback_no_state',
    };
  }

  const history = state.tickHistory;
  if (Array.isArray(history) && history.length > 0) {
    // Busca binária pelo primeiro elemento com event_time >= expiresAtMs
    let low = 0;
    let high = history.length - 1;
    let foundIdx = -1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (history[mid].event_time >= expiresAtMs) {
        foundIdx = mid;
        high = mid - 1; // Tenta encontrar um tick ainda mais próximo do início (>= expiresAtMs)
      } else {
        low = mid + 1;
      }
    }

    if (foundIdx !== -1) {
      const matchedTick = history[foundIdx];
      return {
        exitPrice: matchedTick.priceNum,
        tickSequence: matchedTick.sequence,
        tickEventTime: matchedTick.event_time,
        source: 'tick_history_exact',
      };
    }

    // Se todos os ticks do histórico têm event_time < expiresAtMs, mas já passou do vencimento,
    // retorna o tick mais recente disponível
    const latestTick = history[history.length - 1];
    if (latestTick && Number.isFinite(latestTick.priceNum)) {
      return {
        exitPrice: latestTick.priceNum,
        tickSequence: latestTick.sequence,
        tickEventTime: latestTick.event_time,
        source: 'tick_history_latest',
      };
    }
  }

  const currentParsed = parseFloat(state.currentPrice);
  return {
    exitPrice: Number.isFinite(currentParsed) ? currentParsed : safeFallback,
    tickSequence: state.sequence ?? null,
    tickEventTime: state.lastTs ?? null,
    source: 'state_current_price',
  };
}

/**
 * Resolve o payout_pct gravado no contrato no momento da abertura.
 * Se contratos antigos não tiverem payout_pct gravado, usa 85 apenas para eles com log de aviso (P1-1).
 */
export function resolveContractPayoutPct(contractRow, contractId = 'unknown') {
  const raw = contractRow?.payout_pct ?? contractRow?.payoutPct;
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    console.warn(
      `[Settlement Legacy Payout] Contrato antigo ${contractId} sem payout_pct gravado; usando fallback 85`
    );
    return 85;
  }
  return Number(raw);
}

/**
 * P1-2: Converte um preço (string decimal ou number) para inteiro escalado (BigInt)
 * pela precisão do ativo (getAssetConfig(symbol).decimals), eliminando erros de IEEE-754.
 */
export function scalePriceToBigInt(price, decimals = 6) {
  const d = Number.isInteger(decimals) && decimals >= 0 ? decimals : 6;
  if (typeof price === 'bigint') {
    return price;
  }
  if (typeof price === 'string') {
    const trimmed = price.trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
      const sign = trimmed.startsWith('-') ? -1n : 1n;
      const unsigned = trimmed.replace(/^[+-]/, '');
      const [whole, rawFrac = ''] = unsigned.split('.');
      const strippedFrac = rawFrac.length > d ? rawFrac.replace(/0+$/, '') : rawFrac;
      if (strippedFrac.length <= d) {
        const paddedFrac = strippedFrac.padEnd(d, '0');
        return sign * BigInt(whole + paddedFrac);
      }
    }
  }
  const num = Number(price);
  if (!Number.isFinite(num)) {
    throw new Error(`INVALID_PRICE: ${String(price)}`);
  }
  return BigInt(Math.round(num * 10 ** d));
}

/**
 * Calcula de forma pura e determinística o resultado e o payout em centavos (minor units).
 * P1-1: Usa aritmética inteira exata: payoutMinor = stake + Math.floor((stake * payoutPct) / 100).
 * P1-2: Compara entryPrice e exitPrice convertidos para inteiro escalado pela precisão do ativo.
 */
export function computeContractOutcome({
  direction,
  entryPrice,
  exitPrice,
  stakeMinor,
  payoutPct,
  symbol,
  decimals,
}) {
  if (
    payoutPct === null ||
    payoutPct === undefined ||
    typeof payoutPct === 'boolean' ||
    (typeof payoutPct === 'string' && payoutPct.trim() === '')
  ) {
    throw new Error('INVALID_PAYOUT_PCT: payoutPct obrigatório em [0, 100]');
  }
  const pct = Number(payoutPct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    throw new Error(`INVALID_PAYOUT_PCT: valor fora de [0, 100] (${String(payoutPct)})`);
  }

  const assetCfg = symbol ? getAssetConfig(symbol) : null;
  const resolvedDecimals =
    Number.isInteger(decimals) && decimals >= 0
      ? decimals
      : assetCfg?.decimals ?? assetCfg?.precision ?? 6;

  const entryScaled = scalePriceToBigInt(entryPrice, resolvedDecimals);
  const exitScaled = scalePriceToBigInt(exitPrice, resolvedDecimals);

  const entry = Number(entryPrice);
  const exit = Number(exitPrice);
  const stake = parseInt(stakeMinor, 10);
  const isUp = direction === 'UP';
  const won = (isUp && exitScaled > entryScaled) || (!isUp && exitScaled < entryScaled);
  const draw = exitScaled === entryScaled;
  const result = won ? 'WIN' : draw ? 'DRAW' : 'LOSS';
  const payoutMinor = won ? stake + Math.floor((stake * pct) / 100) : draw ? stake : 0;

  return {
    result,
    payoutMinor,
    payoutPct: pct,
    entryPrice: entry,
    exitPrice: exit,
    stakeMinor: stake,
  };
}

/**
 * Serializa de forma única e canônica qualquer linha do banco ou objeto de contrato em memória (Relatório #12).
 * Invariantes invioláveis:
 * - entry_price: preço oficial de entrada (sempre numérico).
 * - strike_price: alias legado de entry_price (SEMPRE igual a entry_price, nunca sobrescrito por exit_price).
 * - exit_price: null enquanto status === 'OPEN'; preço oficial de saída quando 'SETTLED'.
 * - entry_tick_sequence / exit_tick_sequence: sequences oficiais dos ticks de abertura e liquidação.
 */
export function serializeContract(row) {
  if (!row || typeof row !== 'object') return null;
  const entryPrice = Number(row.entry_price ?? row.strike_price);
  const isOpen = row.status === 'OPEN';
  const rawExit = isOpen ? null : row.exit_price;
  const exitPrice =
    rawExit !== null && rawExit !== undefined && Number.isFinite(Number(rawExit))
      ? Number(rawExit)
      : null;
  const entryTickSequence =
    row.entry_tick_sequence !== null &&
    row.entry_tick_sequence !== undefined &&
    Number.isFinite(Number(row.entry_tick_sequence))
      ? Number(row.entry_tick_sequence)
      : null;
  const exitTickSequence =
    !isOpen &&
    row.exit_tick_sequence !== null &&
    row.exit_tick_sequence !== undefined &&
    Number.isFinite(Number(row.exit_tick_sequence))
      ? Number(row.exit_tick_sequence)
      : null;

  const toIsoOrKeep = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString();
    return String(val);
  };

  const serialized = {
    id: String(row.id),
    user_id: row.user_id ?? undefined,
    symbol: row.symbol,
    direction: row.direction,
    status: row.status || 'OPEN',
    result: isOpen ? null : (row.result || null),
    stake_minor: Number(row.stake_minor),
    payout_pct:
      row.payout_pct !== null && row.payout_pct !== undefined && Number.isFinite(Number(row.payout_pct))
        ? Number(row.payout_pct)
        : 85,
    payout_minor:
      !isOpen && row.payout_minor !== null && row.payout_minor !== undefined
        ? Number(row.payout_minor)
        : null,
    entry_price: entryPrice,
    strike_price: entryPrice,
    exit_price: exitPrice,
    entry_tick_sequence: entryTickSequence,
    exit_tick_sequence: exitTickSequence,
    expires_at: toIsoOrKeep(row.expires_at),
    created_at: toIsoOrKeep(row.created_at || row.opened_at),
    opened_at: toIsoOrKeep(row.opened_at || row.created_at),
    settled_at: isOpen ? null : toIsoOrKeep(row.settled_at),
  };

  if (row.duration_seconds !== undefined) {
    serialized.duration_seconds = Number(row.duration_seconds);
  }
  if (row.expiry_mode !== undefined) {
    serialized.expiry_mode = row.expiry_mode;
  }
  if (row.idempotency_key !== undefined) {
    serialized.idempotency_key = row.idempotency_key;
  }
  return serialized;
}

/**
 * Regra de Fonte da Verdade (P0-1 Passo 2b/2c/2d):
 * - Modo 1: BLNK_LEDGER (blnkEnabled === true e instância blnk válida):
 *   O Blnk Ledger é a única fonte da verdade contábil (para DEMO e REAL).
 *   NÃO debita nem credita users.demo_balance_minor localmente (zero débito/crédito duplo).
 * - Modo 2: POSTGRES_DEMO_FALLBACK (blnkEnabled === false):
 *   A coluna users.demo_balance_minor no PostgreSQL é a única fonte da verdade para contas DEMO.
 *   Contas REAL são bloqueadas com 503 LEDGER_UNAVAILABLE.
 */
export function isBlnkLedgerActive(blnk, blnkEnabled) {
  const resolvedFlag = typeof blnkEnabled === 'function' ? blnkEnabled() : blnkEnabled;
  if (resolvedFlag === false) return false;
  if (resolvedFlag === true) return Boolean(blnk);
  return Boolean(blnk && typeof blnk.settleContract === 'function');
}

/**
 * Executa a abertura atômica de contrato respeitando a fonte única da verdade (P0-1 Passo 2a/2b/2c):
 * - Se conta REAL e Blnk desativado -> recusa imediatamente com 503 LEDGER_UNAVAILABLE.
 * - Se Blnk ativo (BLNK_LEDGER) -> reserva no Blnk e persiste contrato + outbox PROCESSED sem tocar em users.demo_balance_minor.
 * - Se Blnk desativado (POSTGRES_DEMO_FALLBACK) -> dentro da MESMA transação (BEGIN ... COMMIT) do INSERT INTO contracts,
 *   executa UPDATE users SET demo_balance_minor = demo_balance_minor - $1 WHERE id = $2 AND demo_balance_minor >= $1 RETURNING demo_balance_minor.
 *   Se rowCount === 0 -> ROLLBACK e retorna 400 INSUFFICIENT_BALANCE.
 */
export async function executeAtomicContractOpen({
  pgPool,
  blnk,
  blnkEnabled = false,
  contractId,
  userId,
  symbol,
  direction,
  stakeMinor,
  payoutPct = 85,
  entryPrice,
  entryTickSequence,
  entryTickHash,
  idempotencyKey,
  expiresAt,
  accountType = 'DEMO',
  onWalletMutated,
}) {
  const normalizedAccountType = String(accountType || 'DEMO').trim().toUpperCase();
  const blnkActive = isBlnkLedgerActive(blnk, blnkEnabled);

  // Passo 2c: Conta REAL exige Blnk Ledger ativo — jamais abrir contrato real sem ledger
  if (normalizedAccountType === 'REAL' && !blnkActive) {
    return {
      ok: false,
      statusCode: 503,
      errorBody: {
        code: 'LEDGER_UNAVAILABLE',
        message: 'Blnk Ledger obrigatório para abertura de contrato em conta REAL',
      },
    };
  }

  let newSyncedBalanceMinor = undefined;

  // Passo 2b: Modo BLNK_LEDGER — reserva no Blnk sem debitar users.demo_balance_minor localmente
  if (userId && blnkActive) {
    try {
      let blnkBal;
      try {
        blnkBal = await blnk.getBalance(userId);
      } catch (balErr) {
        if (
          String(balErr.message).includes('404') ||
          String(balErr.message).includes('not found')
        ) {
          if (typeof blnk.onboardUser === 'function') {
            await blnk.onboardUser(userId);
          }
          blnkBal = await blnk.getBalance(userId);
        } else {
          throw balErr;
        }
      }
      if (!blnkBal || Number(blnkBal.available_minor) < stakeMinor) {
        return {
          ok: false,
          statusCode: 400,
          errorBody: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Saldo insuficiente no Blnk Ledger',
          },
        };
      }
      await blnk.reserveStake(userId, contractId, stakeMinor);
      newSyncedBalanceMinor = Number(blnkBal.available_minor) - stakeMinor;
      if (typeof onWalletMutated === 'function') {
        onWalletMutated(userId, newSyncedBalanceMinor);
      }
    } catch (blnkReserveErr) {
      if (
        String(blnkReserveErr.message).includes('422') ||
        String(blnkReserveErr.message).includes('INSUFFICIENT_BALANCE')
      ) {
        return {
          ok: false,
          statusCode: 400,
          errorBody: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Saldo insuficiente no Blnk Ledger',
          },
        };
      }
      return {
        ok: false,
        statusCode: 503,
        errorBody: {
          code: 'LEDGER_UNAVAILABLE',
          message: 'Blnk Ledger indisponível',
        },
      };
    }
  }

  // Passo 2a: Persistência Atômica ACID no PostgreSQL (Débito sem Blnk + INSERT INTO contracts + Outbox na MESMA transação)
  if (userId && pgPool) {
    let dbClient = null;
    try {
      dbClient = await pgPool.connect();
      await dbClient.query('BEGIN');

      if (!blnkActive) {
        const debitRes = await dbClient.query(
          `UPDATE users
           SET demo_balance_minor = demo_balance_minor - $1, updated_at = NOW()
           WHERE id = $2 AND demo_balance_minor >= $1
           RETURNING demo_balance_minor`,
          [stakeMinor, userId]
        );
        if (debitRes.rowCount === 0) {
          await dbClient.query('ROLLBACK');
          return {
            ok: false,
            statusCode: 400,
            errorBody: {
              code: 'INSUFFICIENT_BALANCE',
              message: 'Saldo insuficiente',
            },
          };
        }
        newSyncedBalanceMinor = Number(debitRes.rows[0].demo_balance_minor);
      }

      await dbClient.query(
        `INSERT INTO contracts (
          id, user_id, symbol, direction, status, stake_minor, entry_price,
          idempotency_key, opened_at, expires_at, created_at, entry_tick_sequence, payout_pct
        ) VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, NOW(), $8, NOW(), $9, $10)`,
        [
          contractId,
          userId,
          symbol,
          direction,
          stakeMinor,
          entryPrice,
          idempotencyKey,
          expiresAt,
          entryTickSequence,
          payoutPct,
        ]
      );

      const outboxPayload = JSON.stringify({
        contract_id: contractId,
        user_id: userId,
        stake_minor: stakeMinor,
        payout_pct: payoutPct,
        symbol,
        entry_price: entryPrice,
        entry_tick_sequence: entryTickSequence,
        entry_tick_hash: entryTickHash,
        reference: `reserve:${contractId}`,
      });

      await dbClient.query(
        `INSERT INTO outbox_events (event_type, payload, status, processed_at)
         VALUES ('RESERVE_STAKE', $1::jsonb, 'PROCESSED', NOW())`,
        [outboxPayload]
      );

      await dbClient.query('COMMIT');
      if (!blnkActive && typeof onWalletMutated === 'function') {
        onWalletMutated(userId, newSyncedBalanceMinor);
      }
      return {
        ok: true,
        persistedInDb: true,
        newBalanceMinor: newSyncedBalanceMinor,
      };
    } catch (dbErr) {
      if (dbClient) {
        try {
          await dbClient.query('ROLLBACK');
        } catch (_) {}
      }
      if (userId && blnkActive && typeof blnk?.releaseReservedStake === 'function') {
        try {
          await blnk.releaseReservedStake(userId, contractId, stakeMinor);
          if (typeof onWalletMutated === 'function') {
            onWalletMutated(userId);
          }
        } catch (_) {}
      }
      return {
        ok: false,
        statusCode: 500,
        dbError: dbErr,
        errorBody: {
          code: 'DB_TRANSACTION_FAILED',
          message: 'Falha na gravação atômica do contrato',
        },
      };
    } finally {
      if (dbClient) {
        try {
          dbClient.release();
        } catch (_) {}
      }
    }
  }

  return {
    ok: true,
    persistedInDb: false,
    newBalanceMinor: newSyncedBalanceMinor,
  };
}

/**
 * Cria o coordenador resiliente de liquidação (Sweeper + Trigger Direto Idempotente).
 */
export function createSettlementCoordinator({
  assetState,
  resolveSymbol,
  devContracts,
  devWallet,
  pgPool,
  blnk,
  blnkEnabled,
  wss,
  WebSocket,
  onWalletMutated,
}) {
  const settlingContractIds = new Set();
  const settledContractIdsCache = new Set();
  let isSweeping = false;
  let dbRecoveryBackoffUntil = 0;

  const telemetry = {
    sweeperRunsTotal: 0,
    contractsSettledByTimerTotal: 0,
    contractsSettledBySweeperTotal: 0,
    contractsRecoveredFromDbTotal: 0,
    duplicateSettlementPreventedTotal: 0,
  };

  /**
   * Liquida um único contrato de maneira estritamente atômica e idempotente (I-03, I-04).
   */
  async function settleOpenContract(contractInput, triggerSource = 'sweeper', nowMs = Date.now()) {
    if (!contractInput || !contractInput.id) {
      return { settled: false, reason: 'INVALID_CONTRACT' };
    }

    const contractId = String(contractInput.id);

    // 1. Trava rápida de idempotência e concorrência em memória
    if (settledContractIdsCache.has(contractId)) {
      telemetry.duplicateSettlementPreventedTotal += 1;
      return { settled: false, reason: 'ALREADY_SETTLED' };
    }
    if (settlingContractIds.has(contractId)) {
      telemetry.duplicateSettlementPreventedTotal += 1;
      return { settled: false, reason: 'IN_FLIGHT_SETTLEMENT' };
    }

    const memTarget = devContracts.find((c) => c.id === contractId);
    const target = memTarget || contractInput;

    if (target.status && target.status !== 'OPEN') {
      settledContractIdsCache.add(contractId);
      telemetry.duplicateSettlementPreventedTotal += 1;
      return { settled: false, reason: 'ALREADY_SETTLED_STATUS' };
    }

    const expiresAtMs = typeof target.expires_at === 'number'
      ? target.expires_at
      : Date.parse(target.expires_at);

    if (Number.isFinite(expiresAtMs) && nowMs < expiresAtMs) {
      return { settled: false, reason: 'NOT_EXPIRED_YET' };
    }

    settlingContractIds.add(contractId);

    try {
      const canonicalSymbol = resolveSymbol(target.symbol);
      const state = assetState.get(canonicalSymbol);
      let entryPrice = Number(target.entry_price);
      let stake = parseInt(target.stake_minor, 10);
      let userId = target.user_id || null;
      const isAuthenticatedUser = Boolean(userId && userId !== 'guest-demo');
      const hasRealPg = Boolean(pgPool && typeof pgPool.connect === 'function');

      let exitPrice = null;
      let exitTickSequence = null;
      let result = null;
      let payoutMinor = null;
      let tickSource = 'postgres_official_tick';
      let updatedUserBalance = null;

      if (hasRealPg && isAuthenticatedUser) {
        let dbClient = null;
        try {
          dbClient = await pgPool.connect();
          await dbClient.query('BEGIN');

          const lockRes = await dbClient.query(
            `SELECT id, user_id, symbol, direction, status, stake_minor, payout_pct, entry_price, expires_at
             FROM contracts
             WHERE id = $1
             FOR UPDATE`,
            [contractId]
          );

          if (lockRes.rowCount === 0) {
            await dbClient.query('ROLLBACK');
            return { settled: false, reason: 'CONTRACT_NOT_FOUND_IN_DB' };
          }

          const contractRow = lockRes.rows[0];
          if (contractRow.status !== 'OPEN') {
            await dbClient.query('ROLLBACK');
            if (memTarget) {
              memTarget.status = contractRow.status;
            }
            settledContractIdsCache.add(contractId);
            telemetry.duplicateSettlementPreventedTotal += 1;
            return { settled: false, reason: 'ALREADY_SETTLED_IN_DB' };
          }

          const dbExpiresAtMs = new Date(contractRow.expires_at).getTime();
          if (Number.isFinite(dbExpiresAtMs) && nowMs < dbExpiresAtMs) {
            await dbClient.query('ROLLBACK');
            return { settled: false, reason: 'NOT_EXPIRED_YET' };
          }

          const dbCanonicalSymbol = resolveSymbol(contractRow.symbol);
          const tickRes = await dbClient.query(
            `SELECT sequence, price, ts, hash
             FROM ticks
             WHERE symbol = $1 AND ts >= $2
             ORDER BY ts ASC, sequence ASC
             LIMIT 1`,
            [dbCanonicalSymbol, contractRow.expires_at]
          );

          if (tickRes.rowCount === 0) {
            await dbClient.query('ROLLBACK');
            return { settled: false, reason: 'WAITING_FOR_OFFICIAL_EXPIRY_TICK' };
          }

          const officialTick = tickRes.rows[0];
          exitPrice = Number(officialTick.price);
          exitTickSequence = Number(officialTick.sequence);
          entryPrice = Number(contractRow.entry_price);
          stake = parseInt(contractRow.stake_minor, 10);
          userId = contractRow.user_id;
          const payoutPct = resolveContractPayoutPct(contractRow, contractId);

          const outcome = computeContractOutcome({
            direction: contractRow.direction,
            entryPrice: contractRow.entry_price,
            exitPrice: officialTick.price,
            stakeMinor: stake,
            payoutPct,
            symbol: dbCanonicalSymbol,
          });
          result = outcome.result;
          payoutMinor = outcome.payoutMinor;

          const blnkActive = isBlnkLedgerActive(blnk, blnkEnabled);
          if (blnkActive) {
            try {
              await blnk.settleContract(contractId, userId, result, stake, payoutMinor);
              const bal = await blnk.getBalance(userId);
              if (bal && Number.isSafeInteger(Number(bal.available_minor))) {
                updatedUserBalance = Number(bal.available_minor);
              }
            } catch (blnkErr) {
              await dbClient.query('ROLLBACK');
              return {
                settled: false,
                reason: 'BLNK_SETTLEMENT_FAILED',
                error: blnkErr.message,
              };
            }
          }

          const updateRes = await dbClient.query(
            `UPDATE contracts
             SET status = 'SETTLED',
                 result = $1,
                 payout_minor = $2,
                 exit_price = $3,
                 exit_tick_sequence = $4,
                 settled_at = NOW()
             WHERE id = $5 AND status = 'OPEN'
             RETURNING id`,
            [result, payoutMinor, exitPrice, exitTickSequence, contractId]
          );

          if (updateRes.rowCount === 0) {
            await dbClient.query('ROLLBACK');
            settledContractIdsCache.add(contractId);
            telemetry.duplicateSettlementPreventedTotal += 1;
            return { settled: false, reason: 'ALREADY_SETTLED_IN_DB' };
          }

          // Modo POSTGRES_DEMO_FALLBACK (!blnkActive): credita payoutMinor atomicamente na mesma transação
          if (!blnkActive) {
            if (payoutMinor > 0) {
              const creditRes = await dbClient.query(
                `UPDATE users
                 SET demo_balance_minor = demo_balance_minor + $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING demo_balance_minor`,
                [payoutMinor, userId]
              );
              if (creditRes.rows.length > 0) {
                updatedUserBalance = Number(creditRes.rows[0].demo_balance_minor);
              }
            } else {
              const balRes = await dbClient.query(
                'SELECT demo_balance_minor FROM users WHERE id = $1',
                [userId]
              );
              if (balRes.rows.length > 0) {
                updatedUserBalance = Number(balRes.rows[0].demo_balance_minor);
              }
            }
          }

          const outboxPayload = JSON.stringify({
            contract_id: contractId,
            user_id: userId,
            symbol: dbCanonicalSymbol,
            direction: contractRow.direction,
            result,
            stake_minor: stake,
            payout_minor: payoutMinor,
            entry_price: entryPrice,
            exit_price: exitPrice,
            exit_tick_sequence: exitTickSequence,
            exit_tick_hash: officialTick.hash,
          });

          await dbClient.query(
            `INSERT INTO outbox_events (event_type, payload, status, processed_at)
             VALUES ('CONTRACT_SETTLED', $1::jsonb, 'PROCESSED', NOW())`,
            [outboxPayload]
          );

          await dbClient.query('COMMIT');
        } catch (dbErr) {
          if (dbClient) {
            try {
              await dbClient.query('ROLLBACK');
            } catch (_) {}
          }
          return {
            settled: false,
            reason: 'DB_TRANSACTION_FAILED',
            error: dbErr.message,
          };
        } finally {
          if (dbClient) {
            try {
              dbClient.release();
            } catch (_) {}
          }
        }
      } else {
        // Caminho em memória / mock de testes unitários sem pool PostgreSQL real
        if (
          state &&
          !state.paused &&
          Array.isArray(state.tickHistory) &&
          state.tickHistory.length > 0 &&
          Number.isFinite(expiresAtMs)
        ) {
          const latestTickTime = state.tickHistory[state.tickHistory.length - 1].event_time;
          if (latestTickTime < expiresAtMs && (nowMs - expiresAtMs) < 1200) {
            return { settled: false, reason: 'WAITING_FOR_EXPIRY_TICK' };
          }
        }

        const tickResolution = resolveExitPriceAtExpiry(
          state,
          Number.isFinite(expiresAtMs) ? expiresAtMs : nowMs,
          entryPrice
        );
        exitPrice = tickResolution.exitPrice;
        exitTickSequence = tickResolution.tickSequence;
        tickSource = tickResolution.source;
        const payoutPct = resolveContractPayoutPct(target, contractId);

        const outcome = computeContractOutcome({
          direction: target.direction,
          entryPrice: target.entry_price ?? target.strike_price ?? entryPrice,
          exitPrice,
          stakeMinor: stake,
          payoutPct,
          symbol: canonicalSymbol,
        });
        result = outcome.result;
        payoutMinor = outcome.payoutMinor;

        if (pgPool && isAuthenticatedUser) {
          try {
            const updateContractRes = await pgPool.query(
              `UPDATE contracts
               SET status = 'SETTLED',
                   result = $1,
                   payout_minor = $2,
                   exit_price = $3,
                   exit_tick_sequence = $5,
                   settled_at = NOW()
               WHERE id = $4 AND status = 'OPEN'
               RETURNING id, user_id`,
              [result, payoutMinor, exitPrice, contractId, exitTickSequence]
            );

            if (updateContractRes.rowCount === 0 && (target._persistedInDb || triggerSource === 'sweeper_db')) {
              if (memTarget) {
                memTarget.status = 'SETTLED';
              }
              settledContractIdsCache.add(contractId);
              telemetry.duplicateSettlementPreventedTotal += 1;
              return { settled: false, reason: 'ALREADY_SETTLED_IN_DB' };
            }
          } catch (dbContractErr) {
            console.error('[DB Settlement Atomic Lock Error]', dbContractErr.message);
          }
        }

        if (pgPool && isAuthenticatedUser) {
          try {
            if (payoutMinor > 0) {
              const creditRes = await pgPool.query(
                `UPDATE users
                 SET demo_balance_minor = demo_balance_minor + $1, updated_at = NOW()
                 WHERE id = $2
                 RETURNING demo_balance_minor`,
                [payoutMinor, userId]
              );
              if (creditRes.rows.length > 0) {
                updatedUserBalance = Number(creditRes.rows[0].demo_balance_minor);
              }
            } else {
              const balRes = await pgPool.query(
                'SELECT demo_balance_minor FROM users WHERE id = $1',
                [userId]
              );
              if (balRes.rows.length > 0) {
                updatedUserBalance = Number(balRes.rows[0].demo_balance_minor);
              }
            }
          } catch (dbBalErr) {
            console.error('[DB Settlement Balance Update Error]', dbBalErr.message);
          }
        }

        if (blnk && isAuthenticatedUser) {
          try {
            await blnk.settleContract(contractId, userId, result, stake, payoutMinor);
            const bal = await blnk.getBalance(userId);
            if (bal && Number.isSafeInteger(Number(bal.available_minor))) {
              updatedUserBalance = Number(bal.available_minor);
            }
          } catch (blnkSettleErr) {
            console.warn('[Blnk Settlement Warning]', blnkSettleErr.message);
          }
        }
      }

      // 3. Atualiza estado em memória somente após confirmação durável (Relatório #12: strike_price permanece entryPrice)
      target.status = 'SETTLED';
      target.result = result;
      target.payout_minor = payoutMinor;
      target.entry_price = entryPrice;
      target.strike_price = entryPrice;
      target.exit_price = exitPrice;
      target.exit_tick_sequence = exitTickSequence;
      target.settled_at = new Date(nowMs).toISOString();

      if (!memTarget) {
        devContracts.unshift(target);
      }

      settledContractIdsCache.add(contractId);
      if (settledContractIdsCache.size > 10000) {
        const firstKey = settledContractIdsCache.values().next().value;
        if (firstKey) settledContractIdsCache.delete(firstKey);
      }

      devWallet.reserved_minor = Math.max(0, devWallet.reserved_minor - stake);
      devWallet.available_minor += payoutMinor;

      // Notifica cache de carteira que houve mutação de saldo para este usuário
      if (typeof onWalletMutated === 'function' && userId) {
        try {
          onWalletMutated(userId, updatedUserBalance);
        } catch (_) {}
      }

      // 6. Contabiliza telemetria pela origem da liquidação
      if (triggerSource === 'timer') {
        telemetry.contractsSettledByTimerTotal += 1;
      } else if (triggerSource === 'sweeper_db') {
        telemetry.contractsSettledBySweeperTotal += 1;
        telemetry.contractsRecoveredFromDbTotal += 1;
      } else {
        telemetry.contractsSettledBySweeperTotal += 1;
      }

      // 7. Broadcast WebSocket para atualização em tempo real na UI
      const finalBroadcastBal =
        updatedUserBalance !== null ? updatedUserBalance : devWallet.available_minor;
      if (wss && wss.clients) {
        const walletMsg = JSON.stringify({
          type: 'wallet_balance',
          available_minor: finalBroadcastBal,
          user_id: userId,
        });
        const settledMsg = JSON.stringify({
          type: 'contract_settled',
          contract_id: contractId,
          user_id: userId,
          result,
          stake_minor: stake,
          payout_minor: payoutMinor,
          entry_price: entryPrice,
          strike_price: entryPrice,
          exit_price: exitPrice,
          entry_tick_sequence: target.entry_tick_sequence ?? null,
          exit_tick_sequence: exitTickSequence,
          symbol: target.symbol,
          direction: target.direction,
        });

        const openState = WebSocket ? WebSocket.OPEN : 1;
        for (const client of wss.clients) {
          if (client.readyState === openState) {
            if (!client.authenticatedUserId || !userId || client.authenticatedUserId === userId) {
              client.send(walletMsg);
              client.send(settledMsg);
            }
          }
        }
      }

      return {
        settled: true,
        contractId,
        result,
        payoutMinor,
        exitPrice,
        exitTickSequence,
        tickSource,
        triggerSource,
      };
    } finally {
      settlingContractIds.delete(contractId);
    }
  }

  /**
   * Executa um ciclo completo de varredura de contratos vencidos (memória + banco de dados).
   * Garante que nenhum contrato fique preso em 'OPEN' mesmo se o processo reiniciar.
   */
  async function runSweepCycle(nowMs = Date.now()) {
    if (isSweeping) return { skipped: true };
    isSweeping = true;
    telemetry.sweeperRunsTotal += 1;

    const settledResults = [];
    try {
      // 1. Varre contratos em memória cujo expires_at <= nowMs
      for (const c of devContracts) {
        if (c && c.status === 'OPEN') {
          const expMs = Date.parse(c.expires_at);
          if (Number.isFinite(expMs) && expMs <= nowMs) {
            const res = await settleOpenContract(c, 'sweeper_mem', nowMs);
            if (res.settled) settledResults.push(res);
          }
        }
      }

      // 2. Varre contratos 'OPEN' vencidos diretamente no PostgreSQL (Crash / Restart Recovery)
      if (pgPool && nowMs >= dbRecoveryBackoffUntil) {
        try {
          const expiredDbRes = await pgPool.query(
            `SELECT id, user_id, symbol, direction, status, stake_minor, payout_pct, entry_price, expires_at, opened_at, created_at
             FROM contracts
             WHERE status = 'OPEN' AND expires_at <= NOW()
             ORDER BY expires_at ASC
             LIMIT 100`
          );

          for (const row of expiredDbRes.rows) {
            if (!settledContractIdsCache.has(row.id) && !settlingContractIds.has(row.id)) {
              const dbContractObj = {
                id: row.id,
                user_id: row.user_id,
                symbol: row.symbol,
                direction: row.direction,
                status: row.status,
                stake_minor: Number(row.stake_minor),
                payout_pct: row.payout_pct !== undefined && row.payout_pct !== null ? Number(row.payout_pct) : undefined,
                entry_price: Number(row.entry_price),
                strike_price: Number(row.entry_price),
                expires_at: new Date(row.expires_at).toISOString(),
                created_at: new Date(row.created_at || row.opened_at || nowMs).toISOString(),
                _persistedInDb: true,
              };
              const res = await settleOpenContract(dbContractObj, 'sweeper_db', nowMs);
              if (res.settled) settledResults.push(res);
            }
          }
        } catch (dbSweepErr) {
          // Se o banco não estiver acessível localmente, aplica backoff de 15s para não poluir logs
          dbRecoveryBackoffUntil = nowMs + 15_000;
        }
      }

      return { skipped: false, settledCount: settledResults.length, settledResults };
    } finally {
      isSweeping = false;
    }
  }

  return {
    settleOpenContract,
    runSweepCycle,
    telemetry,
    settlingContractIds,
    settledContractIdsCache,
  };
}
