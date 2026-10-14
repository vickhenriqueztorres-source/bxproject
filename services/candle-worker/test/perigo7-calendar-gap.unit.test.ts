import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TimeframeAggregator,
  isMarketOpen,
  shouldCloseCandle,
  aggregateCandleGapTolerant,
} from "../src/aggregator/timeframe-aggregator.js";

describe("[Subetapa 04 — Perigo 7] Calendário de Sessão por Símbolo em UTC e Agregação Gap-Tolerant no Candle Worker TS", () => {
  it("[TÉCNICAS 1, 2 e 3] Valida sessões 24/7 (Sintéticos/Cripto) vs Seg-Sex e Feriados (Forex/Commodities) em UTC", () => {
    // Sábado em UTC (2026-10-17T15:00:00Z)
    const saturdayUtc = new Date("2026-10-17T15:00:00Z");
    assert.equal(isMarketOpen("R_100", saturdayUtc), true, "Sintéticos 24/7 abertos no sábado");
    assert.equal(isMarketOpen("BTCUSDT", saturdayUtc), true, "Cripto 24/7 aberto no sábado");
    assert.equal(isMarketOpen("EURUSD-OTC", saturdayUtc), false, "Forex fechado no sábado");
    assert.equal(isMarketOpen("XAUUSD-OTC", saturdayUtc), false, "Commodities fechado no sábado");

    // Quarta-feira às 21:30 UTC (pausa diária das commodities entre 21:00 e 22:00 UTC)
    const wedBreakUtc = new Date("2026-10-14T21:30:00Z");
    assert.equal(isMarketOpen("XAUUSD-OTC", wedBreakUtc), false, "XAUUSD em pausa de sessão às 21:30 UTC");
    assert.equal(isMarketOpen("EURUSD-OTC", wedBreakUtc), true, "EURUSD aberto na quarta às 21:30 UTC");

    // Feriado de Natal (2026-12-25T14:00:00Z — Sexta-feira)
    const christmasUtc = new Date("2026-12-25T14:00:00Z");
    assert.equal(isMarketOpen("EURUSD-OTC", christmasUtc), false, "Forex fechado no Natal");
    assert.equal(isMarketOpen("R_100", christmasUtc), true, "Sintéticos abertos no Natal");
  });

  it("[TÉCNICA 3] TimeframeAggregator.processTickForInterval ignora ticks fora da sessão sem gravar candle fantasma no Redis", async () => {
    let redisCalled = false;
    const mockRedis = {
      eval: async () => {
        redisCalled = true;
        return ["1.08500", "1.08500", "1.08500", "1.08500", 1];
      },
    };

    const aggregator = new TimeframeAggregator(mockRedis as any);
    // Sábado UTC para EURUSD-OTC
    const saturdayTick = {
      symbol: "EURUSD-OTC",
      sequence: 500n,
      price: "1.08500",
      ts: new Date("2026-10-17T15:00:00Z"),
    };

    const resClosed = await aggregator.processTickForInterval(saturdayTick, "1m");
    assert.equal(resClosed.activeCandle, null);
    assert.equal(resClosed.closedBucketStart, null);
    assert.equal(redisCalled, false, "Redis não deve ser tocado para tick fora da sessão");

    // Segunda-feira UTC para EURUSD-OTC -> agrega normalmente
    const mondayTick = {
      symbol: "EURUSD-OTC",
      sequence: 501n,
      price: "1.08520",
      ts: new Date("2026-10-19T10:00:00Z"),
    };
    const resOpen = await aggregator.processTickForInterval(mondayTick, "1m");
    assert.notEqual(resOpen.activeCandle, null);
    assert.equal(redisCalled, true);
  });

  it("[TÉCNICA 5] aggregateCandleGapTolerant retorna null quando bucket não possui ticks ou mercado está fechado (zero velas artificiais)", () => {
    const bStart = new Date("2026-10-14T14:00:00Z");
    const bEnd = new Date("2026-10-14T14:01:00Z");

    // 1. Sem ticks no bucket -> null (não cria vela artificial)
    const emptyCandle = aggregateCandleGapTolerant([], bStart, bEnd, "R_100", "1m");
    assert.equal(emptyCandle, null);

    // 2. Com ticks válidos ordenados por sequence -> deriva OHLCV exato
    const validCandle = aggregateCandleGapTolerant(
      [
        { symbol: "R_100", sequence: 10n, price: "1500.00", ts: new Date("2026-10-14T14:00:05Z") },
        { symbol: "R_100", sequence: 11n, price: "1510.50", ts: new Date("2026-10-14T14:00:25Z") },
        { symbol: "R_100", sequence: 12n, price: "1495.25", ts: new Date("2026-10-14T14:00:40Z") },
        { symbol: "R_100", sequence: 13n, price: "1504.00", ts: new Date("2026-10-14T14:00:55Z") },
      ],
      bStart,
      bEnd,
      "R_100",
      "1m"
    );

    assert.notEqual(validCandle, null);
    assert.equal(validCandle!.open, "1500.00");
    assert.equal(validCandle!.high, "1510.50");
    assert.equal(validCandle!.low, "1495.25");
    assert.equal(validCandle!.close, "1504.00");
    assert.equal(validCandle!.volume, 4);
  });
});
