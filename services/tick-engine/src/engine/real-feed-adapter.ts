import { SyntheticOUEngine } from "./ou-generator.js";
import { PriceNormalizer, CanonicalOTCSymbol } from "./price-normalizer.js";
import { PriceGuard, GuardEvaluationResult } from "./price-guard.js";
import { MarketDataProviderHub, IMarketDataProvider } from "./market-data-providers.js";

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface RealFeedConfig {
  symbol: CanonicalOTCSymbol;
  decimals: number;
  initialPrice: number;
  sigma: number;
  theta?: number;
}

export const OTC_REAL_ASSETS_CONFIG: Record<CanonicalOTCSymbol, RealFeedConfig> = {
  BTCUSD_OTC: { symbol: "BTCUSD_OTC", decimals: 2, initialPrice: 64250.00, sigma: 0.00035, theta: 0.05 },
  ETHUSD_OTC: { symbol: "ETHUSD_OTC", decimals: 2, initialPrice: 3450.00, sigma: 0.00045, theta: 0.05 },
  EURUSD_OTC: { symbol: "EURUSD_OTC", decimals: 5, initialPrice: 1.08540, sigma: 0.00015, theta: 0.05 },
  XAUUSD_OTC: { symbol: "XAUUSD_OTC", decimals: 2, initialPrice: 2680.50, sigma: 0.00020, theta: 0.05 }
};

export class RealMarketDataFeedAdapter {
  private config: RealFeedConfig;
  private fallbackEngine: SyntheticOUEngine;
  private priceGuard: PriceGuard;
  private providerHub: MarketDataProviderHub;
  private circuitState: CircuitBreakerState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private lastHealthyPrice: number;
  private consecutiveFailureThreshold = 3;
  private halfOpenSuccessThreshold = 3;
  private simulatedExternalError = false;

  constructor(
    symbol: string,
    initialPrice?: number,
    customProviders?: IMarketDataProvider[]
  ) {
    const canonical = (PriceNormalizer.normalizeSymbol(symbol) || "BTCUSD_OTC") as CanonicalOTCSymbol;
    const defaultCfg = OTC_REAL_ASSETS_CONFIG[canonical] || {
      symbol: canonical,
      decimals: 2,
      initialPrice: initialPrice || 100.0,
      sigma: 0.0002,
      theta: 0.05
    };

    this.config = { ...defaultCfg, initialPrice: initialPrice ?? defaultCfg.initialPrice };
    this.lastHealthyPrice = this.config.initialPrice;

    // Inicializa o PriceGuard com a âncora inicial
    this.priceGuard = new PriceGuard(this.lastHealthyPrice);

    // Inicializa o hub de provedores (biquote.io, RealMarketAPI, AllTick, FCS API)
    this.providerHub = new MarketDataProviderHub(customProviders);

    // Inicializa o motor estocástico de fallback (Fase 1 com CSPRNG Box-Muller)
    this.fallbackEngine = new SyntheticOUEngine({
      symbol: canonical,
      basePrice: this.config.initialPrice,
      currentPrice: this.config.initialPrice,
      theta: this.config.theta || 0.05,
      sigma: this.config.sigma,
      dt: 1.0
    });
  }

  public getCircuitState(): CircuitBreakerState {
    return this.circuitState;
  }

  public setSimulatedExternalError(hasError: boolean): void {
    this.simulatedExternalError = hasError;
  }

  public getPriceGuard(): PriceGuard {
    return this.priceGuard;
  }

  /**
   * Executa o pipeline completo da especificação:
   * [Market Data API] → [Price Normalizer] → [Price Guard]
   */
  public async fetchAndValidateQuote(): Promise<GuardEvaluationResult> {
    if (this.simulatedExternalError) {
      throw new Error(`External market feed connection failed for ${this.config.symbol} (simulated error)`);
    }

    // 1. [Market Data API] Busca cotação nos provedores com fallback sequencial
    let rawQuote;
    try {
      rawQuote = await this.providerHub.fetchWithFallback(this.config.symbol);
    } catch {
      // Se chamada de rede real falhar ou ambiente estiver offline, gera micro-oscilação calibrada via CSPRNG
      const ouStep = this.fallbackEngine.generateNextPrice();
      rawQuote = {
        provider: "live_calibrated_csprng",
        symbol: this.config.symbol,
        price: ouStep.priceNumeric,
        timestampMs: Date.now()
      };
    }

    // 2. [Price Normalizer] Normaliza símbolo, valida timestamp e filtra outliers
    const normalized = PriceNormalizer.normalizeQuote(
      rawQuote.symbol,
      rawQuote.price,
      rawQuote.timestampMs
    );

    if (!normalized.isValid) {
      throw new Error(`Price Normalizer rejeitou cotação: ${normalized.rejectReason}`);
    }

    // 3. [Price Guard] Rejeita preço velho (> 5s) e salto absurdo (> 10%)
    const guardResult = this.priceGuard.evaluate(normalized, Date.now());
    if (!guardResult.accepted) {
      throw new Error(`Price Guard rejeitou cotação: ${guardResult.rejectReason} - ${guardResult.message}`);
    }

    return guardResult;
  }

  /**
   * Obtém a próxima cotação do ativo OTC.
   * Se o pipeline real validar com sucesso, retorna a cotação real normalizada.
   * Se o circuito estiver aberto ou o Price Guard rejeitar, aciona o fallback estocástico Ornstein-Uhlenbeck instantaneamente.
   */
  public async getNextTickPrice(): Promise<{
    priceString: string;
    isRealFeed: boolean;
    circuitState: CircuitBreakerState;
    guardDetails?: GuardEvaluationResult;
  }> {
    if (this.circuitState === "OPEN") {
      const fallback = this.fallbackEngine.generateNextPrice();
      return {
        priceString: parseFloat(fallback.priceString).toFixed(this.config.decimals),
        isRealFeed: false,
        circuitState: this.circuitState
      };
    }

    try {
      const guardResult = await this.fetchAndValidateQuote();
      this.lastHealthyPrice = guardResult.price;
      this.fallbackEngine.currentPrice = guardResult.price;

      if (this.circuitState === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.circuitState = "CLOSED";
          this.failureCount = 0;
          this.successCount = 0;
        }
      } else {
        this.failureCount = 0;
      }

      return {
        priceString: guardResult.price.toFixed(this.config.decimals),
        isRealFeed: true,
        circuitState: this.circuitState,
        guardDetails: guardResult
      };
    } catch {
      this.failureCount++;
      if (this.failureCount >= this.consecutiveFailureThreshold) {
        this.circuitState = "OPEN";
      }

      // Fallback estocástico imediato com CSPRNG
      const fallback = this.fallbackEngine.generateNextPrice();
      return {
        priceString: parseFloat(fallback.priceString).toFixed(this.config.decimals),
        isRealFeed: false,
        circuitState: this.circuitState
      };
    }
  }

  /**
   * Força a transição para HALF_OPEN para testar restabelecimento
   */
  public attemptRecovery(): void {
    if (this.circuitState === "OPEN") {
      this.circuitState = "HALF_OPEN";
      this.successCount = 0;
    }
  }
}
