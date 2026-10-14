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

export const TIER_WEIGHTS_BPS: Record<PayoutTier, number[]> = {
  TOP_3: [5000, 3000, 2000],
  TOP_10: [3500, 2000, 1200, 700, 700, 380, 380, 380, 380, 380],
  TOP_20: [
    2500, 1500, 1000, 500, 500,
    300, 300, 300, 300, 300,
    250, 250, 250, 250, 250, 250, 250, 250, 250, 250
  ],
  TOP_30: [
    2000, 1200, 800,
    400, 400, 400, 400, 400, 400, 400,
    200, 200, 200, 200, 200, 200, 200, 200, 200, 200,
    120, 120, 120, 120, 120, 120, 120, 120, 120, 120
  ]
};

/**
 * Distribuição exata de prêmios em centavos inteiros usando algoritmo Hare-Niemeyer (Maior Resto) em BigInt.
 * Garante matematicamente que a soma dos prêmios é 100% igual a totalPoolCents (saldo final do Escrow = 0).
 */
export function calculateExactPrizeDistribution(
  totalPoolCents: number,
  tier: PayoutTier,
  eligibleWinnersCount: number
): number[] {
  if (!Number.isSafeInteger(totalPoolCents) || totalPoolCents < 0) {
    throw new Error("INVALID_MINOR_AMOUNT: totalPoolCents must be non-negative integer");
  }
  if (totalPoolCents === 0 || eligibleWinnersCount <= 0) return [];

  const rawWeights = TIER_WEIGHTS_BPS[tier];
  if (!rawWeights) {
    throw new Error(`INVALID_PAYOUT_TIER: Unsupported tier '${tier}'`);
  }

  const activeCount = Math.min(rawWeights.length, Math.trunc(eligibleWinnersCount));
  const activeWeights = rawWeights.slice(0, activeCount);
  const weightSum = activeWeights.reduce((acc, w) => acc + w, 0);

  const poolBig = BigInt(totalPoolCents);
  const sumBig = BigInt(weightSum);

  const floors: number[] = [];
  const remainders: { index: number; rem: bigint }[] = [];
  let distributedSum = 0;

  for (let i = 0; i < activeCount; i++) {
    const numerator = poolBig * BigInt(activeWeights[i]);
    const floorVal = Number(numerator / sumBig);
    const remVal = numerator % sumBig;
    floors.push(floorVal);
    remainders.push({ index: i, rem: remVal });
    distributedSum += floorVal;
  }

  const leftoverCents = totalPoolCents - distributedSum;
  // Ordena pelo maior resto fracionário; em empate de resto, prioriza o rank mais alto (menor índice)
  remainders.sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : a.index - b.index));

  for (let i = 0; i < leftoverCents; i++) {
    floors[remainders[i].index] += 1;
  }

  return floors;
}

export class BlnkClient {
  private baseUrl: string;
  private timeoutMs: number;
  private failureCount: number = 0;
  private circuitOpenUntil: number = 0;
  private readonly maxFailures: number = 5;
  private readonly resetTimeoutMs: number = 10000;

  readonly LEDGER_ID = "broker_demo";
  readonly HOUSE_REVENUE = "@house_revenue";
  readonly HOUSE_PAYOUT = "@house_payout";
  readonly BROKER_FLOAT = "@broker_float";
  readonly HOUSE_TOURNAMENT_RAKE = "@house:tournament_rake";
  readonly HOUSE_TOURNAMENT_OVERLAY = "@house:tournament_overlay";
  readonly HOUSE_BONUS_RESERVE = "@house:bonus_reserve";
  readonly DEMO_START_BALANCE_MINOR = 1_000_000; // US$ 10.000,00 em centavos (D-11, D-18)

  /**
   * Nomenclatura canônica da Fase 2 (Seção 7.1): user:{id}:demo:{currency}:available | reserved
   */
  public static getUserDemoAccount(userId: string, kind: "available" | "reserved", currency = "USD"): string {
    const normalized = (currency || "").toUpperCase();
    if (normalized !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Demo ledger only supports ISO-4217 'USD'");
    }
    return `user:${userId}:demo:${normalized}:${kind}`;
  }

  /**
   * Nomenclatura canônica da Fase 2 (Seção 7.2): platform:demo:{currency}:liability | revenue | payout
   */
  public static getPlatformDemoAccount(kind: "liability" | "revenue" | "payout", currency = "USD"): string {
    const normalized = (currency || "").toUpperCase();
    if (normalized !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Demo ledger only supports ISO-4217 'USD'");
    }
    return `platform:demo:${normalized}:${kind}`;
  }

  /**
   * Contas reais e margem de bônus por usuário (Fase 1 Arena):
   * @user_{userId}:real:available | @user_{userId}:real:reserved | @user_{userId}:bonus_margin
   */
  public static getUserRealAccount(
    userId: string,
    kind: "available" | "reserved" | "bonus_margin",
    currency = "USD"
  ): string {
    const normalized = (currency || "").toUpperCase();
    if (normalized !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Real ledger only supports ISO-4217 'USD'");
    }
    if (kind === "bonus_margin") {
      return `@user_${userId}:bonus_margin`;
    }
    return `@user_${userId}:real:${kind}`;
  }

  /**
   * Conta Custódia (Escrow) isolada por torneio: @tournament_{tournamentId}:escrow
   */
  public static getTournamentEscrowAccount(tournamentId: string, currency = "USD"): string {
    const normalized = (currency || "").toUpperCase();
    if (normalized !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Tournament escrow only supports ISO-4217 'USD'");
    }
    return `@tournament_${tournamentId}:escrow`;
  }

  constructor(baseUrl: string = process.env.BLNK_URL || "http://localhost:5001", timeoutMs: number = 3000) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  private isCircuitOpen(): boolean {
    if (this.circuitOpenUntil > Date.now()) {
      return true;
    }
    return false;
  }

  private recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  private recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.maxFailures) {
      this.circuitOpenUntil = Date.now() + this.resetTimeoutMs;
      console.warn(`[BlnkClient] Circuit Breaker tripped OPEN for ${this.resetTimeoutMs}ms`);
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
          if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 409 || response.status === 422) {
            throw new Error(`BLNK_CLIENT_ERROR_${response.status}: ${body}`);
          }
          throw new Error(`BLNK_HTTP_ERROR_${response.status}: ${body}`);
        }

        this.recordSuccess();
        const data = (await response.json()) as T;
        return data;
      } catch (err: any) {
        clearTimeout(timer);
        if (attempt >= maxAttempts || err.message?.startsWith("BLNK_CLIENT_ERROR")) {
          if (!err.message?.startsWith("BLNK_CLIENT_ERROR")) this.recordFailure();
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
  async initializeLedgerAndHouseAccounts(): Promise<void> {
    try {
      await this.request("/ledgers", {
        method: "POST",
        body: JSON.stringify({ name: "Broker Demo Ledger", id: this.LEDGER_ID })
      });
    } catch (err: any) {
      if (!err.message?.startsWith("BLNK_CLIENT_ERROR_409")) throw err;
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
      } catch (err: any) {
        if (!err.message?.startsWith("BLNK_CLIENT_ERROR_409")) throw err;
      }
    }
  }

  /**
   * Onboarding do usuário com criação de contas e US$ 10.000 demo (D-11, I-01)
   */
  async onboardUser(userId: string): Promise<void> {
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
    } catch (err: any) {
      if (!err.message?.startsWith("BLNK_CLIENT_ERROR_409")) throw err;
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
    } catch (err: any) {
      if (!err.message?.startsWith("BLNK_CLIENT_ERROR_409")) throw err;
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
    } catch (err: any) {
      // Se a transação já foi processada anteriormente (idempotência), ignorar erro
      if (!err.message?.includes("409") && !err.message?.includes("conflict")) {
        throw err;
      }
    }
  }

  /**
   * Reserva a stake do usuário movendo de available para reserved (I-03)
   */
  async reserveStake(userId: string, contractId: string, stakeMinor: number): Promise<void> {
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
  async releaseReservedStake(userId: string, contractId: string, stakeMinor: number): Promise<void> {
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
  async settleContract(
    contractId: string,
    userId: string,
    result: "WIN" | "LOSS" | "DRAW",
    stakeMinor: number,
    payoutMinor: number
  ): Promise<void> {
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
    } else if (result === "WIN") {
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
    } else if (result === "DRAW") {
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
  async getBalance(userId: string): Promise<{ available_minor: number; reserved_minor: number }> {
    const availableAcc = `@user_${userId}:available`;
    const reservedAcc = `@user_${userId}:reserved`;

    const [availRes, resRes] = await Promise.all([
      this.request<BlnkBalanceResponse>(`/balances/${availableAcc}`),
      this.request<BlnkBalanceResponse>(`/balances/${reservedAcc}`)
    ]);

    if (availRes?.currency && availRes.currency !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Unexpected currency in Blnk balance response");
    }
    if (resRes?.currency && resRes.currency !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Unexpected currency in Blnk balance response");
    }

    return {
      available_minor: Math.trunc(Number(availRes.balance)),
      reserved_minor: Math.trunc(Number(resRes.balance))
    };
  }

  /**
   * Consulta o saldo real (available, reserved, bonus_margin) do usuário no Blnk
   */
  async getRealBalance(userId: string): Promise<{
    available_minor: number;
    reserved_minor: number;
    bonus_margin_minor: number;
  }> {
    const availAcc = BlnkClient.getUserRealAccount(userId, "available");
    const resAcc = BlnkClient.getUserRealAccount(userId, "reserved");
    const bonusAcc = BlnkClient.getUserRealAccount(userId, "bonus_margin");

    const [availRes, resRes, bonusRes] = await Promise.all([
      this.request<BlnkBalanceResponse>(`/balances/${availAcc}`),
      this.request<BlnkBalanceResponse>(`/balances/${resAcc}`),
      this.request<BlnkBalanceResponse>(`/balances/${bonusAcc}`)
    ]);

    for (const r of [availRes, resRes, bonusRes]) {
      if (r?.currency && r.currency !== "USD") {
        throw new Error("SILENT_CONVERSION_FORBIDDEN: Unexpected currency in Blnk real balance response");
      }
    }

    return {
      available_minor: Math.trunc(Number(availRes.balance)),
      reserved_minor: Math.trunc(Number(resRes.balance)),
      bonus_margin_minor: Math.trunc(Number(bonusRes.balance))
    };
  }

  /**
   * Credita depósito real confirmado: @broker_float -> @user_{userId}:real:available (AC-F1-01)
   */
  async creditRealDeposit(userId: string, txId: string, amountMinor: number): Promise<void> {
    await this.recordTransaction({
      amount: amountMinor,
      precision: 100,
      currency: "USD",
      source: this.BROKER_FLOAT,
      destination: BlnkClient.getUserRealAccount(userId, "available"),
      reference: `deposit:${txId}`,
      description: `Confirmed real deposit ${txId}`,
      allow_overdraft: true
    });
  }

  /**
   * Etapa 1 do Saque Real (Hold): @user_{userId}:real:available -> @user_{userId}:real:reserved (AC-F1-01)
   */
  async holdRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void> {
    await this.recordTransaction({
      amount: amountMinor,
      precision: 100,
      currency: "USD",
      source: BlnkClient.getUserRealAccount(userId, "available"),
      destination: BlnkClient.getUserRealAccount(userId, "reserved"),
      reference: `withdraw_hold:${txId}`,
      description: `Real withdrawal hold for tx ${txId}`,
      allow_overdraft: false
    });
  }

  /**
   * Etapa 2 do Saque Real (Settle): @user_{userId}:real:reserved -> @broker_float (AC-F1-01)
   */
  async settleRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void> {
    await this.recordTransaction({
      amount: amountMinor,
      precision: 100,
      currency: "USD",
      source: BlnkClient.getUserRealAccount(userId, "reserved"),
      destination: this.BROKER_FLOAT,
      reference: `withdraw_settle:${txId}`,
      description: `Real withdrawal settlement for tx ${txId}`,
      allow_overdraft: false
    });
  }

  /**
   * Estorno de Saque Real Cancelado/Rejeitado (Regra I-06): @user_{userId}:real:reserved -> @user_{userId}:real:available
   */
  async reverseRealWithdrawal(userId: string, txId: string, amountMinor: number): Promise<void> {
    await this.recordTransaction({
      amount: amountMinor,
      precision: 100,
      currency: "USD",
      source: BlnkClient.getUserRealAccount(userId, "reserved"),
      destination: BlnkClient.getUserRealAccount(userId, "available"),
      reference: `reversal:withdraw_hold:${txId}`,
      description: `Reversal of real withdrawal hold for tx ${txId}`,
      allow_overdraft: false
    });
  }

  /**
   * Registra Buy-in ou Rebuy de torneio com split atômico 30% Rake / 70% Escrow (AC-F1-02)
   */
  async recordTournamentEntryOrRebuy(params: {
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
  }> {
    const { tournamentId, userId, eventType, attemptNumber, grossAmountMinor } = params;
    if (!Number.isSafeInteger(grossAmountMinor) || grossAmountMinor <= 0) {
      throw new Error("INVALID_MINOR_AMOUNT: grossAmountMinor must be a positive safe integer");
    }

    const rakeBps = params.rakeBps ?? 3000;
    const rakeMinor = Number((BigInt(grossAmountMinor) * BigInt(rakeBps)) / 10000n);
    const escrowMinor = grossAmountMinor - rakeMinor;

    const userRealAvail = BlnkClient.getUserRealAccount(userId, "available");
    const escrowAcc = BlnkClient.getTournamentEscrowAccount(tournamentId);
    const rakeRef = `tour_rake:${tournamentId}:${userId}:${eventType}_${attemptNumber}`;
    const escrowRef = `tour_escrow:${tournamentId}:${userId}:${eventType}_${attemptNumber}`;

    if (rakeMinor > 0) {
      await this.recordTransaction({
        amount: rakeMinor,
        precision: 100,
        currency: "USD",
        source: userRealAvail,
        destination: this.HOUSE_TOURNAMENT_RAKE,
        reference: rakeRef,
        description: `Tournament ${eventType} rake (30%) for ${tournamentId}`,
        allow_overdraft: false
      });
    }

    if (escrowMinor > 0) {
      await this.recordTransaction({
        amount: escrowMinor,
        precision: 100,
        currency: "USD",
        source: userRealAvail,
        destination: escrowAcc,
        reference: escrowRef,
        description: `Tournament ${eventType} prize escrow (70%) for ${tournamentId}`,
        allow_overdraft: false
      });
    }

    return { rakeMinor, escrowMinor, rakeRef, escrowRef };
  }

  /**
   * Injeta Overlay Garantido da reserva da casa para o Escrow do torneio
   */
  async provisionTournamentOverlay(tournamentId: string, overlayMinor: number): Promise<void> {
    await this.recordTransaction({
      amount: overlayMinor,
      precision: 100,
      currency: "USD",
      source: this.HOUSE_TOURNAMENT_OVERLAY,
      destination: BlnkClient.getTournamentEscrowAccount(tournamentId),
      reference: `tour_overlay:${tournamentId}`,
      description: `Tournament guaranteed prize overlay for ${tournamentId}`,
      allow_overdraft: true
    });
  }

  /**
   * Distribui 100% do Escrow do torneio para os vencedores humanos (Top 3, Top 10, Top 20 ou Top 30) via Hare-Niemeyer (AC-F1-03)
   */
  async distributeTournamentPrizes(params: {
    tournamentId: string;
    totalPoolMinor: number;
    tier: PayoutTier;
    winners: { userId: string; rank: number }[];
  }): Promise<{
    distributions: { userId: string; rank: number; prizeMinor: number; reference: string }[];
    totalDistributedMinor: number;
    remainingEscrowMinor: number;
  }> {
    const { tournamentId, totalPoolMinor, tier, winners } = params;
    const prizes = calculateExactPrizeDistribution(totalPoolMinor, tier, winners.length);
    const escrowAcc = BlnkClient.getTournamentEscrowAccount(tournamentId);

    const distributions: { userId: string; rank: number; prizeMinor: number; reference: string }[] = [];
    let totalDistributedMinor = 0;

    for (let i = 0; i < prizes.length; i++) {
      const prizeMinor = prizes[i];
      const winner = winners[i];
      if (!winner || prizeMinor <= 0) continue;

      const reference = `tour_prize:${tournamentId}:rank_${winner.rank}:${winner.userId}`;
      await this.recordTransaction({
        amount: prizeMinor,
        precision: 100,
        currency: "USD",
        source: escrowAcc,
        destination: BlnkClient.getUserRealAccount(winner.userId, "available"),
        reference,
        description: `Tournament ${tournamentId} Rank #${winner.rank} prize payout`,
        allow_overdraft: false
      });

      totalDistributedMinor += prizeMinor;
      distributions.push({
        userId: winner.userId,
        rank: winner.rank,
        prizeMinor,
        reference
      });
    }

    return {
      distributions,
      totalDistributedMinor,
      remainingEscrowMinor: totalPoolMinor - totalDistributedMinor
    };
  }

  /**
   * Concede margem de bônus (ex: +50% por superar o @Alpha_Quant) bloqueada por Rollover 25x (AC-F1-04)
   */
  async grantTournamentBonusMargin(params: {
    userId: string;
    bonusId: string;
    bonusAmountMinor: number;
  }): Promise<void> {
    await this.recordTransaction({
      amount: params.bonusAmountMinor,
      precision: 100,
      currency: "USD",
      source: this.HOUSE_BONUS_RESERVE,
      destination: BlnkClient.getUserRealAccount(params.userId, "bonus_margin"),
      reference: `bonus_grant:${params.bonusId}`,
      description: `Promotional bonus margin grant ${params.bonusId} (25x rollover required)`,
      allow_overdraft: true
    });
  }

  public async recordTransaction(payload: BlnkTransactionPayload): Promise<any> {
    if (!payload || typeof payload !== "object") {
      throw new Error("INVALID_PAYLOAD: Transaction payload is required");
    }
    if ("rate" in (payload as any) || "exchange_rate" in (payload as any)) {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Implicit currency conversion is forbidden");
    }
    if (payload.currency !== "USD") {
      throw new Error("SILENT_CONVERSION_FORBIDDEN: Currency must be strictly ISO-4217 'USD'");
    }
    if (payload.precision !== 100) {
      throw new Error("INVALID_PRECISION: Precision must be strictly 100");
    }
    if (typeof payload.amount !== "number" || !Number.isSafeInteger(payload.amount) || payload.amount <= 0) {
      throw new Error("INVALID_MINOR_AMOUNT: Amount must be a positive safe integer in minor units (cents)");
    }
    if (
      typeof payload.source !== "string" ||
      payload.source.trim().length === 0 ||
      typeof payload.destination !== "string" ||
      payload.destination.trim().length === 0 ||
      payload.source.trim() === payload.destination.trim()
    ) {
      throw new Error("DOUBLE_ENTRY_VIOLATION: Source and destination must be distinct valid accounts");
    }
    if (typeof payload.reference !== "string" || payload.reference.trim().length === 0) {
      throw new Error("IDEMPOTENCY_VIOLATION: Reference is required for idempotent ledger transactions");
    }

    return this.request("/transactions", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
}
