export interface BlnkTransactionPayload {
    amount: number;
    precision: number;
    currency: string;
    source: string;
    destination: string;
    reference: string;
    description?: string;
    allow_overdraft?: boolean;
}
export interface BlnkBalanceResponse {
    balance: number;
    credit_balance: number;
    debit_balance: number;
    currency: string;
}
export declare class BlnkClient {
    private baseUrl;
    private timeoutMs;
    private failureCount;
    private circuitOpenUntil;
    private readonly maxFailures;
    private readonly resetTimeoutMs;
    readonly LEDGER_ID = "broker_demo";
    readonly HOUSE_REVENUE = "@house_revenue";
    readonly HOUSE_PAYOUT = "@house_payout";
    readonly BROKER_FLOAT = "@broker_float";
    readonly DEMO_START_BALANCE_MINOR = 1000000;
    constructor(baseUrl?: string, timeoutMs?: number);
    private isCircuitOpen;
    private recordSuccess;
    private recordFailure;
    private request;
    /**
     * Garante a inicialização das contas da casa e ledger
     */
    initializeLedgerAndHouseAccounts(): Promise<void>;
    /**
     * Onboarding do usuário com criação de contas e US$ 10.000 demo (D-11, I-01)
     */
    onboardUser(userId: string): Promise<void>;
    /**
     * Reserva a stake do usuário movendo de available para reserved (I-03)
     */
    reserveStake(userId: string, contractId: string, stakeMinor: number): Promise<void>;
    /**
     * Reverte reserva de stake em caso de cancelamento da ordem
     */
    releaseReservedStake(userId: string, contractId: string, stakeMinor: number): Promise<void>;
    /**
     * Liquidação financeira no Blnk Ledger (D-19, I-04, I-05)
     */
    settleContract(contractId: string, userId: string, result: "WIN" | "LOSS" | "DRAW", stakeMinor: number, payoutMinor: number): Promise<void>;
    /**
     * Consulta o saldo disponível do usuário no Blnk (D-02, I-01)
     */
    getBalance(userId: string): Promise<{
        available_minor: number;
        reserved_minor: number;
    }>;
    private recordTransaction;
}
