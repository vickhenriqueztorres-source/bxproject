"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlnkClient = void 0;
class BlnkClient {
    baseUrl;
    timeoutMs;
    failureCount = 0;
    circuitOpenUntil = 0;
    maxFailures = 5;
    resetTimeoutMs = 10000;
    LEDGER_ID = "broker_demo";
    HOUSE_REVENUE = "@house_revenue";
    HOUSE_PAYOUT = "@house_payout";
    BROKER_FLOAT = "@broker_float";
    DEMO_START_BALANCE_MINOR = 1_000_000; // US$ 10.000,00 em centavos (D-11, D-18)
    constructor(baseUrl = process.env.BLNK_URL || "http://localhost:5001", timeoutMs = 3000) {
        this.baseUrl = baseUrl.replace(/\/$/, "");
        this.timeoutMs = timeoutMs;
    }
    isCircuitOpen() {
        if (this.circuitOpenUntil > Date.now()) {
            return true;
        }
        return false;
    }
    recordSuccess() {
        this.failureCount = 0;
        this.circuitOpenUntil = 0;
    }
    recordFailure() {
        this.failureCount++;
        if (this.failureCount >= this.maxFailures) {
            this.circuitOpenUntil = Date.now() + this.resetTimeoutMs;
            console.warn(`[BlnkClient] Circuit Breaker tripped OPEN for ${this.resetTimeoutMs}ms`);
        }
    }
    async request(path, options = {}) {
        if (this.isCircuitOpen()) {
            throw new Error("CIRCUIT_BREAKER_OPEN: Blnk service temporarily unavailable");
        }
        const url = `${this.baseUrl}${path}`;
        let attempt = 0;
        const maxAttempts = 3;
        while (attempt < maxAttempts) {
            attempt++;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), this.timeoutMs);
            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        ...options.headers
                    }
                });
                clearTimeout(timer);
                if (!response.ok) {
                    const body = await response.text();
                    // Se for erro de idempotência ou conflito conhecido, não retenta
                    if (response.status === 409 || response.status === 422) {
                        throw new Error(`BLNK_CLIENT_ERROR_${response.status}: ${body}`);
                    }
                    throw new Error(`BLNK_HTTP_ERROR_${response.status}: ${body}`);
                }
                this.recordSuccess();
                const data = (await response.json());
                return data;
            }
            catch (err) {
                clearTimeout(timer);
                if (attempt >= maxAttempts || err.message?.startsWith("BLNK_CLIENT_ERROR")) {
                    this.recordFailure();
                    throw err;
                }
                // Exponential backoff com jitter: 50ms * 2^attempt + jitter
                const backoff = 50 * Math.pow(2, attempt) + Math.floor(Math.random() * 30);
                await new Promise(r => setTimeout(r, backoff));
            }
        }
        throw new Error("BLNK_MAX_RETRIES_EXCEEDED");
    }
    /**
     * Garante a inicialização das contas da casa e ledger
     */
    async initializeLedgerAndHouseAccounts() {
        try {
            await this.request("/ledgers", {
                method: "POST",
                body: JSON.stringify({ name: "Broker Demo Ledger", id: this.LEDGER_ID })
            });
        }
        catch {
            // Ignora se o ledger já existe
        }
        const accounts = [
            { name: "House Revenue", number: this.HOUSE_REVENUE, ledger_id: this.LEDGER_ID, currency: "USD" },
            { name: "House Payout", number: this.HOUSE_PAYOUT, ledger_id: this.LEDGER_ID, currency: "USD" },
            { name: "Broker Float", number: this.BROKER_FLOAT, ledger_id: this.LEDGER_ID, currency: "USD" }
        ];
        for (const acc of accounts) {
            try {
                await this.request("/accounts", {
                    method: "POST",
                    body: JSON.stringify(acc)
                });
            }
            catch {
                // Ignora se conta já existe
            }
        }
    }
    /**
     * Onboarding do usuário com criação de contas e US$ 10.000 demo (D-11, I-01)
     */
    async onboardUser(userId) {
        const availableAcc = `@user_${userId}:available`;
        const reservedAcc = `@user_${userId}:reserved`;
        // 1. Cria conta disponível
        try {
            await this.request("/accounts", {
                method: "POST",
                body: JSON.stringify({
                    name: `User ${userId} Available`,
                    number: availableAcc,
                    ledger_id: this.LEDGER_ID,
                    currency: "USD"
                })
            });
        }
        catch {
            // Já criada
        }
        // 2. Cria conta de garantia
        try {
            await this.request("/accounts", {
                method: "POST",
                body: JSON.stringify({
                    name: `User ${userId} Reserved`,
                    number: reservedAcc,
                    ledger_id: this.LEDGER_ID,
                    currency: "USD"
                })
            });
        }
        catch {
            // Já criada
        }
        // 3. Credita saldo inicial demo de US$ 10.000,00 com referência idempotente
        try {
            await this.recordTransaction({
                amount: this.DEMO_START_BALANCE_MINOR,
                precision: 100,
                currency: "USD",
                source: this.BROKER_FLOAT,
                destination: availableAcc,
                reference: `onboarding:${userId}`,
                description: "Initial Demo Balance US$ 10,000",
                allow_overdraft: true
            });
        }
        catch (err) {
            // Se a transação já foi processada anteriormente (idempotência), ignorar erro
            if (!err.message?.includes("409") && !err.message?.includes("conflict")) {
                throw err;
            }
        }
    }
    /**
     * Reserva a stake do usuário movendo de available para reserved (I-03)
     */
    async reserveStake(userId, contractId, stakeMinor) {
        await this.recordTransaction({
            amount: stakeMinor,
            precision: 100,
            currency: "USD",
            source: `@user_${userId}:available`,
            destination: `@user_${userId}:reserved`,
            reference: `reserve:${contractId}`,
            description: `Stake reservation for contract ${contractId}`,
            allow_overdraft: false
        });
    }
    /**
     * Reverte reserva de stake em caso de cancelamento da ordem
     */
    async releaseReservedStake(userId, contractId, stakeMinor) {
        await this.recordTransaction({
            amount: stakeMinor,
            precision: 100,
            currency: "USD",
            source: `@user_${userId}:reserved`,
            destination: `@user_${userId}:available`,
            reference: `reversal:reserve:${contractId}`,
            description: `Reversal of stake reservation for contract ${contractId}`,
            allow_overdraft: false
        });
    }
    /**
     * Liquidação financeira no Blnk Ledger (D-19, I-04, I-05)
     */
    async settleContract(contractId, userId, result, stakeMinor, payoutMinor) {
        const userReserved = `@user_${userId}:reserved`;
        const userAvailable = `@user_${userId}:available`;
        if (result === "LOSS") {
            // Perda: move a stake reservada para a conta de receita da casa
            await this.recordTransaction({
                amount: stakeMinor,
                precision: 100,
                currency: "USD",
                source: userReserved,
                destination: this.HOUSE_REVENUE,
                reference: `settlement:${contractId}:LOSS`,
                description: `Loss settlement for contract ${contractId}`,
                allow_overdraft: false
            });
        }
        else if (result === "WIN") {
            // Vitória: 
            // 1. Devolve a stake reservada de volta para a carteira disponível
            await this.recordTransaction({
                amount: stakeMinor,
                precision: 100,
                currency: "USD",
                source: userReserved,
                destination: userAvailable,
                reference: `settlement:${contractId}:WIN_STAKE`,
                description: `Stake refund on WIN for contract ${contractId}`,
                allow_overdraft: false
            });
            // 2. Transfere o lucro (payout - stake) da conta da casa para o usuário
            const profitMinor = payoutMinor - stakeMinor;
            if (profitMinor > 0) {
                await this.recordTransaction({
                    amount: profitMinor,
                    precision: 100,
                    currency: "USD",
                    source: this.HOUSE_PAYOUT,
                    destination: userAvailable,
                    reference: `settlement:${contractId}:WIN_PROFIT`,
                    description: `Profit payout for contract ${contractId}`,
                    allow_overdraft: true
                });
            }
        }
        else if (result === "DRAW") {
            // Empate: devolve a stake integralmente
            await this.recordTransaction({
                amount: stakeMinor,
                precision: 100,
                currency: "USD",
                source: userReserved,
                destination: userAvailable,
                reference: `settlement:${contractId}:DRAW`,
                description: `Draw refund for contract ${contractId}`,
                allow_overdraft: false
            });
        }
    }
    /**
     * Consulta o saldo disponível do usuário no Blnk (D-02, I-01)
     */
    async getBalance(userId) {
        const availableAcc = `@user_${userId}:available`;
        const reservedAcc = `@user_${userId}:reserved`;
        const [availRes, resRes] = await Promise.all([
            this.request(`/balances/${availableAcc}`),
            this.request(`/balances/${reservedAcc}`)
        ]);
        return {
            available_minor: availRes.balance,
            reserved_minor: resRes.balance
        };
    }
    async recordTransaction(payload) {
        return this.request("/transactions", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    }
}
exports.BlnkClient = BlnkClient;
