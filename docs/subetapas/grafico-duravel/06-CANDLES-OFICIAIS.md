# 06 — Candles derivados dos ticks e API v2

Agentes: backend e QA; arquiteto/verificador revisam. Skills 01/03/05/06/08/09/10.
Pré-condição: gate 05 VALIDADA. Escopo: worker/repository/API de candles; endpoint antigo preservado até transição de clientes.

## Passo a passo

1. Escrever RED com ticks reais persistidos nas bordas UTC e sequência reentregue; comparar OHLCV por SQL independente.
2. Agregar buckets [início,fim) de 5s/15s/30s/1m/5m a partir dos ticks oficiais. Open/close pelo menor/maior sequence, volume = contagem de ticks únicos.
3. Reprocessar/reconstruir idempotentemente sem depender de Map RAM ou incrementar volume em cada entrega.
4. Criar consumer group com recuperação do backlog desde o checkpoint oficial; XACK só depois do commit, XAUTOCLAIM recupera órfãos.
5. Emitir fechamento durável e tornar lacuna temporal explícita; não inventar OHLC nos períodos sem tick.
6. Servir `/v2/candles` com limites, allowlist de timeframe, paginação estável, preços string e tempo/unidade documentados. Preservar proveniência do legado separada.
7. Reconstruir janela com job limitado por tempo/bucket e comparar diferença exata = zero. Nunca acumular histórico ilimitado em RAM.

## Testes de aceite

- AC-GD-06-1: ticks fora de ordem e duplicados 20× geram o mesmo OHLCV da consulta SQL, em todos os timeframes.
- AC-GD-06-2: tick exatamente no fim pertence ao próximo bucket; transição de dia/UTC não depende do fuso do host.
- AC-GD-06-3: matar worker antes/depois do commit/ACK, reiniciar Redis e retomar backlog mantém candles reconstruíveis sem perda.
- AC-GD-06-4: consulta paginada não duplica/omite buckets fechados; limites inválidos/SQL injection/intervalo excessivo são rejeitados.
- AC-GD-06-5: histórico vazio permanece vazio e lacuna não vira vela fabricada; rebuild do dia difere zero.

Stress: 36 símbolos a 1 Hz com 300 consultas/s por 10min em staging sintético, memória limitada e sem regressão de p99 da carteira acima de 10% da baseline comparável. Alvos de projeto: GET candles p95<200ms e 5xx+timeouts<0,1%; congelar thresholds antes do ensaio.
Segurança: role API somente leitura; escrita de cliente não altera OHLC. Caos comprova PID e pending entries reais.
Rollback: voltar consumidores compatíveis e manter tabelas/log; não apagar candles para esconder divergências.
Gate: V-05/V-06/V-12/V-13, diferença zero e testes de contrato de API; falha em um timeframe bloqueia próximo passo.
