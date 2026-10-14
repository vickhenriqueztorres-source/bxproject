export class RegionalMetricsService {
  private static instance: RegionalMetricsService;

  // Contadores por país e path
  private requestCounts: Map<string, number> = new Map();
  // Contadores de rejeições de Geoblocking por país
  private geoblockRejections: Map<string, number> = new Map();
  // Gauges de Feature flags
  private flagStatuses: Map<string, number> = new Map();
  // Status de Feeds OTC Reais (0 = CLOSED/Saudável, 1 = OPEN/Fallback, 2 = HALF_OPEN)
  private otcFeedStatuses: Map<string, { status: number; latencyMs: number }> = new Map();

  // Métricas Industriais do Motor e Contratos (T15)
  private tickEngineLeaders: Map<string, number> = new Map();
  private tickEngineCounts: Map<string, number> = new Map();
  private tickEngineErrors: Map<string, number> = new Map();
  private contractCreatedCounts: Map<string, number> = new Map();
  private contractOpenCounts: Map<string, number> = new Map();
  private settlementFailures: Map<string, number> = new Map();
  private http5xxCounts: Map<string, number> = new Map();
  private apiLatenciesP95: Map<string, number> = new Map();

  private activeUsersByCountry: Map<string, number> = new Map([
    ["BR", 120],
    ["MX", 65],
    ["CO", 45],
    ["AR", 30],
    ["CL", 22],
    ["PE", 18]
  ]);
  private contractsByCountry: Map<string, number> = new Map();
  private regionLatenciesMs: Map<string, number> = new Map([
    ["BR", 18],
    ["MX", 34],
    ["CO", 29],
    ["AR", 24],
    ["CL", 27],
    ["PE", 31]
  ]);
  private http5xxByCountry: Map<string, number> = new Map();
  private flagChangesCount: Map<string, number> = new Map();

  private constructor() {
    // Inicializa os 4 ativos OTC com estado CLOSED e latência saudável inicial
    const otcAssets = ["BTCUSD_OTC", "ETHUSD_OTC", "EURUSD_OTC", "XAUUSD_OTC"];
    for (const sym of otcAssets) {
      this.otcFeedStatuses.set(sym, { status: 0, latencyMs: 25 });
    }
  }

  public static getInstance(): RegionalMetricsService {
    if (!RegionalMetricsService.instance) {
      RegionalMetricsService.instance = new RegionalMetricsService();
    }
    return RegionalMetricsService.instance;
  }

  private sanitizeSymbol(symbol: string): string {
    return /^[A-Z0-9_]{3,20}$/.test(symbol) ? symbol : "UNKNOWN";
  }

  private sanitizePath(path: string): string {
    const clean = path.split("?")[0];
    if (clean.length > 40 || (!clean.startsWith("/api") && !clean.startsWith("/health") && !clean.startsWith("/ready") && !clean.startsWith("/metrics"))) {
      return "/other";
    }
    return clean;
  }

  public incrementRequest(country: string, path: string, statusCode: number): void {
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN";
    const safePath = this.sanitizePath(path);
    const key = `${safeCountry}|${safePath}|${statusCode}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);
    if (statusCode >= 500) {
      this.incrementHttp5xx(safePath, statusCode, safeCountry);
    }
  }

  public setActiveUsers(country: string, count: number): void {
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN";
    this.activeUsersByCountry.set(safeCountry, Math.max(0, count));
  }

  public recordRegionLatency(country: string, latencyMs: number): void {
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN";
    this.regionLatenciesMs.set(safeCountry, Number(latencyMs.toFixed(2)));
  }

  public incrementGeoblockRejection(country: string, reason: string): void {
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN";
    const key = `${safeCountry}|${reason}`;
    this.geoblockRejections.set(key, (this.geoblockRejections.get(key) || 0) + 1);
  }

  public setFlagStatus(country: string, flagKey: string, enabled: boolean): void {
    const safeCountry = /^[A-Z]{2,6}$/.test(country) ? country : "SYSTEM";
    const key = `${safeCountry}|${flagKey}`;
    this.flagStatuses.set(key, enabled ? 1 : 0);
    this.flagChangesCount.set(key, (this.flagChangesCount.get(key) || 0) + 1);
  }

  public setOtcFeedStatus(symbol: string, state: "CLOSED" | "OPEN" | "HALF_OPEN", latencyMs = 30): void {
    const statusCode = state === "CLOSED" ? 0 : state === "OPEN" ? 1 : 2;
    this.otcFeedStatuses.set(symbol, { status: statusCode, latencyMs });
  }

  // --- Métricas Industriais do Tick Engine ---
  public setTickEngineLeader(symbol: string, isLeader: boolean): void {
    const sym = this.sanitizeSymbol(symbol);
    this.tickEngineLeaders.set(sym, isLeader ? 1 : 0);
  }

  public incrementTickCount(symbol: string, count = 1): void {
    const sym = this.sanitizeSymbol(symbol);
    this.tickEngineCounts.set(sym, (this.tickEngineCounts.get(sym) || 0) + count);
  }

  public incrementTickError(symbol: string): void {
    const sym = this.sanitizeSymbol(symbol);
    this.tickEngineErrors.set(sym, (this.tickEngineErrors.get(sym) || 0) + 1);
  }

  // --- Métricas Industriais de Contratos e Settlement ---
  public incrementContractCreated(symbol: string, direction: "CALL" | "PUT" | "UP" | "DOWN", country = "BR"): void {
    const sym = this.sanitizeSymbol(symbol);
    const key = `${sym}|${direction}`;
    this.contractCreatedCounts.set(key, (this.contractCreatedCounts.get(key) || 0) + 1);
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "BR";
    this.contractsByCountry.set(safeCountry, (this.contractsByCountry.get(safeCountry) || 0) + 1);
  }

  public setContractOpenCount(symbol: string, count: number): void {
    const sym = this.sanitizeSymbol(symbol);
    this.contractOpenCounts.set(sym, count);
  }

  public incrementSettlementFailed(symbol: string, reason: string): void {
    const sym = this.sanitizeSymbol(symbol);
    const key = `${sym}|${reason}`;
    this.settlementFailures.set(key, (this.settlementFailures.get(key) || 0) + 1);
  }

  // --- Métricas Industriais de API e Latência ---
  public incrementHttp5xx(path: string, status: number, country = "BR"): void {
    const safePath = this.sanitizePath(path);
    const key = `${safePath}|${status}`;
    this.http5xxCounts.set(key, (this.http5xxCounts.get(key) || 0) + 1);
    const safeCountry = /^[A-Z]{2}$/.test(country) ? country : "UNKNOWN";
    const cKey = `${safeCountry}|${safePath}|${status}`;
    this.http5xxByCountry.set(cKey, (this.http5xxByCountry.get(cKey) || 0) + 1);
  }

  public recordApiLatency(path: string, latencyMs: number, country?: string): void {
    const safePath = this.sanitizePath(path);
    this.apiLatenciesP95.set(safePath, Number(latencyMs.toFixed(2)));
    if (country) {
      this.recordRegionLatency(country, latencyMs);
    }
  }

  public renderOpenMetrics(): string {
    const lines: string[] = [];

    // 1. broker_http_requests_total
    lines.push("# HELP broker_http_requests_total Total de requisicoes HTTP processadas segmentadas por pais");
    lines.push("# TYPE broker_http_requests_total counter");
    for (const [key, count] of this.requestCounts.entries()) {
      const [country, path, status] = key.split("|");
      lines.push(`broker_http_requests_total{country="${country}",path="${path}",status="${status}"} ${count}`);
    }

    // 2. broker_geoblock_rejections_total
    lines.push("# HELP broker_geoblock_rejections_total Total de conexoes interceptadas por Geoblocking na Fase 2");
    lines.push("# TYPE broker_geoblock_rejections_total counter");
    for (const [key, count] of this.geoblockRejections.entries()) {
      const [country, reason] = key.split("|");
      lines.push(`broker_geoblock_rejections_total{country="${country}",reason="${reason}"} ${count}`);
    }

    // 3. broker_feature_flags_status & changes
    lines.push("# HELP broker_feature_flags_status Estado das feature flags dinamicas por pais (1=ativo, 0=inativo)");
    lines.push("# TYPE broker_feature_flags_status gauge");
    for (const [key, val] of this.flagStatuses.entries()) {
      const [country, flagKey] = key.split("|");
      lines.push(`broker_feature_flags_status{country="${country}",flag="${flagKey}"} ${val}`);
    }
    if (this.flagChangesCount.size > 0) {
      lines.push("# HELP broker_feature_flag_changes_total Total de alteracoes de feature flags em runtime");
      lines.push("# TYPE broker_feature_flag_changes_total counter");
      for (const [key, val] of this.flagChangesCount.entries()) {
        const [country, flagKey] = key.split("|");
        lines.push(`broker_feature_flag_changes_total{country="${country}",flag="${flagKey}"} ${val}`);
      }
    }

    // 4. broker_otc_real_feed_status & latency
    lines.push("# HELP broker_otc_real_feed_status Estado do circuit breaker de feed OTC real (0=CLOSED, 1=OPEN, 2=HALF_OPEN)");
    lines.push("# TYPE broker_otc_real_feed_status gauge");
    for (const [sym, data] of this.otcFeedStatuses.entries()) {
      lines.push(`broker_otc_real_feed_status{symbol="${sym}"} ${data.status}`);
      lines.push(`broker_otc_real_feed_latency_ms{symbol="${sym}"} ${data.latencyMs}`);
    }

    // 4.1 Seção 12.1: Usuários ativos por país
    lines.push("# HELP broker_active_users Usuarios ativos por pais na Fase 2");
    lines.push("# TYPE broker_active_users gauge");
    for (const [country, count] of this.activeUsersByCountry.entries()) {
      lines.push(`broker_active_users{country="${country}"} ${count}`);
    }

    // 4.2 Seção 12.1: Contratos por país
    lines.push("# HELP broker_contracts_by_country_total Total de contratos abertos por pais na Fase 2");
    lines.push("# TYPE broker_contracts_by_country_total counter");
    for (const [country, count] of this.contractsByCountry.entries()) {
      lines.push(`broker_contracts_by_country_total{country="${country}"} ${count}`);
    }

    // 4.3 Seção 12.1: Latência por região / país
    lines.push("# HELP broker_region_latency_p95_ms Latencia p95 em milissegundos por regiao/pais");
    lines.push("# TYPE broker_region_latency_p95_ms gauge");
    for (const [country, lat] of this.regionLatenciesMs.entries()) {
      lines.push(`broker_region_latency_p95_ms{country="${country}"} ${lat}`);
    }

    // 4.4 Seção 12.1: Erros 5xx por país
    lines.push("# HELP broker_http_5xx_by_country_total Total de erros HTTP 5xx por pais");
    lines.push("# TYPE broker_http_5xx_by_country_total counter");
    for (const [key, count] of this.http5xxByCountry.entries()) {
      const [country, path, status] = key.split("|");
      lines.push(`broker_http_5xx_by_country_total{country="${country}",path="${path}",status="${status}"} ${count}`);
    }

    // 5. tick_engine_is_leader
    if (this.tickEngineLeaders.size > 0) {
      lines.push("# HELP tick_engine_is_leader Lideranca ativa do motor de ticks por ativo (1=lider, 0=seguidor)");
      lines.push("# TYPE tick_engine_is_leader gauge");
      for (const [sym, val] of this.tickEngineLeaders.entries()) {
        lines.push(`tick_engine_is_leader{symbol="${sym}"} ${val}`);
      }
    }

    // 6. tick_engine_ticks_total
    if (this.tickEngineCounts.size > 0) {
      lines.push("# HELP tick_engine_ticks_total Total acumulado de ticks gerados pelo motor");
      lines.push("# TYPE tick_engine_ticks_total counter");
      for (const [sym, val] of this.tickEngineCounts.entries()) {
        lines.push(`tick_engine_ticks_total{symbol="${sym}"} ${val}`);
      }
    }

    // 7. tick_engine_errors_total
    if (this.tickEngineErrors.size > 0) {
      lines.push("# HELP tick_engine_errors_total Total de erros na geracao ou persistencia de ticks");
      lines.push("# TYPE tick_engine_errors_total counter");
      for (const [sym, val] of this.tickEngineErrors.entries()) {
        lines.push(`tick_engine_errors_total{symbol="${sym}"} ${val}`);
      }
    }

    // 8. contract_created_total
    if (this.contractCreatedCounts.size > 0) {
      lines.push("# HELP contract_created_total Total de contratos abertos por simbolo e direcao");
      lines.push("# TYPE contract_created_total counter");
      for (const [key, val] of this.contractCreatedCounts.entries()) {
        const [sym, dir] = key.split("|");
        lines.push(`contract_created_total{symbol="${sym}",direction="${dir}"} ${val}`);
      }
    }

    // 9. contract_open_total
    if (this.contractOpenCounts.size > 0) {
      lines.push("# HELP contract_open_total Quantidade atual de contratos abertos e pendentes de expiracao");
      lines.push("# TYPE contract_open_total gauge");
      for (const [sym, val] of this.contractOpenCounts.entries()) {
        lines.push(`contract_open_total{symbol="${sym}"} ${val}`);
      }
    }

    // 10. contract_settlement_failed_total
    if (this.settlementFailures.size > 0) {
      lines.push("# HELP contract_settlement_failed_total Total de falhas no settlement de contratos");
      lines.push("# TYPE contract_settlement_failed_total counter");
      for (const [key, val] of this.settlementFailures.entries()) {
        const [sym, reason] = key.split("|");
        lines.push(`contract_settlement_failed_total{symbol="${sym}",reason="${reason}"} ${val}`);
      }
    }

    // 11. api_http_5xx_total
    if (this.http5xxCounts.size > 0) {
      lines.push("# HELP api_http_5xx_total Total de respostas HTTP 5xx emitidas pela API");
      lines.push("# TYPE api_http_5xx_total counter");
      for (const [key, val] of this.http5xxCounts.entries()) {
        const [path, status] = key.split("|");
        lines.push(`api_http_5xx_total{path="${path}",status="${status}"} ${val}`);
      }
    }

    // 12. api_request_latency_p95_ms
    if (this.apiLatenciesP95.size > 0) {
      lines.push("# HELP api_request_latency_p95_ms Estimativa de latencia p95 em milissegundos");
      lines.push("# TYPE api_request_latency_p95_ms gauge");
      for (const [path, val] of this.apiLatenciesP95.entries()) {
        lines.push(`api_request_latency_p95_ms{path="${path}"} ${val}`);
      }
    }

    return lines.join("\n");
  }
}
