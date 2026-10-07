# Subetapa 1 — Calendário de Trading por Símbolo

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/SUBETAPA_1_CALENDARIO_POR_SIMBOLO.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-01 (36 Ativos e Parâmetros), V-05 (Isolamento de Ativos)

---

## 1. Objetivo Técnico

Implementar a camada institucional de definição de calendários de mercado para todos os 36 ativos do catálogo:
- Sintéticos: 24/7 ininterrupto.
- Cripto: 24/7 ininterrupto.
- Forex: Segunda a Sexta (domingo 21:00 UTC até sexta 21:00 UTC) com feriados globais (Natal, Ano Novo).
- Commodities/Índices mundiais: Horários específicos com pausas de compensação.

Fornecer função utilitária rápida e determinística:
```typescript
function isMarketOpen(symbol: string, date: Date = new Date()): boolean;
```

---

## 2. Critérios de Aceite

- [x] Cada um dos 36 ativos possui calendário explicitamente configurado.
- [x] Consulta de abertura/fechamento executa em < 0.1ms em memória.
- [x] Finais de semana retornam `false` para Forex e `true` para Cripto e Sintéticos.
