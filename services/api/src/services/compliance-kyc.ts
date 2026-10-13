import {
  CountryCode,
  KYCProfileDTO,
  KYCStatus,
  KYCTier,
  RED_ZONE_COUNTRIES
} from "@broker/shared";

export interface SubmitDocumentDTO {
  documentType: string;
  documentNumber: string;
  nationalityCountry: string;
  issuerCountry: string;
}

export interface DepositCheckResult {
  allowed: boolean;
  tier: KYCTier;
  status: KYCStatus;
  requestedMinor: number;
  cumulativeMinor: number;
  limitMinor: number;
  reason?: string;
}

export class DynamicComplianceService {
  constructor(
    private pg: any,
    private redis?: any
  ) {}

  /**
   * Obtém o perfil de KYC do usuário (ou inicializa perfil padrão Tier 0 se não existir)
   */
  async getProfile(userId: string, defaultCountry: string = "BR"): Promise<KYCProfileDTO> {
    const res = await this.pg.query(
      `SELECT id, user_id, country_code, document_type, document_number, status, tier, deposit_limit_minor, nationality_country_code, rejection_reason 
       FROM kyc_profiles 
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        country_code: row.country_code,
        document_type: row.document_type,
        document_number: row.document_number,
        status: row.status as KYCStatus,
        tier: (row.tier || "TIER_0") as KYCTier,
        deposit_limit_minor: Number(row.deposit_limit_minor || 30000),
        nationality_country_code: row.nationality_country_code,
        rejection_reason: row.rejection_reason
      };
    }

    // Criar perfil padrão inicial em Tier 0
    const country = /^[A-Z]{2}$/.test(defaultCountry.toUpperCase()) ? defaultCountry.toUpperCase() : "BR";
    const insertRes = await this.pg.query(
      `INSERT INTO kyc_profiles (user_id, country_code, document_type, status, tier, deposit_limit_minor)
       VALUES ($1, $2, 'AUTO_TIER0', 'UNVERIFIED', 'TIER_0', 30000)
       RETURNING id, user_id, country_code, document_type, document_number, status, tier, deposit_limit_minor, nationality_country_code, rejection_reason`,
      [userId, country]
    );
    const row = insertRes.rows[0];
    return {
      id: row.id,
      user_id: row.user_id,
      country_code: row.country_code,
      document_type: row.document_type,
      document_number: row.document_number,
      status: row.status as KYCStatus,
      tier: row.tier as KYCTier,
      deposit_limit_minor: Number(row.deposit_limit_minor),
      nationality_country_code: row.nationality_country_code,
      rejection_reason: row.rejection_reason
    };
  }

  /**
   * Avalia elegibilidade pré-depósito sob regras de Tier e Zonas Regulatórias
   */
  async evaluateDepositEligibility(
    userId: string,
    requestedDepositMinor: number,
    accessCountry: string
  ): Promise<DepositCheckResult> {
    const countryUpper = accessCountry.toUpperCase();

    // 1. Bloqueio absoluto se o IP for de Zona Vermelha
    if ((RED_ZONE_COUNTRIES as readonly string[]).includes(countryUpper)) {
      return {
        allowed: false,
        tier: "TIER_0",
        status: "REJECTED",
        requestedMinor: requestedDepositMinor,
        cumulativeMinor: 0,
        limitMinor: 0,
        reason: "RED_ZONE_PROHIBITED: Financial transactions blocked from this jurisdiction."
      };
    }

    const profile = await this.getProfile(userId, countryUpper);

    // 2. Se o perfil foi rejeitado anteriormente (ex: tentou enviar passaporte US/EU)
    if (profile.status === "REJECTED") {
      return {
        allowed: false,
        tier: profile.tier,
        status: profile.status,
        requestedMinor: requestedDepositMinor,
        cumulativeMinor: 0,
        limitMinor: 0,
        reason: profile.rejection_reason || "ACCOUNT_REJECTED_BY_COMPLIANCE"
      };
    }

    // 3. Obter total cumulativo já depositado (via cache/jobs)
    const cumulativeKey = `user:deposit_cumulative:${userId}`;
    let cumulativeMinor = 0;
    if (this.redis) {
      try {
        const val = await this.redis.get(cumulativeKey);
        if (val) cumulativeMinor = parseInt(val, 10);
      } catch {
        cumulativeMinor = 0;
      }
    }

    const proposedTotal = cumulativeMinor + requestedDepositMinor;

    // 4. Se usuário está no Tier 0, aplica o teto estrito de $300 (30.000 centavos)
    if (profile.tier === "TIER_0" && proposedTotal > profile.deposit_limit_minor) {
      return {
        allowed: false,
        tier: profile.tier,
        status: profile.status,
        requestedMinor: requestedDepositMinor,
        cumulativeMinor,
        limitMinor: profile.deposit_limit_minor,
        reason: `TIER_0_LIMIT_EXCEEDED: Cumulative limit of $${profile.deposit_limit_minor / 100} exceeded. Submit Tier 1 ID document to increase deposit limit.`
      };
    }

    // 5. Se estiver em Tier 1 (Aprovado), valida contra o teto de Tier 1 ($10.000)
    if (profile.tier === "TIER_1" && proposedTotal > profile.deposit_limit_minor) {
      return {
        allowed: false,
        tier: profile.tier,
        status: profile.status,
        requestedMinor: requestedDepositMinor,
        cumulativeMinor,
        limitMinor: profile.deposit_limit_minor,
        reason: `TIER_1_LIMIT_EXCEEDED: Transaction exceeds maximum allowed tier limit.`
      };
    }

    return {
      allowed: true,
      tier: profile.tier,
      status: profile.status,
      requestedMinor: requestedDepositMinor,
      cumulativeMinor,
      limitMinor: profile.deposit_limit_minor
    };
  }

  /**
   * Submete e analisa documento de identidade para upgrade para Tier 1 com Anti-Red Zone Exclusion
   */
  async submitTier1Document(
    userId: string,
    data: SubmitDocumentDTO
  ): Promise<{ status: KYCStatus; tier: KYCTier; reason?: string }> {
    const nat = data.nationalityCountry.trim().toUpperCase();
    const issuer = data.issuerCountry.trim().toUpperCase();

    // REGRA INVIOLÁVEL: Anti-Red Zone Exclusion
    // Rejeição imediata se nacionalidade ou país emissor pertencer à Zona Vermelha
    const isRedNationality = (RED_ZONE_COUNTRIES as readonly string[]).includes(nat);
    const isRedIssuer = (RED_ZONE_COUNTRIES as readonly string[]).includes(issuer);

    if (isRedNationality || isRedIssuer) {
      const reason = `RED_ZONE_DOCUMENT_REJECTED: Citizens and residents of ${isRedNationality ? nat : issuer} are strictly prohibited from retail binary/synthetic contract trading.`;

      await this.pg.query(
        `UPDATE kyc_profiles 
         SET status = 'REJECTED', 
             nationality_country_code = $1, 
             rejection_reason = $2, 
             updated_at = NOW() 
         WHERE user_id = $3`,
        [nat, reason, userId]
      );

      return {
        status: "REJECTED",
        tier: "TIER_0",
        reason
      };
    }

    // Validação básica de completude do documento
    if (!data.documentNumber || data.documentNumber.trim().length < 4) {
      return {
        status: "UNVERIFIED",
        tier: "TIER_0",
        reason: "INVALID_DOCUMENT_NUMBER"
      };
    }

    // Aprovação de documento para jurisdições das Zonas Amarela e Verde
    // Elevação do teto para $10.000 (1.000.000 centavos)
    const TIER1_LIMIT_MINOR = 1000000;

    await this.pg.query(
      `UPDATE kyc_profiles 
       SET status = 'APPROVED', 
           tier = 'TIER_1', 
           deposit_limit_minor = $1, 
           document_type = $2, 
           document_number = $3, 
           nationality_country_code = $4, 
           rejection_reason = NULL, 
           updated_at = NOW() 
       WHERE user_id = $5`,
      [TIER1_LIMIT_MINOR, data.documentType, data.documentNumber, nat, userId]
    );

    return {
      status: "APPROVED",
      tier: "TIER_1"
    };
  }
}
