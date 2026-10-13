import { CountryCode, PHASE2_COUNTRIES } from "./types.js";

export const COUNTRY_TIMEZONES: Record<CountryCode, string> = {
  BR: "America/Sao_Paulo",
  MX: "America/Mexico_City",
  CO: "America/Bogota",
  AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago",
  PE: "America/Lima"
};

/**
 * Retorna o timezone IANA padrão para um código de país
 */
export function getTimezoneForCountry(country: CountryCode): string {
  return COUNTRY_TIMEZONES[country] || "UTC";
}

/**
 * Formata data e hora utilizando Intl.DateTimeFormat respeitando o timezone regional
 */
export function formatDateTime(
  date: Date | string | number,
  locale: string = "pt-BR",
  timeZone?: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "object" ? date : new Date(date);
  if (isNaN(dateObj.getTime())) {
    return "--";
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(timeZone ? { timeZone } : {}),
    ...options
  };

  try {
    return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
  } catch {
    // Fallback sem timezone específico em caso de ambiente não suportado
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).format(dateObj);
  }
}

/**
 * Formata apenas o horário (HH:mm:ss) no timezone regional
 */
export function formatTime(
  date: Date | string | number,
  locale: string = "pt-BR",
  timeZone?: string
): string {
  return formatDateTime(date, locale, timeZone, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}
