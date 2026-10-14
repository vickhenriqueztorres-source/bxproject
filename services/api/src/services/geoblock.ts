import { FastifyRequest } from "fastify";
import { CountryCode, DisplayCurrencyCode, PHASE2_COUNTRIES, COUNTRY_TIMEZONES } from "@broker/shared";

export interface GeoContext {
  country: string;
  allowed: boolean;
  defaultCurrency: DisplayCurrencyCode;
  defaultLocale: string;
  timezone: string;
}

export const COUNTRY_METADATA: Record<CountryCode, { currency: DisplayCurrencyCode; locale: string; name: string; timezone: string }> = {
  BR: { currency: "BRL", locale: "pt-BR", name: "Brasil", timezone: "America/Sao_Paulo" },
  MX: { currency: "MXN", locale: "es-MX", name: "México", timezone: "America/Mexico_City" },
  CO: { currency: "COP", locale: "es-CO", name: "Colômbia", timezone: "America/Bogota" },
  AR: { currency: "ARS", locale: "es-AR", name: "Argentina", timezone: "America/Argentina/Buenos_Aires" },
  CL: { currency: "CLP", locale: "es-CL", name: "Chile", timezone: "America/Santiago" },
  PE: { currency: "PEN", locale: "es-PE", name: "Peru", timezone: "America/Lima" }
};

export class GeoBlockService {
  /**
   * Fallback de geolocalização por faixa de IP regional LatAm (Seções 3.1 e 10.1)
   */
  static resolveCountryFromIp(ip?: string): CountryCode | null {
    if (!ip || typeof ip !== "string") return null;
    const clean = ip.replace(/^::ffff:/, "").trim();
    if (clean.startsWith("177.") || clean.startsWith("189.4.") || clean.startsWith("200.160.")) return "BR";
    if (clean.startsWith("187.188.") || clean.startsWith("201.144.")) return "MX";
    if (clean.startsWith("181.48.") || clean.startsWith("190.24.")) return "CO";
    if (clean.startsWith("181.16.") || clean.startsWith("190.19.")) return "AR";
    if (clean.startsWith("190.45.") || clean.startsWith("200.83.")) return "CL";
    if (clean.startsWith("190.42.") || clean.startsWith("200.48.")) return "PE";
    return null;
  }

  /**
   * Extrai o código de país a partir dos cabeçalhos da requisição ou fallback GeoIP com sanitização
   */
  static extractCountry(req: FastifyRequest): string {
    // 1. Cloudflare header
    const cfCountry = req.headers?.["cf-ipcountry"];
    if (typeof cfCountry === "string") {
      const sanitized = cfCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    // 2. Header de borda reverso X-Country-Code
    const xCountry = req.headers?.["x-country-code"];
    if (typeof xCountry === "string") {
      const sanitized = xCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    // 3. Header para testes ou desenvolvimento controlado
    const testCountry = req.headers?.["x-test-country"];
    if (process.env.NODE_ENV !== "production" && typeof testCountry === "string") {
      const sanitized = testCountry.trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
      return "UNKNOWN";
    }

    // 4. Fallback GeoIP por endereço IP ou X-Forwarded-For (Seções 3.1 e 10.1)
    const forwardedIp = typeof req.headers?.["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : (req as any).ip;
    const ipCountry = this.resolveCountryFromIp(forwardedIp);
    if (ipCountry) return ipCountry;

    // Default quando ausente ou não determinável: Brasil 100% livre para hospedagem e testes
    return "BR";
  }

  /**
   * Verifica se o país faz parte da allowlist da Fase 2 (Brasil é 100% livre)
   */
  static isAllowed(country: string): boolean {
    const upper = country.toUpperCase();
    if (upper === "BR") return true; // Brasil 100% livre
    return PHASE2_COUNTRIES.includes(upper as CountryCode);
  }

  /**
   * Constrói o contexto geográfico completo da requisição
   */
  static resolveGeoContext(req: FastifyRequest): GeoContext {
    const country = this.extractCountry(req);
    const allowed = this.isAllowed(country);

    if (allowed) {
      const meta = COUNTRY_METADATA[country as CountryCode];
      return {
        country,
        allowed: true,
        defaultCurrency: meta.currency,
        defaultLocale: meta.locale,
        timezone: meta.timezone
      };
    }

    // Fallback para países bloqueados ou desconhecidos
    return {
      country,
      allowed: false,
      defaultCurrency: "BRL",
      defaultLocale: "pt-BR",
      timezone: "America/Sao_Paulo"
    };
  }
}
