# Plano Geral — Símbolos, Calendários de Mercado e Consistência de Sessões

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/00-PLANO-GERAL.md`  
> **Status:** APROVADO PELO TECH LEAD & BROKER ARCHITECT  
> **Classificação:** Crítico — Integridade Temporal, Horários de Mercado e Precificação  
> **Invariantes Relacionadas:** V-01 (36 Ativos e Parâmetros), V-04 (OHLCV Idempotente), V-08 (Settlement no Tick Oficial), V-13 (Zero-Sum Ledger)

---

## 1. Diagnóstico do Problema & Causa Raiz

Em plataformas multi-ativos (Sintéticos, Forex, Cripto, Commodities):
- **Criptomoedas (ex: BTC, ETH):** Operam 24 horas por dia, 7 dias por semana (24/7).
- **Índices Sintéticos (ex: VOL10, VOL100, CRASH500):** Operam 24/7 ininterruptamente com difusão contínua.
- **Forex (ex: EURUSD, USDJPY, GBPUSD):** Abrem domingo às 21:00 UTC e fecham sexta-feira às 21:00 UTC. Fins de semana e feriados globais não possuem liquidez ou cotação.
- **Commodities / Metais (ex: XAUUSD, USOIL):** Possuem pausas diárias de manutenção (ex: 21:00 às 22:00 UTC) e fecham nos fins de semana.

### O Problema do Jeito Ingênuo:
Se o sistema assumir que todos os ativos são 24/7:
1. O agregador de velas tenta fechar velas vazias no fim de semana ou gera barras artificiais com tick fantasma.
2. Contratos de Forex abertos na sexta-feira à noite podem ser liquidados no sábado por ticks de teste ou atrasados, violando o settlement financeiro legítimo.
3. Gráficos exibem "buracos" não tratados ou quebram a escala de tempo temporal.

---

## 2. As 5 Técnicas da Indústria Implementadas

| Técnica | Objetivo | Implementação |
| :--- | :--- | :--- |
| **1. Calendário de Trading por Símbolo** | Cada ativo define explicitamente seus dias, horários de sessão, feriados e fuso (UTC). | Configuração tipada `TradingCalendar` por símbolo (`sessions`, `days`, `holidays`, `timezone: "UTC"`). |
| **2. UTC como Padrão Inviolável** | Armazenamento e comunicação estritamente em UTC; conversão local apenas na renderização da interface. | Timestamps em ISO UTC / `TIMESTAMPTZ` no PostgreSQL; conversão de exibição via `Intl.DateTimeFormat`. |
| **3. Candle Worker Valida Sessão** | O worker de agregação de velas só fecha ou computa barras se o timestamp estiver dentro da sessão aberta do ativo. | Verificação `isMarketOpen(symbol, timestamp)` antes de agregar ticks para fechar barra OHLCV. |
| **4. Settlement Valida Sessão** | A liquidação de contratos exige que o tick de expiração e o momento atual pertençam a uma sessão de mercado ativa. | Verificação de sessão no `contract-service.ts` e `settlement-worker`: rejeita liquidação com tick fora de sessão. |
| **5. Agregação Gap-Tolerant** | Períodos sem negociação (fim de semana/feriado) constituem gaps legítimos de mercado e não quebram o fluxo de agregação. | O agregador processa os buckets reais existentes; na ausência de ticks, não inventa velas nem interpola preços falsos. |

---

## 3. Estrutura das 5 Subetapas

1. **Subetapa 1 (`SUBETAPA_1_CALENDARIO_POR_SIMBOLO.md`)**: Registro dos calendários institucionais para os 36 ativos do catálogo.
2. **Subetapa 2 (`SUBETAPA_2_UTC_PADRAO_DISPLAY_LOCAL.md`)**: Validação de timestamps UTC ponta a ponta e utilitários de exibição local.
3. **Subetapa 3 (`SUBETAPA_3_CANDLE_WORKER_VALIDA_SESSAO.md`)**: Guarda de sessão de mercado no agregador OHLCV.
4. **Subetapa 4 (`SUBETAPA_4_SETTLEMENT_VALIDA_SESSAO.md`)**: Guarda de sessão de mercado no motor de liquidação de contratos.
5. **Subetapa 5 (`SUBETAPA_5_AGREGACAO_GAP_TOLERANT.md`)**: Suporte a gap legítimo de calendário e resiliência a finais de semana.
