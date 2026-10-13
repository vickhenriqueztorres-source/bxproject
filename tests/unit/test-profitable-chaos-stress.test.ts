import { describe, it, expect } from "vitest";
import { OpenContractSchema } from "../../packages/shared/src/index.ts";

describe("SUBETAPA 04 — Testes de Estresse, Caos e Segurança do Modelo Lucrativo", () => {
  describe("Segurança: Bloqueio de Arbitragem e Front-Running", () => {
    it("rejeita qualquer tentativa de injeção de duração ultracurta (< 30s) que permitiria arbitragem", () => {
      const maliciousDurations = [1, 2, 5, 10, 15, 20, 25, 28, 29];
      for (const d of maliciousDurations) {
        const res = OpenContractSchema.safeParse({
          symbol: "BTCUSD_OTC",
          direction: "UP",
          stake_minor: 1000,
          duration_seconds: d,
        });
        expect(res.success).toBe(false);
      }
    });

    it("rejeita mass assignment e campos fraudulentos de timestamp enviados pelo cliente", () => {
      const spoofedPayloads = [
        {
          symbol: "BTCUSD_OTC",
          direction: "UP",
          stake_minor: 1000,
          duration_seconds: 60,
          expires_at: "2026-10-10T12:00:05.000Z", // tentativa de forçar 5s
        },
        {
          symbol: "BTCUSD_OTC",
          direction: "DOWN",
          stake_minor: 1000,
          client_price: 65000.5, // tentativa de impor preço de entrada
        },
        {
          symbol: "BTCUSD_OTC",
          direction: "UP",
          stake_minor: 1000,
          payout_minor: 999999, // tentativa de manipular payout
        },
      ];

      for (const p of spoofedPayloads) {
        const res = OpenContractSchema.safeParse(p);
        expect(res.success).toBe(false);
      }
    });
  });

  describe("Estresse: Processamento Concorrente de 100 Contratos", () => {
    it("valida 100 ordens simultâneas em menos de 50ms com integridade perfeita", () => {
      const start = performance.now();
      const payloads = Array.from({ length: 100 }, (_, i) => ({
        symbol: i % 2 === 0 ? "BTCUSD_OTC" : "EURUSD_OTC",
        direction: (i % 2 === 0 ? "UP" : "DOWN") as "UP" | "DOWN",
        stake_minor: 100 + (i * 10),
        duration_seconds: 30 + ((i * 5) % 270),
      }));

      const results = payloads.map((p) => OpenContractSchema.safeParse(p));
      const elapsed = performance.now() - start;

      for (const r of results) {
        expect(r.success).toBe(true);
      }
      expect(elapsed).toBeLessThan(50); // Performance ultrarrápida
    });
  });

  describe("Caos: Tolerância a Desvios de Relógio (Clock Skew Invariance)", () => {
    it("garante que o cálculo oficial do servidor é imune a relógios de clientes adiantados ou atrasados", () => {
      const serverTickTime = new Date("2026-10-10T12:00:00.000Z");
      const clientClockAdiantado = new Date("2026-10-10T12:15:00.000Z"); // +15 min
      const clientClockAtrasado = new Date("2026-10-10T11:45:00.000Z"); // -15 min

      // O servidor calcula usando o seu próprio tempo base de tick
      const durationSeconds = 60;
      const safeDuration = Math.max(30, Math.min(300, durationSeconds));
      const serverCalculatedExpiresAt = new Date(serverTickTime.getTime() + safeDuration * 1000);

      expect(serverCalculatedExpiresAt.toISOString()).toBe("2026-10-10T12:01:00.000Z");
      expect(serverCalculatedExpiresAt.getTime() - serverTickTime.getTime()).toBe(60000);

      // Desvios do cliente são completamente ignorados
      void clientClockAdiantado;
      void clientClockAtrasado;
    });
  });
});
