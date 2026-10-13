import { FastifyRequest } from "fastify";
import {
  RED_ZONE_COUNTRIES,
  YELLOW_ZONE_COUNTRIES,
  GREEN_ZONE_COUNTRIES,
  RegulatoryZone
} from "@broker/shared";

export interface RegulatoryJurisdictionInfo {
  countryCode: string;
  countryName: string;
  zone: RegulatoryZone;
  regulatorAuthority: string;
  enforcementLevel: string;
  hardBlock: boolean;
}

export interface RegulatoryRoutingContext {
  country: string;
  zone: RegulatoryZone;
  hardBlocked: boolean;
  regulatorAuthority: string;
  suggestedMirror: string;
}

// Catálogo in-memory estático para defesa em profundidade (Fail-safe contra indisponibilidade de DB/Redis)
const STATIC_REGULATORY_MAP: Record<string, RegulatoryJurisdictionInfo> = {
  // RED ZONE
  US: { countryCode: "US", countryName: "Estados Unidos", zone: "RED", regulatorAuthority: "CFTC/SEC", enforcementLevel: "CRIMINAL_SANCTIONS", hardBlock: true },
  CA: { countryCode: "CA", countryName: "Canadá", zone: "RED", regulatorAuthority: "CSA", enforcementLevel: "ACTIVE_PROSECUTION", hardBlock: true },
  GB: { countryCode: "GB", countryName: "Reino Unido", zone: "RED", regulatorAuthority: "FCA", enforcementLevel: "RETAIL_BAN", hardBlock: true },
  AU: { countryCode: "AU", countryName: "Austrália", zone: "RED", regulatorAuthority: "ASIC", enforcementLevel: "RETAIL_BAN", hardBlock: true },
  IL: { countryCode: "IL", countryName: "Israel", zone: "RED", regulatorAuthority: "ISA", enforcementLevel: "TOTAL_BAN", hardBlock: true },
  JP: { countryCode: "JP", countryName: "Japão", zone: "RED", regulatorAuthority: "JFSA", enforcementLevel: "STRICT_LOCAL_LICENSE_ONLY", hardBlock: true },
  DE: { countryCode: "DE", countryName: "Alemanha", zone: "RED", regulatorAuthority: "BaFin", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  FR: { countryCode: "FR", countryName: "França", zone: "RED", regulatorAuthority: "AMF", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  IT: { countryCode: "IT", countryName: "Itália", zone: "RED", regulatorAuthority: "CONSOB", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  ES: { countryCode: "ES", countryName: "Espanha", zone: "RED", regulatorAuthority: "CNMV", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  NL: { countryCode: "NL", countryName: "Holanda", zone: "RED", regulatorAuthority: "AFM", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  BE: { countryCode: "BE", countryName: "Bélgica", zone: "RED", regulatorAuthority: "FSMA", enforcementLevel: "TOTAL_BAN", hardBlock: true },
  AT: { countryCode: "AT", countryName: "Áustria", zone: "RED", regulatorAuthority: "FMA", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  SE: { countryCode: "SE", countryName: "Suécia", zone: "RED", regulatorAuthority: "FI", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  PL: { countryCode: "PL", countryName: "Polônia", zone: "RED", regulatorAuthority: "KNF", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  IE: { countryCode: "IE", countryName: "Irlanda", zone: "RED", regulatorAuthority: "CBI", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  PT: { countryCode: "PT", countryName: "Portugal", zone: "RED", regulatorAuthority: "CMVM", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },
  GR: { countryCode: "GR", countryName: "Grécia", zone: "RED", regulatorAuthority: "HCMC", enforcementLevel: "ESMA_RETAIL_BAN", hardBlock: true },

  // YELLOW ZONE
  MX: { countryCode: "MX", countryName: "México", zone: "YELLOW", regulatorAuthority: "CNBV", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  IN: { countryCode: "IN", countryName: "Índia", zone: "YELLOW", regulatorAuthority: "SEBI/RBI", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  ID: { countryCode: "ID", countryName: "Indonésia", zone: "YELLOW", regulatorAuthority: "Bappebti", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  TH: { countryCode: "TH", countryName: "Tailândia", zone: "YELLOW", regulatorAuthority: "SEC", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  ZA: { countryCode: "ZA", countryName: "África do Sul", zone: "YELLOW", regulatorAuthority: "FSCA", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  NG: { countryCode: "NG", countryName: "Nigéria", zone: "YELLOW", regulatorAuthority: "SEC", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  TR: { countryCode: "TR", countryName: "Turquia", zone: "YELLOW", regulatorAuthority: "CMB", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },
  PH: { countryCode: "PH", countryName: "Filipinas", zone: "YELLOW", regulatorAuthority: "SEC", enforcementLevel: "REVERSE_SOLICITATION", hardBlock: false },

  // GREEN ZONE (100% Livre)
  BR: { countryCode: "BR", countryName: "Brasil", zone: "GREEN", regulatorAuthority: "LIBERADO_BR", enforcementLevel: "UNRESTRICTED_ACCESS", hardBlock: false },
  KM: { countryCode: "KM", countryName: "Comores", zone: "GREEN", regulatorAuthority: "Mwali/Anjouan", enforcementLevel: "OFFSHORE_LICENSED", hardBlock: false },
  VC: { countryCode: "VC", countryName: "São Vicente e Granadinas", zone: "GREEN", regulatorAuthority: "SVGFSA", enforcementLevel: "OFFSHORE_TOLERATED", hardBlock: false },
  SC: { countryCode: "SC", countryName: "Seychelles", zone: "GREEN", regulatorAuthority: "FSA", enforcementLevel: "OFFSHORE_LICENSED", hardBlock: false },
  VU: { countryCode: "VU", countryName: "Vanuatu", zone: "GREEN", regulatorAuthority: "VFSC", enforcementLevel: "OFFSHORE_LICENSED", hardBlock: false },
  MH: { countryCode: "MH", countryName: "Ilhas Marshall", zone: "GREEN", regulatorAuthority: "Maritime/Registry", enforcementLevel: "IBC_TOLERATED", hardBlock: false },
  CR: { countryCode: "CR", countryName: "Costa Rica", zone: "GREEN", regulatorAuthority: "General Commerce", enforcementLevel: "OFFSHORE_TOLERATED", hardBlock: false },
  LC: { countryCode: "LC", countryName: "Santa Lúcia", zone: "GREEN", regulatorAuthority: "FSRA", enforcementLevel: "OFFSHORE_LICENSED", hardBlock: false },
  CO: { countryCode: "CO", countryName: "Colômbia", zone: "GREEN", regulatorAuthority: "SFC", enforcementLevel: "UNRESTRICTED_ACCESS", hardBlock: false },
  AR: { countryCode: "AR", countryName: "Argentina", zone: "GREEN", regulatorAuthority: "CNV", enforcementLevel: "UNRESTRICTED_ACCESS", hardBlock: false },
  CL: { countryCode: "CL", countryName: "Chile", zone: "GREEN", regulatorAuthority: "CMF", enforcementLevel: "UNRESTRICTED_ACCESS", hardBlock: false },
  PE: { countryCode: "PE", countryName: "Peru", zone: "GREEN", regulatorAuthority: "SMV", enforcementLevel: "UNRESTRICTED_ACCESS", hardBlock: false }
};

export class RegulatoryZoneService {
  constructor(
    private pg?: any,
    private redis?: any
  ) {}

  /**
   * Sanitiza e extrai o código do país com proteção anti-spoofing
   */
  static extractCountry(req: FastifyRequest): string {
    const cfCountry = req.headers["cf-ipcountry"];
    if (typeof cfCountry === "string") {
      const sanitized = cfCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    const xCountry = req.headers["x-country-code"];
    if (typeof xCountry === "string") {
      const sanitized = xCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    const testCountry = req.headers["x-test-country"];
    if (process.env.NODE_ENV !== "production" && typeof testCountry === "string") {
      const sanitized = testCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    // Default para hospedagem direta e testes: Brasil 100% livre
    return "BR";
  }

  /**
   * Obtém informações da jurisdição por código de país
   */
  async getJurisdiction(countryCode: string): Promise<RegulatoryJurisdictionInfo> {
    const upper = countryCode.toUpperCase();

    // 1. Tentar Cache Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(`reg:jurisdiction:${upper}`);
        if (cached) return JSON.parse(cached);
      } catch {
        // Falha no Redis ignora e segue para Postgres/Static
      }
    }

    // 2. Tentar PostgreSQL se disponível
    if (this.pg) {
      try {
        const res = await this.pg.query(
          `SELECT country_code, country_name, zone, regulator_authority, enforcement_level, hard_block 
           FROM regulatory_jurisdictions WHERE country_code = $1`,
          [upper]
        );
        if (res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          const info: RegulatoryJurisdictionInfo = {
            countryCode: row.country_code,
            countryName: row.country_name,
            zone: row.zone,
            regulatorAuthority: row.regulator_authority,
            enforcementLevel: row.enforcement_level,
            hardBlock: Boolean(row.hard_block)
          };

          if (this.redis) {
            try {
              await this.redis.set(`reg:jurisdiction:${upper}`, JSON.stringify(info), "EX", 3600);
            } catch {
              // Ignore cache write failure
            }
          }
          return info;
        }
      } catch {
        // Fallback para mapa estático
      }
    }

    // 3. Fallback estático em memória (Defesa em profundidade garantida)
    if (STATIC_REGULATORY_MAP[upper]) {
      return STATIC_REGULATORY_MAP[upper];
    }

    // Se não estiver em lista específica:
    // Se pertencer ao RED_ZONE_COUNTRIES:
    if (RED_ZONE_COUNTRIES.includes(upper as any)) {
      return {
        countryCode: upper,
        countryName: upper,
        zone: "RED",
        regulatorAuthority: "LOCAL_REGULATOR",
        enforcementLevel: "RETAIL_BAN",
        hardBlock: true
      };
    }

    // Caso padrão para países desconhecidos ou offshore não listados: GREEN de tolerância geral
    return {
      countryCode: upper,
      countryName: upper,
      zone: "GREEN",
      regulatorAuthority: "OFFSHORE_TOLERATED",
      enforcementLevel: "GENERAL_ACCESS",
      hardBlock: false
    };
  }

  /**
   * Determina se o país tem bloqueio rígido (Hard Geo-block)
   */
  async isHardBlocked(countryCode: string): Promise<boolean> {
    if (countryCode.toUpperCase() === "BR") return false; // Brasil 100% livre
    const info = await this.getJurisdiction(countryCode);
    return info.hardBlock || info.zone === "RED";
  }

  /**
   * Obtém o domínio espelho sugerido para o país
   */
  async getPreferredMirror(countryCode: string): Promise<string> {
    const upper = countryCode.toUpperCase();

    // 1. Tentar Cache Redis
    if (this.redis) {
      try {
        const cached = await this.redis.get(`reg:mirror:${upper}`);
        if (cached) return cached;
      } catch {
        // Fallback
      }
    }

    // 2. Consulta ao PostgreSQL
    if (this.pg) {
      try {
        // Busca espelho específico ativo
        const specificRes = await this.pg.query(
          `SELECT domain_name FROM mirror_domains 
           WHERE target_country = $1 AND status = 'ACTIVE' 
           ORDER BY priority ASC LIMIT 1`,
          [upper]
        );
        if (specificRes.rows && specificRes.rows.length > 0) {
          const domain = specificRes.rows[0].domain_name;
          if (this.redis) await this.redis.set(`reg:mirror:${upper}`, domain, "EX", 300).catch(() => {});
          return domain;
        }

        // Se não tiver espelho específico, busca espelho global ativo
        const globalRes = await this.pg.query(
          `SELECT domain_name FROM mirror_domains 
           WHERE target_country IS NULL AND status = 'ACTIVE' 
           ORDER BY priority ASC LIMIT 1`
        );
        if (globalRes.rows && globalRes.rows.length > 0) {
          const domain = globalRes.rows[0].domain_name;
          if (this.redis) await this.redis.set(`reg:mirror:${upper}`, domain, "EX", 300).catch(() => {});
          return domain;
        }
      } catch {
        // Fallback
      }
    }

    // 3. Fallback estático
    if (upper === "BR") return "app.nomedominio-br1.com";
    if (upper === "IN") return "app.nomedominio-in.com";
    return "app.nomedominio-global.com";
  }

  /**
   * Constrói o contexto regulatório completo da requisição
   */
  async resolveRoutingContext(req: FastifyRequest): Promise<RegulatoryRoutingContext> {
    const country = RegulatoryZoneService.extractCountry(req);
    const jurisdiction = await this.getJurisdiction(country);
    const suggestedMirror = await this.getPreferredMirror(country);

    return {
      country,
      zone: jurisdiction.zone,
      hardBlocked: jurisdiction.hardBlock,
      regulatorAuthority: jurisdiction.regulatorAuthority,
      suggestedMirror
    };
  }
}
