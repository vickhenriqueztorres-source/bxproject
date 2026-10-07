# Subetapa 5 — Agregação Gap-Tolerant (Velas sem Buracos Espúrios)

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/SUBETAPA_5_AGREGACAO_GAP_TOLERANT.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-04 (OHLCV Idempotente), V-06 (Zero Martingale Drift)

---

## 1. Objetivo Técnico

Garantir que a ausência de ticks durante o fechamento de mercado (fins de semana e feriados) seja tratada como **gap legítimo de mercado**:
1. O agregador não tenta interpolar preços artificiais nem inventar candles fantasmas.
2. Na API `/candles`, o gráfico liga a barra de fechamento de sexta-feira com a barra de abertura de domingo sem gerar distorções matemáticas.
3. Se o ativo for 24/7 (Cripto e Sintéticos) e houver gap, o sistema sinaliza como anomalia de feed, mas se for Forex no fim de semana, reconhece como suspensão legítima de calendário.

---

## 2. Critérios de Aceite

- [x] Agregador não cria velas fictícias em períodos fechados.
- [x] Retorno da API de histórico é contínuo e consistente com o calendário do ativo.
