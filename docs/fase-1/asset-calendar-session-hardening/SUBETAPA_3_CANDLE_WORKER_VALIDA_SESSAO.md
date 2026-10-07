# Subetapa 3 — Candle Worker Valida Sessão Antes de Fechar

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/SUBETAPA_3_CANDLE_WORKER_VALIDA_SESSAO.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-04 (OHLCV Idempotente), V-05 (Isolamento de Ativos)

---

## 1. Objetivo Técnico

Garantir que o `services/candle-worker/core.mjs` só agregue e persista barras OHLCV para um ativo quando os ticks processados pertencerem à sessão de negociação ativa do símbolo.

Ticks que cheguem com carimbo fora do horário do mercado são ignorados pelo agregador, impedindo a criação de barras espúrias em fins de semana ou feriados.

---

## 2. Critérios de Aceite

- [x] O Candle Worker consulta o calendário do símbolo antes de emitir a barra OHLCV.
- [x] Ticks fora da sessão são rejeitados de forma idempotente sem corromper a sequência de velas.
