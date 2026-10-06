# Exemplo 1 — T10 Settlement Worker: prompt simples × prompt com guardas

## Entrada

```text
"Vou pedir à IDE para implementar o Settlement Worker (T10). Onde ela vai errar e como eu travo?"
```

## Condição A — prompt simples

```text
Crie um worker em TypeScript que liquida os contratos vencidos. Se o preço subiu e o contrato é UP,
o usuário ganha 85%. Use Postgres e o Blnk.
```

Código típico devolvido (resumo):

```ts
setInterval(async () => {
  const { rows } = await pool.query(`SELECT * FROM contracts WHERE status='OPEN' AND expires_at <= now()`)
  for (const c of rows) {
    const last = await getLatestTick(c.symbol)
    const win = c.direction === 'UP' ? last.price > c.entry_price : last.price < c.entry_price
    try {
      if (win) await blnk.payout(c.user_id, c.stake * 1.85)
    } catch (e) {
      console.error(e)
    }
    await pool.query(`UPDATE contracts SET status='SETTLED' WHERE id=$1`, [c.id])
  }
}, 1000)
```

O código compila, roda e passa num teste manual com um worker. Defeitos:

| # | Defeito | Classe | Severidade | Quem detecta |
|---|---------|--------|------------|--------------|
| 1 | Sem lock: 2 réplicas do worker pagam 2× | F-03 | CRITICA | P-03 `settlement-once` |
| 2 | Tick "mais recente" em vez do primeiro `ts >= expires_at` | F-03 | CRITICA | P-03 `exit-tick` + P-04 trigger |
| 3 | `c.stake * 1.85` em `number` | F-02 | ALTA | P-05 + P-03 `payout` |
| 4 | `catch` engole erro e marca `SETTLED` sem pagar | F-09 | CRITICA | Caos (T17) |
| 5 | `price` volta do driver como string → comparação lexicográfica (`"9.5" > "10.1"`) | F-02 | CRITICA | P-03 property-based |
| 6 | Empate tratado como derrota | F-05 | ALTA | P-03 `payout` |
| 7 | `setInterval` sobrepõe execuções se uma passar de 1 s | F-03 | ALTA | Teste de carga |

## Condição B — com guardas

Prompt com o template de `references/guardrails.md`, incluindo:

```text
CONCORRÊNCIA: reivindicar com FOR UPDATE SKIP LOCKED e mudar para EXPIRING no mesmo UPDATE.
TICK DE SAÍDA: primeiro tick com ts >= expires_at; se não existir ainda, não liquidar.
DINHEIRO: bigint minor; payout = stake * 185 / 100 (floor). Empate conforme 02-financial-invariants.
FALHA NO BLNK: contrato fica EXPIRING; retry com reference payout:<id>; DLQ após 5.
ORÁCULOS (somente leitura): tests/oracle/settlement-once.test.ts, exit-tick.test.ts, payout.test.ts
```

Resultado típico: defeitos 1–5 não aparecem. Ainda aparecem, com frequência:

- comparação de preço feita com `Number(price)` "para simplificar" (F-02) → pego por P-05;
- teste novo com Blnk mockado sempre bem-sucedido (F-07) → pego por P-09 (mutante sobrevive).

## Saída no formato da skill

```text
SUBTASK: T10 — Scheduler + Settlement Worker
RISCO IA: ALTO
FALHAS PROVÁVEIS:
  - F-03 — liquidação dupla sem lock; tick de saída errado; execuções sobrepostas
  - F-02 — payout e comparação de preço em number/string
  - F-09 — SETTLED gravado quando o Blnk falha
  - F-05 — empate esquecido
NÃO DELEGAR (LIMITES):
  - L-01 — prova de liquidação única: CI com 4 workers e 1.000 contratos
  - L-02 — caos: derrubar Blnk e worker no meio (T17)
GUARDAS NO PROMPT: SKIP LOCKED + EXPIRING; primeiro ts >= expires_at; bigint; reference payout:<id>
GUARDAS FORA DO PROMPT: P-03 (3 oráculos), P-04 (trigger de tick de saída e transições), P-05, P-09
EVIDÊNCIA EXIGIDA: jobs settlement-once, exit-tick, payout verdes; mutation.json >= 80
REGISTRO TCC: run A e B, iterações, F-xx com detected_by, human_minutes
```

## Leitura para o TCC

A condição A mostra o padrão central: o código **parece correto em leitura** e **funciona com um processo**.
Os defeitos críticos só aparecem com concorrência, borda de tempo ou falha de dependência — exatamente o que a IA não executa (L-01, L-02).
