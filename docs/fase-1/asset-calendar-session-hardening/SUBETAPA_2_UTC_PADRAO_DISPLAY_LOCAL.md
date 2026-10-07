# Subetapa 2 — UTC como Padrão Inviolável & Conversão na Exibição

> **Documento:** `docs/fase-1/asset-calendar-session-hardening/SUBETAPA_2_UTC_PADRAO_DISPLAY_LOCAL.md`  
> **Status:** ESPECIFICAÇÃO TÉCNICA  
> **Invariantes:** V-03 (Timestamps no Passado/Presente), Integridade Temporal

---

## 1. Objetivo Técnico

Padronizar 100% dos timestamps em UTC (*Coordinated Universal Time*):
1. Banco de Dados: colunas do tipo `TIMESTAMPTZ` sempre gravadas em UTC.
2. Mensagens WebSocket e REST: formato ISO 8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`).
3. Frontend: Lightweight Charts consome segundos UTC (`UTCTimestamp`). Conversões para hora local do trader ocorrem exclusivamente na camada de apresentação (tooltips e eixos).

---

## 2. Critérios de Aceite

- [x] Zero timestamps armazenados ou transitados com timezones locais não qualificados.
- [x] Imunidade total a alterações de horário de verão (DST - Daylight Saving Time).
