# Exemplo 2 — Candles divergentes depois do caos C-05 (Redis reiniciado)

## Entrada

```text
Pedido: "verifica o cenário E4 / C-05: Redis reiniciado no meio do pico."
Commit: c31aa90
Ambiente: ci
Janela: 2026-06-10T15:00:00Z → 2026-06-10T15:12:00Z
Intervalos de candle gerados: 1m e 5m
```

## Execução

1. E4 exige todas as garantias. `V-11` e `V-12` vêm da saída do teste de carga.
2. Pós-condições:

```text
$ CANDLE_INTERVALS="1m 5m" ... bash scripts/verify-postconditions.sh
V-02 Sequence      : PASS — 0 linhas
V-03 Cadência      : PASS — 0 linhas
V-04 Hash          : PASS — 0 linhas
V-05 Outbox        : PASS — 0 linhas
V-05 Stream        : PASS — todos os streams em dia
V-06 Candles 1m    : FAIL — 7 linha(s); primeiras:
    ETHUSD_OTC|2026-06-10 15:04:00+00
    ETHUSD_OTC|2026-06-10 15:05:00+00
    XAUUSD_OTC|2026-06-10 15:04:00+00
V-06 Candles 5m    : FAIL — 3 linha(s)
...
Resultado: REPROVADO (2 FAIL, 0 INCONCLUSIVO)
```

3. Detalhe de um bucket (só leitura):

```sql
SELECT c.close, c.last_seq, max(t.sequence) AS real_last_seq,
       (array_agg(t.price ORDER BY t.sequence DESC))[1] AS real_close
FROM candles c JOIN ticks t
  ON t.symbol = c.symbol AND t.ts >= c.bucket_start AND t.ts < c.bucket_start + interval '1 minute'
WHERE c.symbol = 'ETHUSD_OTC' AND c.interval = '1m' AND c.bucket_start = '2026-06-10 15:04:00+00'
GROUP BY c.close, c.last_seq;
--  close    | last_seq | real_last_seq | real_close
-- 3412.18   |   18291  |     18294     | 3412.40
```

O candle parou 3 ticks antes do fim do minuto: depois do reinício do Redis, os itens reentregues do
Stream chegaram fora de ordem e o worker descartou os de `sequence` menor que o último visto **no
processo**, não no banco.

## Saída

```text
SKILL: 10-post-implementation-verification
MODO: CAOS
COMMIT: c31aa90
AMBIENTE: ci
JANELA: 2026-06-10T15:00:00Z → 2026-06-10T15:12:00Z
ESCOPO: E4 / C-05 — Redis reiniciado durante o pico

V-02 Sequence    : PASS
V-03 Cadência    : PASS
V-04 Hash        : PASS
V-05 Outbox      : PASS · Stream PASS
V-06 Candles     : FAIL — 7 buckets 1m e 3 buckets 5m divergentes em ETHUSD_OTC e XAUUSD_OTC (15:04–15:06)
V-07 Anti-cross  : PASS
V-08 Prazo       : PASS
V-09 Dinheiro    : PASS (L/D) · PENDENTE (WIN, D-19)
V-11 WebSocket   : PASS — evidência em tests/chaos/c05.log
V-12 SLOs        : PASS — summary.json, todos os thresholds ok
V-13 Integridade : PASS

FALHAS:
- V-06 — candles com last_seq < max(sequence) do bucket depois da reentrega — reprodução: consulta de
  detalhe acima — destino: bug-fix-agent (Candle Worker); o candle precisa ser recalculado a partir
  dos ticks do bucket, não do estado em memória

PENDÊNCIAS: D-19
VEREDITO: REPROVADO
```

## Por que este é o comportamento certo

- Preço, hash e dinheiro estavam certos. O gráfico estava errado — e isso também reprova (`V-06`).
- O `CHECK (volume = last_seq - first_seq + 1)` não pegou porque o candle errado era coerente consigo
  mesmo. Só o recálculo a partir dos ticks prova a divergência.
- O verificador não "reprocessa os candles" para deixar verde: candle reconstruído depois esconderia o bug.
