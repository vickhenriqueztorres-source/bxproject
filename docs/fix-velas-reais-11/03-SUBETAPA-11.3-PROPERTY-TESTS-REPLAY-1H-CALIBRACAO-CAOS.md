# Subetapa 11.3 — Property-Based Tests, Replay de 1h, Calibração 1Hz vs 4Hz e Caos

## Objetivo
Provar matematicamente todas as garantias do relatório #11 com testes baseados em propriedades, replay de 1 hora (3.600 ticks), calibração de volatilidade Ornstein-Uhlenbeck (1 Hz vs 4 Hz) e injeção de caos.

## Bateria de Testes (`tests/unit/velas-reais-11-property-replay.test.mjs`)
1. **Property-Based Tests (100 rodadas × 120 ticks aleatórios CSPRNG = 12.000 ticks)**:
   - Agregar ticks → `5s` → somar para `15s`, `30s`, `1m` == agregar ticks direto para `15s`, `30s`, `1m` (`diff = 0`).
   - Implementação compartilhada (`@broker/shared`), servidor (`candle-aggregation-engine.mjs`) e cliente (`chart-scale-normalizer.ts`) produzem OHLCV idêntico (`diff = 0`).
2. **Replay Determinístico de 1 Hora (3.600 ticks a 1 Hz)**:
   - 720 velas de 5s (todas com `volume === 5`, `ticks_per_5s_bucket === 5`), 240 velas de 15s, 120 velas de 30s e 60 velas de 1m com `diff = 0` entre servidor e cliente.
3. **Calibração de Frequência 1 Hz vs 4 Hz (Risco 1)**:
   - Verifica que o escalonamento `sigma_4Hz = sigma * sqrt(0.25) = sigma / 2` e `theta_4Hz = 1 - (1 - theta)^0.25` preserva a variância dos retornos de 60s dentro da tolerância estatística.
4. **Caos, Clock Skew e Reconciliação de Gap de Ticks**:
   - Cliente perde ticks intermediários (com o pico `high` do período), servidor perdeu ou atrasou o último tick: reconciliação combina `high = max`, `low = min` e `close` da maior `sequence`.
   - Relógio retrocede 3 segundos (Clock Skew) ou trava por 4 segundos (GC Pause): `computeNextAlignedSlot` garante monotonicidade estrita e pula os 3 slots perdidos sem rajada.
