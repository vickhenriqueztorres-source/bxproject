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
        // 0. Checagem: Zero-Sum & Double-Entry no Blnk Ledger (se disponível no client/adapter)
        try {
            const anyBlnk = this.blnkClient;
            if (anyBlnk && typeof anyBlnk.getLedgerAuditSnapshot === "function") {
                const snapshot = await anyBlnk.getLedgerAuditSnapshot();
                if (snapshot?.accounts && Array.isArray(snapshot.accounts)) {
                    const totalSum = snapshot.accounts.reduce((acc, item) => acc + Number(item.balance_minor ?? item.balance ?? 0), 0);
                    if (totalSum !== 0) {
                        report.checks.blnk_zero_sum = false;
                        report.discrepancies.push(`Blnk zero-sum violation: algebraic sum across all accounts is ${totalSum} (expected 0)`);
                    }
                }
                if (snapshot?.transactions && Array.isArray(snapshot.transactions)) {
                    for (const tx of snapshot.transactions) {
                        const debit = tx.debit ?? tx.amount;
                        const credit = tx.credit ?? tx.amount;
                        if (debit !== credit || tx.currency !== "USD" || !Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
                            report.checks.blnk_zero_sum = false;
                            report.discrepancies.push(`Invalid ledger transaction [${tx.reference}]: debit=${debit}, credit=${credit}, currency=${tx.currency}`);
                        }
                    }
                }
            }
        }
        catch (err) {
            report.checks.blnk_zero_sum = false;
            report.discrepancies.push(`Failed verifying Blnk zero-sum: ${err.message}`);
        }
        // 1. Checagem: Contratos Abertos vs Stakes Reservadas
        try {
            const openContractsRes = await this.pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(stake_minor), 0) as total_stake
         FROM contracts
         WHERE status = 'OPEN';`);
            const totalOpenStake = openContractsRes.rows.length > 0
                ? parseInt(openContractsRes.rows[0].total_stake, 10)
                : 0;
            const anyBlnk = this.blnkClient;
            if (anyBlnk && typeof anyBlnk.getTotalReservedBalanceMinor === "function") {
                const blnkReserved = await anyBlnk.getTotalReservedBalanceMinor();
                if (Number(blnkReserved) !== totalOpenStake) {
                    report.checks.open_contracts_vs_reserved = false;
                    report.discrepancies.push(`Open contracts stake (${totalOpenStake}) does not match Blnk reserved balance (${blnkReserved})`);
                }
            }
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
        // 4. Checagem: Sequenciamento de Ticks e Encadeamento de Hash por Símbolo (M-02, M-04, Perigo 5 Técnica 5)
        try {
            const ticksRes = await this.pool.query(`SELECT symbol, sequence, price, ts, prev_hash, hash
         FROM ticks
         ORDER BY symbol ASC, sequence DESC
         LIMIT 500;`);
            const rows = ticksRes.rows;
            const bySymbol = new Map();
            for (const row of rows) {
                const sym = row.symbol || "DEFAULT";
                let bucket = bySymbol.get(sym);
                if (!bucket) {
                    bucket = [];
                    bySymbol.set(sym, bucket);
                }
                bucket.push(row);
            }
            for (const [sym, symRows] of bySymbol.entries()) {
                // Garante ordenação por sequence DESC dentro de cada símbolo
                symRows.sort((a, b) => (BigInt(b.sequence) > BigInt(a.sequence) ? 1 : BigInt(b.sequence) < BigInt(a.sequence) ? -1 : 0));
                if (symRows.length > 1) {
                    for (let i = 0; i < symRows.length - 1; i++) {
                        const currentSeq = BigInt(symRows[i].sequence);
                        const prevSeq = BigInt(symRows[i + 1].sequence);
                        if (currentSeq !== prevSeq + 1n) {
                            report.checks.tick_sequence_continuous = false;
                            report.discrepancies.push(`[${sym}] Gap in tick sequence detected between ${prevSeq} and ${currentSeq}`);
                            break;
                        }
                        // 5. Checagem: Encadeamento de Hash SHA-256 (M-04)
                        if (symRows[i].prev_hash !== symRows[i + 1].hash) {
                            report.checks.hash_chain_valid = false;
                            report.discrepancies.push(`[${sym}] Hash chain mismatch at sequence ${currentSeq}`);
                            break;
                        }
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
    /**
     * Reconciliação linha por linha: Transações do Ledger (Blnk) vs Contratos (OPEN/SETTLED) vs Saldo exibido na UI (I-01, I-02, I-03, I-05)
     */
    static reconcileUserLedgerVsUi(params) {
        const { userId, transactions, contracts, uiWallet } = params;
        const report = {
            userId,
            status: "RECONCILED",
            checks: {
                double_entry_valid: true,
                iso_currency_and_precision_valid: true,
                integer_minor_units_valid: true,
                no_pending_double_counted: true,
                open_contracts_match_reserved: true,
                settled_contracts_match_ledger: true,
                ledger_matches_ui_wallet: true
            },
            derived_ledger_balance: {
                available_minor: 0,
                reserved_minor: 0,
                total_equity_minor: 0
            },
            discrepancies: []
        };
        const userAvailAccounts = new Set([
            `@user_${userId}:available`,
            `user:${userId}:demo:USD:available`
        ]);
        const userResAccounts = new Set([
            `@user_${userId}:reserved`,
            `user:${userId}:demo:USD:reserved`
        ]);
        let derivedAvailable = 0;
        let derivedReserved = 0;
        const seenReferences = new Set();
        const reserveTxByContract = new Map();
        const settlementTxByContract = new Map();
        // 1. Auditoria linha por linha das transações do Ledger
        for (const tx of transactions) {
            if (tx.status === "REJECTED") {
                continue;
            }
            if (!tx.reference || seenReferences.has(tx.reference)) {
                report.checks.no_pending_double_counted = false;
                report.discrepancies.push(`Duplicate or missing transaction reference: '${tx.reference}'`);
                continue;
            }
            seenReferences.add(tx.reference);
            if (typeof tx.amount !== "number" || !Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
                report.checks.integer_minor_units_valid = false;
                report.discrepancies.push(`Invalid non-integer or non-positive amount in tx '${tx.reference}': ${tx.amount}`);
            }
            if (tx.currency !== "USD" || tx.precision !== 100) {
                report.checks.iso_currency_and_precision_valid = false;
                report.discrepancies.push(`Invalid currency/precision in tx '${tx.reference}': currency=${tx.currency}, precision=${tx.precision}`);
            }
            const debit = tx.debit ?? tx.amount;
            const credit = tx.credit ?? tx.amount;
            if (debit !== credit ||
                debit !== tx.amount ||
                !tx.source ||
                !tx.destination ||
                tx.source === tx.destination) {
                report.checks.double_entry_valid = false;
                report.discrepancies.push(`Double-entry violation in tx '${tx.reference}': source=${tx.source}, destination=${tx.destination}, debit=${debit}, credit=${credit}`);
            }
            // Movimentação algébrica das contas do usuário
            if (userAvailAccounts.has(tx.source)) {
                derivedAvailable -= tx.amount;
            }
            if (userAvailAccounts.has(tx.destination)) {
                derivedAvailable += tx.amount;
            }
            if (userResAccounts.has(tx.source)) {
                derivedReserved -= tx.amount;
            }
            if (userResAccounts.has(tx.destination)) {
                derivedReserved += tx.amount;
            }
            if (tx.reference.startsWith("reserve:")) {
                const contractId = tx.reference.slice("reserve:".length);
                reserveTxByContract.set(contractId, (reserveTxByContract.get(contractId) ?? 0) + tx.amount);
            }
            else if (tx.reference.startsWith("settlement:")) {
                const parts = tx.reference.split(":");
                const contractId = parts[1];
                if (contractId) {
                    const list = settlementTxByContract.get(contractId) ?? [];
                    list.push(tx);
                    settlementTxByContract.set(contractId, list);
                }
            }
        }
        report.derived_ledger_balance = {
            available_minor: derivedAvailable,
            reserved_minor: derivedReserved,
            total_equity_minor: derivedAvailable + derivedReserved
        };
        if (derivedAvailable < 0 || derivedReserved < 0) {
            report.checks.ledger_matches_ui_wallet = false;
            report.discrepancies.push(`Negative balance detected in derived ledger state: available=${derivedAvailable}, reserved=${derivedReserved}`);
        }
        // 2. Auditoria Contratos (OPEN e SETTLED) vs Ledger (garantindo que operações pending/OPEN não sejam contadas duas vezes)
        let expectedOpenReserved = 0;
        for (const contract of contracts) {
            if (contract.user_id !== userId)
                continue;
            const reservedAmount = reserveTxByContract.get(contract.id) ?? 0;
            const settlementTxs = settlementTxByContract.get(contract.id) ?? [];
            if (contract.status === "OPEN") {
                expectedOpenReserved += contract.stake_minor;
                if (reservedAmount !== contract.stake_minor) {
                    report.checks.open_contracts_match_reserved = false;
                    report.discrepancies.push(`OPEN contract '${contract.id}' stake (${contract.stake_minor}) does not match ledger reserve (${reservedAmount})`);
                }
                if (settlementTxs.length > 0) {
                    report.checks.no_pending_double_counted = false;
                    report.discrepancies.push(`OPEN contract '${contract.id}' already has settlement transactions in ledger (double-counting risk)`);
                }
            }
            else if (contract.status === "SETTLED") {
                if (reservedAmount !== contract.stake_minor) {
                    report.checks.settled_contracts_match_ledger = false;
                    report.discrepancies.push(`SETTLED contract '${contract.id}' missing matching reserve transaction (${reservedAmount} vs ${contract.stake_minor})`);
                }
                if (settlementTxs.length === 0) {
                    report.checks.settled_contracts_match_ledger = false;
                    report.discrepancies.push(`SETTLED contract '${contract.id}' has no settlement transactions in ledger`);
                }
            }
        }
        if (derivedReserved !== expectedOpenReserved) {
            report.checks.open_contracts_match_reserved = false;
            report.discrepancies.push(`Derived reserved balance (${derivedReserved}) does not match sum of OPEN contracts (${expectedOpenReserved})`);
        }
        // 3. Auditoria Ledger vs Payload exibido na UI (Carteira)
        if (uiWallet.currency !== "USD" || (uiWallet.precision !== undefined && uiWallet.precision !== 100)) {
            report.checks.iso_currency_and_precision_valid = false;
            report.discrepancies.push(`UI Wallet invalid currency/precision: currency=${uiWallet.currency}, precision=${uiWallet.precision}`);
        }
        if (uiWallet.available_minor !== derivedAvailable ||
            uiWallet.reserved_minor !== derivedReserved ||
            (uiWallet.total_equity_minor !== undefined &&
                uiWallet.total_equity_minor !== derivedAvailable + derivedReserved)) {
            report.checks.ledger_matches_ui_wallet = false;
            report.discrepancies.push(`UI Wallet mismatch vs Ledger: UI(avail=${uiWallet.available_minor}, res=${uiWallet.reserved_minor}) !== Ledger(avail=${derivedAvailable}, res=${derivedReserved})`);
        }
        if (report.discrepancies.length > 0) {
            report.status = "DISCREPANCY_DETECTED";
        }
        return report;
    }
    reconcileUserLedgerVsUi(params) {
        return FinancialReconciler.reconcileUserLedgerVsUi(params);
    }
    /**
     * Reconciliação determinística de:
     * 1. Conservação de Escrow de Torneio (@tournament_{id}:escrow) em centavos inteiros.
     * 2. Hold de Saques da Carteira Real (@user_{id}:real:reserved vs saques PENDING).
     * 3. Isolamento de Margem de Bônus (@user_{id}:bonus_margin -> @user_{id}:real:available).
     */
    static reconcileTournamentEscrowAndRealWallet(params) {
        const report = {
            timestamp: new Date().toISOString(),
            status: "HEALTHY",
            checks: {
                tournament_escrow_conservation: true,
                real_wallet_withdrawals_hold_check: true,
                bonus_margin_isolation_check: true,
            },
            discrepancies: [],
        };
        const activeStatuses = new Set(["RUNNING", "REBUY_FREEZE", "TRADING_FREEZE", "SETTLING"]);
        const validEntryTypes = new Set(["BUY_IN", "REBUY", "OVERLAY_INJECTION"]);
        // 1. Invariante: tournament_escrow_conservation
        for (const tournament of params.tournaments ?? []) {
            if (!Number.isSafeInteger(tournament.escrowBalanceMinor) || tournament.escrowBalanceMinor < 0) {
                report.checks.tournament_escrow_conservation = false;
                report.discrepancies.push(`Tournament '${tournament.tournamentId}' has invalid escrowBalanceMinor: ${tournament.escrowBalanceMinor}`);
                continue;
            }
            if (activeStatuses.has(tournament.status)) {
                let expectedEscrowMinor = 0;
                if (Array.isArray(tournament.entries)) {
                    for (const entry of tournament.entries) {
                        if (!Number.isSafeInteger(entry.escrow_amount_minor) || entry.escrow_amount_minor < 0) {
                            report.checks.tournament_escrow_conservation = false;
                            report.discrepancies.push(`Tournament '${tournament.tournamentId}' entry '${entry.id ?? "unknown"}' has invalid escrow_amount_minor: ${entry.escrow_amount_minor}`);
                        }
                        else if (validEntryTypes.has(entry.entry_type)) {
                            expectedEscrowMinor += entry.escrow_amount_minor;
                        }
                    }
                }
                else if (tournament.expectedEscrowTotalMinor !== undefined) {
                    expectedEscrowMinor = tournament.expectedEscrowTotalMinor;
                }
                if (tournament.escrowBalanceMinor !== expectedEscrowMinor) {
                    report.checks.tournament_escrow_conservation = false;
                    report.discrepancies.push(`Active tournament '${tournament.tournamentId}' (status=${tournament.status}) escrow balance (${tournament.escrowBalanceMinor}) !== sum of BUY_IN + REBUY + OVERLAY_INJECTION (${expectedEscrowMinor})`);
                }
            }
            else if (tournament.status === "SETTLED") {
                if (tournament.escrowBalanceMinor !== 0) {
                    report.checks.tournament_escrow_conservation = false;
                    report.discrepancies.push(`SETTLED tournament '${tournament.tournamentId}' must have zero residual escrow balance, found ${tournament.escrowBalanceMinor}`);
                }
            }
        }
        // 2. Invariante: real_wallet_withdrawals_hold_check
        for (const holdAudit of params.realWalletHolds ?? []) {
            if (!Number.isSafeInteger(holdAudit.reservedBalanceMinor) || holdAudit.reservedBalanceMinor < 0) {
                report.checks.real_wallet_withdrawals_hold_check = false;
                report.discrepancies.push(`User '${holdAudit.userId}' has invalid @user_${holdAudit.userId}:real:reserved balance: ${holdAudit.reservedBalanceMinor}`);
                continue;
            }
            let pendingWithdrawalsMinor = 0;
            for (const tx of holdAudit.walletTransactions) {
                if (tx.type === "WITHDRAWAL" && tx.status === "PENDING") {
                    if (!Number.isSafeInteger(tx.amount_minor) || tx.amount_minor <= 0) {
                        report.checks.real_wallet_withdrawals_hold_check = false;
                        report.discrepancies.push(`User '${holdAudit.userId}' pending withdrawal '${tx.id ?? "unknown"}' has invalid amount_minor: ${tx.amount_minor}`);
                    }
                    else {
                        pendingWithdrawalsMinor += tx.amount_minor;
                    }
                }
            }
            if (pendingWithdrawalsMinor > holdAudit.reservedBalanceMinor) {
                report.checks.real_wallet_withdrawals_hold_check = false;
                report.discrepancies.push(`User '${holdAudit.userId}' PENDING withdrawals sum (${pendingWithdrawalsMinor}) exceeds @user_${holdAudit.userId}:real:reserved balance (${holdAudit.reservedBalanceMinor})`);
            }
        }
        // 3. Invariante: bonus_margin_isolation_check
        for (const bonusAudit of params.bonusMargins ?? []) {
            const bonusAccount = `@user_${bonusAudit.userId}:bonus_margin`;
            const realAvailableAccount = `@user_${bonusAudit.userId}:real:available`;
            for (const grant of bonusAudit.bonusGrants) {
                if (grant.status === "UNLOCKED" &&
                    grant.completed_volume_minor < grant.required_rollover_minor) {
                    report.checks.bonus_margin_isolation_check = false;
                    report.discrepancies.push(`User '${bonusAudit.userId}' bonus grant '${grant.id ?? "unknown"}' marked UNLOCKED before completing rollover (${grant.completed_volume_minor} < ${grant.required_rollover_minor})`);
                }
            }
            const bonusToRealTransfers = bonusAudit.ledgerTransactions.filter((tx) => tx.source === bonusAccount && tx.destination === realAvailableAccount);
            if (bonusToRealTransfers.length > 0) {
                let totalTransferredMinor = 0;
                for (const tx of bonusToRealTransfers) {
                    if (!Number.isSafeInteger(tx.amount) || tx.amount <= 0) {
                        report.checks.bonus_margin_isolation_check = false;
                        report.discrepancies.push(`User '${bonusAudit.userId}' bonus transfer '${tx.reference}' has invalid amount: ${tx.amount}`);
                    }
                    else {
                        totalTransferredMinor += tx.amount;
                    }
                }
                const eligibleUnlockedGrants = bonusAudit.bonusGrants.filter((g) => g.status === "UNLOCKED" &&
                    Number.isSafeInteger(g.amount_minor) &&
                    g.amount_minor > 0 &&
                    Number.isSafeInteger(g.completed_volume_minor) &&
                    Number.isSafeInteger(g.required_rollover_minor) &&
                    g.completed_volume_minor >= g.required_rollover_minor);
                const totalEligibleUnlockedMinor = eligibleUnlockedGrants.reduce((acc, g) => acc + g.amount_minor, 0);
                if (eligibleUnlockedGrants.length === 0 || totalTransferredMinor > totalEligibleUnlockedMinor) {
                    report.checks.bonus_margin_isolation_check = false;
                    report.discrepancies.push(`User '${bonusAudit.userId}' unauthorized transfer from ${bonusAccount} to ${realAvailableAccount}: transferred=${totalTransferredMinor}, eligibleUnlocked=${totalEligibleUnlockedMinor}`);
                }
            }
        }
        if (report.discrepancies.length > 0) {
            report.status = "DISCREPANCY_DETECTED";
        }
        return report;
    }
    reconcileTournamentEscrowAndRealWallet(params) {
        return FinancialReconciler.reconcileTournamentEscrowAndRealWallet(params);
    }
}
exports.FinancialReconciler = FinancialReconciler;
