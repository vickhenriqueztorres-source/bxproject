# Example 1 — T10 settlement reprovado

Revisão de um Settlement Worker que parece correto no caminho feliz e passa nos testes unitários,
mas quebra o dinheiro em três ordens de falha diferentes.

## Handoff recebido

```yaml
task_id: T10
agent: financial-correctness-reviewer
objective: Revisar o Settlement Worker antes do merge.
context:
  - diff: services/settlement-worker/src/settle.ts
  - evidência do backend: "pnpm test settle.unit → 9 passed"
  - evidência do QA: "settle.int.test.ts → 5 passed (WIN, LOSS, DRAW, já SETTLED, sem tick)"
skills: [01-project-context, 02-financial-invariants, 05-resilience-patterns]
acceptance_criteria:
  - Cada contrato é liquidado exatamente uma vez.
  - Payout de 85% creditado só em WIN.
  - Sem tick de saída, o contrato não é liquidado.
budget: { max_steps: 20, max_tokens: 80000, timeout: 10m }
```

## Código revisado

```ts
// services/settlement-worker/src/settle.ts
30  export async function handle(msg: ExpiryMessage) {
31    const exit = await redis.get(`tick:last:${msg.symbol}`)
32    await redis.xack('stream:contracts:expiry', 'settlement', msg.id)
33
34    await db.tx(async (t) => {
35      const c = await t.one('SELECT * FROM contracts WHERE id = $1 FOR UPDATE', [msg.contractId])
36      if (c.status === 'SETTLED') return
37      const exitPrice = Number(exit ?? c.entry_price)
38      const result = decide(c.direction, Number(c.entry_price), exitPrice)
39      const payout = result === 'WIN' ? Number(c.stake_minor) * 0.85 : 0
40
41      await blnk.recordTransaction({
42        reference: `credit:${c.id}:${randomUUID()}`,
43        source: 'house_payout',
44        destination: `user:${c.user_id}:available`,
45        amount: payout,
46      })
47      await t.none("UPDATE contracts SET status = 'SETTLED', result = $2 WHERE id = $1", [c.id, result])
48    })
49  }
```

## Linha do tempo aplicada

| Passo | Pergunta | Resposta no código |
|-------|----------|--------------------|
| Leitura do tick | Quem escolheu o preço? | Cache `tick:last:*` (linha 31) — não é o primeiro tick com `ts >= expires_at` |
| `XACK` | E se morrer depois daqui? | `XACK` na linha 32, antes de tudo: mensagem descartada, contrato fica sem liquidar |
| Sem tick | E se o cache estiver vazio? | `exit ?? c.entry_price` (linha 37) → preço igual → DRAW inventado |
| Chamada Blnk | E se der timeout e repetir? | `reference` com `randomUUID()` (linha 42) → segundo crédito |
| Blnk dentro da transação | E se o `UPDATE` falhar depois do crédito? | Rollback do contrato, crédito fica no Blnk; reentrega credita de novo |
| Dinheiro | Inteiro? | `Number(...) * 0.85` (linha 39) — float |

Os testes do QA passam porque nenhum cenário mata o processo entre as linhas 41 e 47,
e o caso "sem tick" testou o banco vazio, não o cache vazio. Isso vai para `pending`.

## Saída

```yaml
task_id: T10
agent: financial-correctness-reviewer
status: DONE
summary: >
  Revisão completa do settle.ts. REPROVADO com 7 achados CRÍTICOS: preço de saída lido do cache,
  XACK antes do COMMIT, DRAW inventado sem tick, reference aleatória no crédito, chamada ao Blnk
  dentro da transação do banco, payout em float e stake que nunca sai de user:reserved. Os testes
  verdes não exercitam crash entre o crédito e o UPDATE; pedido de cenário registrado para o QA.
artifacts: []
evidence:
  - services/settlement-worker/src/settle.ts:30-49 lido integralmente
  - bash agents/financial-correctness-reviewer/scripts/health-check.sh → 4 FAIL (linhas 31, 37, 39, 42)
  - evidências do QA lidas → nenhum cenário de crash entre Blnk e COMMIT
acceptance_criteria_met:
  - { criterion: "Cada contrato liquidado exatamente uma vez", met: false, evidence: "I-03 settle.ts:42; R-06 settle.ts:32" }
  - { criterion: "Payout de 85% só em WIN", met: false, evidence: "FC-08 settle.ts:39 em float" }
  - { criterion: "Sem tick, não liquida", met: false, evidence: "FC-09 settle.ts:37" }
confidence_score: 0.95
review:
  scope: [services/settlement-worker/src/settle.ts]
  invariants:
    I-01: { result: PASS, evidence: "nenhum UPDATE de saldo; saldo só no Blnk" }
    I-02: { result: FAIL, evidence: "settle.ts:41-46 só credita o lucro; stake reservado não volta a available em WIN" }
    I-03: { result: FAIL, evidence: "settle.ts:42 reference com randomUUID()" }
    I-04: { result: FAIL, evidence: "settle.ts:41 Blnk chamado dentro de db.tx" }
    I-05: { result: N/A, evidence: "reconciliação é T11" }
    I-06: { result: N/A, evidence: "subtask não tem fluxo de correção" }
  findings:
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:31
      problem: preço de saída vem do cache tick:last, não do primeiro tick oficial com ts >= expires_at
      scenario: cache atualizado 2 s depois da expiração; resultado decidido com preço posterior ao vencimento
      violates: [FC-09]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:32
      problem: XACK antes de processar
      scenario: worker morre na linha 34; mensagem já confirmada não é reentregue; contrato preso em OPEN
      violates: [I-04, FC-10]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:37
      problem: ausência de tick vira preço de entrada, o que produz DRAW
      scenario: Redis reiniciado; cache vazio; todos os contratos do minuto liquidados como DRAW
      violates: [FC-09]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:42
      problem: reference do crédito muda a cada tentativa
      scenario: Blnk grava e a resposta se perde; retry grava segundo crédito de lucro
      violates: [I-03, FC-10]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:41-47
      problem: chamada ao Blnk dentro da transação do banco
      scenario: crédito gravado no Blnk; UPDATE falha; rollback deixa o contrato aberto; reentrega credita de novo
      violates: [I-04]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:39
      problem: payout em number com multiplicação por 0.85
      scenario: stake de 333 centavos gera 283.05; valor fracionário enviado ao ledger
      violates: [FC-08]
    - severity: CRÍTICO
      location: services/settlement-worker/src/settle.ts:41-46
      problem: WIN só credita o lucro; LOSS e DRAW não movem nada; o stake fica para sempre em user:reserved
      scenario: usuário vence; recebe 85% de lucro mas não recebe o stake de volta; saldo disponível encolhe
      violates: [I-02, FC-06]
  verdict: REPROVADO
decisions_cited: [D-02, D-10, I-02, I-03, I-04, R-06, B-02, B-08, FC-08, FC-09, FC-10]
pending:
  - QA: cenário de crash entre a chamada ao Blnk e o COMMIT (C-02/C-08) para T10
  - QA: caso "sem tick" com Postgres sem o tick de saída e cache preenchido
  - Arredondamento do lucro <não definido no contexto>
handoff_notes:
  - "settle.ts:35 lê contrato só por id — normal para worker, sem rota pública; nenhum envio ao security-reviewer"
```

## O que o revisor não fez

- Não escreveu a versão corrigida do `handle`.
- Não sugeriu `reference: credit:${c.id}:WIN` em bloco de código — o problema e a chave oficial
  já estão na skill 02, que o implementador carrega.
- Não editou o teste do QA para cobrir o crash.
