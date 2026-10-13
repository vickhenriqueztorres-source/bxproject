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
  | "es-PE";

export type ActiveDisplayCurrency = DisplayCurrencyCode | "USD";

function buildCatalog(common: any, auth: any, wallet: any, contracts: any, admin: any) {
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
    withdraw_demo: wallet.withdraw_demo
  };
}

const catalogs: Record<string, any> = {
  "pt-BR": buildCatalog(ptBRCommon, ptBRAuth, ptBRWallet, ptBRContracts, ptBRAdmin),
  "es-MX": buildCatalog(esMXCommon, esMXAuth, esMXWallet, esMXContracts, esMXAdmin),
  "es-CO": buildCatalog(esCOCommon, esCOAuth, esCOWallet, esCOContracts, esCOAdmin),
  "es-AR": buildCatalog(esARCommon, esARAuth, esARWallet, esARContracts, esARAdmin),
  "es-CL": buildCatalog(esCLCommon, esCLAuth, esCLWallet, esCLContracts, esCLAdmin),
  "es-PE": buildCatalog(esPECommon, esPEAuth, esPEWallet, esPEContracts, esPEAdmin),
  // es-ES alias para es-MX
  "es-ES": buildCatalog(esMXCommon, esMXAuth, esMXWallet, esMXContracts, esMXAdmin)
};

const LOCALE_TO_COUNTRY: Record<Locale, CountryCode> = {
  "pt-BR": "BR",
  "es-MX": "MX",
  "es-CO": "CO",
  "es-AR": "AR",
  "es-CL": "CL",
  "es-PE": "PE",
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

interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale) => void;
  currency: ActiveDisplayCurrency;
  setCurrency: (curr: ActiveDisplayCurrency) => void;
  timezone: string;
  t: (path: string, params?: Record<string, string | number>) => string;
  formatBalance: (minorUSD: number | null) => string;
  formatDateTime: (date: Date | string | number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    // 1. Tenta recuperar do cookie
    const cookieLocale = getLocaleCookie() as Locale;
    if (cookieLocale && catalogs[cookieLocale]) return cookieLocale;

    // 2. Tenta recuperar do localStorage
    try {
      const saved = localStorage.getItem("broker_locale") as Locale;
      if (saved && catalogs[saved]) return saved;
    } catch {}

    // 3. Fallback pelo país detectado (se injetado no DOM ou window)
    if (typeof window !== "undefined" && (window as any).__GEO_LOCALE__) {
      const geoLocale = (window as any).__GEO_LOCALE__ as Locale;
      if (catalogs[geoLocale]) {
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

  const [currency, setCurrencyState] = useState<ActiveDisplayCurrency>(() => {
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem("broker_currency");
        if (saved && (saved === "USD" || CURRENCY_CONFIGS[saved as DisplayCurrencyCode])) {
          return saved as ActiveDisplayCurrency;
        }
      }
    } catch {}
    return "USD";
  });

  const country = LOCALE_TO_COUNTRY[locale] || "BR";
  const timezone = getTimezoneForCountry(country);

  // Consulta assíncrona ao Region Router caso o usuário não tenha definido explicitamente
  useEffect(() => {
    let isExplicit = false;
    try {
      isExplicit = Boolean(localStorage.getItem("broker_locale_explicit"));
    } catch {}

    if (!isExplicit && typeof fetch !== "undefined") {
      fetch("/api/v1/geo/resolve")
        .then((res) => {
          if (!res.ok) throw new Error("geo resolve failed");
          return res.json();
        })
        .then((data) => {
          if (data && data.defaultLocale && catalogs[data.defaultLocale]) {
            setLocaleState(data.defaultLocale);
            try {
              localStorage.setItem("broker_locale", data.defaultLocale);
            } catch {}
            setLocaleCookie(data.defaultLocale);
          }
        })
        .catch(() => {
          // Ignora silenciosamente em offline
        });
    }
  }, []);

  const setLocale = (loc: Locale) => {
    setLocaleState(loc);
    try {
      localStorage.setItem("broker_locale", loc);
      localStorage.setItem("broker_locale_explicit", "true");
    } catch {}
    setLocaleCookie(loc);
  };

  const setCurrency = (curr: ActiveDisplayCurrency) => {
    setCurrencyState(curr);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("broker_currency", curr);
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
      ARS: 980.00,
      CLP: 940.00,
      PEN: 3.75
    };

    const rate = defaultRates[currency as DisplayCurrencyCode] || 1.0;
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
        currency,
        setCurrency,
        timezone,
        t,
        formatBalance,
        formatDateTime
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
      currency: "USD",
      setCurrency: () => {},
      timezone: "America/Mexico_City",
      t: (path: string) => path,
      formatBalance: () => "--",
      formatDateTime: () => "--"
    };
  }
  return context;
}
