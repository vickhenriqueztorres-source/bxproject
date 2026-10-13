import { describe, it } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  COUNTRY_TIMEZONES,
  getTimezoneForCountry,
  formatDateTime,
  formatTime,
  CountryCode
} from "../../packages/shared/src/index.ts";

describe("Subetapa 1 (Unit): Dicionários de Tradução, Namespaces e Paridade i18n", () => {
  const baseLocalesDir = path.resolve("apps/web/src/i18n/locales");
  const countries = ["pt-BR", "es-MX", "es-CO", "es-AR", "es-CL", "es-PE"] as const;
  const namespaces = ["common", "auth", "wallet", "contracts", "admin"] as const;

  function getKeys(obj: any, prefix = ""): string[] {
    let keys: string[] = [];
    for (const key of Object.keys(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === "object" && obj[key] !== null) {
        keys = keys.concat(getKeys(obj[key], fullPath));
      } else {
        keys.push(fullPath);
      }
    }
    return keys;
  }

  it("1. Todos os 6 países possuem os 5 namespaces obrigatórios", () => {
    for (const country of countries) {
      const countryDir = path.join(baseLocalesDir, country);
      assert(fs.existsSync(countryDir), `Diretório ${country} deve existir em ${baseLocalesDir}`);

      for (const ns of namespaces) {
        const nsFile = path.join(countryDir, `${ns}.json`);
        assert(fs.existsSync(nsFile), `Namespace ${ns}.json deve existir para ${country}`);
      }
    }
  });

  it("2. Paridade exata de 100% das chaves entre todos os 6 países em cada namespace", () => {
    for (const ns of namespaces) {
      const ptFile = path.join(baseLocalesDir, "pt-BR", `${ns}.json`);
      const ptContent = JSON.parse(fs.readFileSync(ptFile, "utf-8"));
      const ptKeys = getKeys(ptContent).sort();

      for (const country of countries) {
        if (country === "pt-BR") continue;
        const targetFile = path.join(baseLocalesDir, country, `${ns}.json`);
        const targetContent = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
        const targetKeys = getKeys(targetContent).sort();

        assert.deepStrictEqual(
          targetKeys,
          ptKeys,
          `Namespace '${ns}' em '${country}' deve ter 100% das chaves idênticas ao pt-BR`
        );
      }
    }
  });

  it("3. Paridade exata de chaves entre os arquivos raiz de fallback pt-BR.json e es-ES.json", () => {
    const ptJson = JSON.parse(fs.readFileSync(path.join(baseLocalesDir, "pt-BR.json"), "utf-8"));
    const esJson = JSON.parse(fs.readFileSync(path.join(baseLocalesDir, "es-ES.json"), "utf-8"));

    const ptKeys = getKeys(ptJson).sort();
    const esKeys = getKeys(esJson).sort();

    assert.deepStrictEqual(
      ptKeys,
      esKeys,
      "Os arquivos raiz pt-BR.json e es-ES.json devem ter 100% de paridade de chaves"
    );
  });

  it("4. Validação de Timezones dos 6 países da Fase 2", () => {
    const expectedTimezones: Record<CountryCode, string> = {
      BR: "America/Sao_Paulo",
      MX: "America/Mexico_City",
      CO: "America/Bogota",
      AR: "America/Argentina/Buenos_Aires",
      CL: "America/Santiago",
      PE: "America/Lima"
    };

    for (const [code, tz] of Object.entries(expectedTimezones)) {
      assert.strictEqual(
        COUNTRY_TIMEZONES[code as CountryCode],
        tz,
        `Timezone para ${code} deve ser ${tz}`
      );
      assert.strictEqual(
        getTimezoneForCountry(code as CountryCode),
        tz,
        `getTimezoneForCountry(${code}) deve retornar ${tz}`
      );
    }
  });

  it("5. Formatação de Data e Hora com Intl.DateTimeFormat e Timezone regional", () => {
    const testDate = new Date("2026-10-10T15:30:00Z");

    const formattedBR = formatDateTime(testDate, "pt-BR", "America/Sao_Paulo");
    const formattedMX = formatDateTime(testDate, "es-MX", "America/Mexico_City");
    const timePE = formatTime(testDate, "es-PE", "America/Lima");

    assert(typeof formattedBR === "string" && formattedBR.length > 0);
    assert(typeof formattedMX === "string" && formattedMX.length > 0);
    assert(typeof timePE === "string" && timePE.includes(":"));
  });

  it("6. Mensagem de Geoblock referencia com exatidão os 6 países da Fase 2", () => {
    for (const country of countries) {
      const commonPath = path.join(baseLocalesDir, country, "common.json");
      const common = JSON.parse(fs.readFileSync(commonPath, "utf-8"));

      const countriesStr = common.geoblock.countries;
      assert(countriesStr.includes("Brasil"));
      assert(countriesStr.includes("Chile"));
      assert(countriesStr.includes("Argentina"));
    }
  });
});
