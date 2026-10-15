import React, { createContext, useContext, useState, useEffect } from "react";
import {
  DisplayCurrencyCode,
  convertUSDMinorToDisplay,
  CURRENCY_CONFIGS,
  COUNTRY_TIMEZONES,
  getTimezoneForCountry,
  formatDateTime as sharedFormatDateTime,
  CountryCode
} from "@broker/shared";

// Importação modular dos 5 namespaces para os 6 países suportados
import ptBRCommon from "./locales/pt-BR/common.json";
import ptBRAuth from "./locales/pt-BR/auth.json";
import ptBRWallet from "./locales/pt-BR/wallet.json";
import ptBRContracts from "./locales/pt-BR/contracts.json";
import ptBRAdmin from "./locales/pt-BR/admin.json";

import esMXCommon from "./locales/es-MX/common.json";
import esMXAuth from "./locales/es-MX/auth.json";
import esMXWallet from "./locales/es-MX/wallet.json";
import esMXContracts from "./locales/es-MX/contracts.json";
import esMXAdmin from "./locales/es-MX/admin.json";

import esCOCommon from "./locales/es-CO/common.json";
import esCOAuth from "./locales/es-CO/auth.json";
import esCOWallet from "./locales/es-CO/wallet.json";
import esCOContracts from "./locales/es-CO/contracts.json";
import esCOAdmin from "./locales/es-CO/admin.json";

import esARCommon from "./locales/es-AR/common.json";
import esARAuth from "./locales/es-AR/auth.json";
import esARWallet from "./locales/es-AR/wallet.json";
import esARContracts from "./locales/es-AR/contracts.json";
import esARAdmin from "./locales/es-AR/admin.json";

import esCLCommon from "./locales/es-CL/common.json";
import esCLAuth from "./locales/es-CL/auth.json";
import esCLWallet from "./locales/es-CL/wallet.json";
import esCLContracts from "./locales/es-CL/contracts.json";
import esCLAdmin from "./locales/es-CL/admin.json";

import esPECommon from "./locales/es-PE/common.json";
import esPEAuth from "./locales/es-PE/auth.json";
import esPEWallet from "./locales/es-PE/wallet.json";
import esPEContracts from "./locales/es-PE/contracts.json";
import esPEAdmin from "./locales/es-PE/admin.json";

export type Locale =
  | "pt-BR"
  | "es-ES"
  | "es-MX"
  | "es-CO"
  | "es-AR"
  | "es-CL"
  | "es-PE"
  | "es-VE"
  | "es-EC"
  | "es-GT"
  | "es-BO"
  | "es-DO"
  | "es-HN"
  | "es-PY"
  | "es-NI"
  | "es-SV"
  | "es-CR"
  | "es-PA"
  | "es-UY";

export type ActiveDisplayCurrency = DisplayCurrencyCode | "USD";

function buildCatalog(common: any, auth: any, wallet: any, contracts: any, admin: any, lang: "pt" | "es" = "es") {
  const isPt = lang === "pt";
  return {
    common,
    auth,
    wallet,
    contracts,
    admin,
    // Mapeamento e aliases para compatibilidade total retroativa
    app: {
      title: common.title,
      demo_badge: wallet.demo_badge,
      live_badge: wallet.live_badge,
      deposit: wallet.deposit,
      reload_demo: wallet.reload_demo,
      sign_out: auth.sign_out,
      latency: common.latency,
      online: common.online,
      offline: common.offline
    },
    geoblock: common.geoblock,
    currencies: common.currencies,
    tabs: common.tabs,
    trade: contracts,
    withdraw_demo: wallet.withdraw_demo,
    arena: isPt
      ? {
          you: "Você",
          volatilityIndex: "Índice de Volatilidade",
          roomBronze: "Sala Bronze",
          roomSilver: "Sala Prata",
          roomGold: "Sala Ouro",
          classic: "Clássico",
          turbo: "Turbo"
        }
      : {
          you: "Tú",
          volatilityIndex: "Índice de Volatilidad",
          roomBronze: "Sala Bronce",
          roomSilver: "Sala Plata",
          roomGold: "Sala Oro",
          classic: "Clásico",
          turbo: "Turbo"
        },
    result: isPt
      ? {
          win: "Você ganhou!",
          loss: "Você perdeu",
          draw: "Empate"
        }
      : {
          win: "¡Ganaste!",
          loss: "Perdiste",
          draw: "Empate"
        },
    contract: isPt
      ? {
          pending: "Pendente",
          active: "Ativo",
          finished: "Finalizado",
          endsIn: "Termina em"
        }
      : {
          pending: "Pendiente",
          active: "Activo",
          finished: "Finalizado",
          endsIn: "Termina en"
        },
    mood: isPt
      ? {
          buy: "Compra",
          sell: "Venda",
          neutral: "Neutro"
        }
      : {
          buy: "Compra",
          sell: "Venta",
          neutral: "Neutral"
        },
    error: isPt
      ? {
          insufficientBalance: "Saldo insuficiente",
          serverError: "Erro no servidor",
          networkError: "Erro de conexão"
        }
      : {
          insufficientBalance: "Saldo insuficiente",
          serverError: "Error del servidor",
          networkError: "Error de conexión"
        }
  };
}

const defaultEsCatalog = buildCatalog(esMXCommon, esMXAuth, esMXWallet, esMXContracts, esMXAdmin, "es");

const catalogs: Record<string, any> = {
  "pt-BR": buildCatalog(ptBRCommon, ptBRAuth, ptBRWallet, ptBRContracts, ptBRAdmin, "pt"),
  "es-MX": defaultEsCatalog,
  "es-CO": buildCatalog(esCOCommon, esCOAuth, esCOWallet, esCOContracts, esCOAdmin, "es"),
  "es-AR": buildCatalog(esARCommon, esARAuth, esARWallet, esARContracts, esARAdmin, "es"),
  "es-CL": buildCatalog(esCLCommon, esCLAuth, esCLWallet, esCLContracts, esCLAdmin, "es"),
  "es-PE": buildCatalog(esPECommon, esPEAuth, esPEWallet, esPEContracts, esPEAdmin, "es"),
  "es-VE": defaultEsCatalog,
  "es-EC": defaultEsCatalog,
  "es-GT": defaultEsCatalog,
  "es-BO": defaultEsCatalog,
  "es-DO": defaultEsCatalog,
  "es-HN": defaultEsCatalog,
  "es-PY": defaultEsCatalog,
  "es-NI": defaultEsCatalog,
  "es-SV": defaultEsCatalog,
  "es-CR": defaultEsCatalog,
  "es-PA": defaultEsCatalog,
  "es-UY": defaultEsCatalog,
  // es-ES alias para es-MX
  "es-ES": defaultEsCatalog
};

const LOCALE_TO_COUNTRY: Record<Locale, CountryCode> = {
  "pt-BR": "BR",
  "es-MX": "MX",
  "es-CO": "CO",
  "es-AR": "AR",
  "es-CL": "CL",
  "es-PE": "PE",
  "es-VE": "VE",
  "es-EC": "EC",
  "es-GT": "GT",
  "es-BO": "BO",
  "es-DO": "DO",
  "es-HN": "HN",
  "es-PY": "PY",
  "es-NI": "NI",
  "es-SV": "SV",
  "es-CR": "CR",
  "es-PA": "PA",
  "es-UY": "UY",
  "es-ES": "MX"
};

export function getLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)broker_locale=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setLocaleCookie(locale: string, days = 365): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `broker_locale=${encodeURIComponent(locale)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

const COUNTRY_TO_CURRENCY: Record<CountryCode, ActiveDisplayCurrency> = {
  BR: "BRL",
  MX: "MXN",
  CO: "COP",
  AR: "ARS",
  CL: "CLP",
  PE: "PEN",
  VE: "VES",
  EC: "USD",
  GT: "GTQ",
  BO: "BOB",
  DO: "DOP",
  HN: "HNL",
  PY: "PYG",
  NI: "NIO",
  SV: "USD",
  CR: "CRC",
  PA: "USD",
  UY: "UYU"
};

export function isSupportedLocale(val: unknown): val is Locale {
  if (typeof val !== "string") return false;
  return Object.prototype.hasOwnProperty.call(catalogs, val);
}

interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  country: CountryCode;
  geoBlocked: boolean;
  currency: ActiveDisplayCurrency;
  setCurrency: (curr: ActiveDisplayCurrency) => void;
  timezone: string;
  t: (path: string, params?: Record<string, string | number>) => string;
  formatBalance: (minorUSD: number | null) => string;
  formatDateTime: (date: Date | string | number) => string;
  isI18nActive?: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode; initialLocale?: Locale }> = ({
  children,
  initialLocale,
}) => {
  const [geoBlocked, setGeoBlocked] = useState<boolean>(false);
  const [explicitSelection, setExplicitSelection] = useState<boolean>(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) return true;
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem("broker_locale_explicit") === "true") {
        return true;
      }
    } catch {}
    return typeof document !== "undefined";
  });

  const [locale, setLocaleState] = useState<Locale>(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) {
      return initialLocale;
    }

    // 1. Tenta recuperar do cookie
    const cookieLocale = getLocaleCookie();
    if (isSupportedLocale(cookieLocale)) return cookieLocale;

    // 2. Tenta recuperar do localStorage
    try {
      const saved = localStorage.getItem("broker_locale");
      if (isSupportedLocale(saved)) return saved;
    } catch {}

    // 3. Fallback pelo país detectado (se injetado no DOM ou window)
    if (typeof window !== "undefined" && (window as any).__GEO_LOCALE__) {
      const geoLocale = (window as any).__GEO_LOCALE__;
      if (isSupportedLocale(geoLocale)) {
        try {
          localStorage.setItem("broker_locale", geoLocale);
        } catch {}
        setLocaleCookie(geoLocale);
        return geoLocale;
      }
    }

    // 4. Detecção por idioma e país do navegador
    let detected: Locale = "pt-BR";
    if (typeof navigator !== "undefined") {
      const nav = navigator.language || "";
      if (nav.startsWith("pt")) detected = "pt-BR";
      else if (nav.includes("MX")) detected = "es-MX";
      else if (nav.includes("CO")) detected = "es-CO";
      else if (nav.includes("AR")) detected = "es-AR";
      else if (nav.includes("CL")) detected = "es-CL";
      else if (nav.includes("PE")) detected = "es-PE";
      else if (nav.startsWith("es")) detected = "es-MX";
    }

    try {
      localStorage.setItem("broker_locale", detected);
    } catch {}
    setLocaleCookie(detected);
    return detected;
  });

  useEffect(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) {
      setLocaleState(initialLocale);
      setExplicitSelection(true);
    }
  }, [initialLocale]);

  const country = LOCALE_TO_COUNTRY[locale] || "BR";
  const timezone = getTimezoneForCountry(country);

  const [currency, setCurrencyState] = useState<ActiveDisplayCurrency>(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("broker_currency");
        if (saved && (saved === "USD" || Object.prototype.hasOwnProperty.call(CURRENCY_CONFIGS, saved))) {
          return saved as ActiveDisplayCurrency;
        }
      }
    } catch {}
    return COUNTRY_TO_CURRENCY[LOCALE_TO_COUNTRY[locale] || "BR"] || "BRL";
  });

  // Consulta assíncrona ao Region Router (Seções 3.1 e 10.1)
  useEffect(() => {
    if (initialLocale && isSupportedLocale(initialLocale)) return;
    let isExplicit = false;
    let isCurrencyExplicit = false;
    try {
      isExplicit = Boolean(localStorage.getItem("broker_locale_explicit"));
      isCurrencyExplicit = Boolean(localStorage.getItem("broker_currency_explicit"));
    } catch {}

    if (typeof fetch !== "undefined") {
      fetch("/api/v1/geo/resolve")
        .then((res) => {
          if (!res.ok) throw new Error("geo resolve failed");
          return res.json();
        })
        .then((data) => {
          if (data && data.allowed === false) {
            setGeoBlocked(true);
            return;
          }
          setGeoBlocked(false);
          if (!isExplicit && data && isSupportedLocale(data.defaultLocale)) {
            setLocaleState(data.defaultLocale);
            try {
              localStorage.setItem("broker_locale", data.defaultLocale);
            } catch {}
            setLocaleCookie(data.defaultLocale);
          }
          if (!isCurrencyExplicit && data && data.defaultCurrency && Object.prototype.hasOwnProperty.call(CURRENCY_CONFIGS, data.defaultCurrency)) {
            setCurrencyState(data.defaultCurrency as ActiveDisplayCurrency);
            try {
              localStorage.setItem("broker_currency", data.defaultCurrency);
            } catch {}
          }
        })
        .catch(() => {
          // Ignora silenciosamente em offline
        });
    }
  }, [initialLocale]);

  const setLocale = (loc: Locale) => {
    const safeLoc: Locale = isSupportedLocale(loc) ? loc : "pt-BR";
    setLocaleState(safeLoc);
    setExplicitSelection(true);
    const nextCountry = LOCALE_TO_COUNTRY[safeLoc] || "BR";
    const autoCurr = COUNTRY_TO_CURRENCY[nextCountry];
    try {
      localStorage.setItem("broker_locale", safeLoc);
      localStorage.setItem("broker_locale_explicit", "true");
      if (!localStorage.getItem("broker_currency_explicit") && autoCurr) {
        setCurrencyState(autoCurr);
        localStorage.setItem("broker_currency", autoCurr);
      }
    } catch {}
    setLocaleCookie(safeLoc);
  };

  const setCurrency = (curr: ActiveDisplayCurrency) => {
    setCurrencyState(curr);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("broker_currency", curr);
        localStorage.setItem("broker_currency_explicit", "true");
      }
    } catch {}
  };

  const t = (path: string, params?: Record<string, string | number>): string => {
    // Suporta 'namespace.key' ou 'namespace:key'
    const normalizedPath = path.replace(":", ".");
    const keys = normalizedPath.split(".");

    let current = catalogs[locale];
    for (const k of keys) {
      if (current && typeof current === "object" && k in current) {
        current = current[k];
      } else {
        // Fallback primário para es-MX (se for espanhol) ou pt-BR
        const fallbackCatalog = locale.startsWith("es") ? catalogs["es-MX"] : catalogs["pt-BR"];
        let fallbackVal = fallbackCatalog;
        for (const fk of keys) {
          if (fallbackVal && typeof fallbackVal === "object" && fk in fallbackVal) {
            fallbackVal = fallbackVal[fk];
          } else {
            // Fallback absoluto para pt-BR
            let absFallback = catalogs["pt-BR"];
            for (const ak of keys) {
              if (absFallback && typeof absFallback === "object" && ak in absFallback) {
                absFallback = absFallback[ak];
              } else {
                return path;
              }
            }
            fallbackVal = absFallback;
            break;
          }
        }
        current = fallbackVal;
        break;
      }
    }

    if (typeof current !== "string") {
      return path;
    }

    let result = current;
    if (params) {
      for (const [pKey, pVal] of Object.entries(params)) {
        result = result.replace(new RegExp(`{{${pKey}}}`, "g"), String(pVal));
      }
    }

    return result;
  };

  const { rates: liveRates } = useExchangeRates();

  const formatBalance = (minorUSD: number | null): string => {
    if (minorUSD === null || minorUSD === undefined) return "--";

    if (currency === "USD") {
      const usdAmount = minorUSD / 100;
      return `$ ${usdAmount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    const defaultRates: Record<DisplayCurrencyCode, number> = {
      BRL: 5.50,
      MXN: 19.50,
      COP: 4150.00,
      ARS: 1050.00,
      CLP: 940.00,
      PEN: 3.75,
      VES: 45.00,
      GTQ: 7.75,
      BOB: 6.91,
      DOP: 60.10,
      HNL: 25.10,
      PYG: 7800.00,
      NIO: 36.80,
      CRC: 512.00,
      UYU: 41.80
    };

    const rate = liveRates[currency as DisplayCurrencyCode] || defaultRates[currency as DisplayCurrencyCode] || 1.0;
    const converted = convertUSDMinorToDisplay(minorUSD, rate, currency as DisplayCurrencyCode, locale);
    return converted.formatted;
  };

  const formatDateTime = (date: Date | string | number): string => {
    return sharedFormatDateTime(date, locale, timezone);
  };

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        country,
        geoBlocked,
        currency,
        setCurrency,
        timezone,
        t,
        formatBalance,
        formatDateTime,
        isI18nActive: true,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      locale: "es-ES",
      setLocale: () => {},
      country: "MX",
      geoBlocked: false,
      currency: "USD",
      setCurrency: () => {},
      timezone: "America/Mexico_City",
      t: (path: string) => path,
      formatBalance: () => "--",
      formatDateTime: () => "--",
      isI18nActive: false,
    };
  }
  return context;
}

export function useUiLanguage(defaultLang: "pt" | "es" = "es"): "pt" | "es" {
  const context = useContext(I18nContext);
  if (!context) {
    return defaultLang;
  }
  return context.locale.startsWith("pt") ? "pt" : "es";
}

function useExchangeRates() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof fetch === "undefined") return;
    let cancelled = false;

    const fetchRates = async () => {
      try {
        const res = await fetch("/api/currencies");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;

        const newRates: Record<string, number> = {};
        let latestUpdate = "";

        data.forEach((item: { code: string; rate: number; updated_at?: string }) => {
          if (item && typeof item.code === "string" && Number.isFinite(Number(item.rate))) {
            newRates[item.code] = Number(item.rate);
            if (item.updated_at && item.updated_at > latestUpdate) {
              latestUpdate = item.updated_at;
            }
          }
        });

        setRates(newRates);
        if (latestUpdate) setUpdatedAt(latestUpdate);
      } catch {
        // Mantém fallback estático silenciosamente em modo offline/teste
      }
    };

    fetchRates();
    const interval = setInterval(fetchRates, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { rates, updatedAt };
}

