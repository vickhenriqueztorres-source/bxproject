import { CountryCode, PHASE2_COUNTRIES } from "./types.js";

export const COUNTRY_TIMEZONES: Record<CountryCode, string> = {
  // Já implementados (6)
  BR: "America/Sao_Paulo",          // UTC-3
  MX: "America/Mexico_City",         // UTC-6
  CO: "America/Bogota",              // UTC-5
  AR: "America/Argentina/Buenos_Aires", // UTC-3
  CL: "America/Santiago",            // UTC-4 (UTC-3 no verão)
  PE: "America/Lima",                // UTC-5

  // Novos (12)
  VE: "America/Caracas",             // UTC-4
  EC: "America/Guayaquil",           // UTC-5
  GT: "America/Guatemala",           // UTC-6
  BO: "America/La_Paz",              // UTC-4
  DO: "America/Santo_Domingo",       // UTC-4
  HN: "America/Tegucigalpa",         // UTC-6
  PY: "America/Asuncion",            // UTC-4 (UTC-3 no verão)
  NI: "America/Managua",             // UTC-6
  SV: "America/El_Salvador",         // UTC-6
  CR: "America/Costa_Rica",          // UTC-6
  PA: "America/Panama",              // UTC-5
  UY: "America/Montevideo"           // UTC-3
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
