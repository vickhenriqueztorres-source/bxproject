import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { DisplayCurrencyCodeSchema } from "@broker/shared";
import { ExchangeRateService } from "../services/exchange-rates.js";

const ConvertRequestSchema = z.object({
  stake_minor: z.number().int().min(100).max(1000000), // US$ 1,00 a US$ 10.000,00 em centavos
  currency: DisplayCurrencyCodeSchema,
  locale: z.string().optional()
}).strict();

export const currencyRoutes: FastifyPluginAsync = async (server) => {
  const exchangeService = new ExchangeRateService(server.pg, server.redis);

  /**
   * Endpoint público: Catálogo das 6 moedas de exibição da Fase 2 e taxas de câmbio nominais
   */
  server.get("/api/v1/currencies", async () => {
    const currencies = await exchangeService.getAllCurrencies();
    return { currencies };
  });

  /**
   * Endpoint público: Conversão informativa de stake_minor para moeda de exibição (Display Only)
   * Invariante D-18: O ledger e o contrato continuam estritamente em USD minor no backend.
   */
  server.post("/api/v1/currencies/convert", async (request, reply) => {
    const parseResult = ConvertRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
        message: "Payload de conversão inválido.",
        details: parseResult.error.issues
      });
    }

    const { stake_minor, currency, locale } = parseResult.data;
    const conversion = await exchangeService.convertUSDMinor(stake_minor, currency, locale);

    return {
      stake_minor_usd: stake_minor,
      usd_nominal: (stake_minor / 100).toFixed(2),
      currency: conversion.currency,
      exchange_rate: conversion.rate,
      display_amount: conversion.amount,
      display_formatted: conversion.formatted
    };
  });
};
