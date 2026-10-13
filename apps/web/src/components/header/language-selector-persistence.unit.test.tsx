import { describe, it, beforeEach, expect, vi } from "vitest";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  I18nProvider,
  useTranslation,
  getLocaleCookie,
  setLocaleCookie,
  Locale
} from "../../i18n/index";
import {
  LanguageSelectorDropdown,
  LANGUAGE_OPTIONS
} from "./LanguageSelectorDropdown";

// Mock leve de document, localStorage e window para execução isolada em Node
if (typeof (globalThis as any).document === "undefined") {
  let cookieStore = "";
  (globalThis as any).document = {
    get cookie() {
      return cookieStore;
    },
    set cookie(val: string) {
      if (val.includes("max-age=0")) {
        cookieStore = "";
      } else {
        const [cookiePart] = val.split(";");
        const [key, ...rest] = cookiePart.split("=");
        const value = rest.join("=");
        const map = new Map<string, string>();
        cookieStore.split("; ").filter(Boolean).forEach(c => {
          const [k, v] = c.split("=");
          if (k) map.set(k.trim(), v);
        });
        map.set(key.trim(), value);
        cookieStore = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
      }
    }
  };
}

if (typeof (globalThis as any).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
}

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}

describe("Subetapa 10.2: Troca de Idioma, Seletor no Header e Persistência", () => {
  beforeEach(() => {
    // Limpa cookies e localStorage antes de cada teste
    if (typeof document !== "undefined") {
      document.cookie = "broker_locale=; path=/; max-age=0";
    }
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof window !== "undefined") {
      delete (window as any).__GEO_LOCALE__;
    }
  });

  it("1. Seletor de Idioma: Renderiza todas as 6 opções regionais com suas respectivas bandeiras", () => {
    const html = renderToString(
      <I18nProvider>
        <LanguageSelectorDropdown />
      </I18nProvider>
    );

    assert(html.includes('data-testid="header-language-selector"'));
    assert(html.includes('data-testid="language-dropdown-toggle"'));

    // Verifica que as 6 opções de idioma dos 6 países estão catalogadas
    assert.strictEqual(LANGUAGE_OPTIONS.length, 6);
    const codes = LANGUAGE_OPTIONS.map(o => o.code);
    assert(codes.includes("pt-BR"));
    assert(codes.includes("es-MX"));
    assert(codes.includes("es-CO"));
    assert(codes.includes("es-AR"));
    assert(codes.includes("es-CL"));
    assert(codes.includes("es-PE"));
  });

  it("2. Persistência em Cookie: setLocaleCookie e getLocaleCookie gravam e recuperam com precisão", () => {
    setLocaleCookie("es-MX", 30);
    const retrieved = getLocaleCookie();
    assert.strictEqual(retrieved, "es-MX", "Cookie broker_locale deve recuperar es-MX");

    setLocaleCookie("pt-BR", 30);
    assert.strictEqual(getLocaleCookie(), "pt-BR", "Cookie broker_locale deve atualizar para pt-BR");
  });

  it("3. Persistência Bilateral: setLocale grava tanto em localStorage quanto em document.cookie", () => {
    let currentContext: any = null;

    function TestConsumer() {
      currentContext = useTranslation();
      return <div data-testid="active-locale">{currentContext.locale}</div>;
    }

    renderToString(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>
    );

    assert(currentContext !== null);

    // Altera o idioma para es-CO (Colômbia)
    currentContext.setLocale("es-CO");

    // Verifica gravação em localStorage
    assert.strictEqual(localStorage.getItem("broker_locale"), "es-CO");
    assert.strictEqual(localStorage.getItem("broker_locale_explicit"), "true");

    // Verifica gravação em cookie
    assert.strictEqual(getLocaleCookie(), "es-CO");
  });

  it("4. Default pelo País Detectado: Carrega idioma pelo país quando não há preferência prévia", () => {
    // Simula geolocalização detectada para o México (MX -> es-MX)
    (window as any).__GEO_LOCALE__ = "es-MX";

    let contextInstance: any = null;
    function Consumer() {
      contextInstance = useTranslation();
      return <div>{contextInstance.locale}</div>;
    }

    renderToString(
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    );

    assert.strictEqual(contextInstance.locale, "es-MX", "Deve assumir es-MX como default a partir do país detectado");
    assert.strictEqual(localStorage.getItem("broker_locale"), "es-MX", "Deve persistir o default detectado");
    assert.strictEqual(getLocaleCookie(), "es-MX", "Deve persistir o default detectado em cookie");
  });

  it("5. Recuperação de Sessão Anterior via Cookie se localStorage estiver vazio", () => {
    // Cookie já presente de uma visita anterior
    setLocaleCookie("es-AR");
    localStorage.clear();

    let contextInstance: any = null;
    function Consumer() {
      contextInstance = useTranslation();
      return <div>{contextInstance.locale}</div>;
    }

    renderToString(
      <I18nProvider>
        <Consumer />
      </I18nProvider>
    );

    assert.strictEqual(contextInstance.locale, "es-AR", "Deve restaurar es-AR a partir do cookie gravado");
  });
});
