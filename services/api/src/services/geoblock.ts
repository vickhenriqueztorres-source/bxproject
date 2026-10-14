import { FastifyRequest } from "fastify";
import { CountryCode, DisplayCurrencyCode, PHASE2_COUNTRIES, COUNTRY_TIMEZONES } from "@broker/shared";
import { RegionalMetricsService } from "./metrics.js";

export interface GeoContext {
  country: string;
  allowed: boolean;
  defaultCurrency: DisplayCurrencyCode;
  defaultLocale: string;
  timezone: string;
  providerFailed?: boolean;
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
  private static simulatedFailure = false;
  private static customGeoProvider: ((req: FastifyRequest) => string | null) | null = null;

  /**
   * Simula falha no motor/provedor de Geoblocking para testes de caos e resiliência (Modo de Falha 3)
   */
  static setSimulatedFailure(failed: boolean): void {
    this.simulatedFailure = failed;
  }

  static isSimulatedFailure(): boolean {
    return this.simulatedFailure;
  }

  static setCustomGeoProvider(provider: ((req: FastifyRequest) => string | null) | null): void {
    this.customGeoProvider = provider;
  }

  private static isLocalOrPrivateIp(ip?: string): boolean {
    if (!ip || typeof ip !== "string") return true;
    const clean = ip.replace(/^::ffff:/, "").trim().toLowerCase();
    return (
      clean === "" ||
      clean === "127.0.0.1" ||
      clean === "::1" ||
      clean === "localhost" ||
      clean.startsWith("127.") ||
      clean.startsWith("10.") ||
      clean.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)
    );
  }

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
   * Extrai o código de país a partir dos cabeçalhos da requisição ou fallback GeoIP com sanitização.
   * Em caso de falha do provedor GeoIP ou IP externo desconhecido sem header, opera em Fail-Closed ("UNKNOWN").
   */
  static extractCountry(req: FastifyRequest): string {
    try {
      if (this.simulatedFailure) {
        RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
        return "UNKNOWN";
      }

      if (!req || typeof req !== "object") {
        RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
        return "UNKNOWN";
      }

      if (this.customGeoProvider) {
        try {
          const customCountry = this.customGeoProvider(req);
          if (!customCountry || typeof customCountry !== "string") {
            RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
            return "UNKNOWN";
          }
          const sanitized = customCountry.trim().toUpperCase();
          if (/^[A-Z]{2}$/.test(sanitized) && sanitized !== "XX" && sanitized !== "T1") {
            return sanitized;
          }
          RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
          return "UNKNOWN";
        } catch {
          RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
          return "UNKNOWN";
        }
      }

      const headers = req.headers || {};

      // Sinal explícito de falha de borda/GeoIP
      if (headers["x-geo-error"] || headers["x-geo-provider-status"] === "failed") {
        RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
        return "UNKNOWN";
      }

      // 1. Cloudflare header
      const cfCountry = headers["cf-ipcountry"];
      if (typeof cfCountry === "string") {
        const sanitized = cfCountry.trim().toUpperCase();
        // XX = Unknown Country no Cloudflare; T1 = Tor Exit Node
        if (sanitized === "XX" || sanitized === "T1") {
          RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
          return "UNKNOWN";
        }
        if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
        return "UNKNOWN";
      }

      // 2. Header de borda reverso X-Country-Code
      const xCountry = headers["x-country-code"];
      if (typeof xCountry === "string") {
        const sanitized = xCountry.trim().toUpperCase();
        if (sanitized === "XX" || sanitized === "T1") {
          RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
          return "UNKNOWN";
        }
        if (/^[A-Z]{2}$/.test(sanitized)) return sanitized;
        return "UNKNOWN";
      }

      // 3. Header para testes ou desenvolvimento controlado
      const testCountry = headers["x-test-country"];
      if (process.env.NODE_ENV !== "production" && typeof testCountry === "string") {
        const sanitized = testCountry.trim().toUpperCase();
        if (/^[A-Z]{2}$/.test(sanitized) && sanitized !== "XX" && sanitized !== "T1") return sanitized;
        return "UNKNOWN";
      }

      // 4. Fallback GeoIP por endereço IP ou X-Forwarded-For (Seções 3.1 e 10.1)
      const hasForwardedFor = typeof headers["x-forwarded-for"] === "string" && headers["x-forwarded-for"].trim().length > 0;
      const forwardedIp = hasForwardedFor
        ? (headers["x-forwarded-for"] as string).split(",")[0].trim()
        : (req as any).ip;
      const ipCountry = this.resolveCountryFromIp(forwardedIp);
      if (ipCountry) return ipCountry;

      // Se um IP público externo (não privado/loopback) veio via X-Forwarded-For sem header de país e não pertence à LatAm:
      // Fail-Closed ("UNKNOWN") para impedir que falha no header GeoIP libere país sancionado!
      if (hasForwardedFor && !this.isLocalOrPrivateIp(forwardedIp)) {
        RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
        return "UNKNOWN";
      }

      // Default quando ausente em hospedagem local/direta e testes: Brasil 100% livre
      return "BR";
    } catch {
      RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
      return "UNKNOWN";
    }
  }

  /**
   * Verifica se o país faz parte da allowlist da Fase 2 (Brasil é 100% livre)
   */
  static isAllowed(country: string): boolean {
    if (!country || typeof country !== "string") return false;
    if (this.simulatedFailure) return false;
    const upper = country.toUpperCase();
    if (upper === "UNKNOWN" || upper === "XX" || upper === "T1") return false;
    if (upper === "BR") return true; // Brasil 100% livre
    return PHASE2_COUNTRIES.includes(upper as CountryCode);
  }

  /**
   * Constrói o contexto geográfico completo da requisição (Fail-Closed em caso de exceção)
   */
  static resolveGeoContext(req: FastifyRequest): GeoContext {
    try {
      const country = this.extractCountry(req);
      const allowed = this.isAllowed(country);

      if (allowed) {
        const meta = COUNTRY_METADATA[country as CountryCode];
        if (meta) {
          return {
            country,
            allowed: true,
            defaultCurrency: meta.currency,
            defaultLocale: meta.locale,
            timezone: meta.timezone,
            providerFailed: false
          };
        }
      }

      // Fallback Fail-Closed para países bloqueados, desconhecidos ou sob falha de GeoIP
      return {
        country,
        allowed: false,
        defaultCurrency: "BRL",
        defaultLocale: "pt-BR",
        timezone: "America/Sao_Paulo",
        providerFailed: this.simulatedFailure || country === "UNKNOWN"
      };
    } catch {
      RegionalMetricsService.getInstance().incrementGeoblockProviderFailure();
      return {
        country: "UNKNOWN",
        allowed: false,
        defaultCurrency: "BRL",
        defaultLocale: "pt-BR",
        timezone: "America/Sao_Paulo",
        providerFailed: true
      };
    }
  }
}
