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
export type PayoutTier = "TOP_3" | "TOP_10" | "TOP_20" | "TOP_30";
export declare const TIER_WEIGHTS_BPS: Record<PayoutTier, number[]>;
/**
 * Distribuição exata de prêmios em centavos inteiros usando algoritmo Hare-Niemeyer (Maior Resto) em BigInt.
 * Garante matematicamente que a soma dos prêmios é 100% igual a totalPoolCents (saldo final do Escrow = 0).
 */
export declare function calculateExactPrizeDistribution(totalPoolCents: number, tier: PayoutTier, eligibleWinnersCount: number): number[];
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
    readonly HOUSE_TOURNAMENT_RAKE = "@house:tournament_rake";
    readonly HOUSE_TOURNAMENT_OVERLAY = "@house:tournament_overlay";
    readonly HOUSE_BONUS_RESERVE = "@house:bonus_reserve";
    readonly DEMO_START_BALANCE_MINOR = 1000000;
    /**
     * Nomenclatura canônica da Fase 2 (Seção 7.1): user:{id}:demo:{currency}:available | reserved
     */
    static getUserDemoAccount(userId: string, kind: "available" | "reserved", currency?: string): string;
    /**
     * Nomenclatura canônica da Fase 2 (Seção 7.2): platform:demo:{currency}:liability | revenue | payout
     */
    static getPlatformDemoAccount(kind: "liability" | "revenue" | "payout", currency?: string): string;
    /**
     * Contas reais e margem de bônus por usuário (Fase 1 Arena):
     * @user_{userId}:real:available | @user_{userId}:real:reserved | @user_{userId}:bonus_margin
     */
    static getUserRealAccount(userId: string, kind: "available" | "reserved" | "bonus_margin", currency?: string): string;
    /**
     * Conta Custódia (Escrow) isolada por torneio: @tournament_{tournamentId}:escrow
     */
    static getTournamentEscrowAccount(tournamentId: string, currency?: string): string;
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
    /**
     * Consulta o saldo real (available, reserved, bonus_margin) do usuário no Blnk
     */
    getRealBalance(userId: string): Promise<{
        available_minor: number;
        reserved_minor: number;
        bonus_margin_minor: number;
    }>;
    /**
     * Credita depósito real confirmado: @broker_float -> @user_{userId}:real:available (AC-F1-01)
     */
    creditRealDeposit(userId: string, txId: string, amountMinor: number): Promise<void>;
    /**
     * Etapa 1 do Saque Real (Hold): @user_{userId}:real:available -> @user_{userId}:real:reserved (AC-F1-01)
     */
    holdRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void>;
    /**
     * Etapa 2 do Saque Real (Settle): @user_{userId}:real:reserved -> @broker_float (AC-F1-01)
     */
    settleRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void>;
    /**
     * Estorno de Saque Real Cancelado/Rejeitado (Regra I-06): @user_{userId}:real:reserved -> @user_{userId}:real:available
     */
    reverseRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void>;
    /**
     * Registra Buy-in ou Rebuy de torneio com split atômico 30% Rake / 70% Escrow (AC-F1-02)
     */
    recordTournamentEntryOrRebuy(params: {
        tournamentId: string;
        userId: string;
        eventType: "BUY_IN" | "REBUY";
        attemptNumber: number;
        grossAmountMinor: number;
        rakeBps?: number;
    }): Promise<{
        rakeMinor: number;
        escrowMinor: number;
        rakeRef: string;
        escrowRef: string;
    }>;
    /**
     * Injeta Overlay Garantido da reserva da casa para o Escrow do torneio
     */
    provisionTournamentOverlay(tournamentId: string, overlayMinor: number): Promise<void>;
    /**
     * Distribui 100% do Escrow do torneio para os vencedores humanos (Top 3, Top 10, Top 20 ou Top 30) via Hare-Niemeyer (AC-F1-03)
     */
    distributeTournamentPrizes(params: {
        tournamentId: string;
        totalPoolMinor: number;
        tier: PayoutTier;
        winners: {
            userId: string;
            rank: number;
        }[];
    }): Promise<{
        distributions: {
            userId: string;
            rank: number;
            prizeMinor: number;
            reference: string;
        }[];
        totalDistributedMinor: number;
        remainingEscrowMinor: number;
    }>;
    /**
     * Concede margem de bônus (ex: +50% por superar o @Alpha_Quant) bloqueada por Rollover 25x (AC-F1-04)
     */
    grantTournamentBonusMargin(params: {
        userId: string;
        bonusId: string;
        bonusAmountMinor: number;
    }): Promise<void>;
    recordTransaction(payload: BlnkTransactionPayload): Promise<any>;
}
