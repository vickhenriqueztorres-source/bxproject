import { describe, it, expect } from "vitest";
import { OpenContractSchema } from "../../packages/shared/src/index.ts";

describe("SUBETAPA 01 — Modelo Lucrativo: Schema e Validação com Piso de 60s", () => {
  it("aceita duração padrão de 60 segundos quando omitida", () => {
    const validPayload = {
      symbol: "BTCUSD_OTC",
      direction: "UP",
      stake_minor: 1000,
    };
    const parsed = OpenContractSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.duration_seconds).toBeUndefined();
    }
  });

  it("aceita durações válidas no intervalo seguro e lucrativo (60s a 300s)", () => {
    const durations = [60, 75, 90, 120, 180, 300];
    for (const d of durations) {
      const parsed = OpenContractSchema.safeParse({
        symbol: "EURUSD_OTC",
        direction: "DOWN",
        stake_minor: 500,
        duration_seconds: d,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.duration_seconds).toBe(d);
      }
    }
  });

  it("bloqueia estritamente qualquer duração abaixo de 60 segundos (piso mínimo inviolável de 60s)", () => {
    const toxicDurations = [0, -1, 5, 10, 15, 20, 25, 29, 30, 45, 59];
    for (const d of toxicDurations) {
      const parsed = OpenContractSchema.safeParse({
        symbol: "ETHUSD_OTC",
        direction: "UP",
        stake_minor: 1000,
        duration_seconds: d,
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        const error = parsed.error.format();
        expect(error.duration_seconds?._errors.length).toBeGreaterThan(0);
      }
    }
  });

  it("bloqueia durações acima do teto turbo (máximo 300 segundos / 5 minutos)", () => {
    const excessiveDurations = [301, 600, 3600];
    for (const d of excessiveDurations) {
      const parsed = OpenContractSchema.safeParse({
        symbol: "XAUUSD_OTC",
        direction: "UP",
        stake_minor: 1000,
        duration_seconds: d,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("bloqueia durações com números fracionados ou strings", () => {
    const invalidTypes = [30.5, 45.2, "60", null, true];
    for (const val of invalidTypes) {
      const parsed = OpenContractSchema.safeParse({
        symbol: "BTCUSD_OTC",
        direction: "DOWN",
        stake_minor: 1000,
        duration_seconds: val,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("rejeita campos desconhecidos devido ao modo estrito .strict()", () => {
    const maliciousPayload = {
      symbol: "BTCUSD_OTC",
      direction: "UP",
      stake_minor: 1000,
      duration_seconds: 60,
      client_timestamp: Date.now(), // campo extra proibido
    };
    const parsed = OpenContractSchema.safeParse(maliciousPayload);
    expect(parsed.success).toBe(false);
  });
});
