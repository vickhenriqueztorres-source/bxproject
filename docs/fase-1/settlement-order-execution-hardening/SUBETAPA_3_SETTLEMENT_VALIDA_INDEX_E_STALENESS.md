# Subetapa 3 — Settlement Valida Símbolo do Contrato e Idade Máxima do Tick (< 5s)

## 1. Objetivo
Impedir terminantemente que contratos sejam liquidados com cotações de ativos incorretos ou com ticks obsoletos/congelados (stale).

## 2. Implementação
1. **Filtro Estrito por Símbolo:**
   - A query de settlement filtra explicitamente por `symbol = contract.symbol` e `event_time >= contract.expires_at`.
2. **Asserção de Símbolo Pré-Cálculo:**
   - Antes de aplicar a regra financeira WIN/LOSS, validar `assert(tick.symbol === contract.symbol)`. Se divergir, abortar com erro `SYMBOL_MISMATCH`.
3. **Validação de Staleness do Tick de Expiração:**
   - Validar `assert(tick_age <= 5000ms)`. Se o tick tiver mais de 5 segundos em relação ao relógio de eventos ou à expiração, recusar liquidação e emitir `TICK_STALE`.

## 3. Critérios de Aceite e Testes
- Tentativa forçada de liquidar contrato de `EURUSD_OTC` com tick de `BTCUSD_OTC` é 100% rejeitada com exceção fatal.
- Tentativa de liquidar com tick com idade de 5.500ms é rejeitada com status NACK e reagendamento seguro.
