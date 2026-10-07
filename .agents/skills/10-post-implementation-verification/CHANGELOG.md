# Changelog — 10-post-implementation-verification

## [1.0.0] — 2026-06-10

### Adicionado

- Garantias `V-01` a `V-13` com critério numérico e fonte (skills 02, 03, 05, 06, 08 e plano multi-ativos).
- Consultas de pós-condição em `references/api-guide.md`: sequence, cadência, cadeia de hash com `sha256()`
  nativo, outbox e Stream, recálculo de candles, anti-cross com resultado recalculado, prazo de liquidação,
  reconciliação, payout LOSS/DRAW, ativo pausado.
- Matriz "garantias por subetapa" do plano multi-ativos e mapeamento para `T01`–`T18`.
- `scripts/verify-postconditions.sh`: executa as consultas com `auditor_ro`, recusa ambiente não descartável.
- `scripts/health-check.sh`: triagem de padrões que fazem o teste mentir (`.only`, retry, mock de banco,
  k6 sem thresholds, `|| true` no gate, consulta de saída sem `symbol`, candle com `volume + 1`).
- Status `PENDENTE` para regras não decididas (`D-19`) e `INCONCLUSIVO` para falta de evidência.

### Pendências

- Payout de WIN depende de `D-19`.
- Chave de precisão em `indices.params` assumida como `precision` (configurável por `PRECISION_KEY`).
