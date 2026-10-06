# Expected output 2 — T09 compartilhado com o revisor financeiro

## Saída esperada

```yaml
task_id: T09
agent: security-reviewer
status: DONE
summary: >
  Revisão de segurança do Contract Service. REPROVADO. DTO estrito correto. A busca por
  Idempotency-Key não é escopada por user_id: reusar a chave de outro usuário devolve o contrato
  dele. O gateway lê o token da query string. Pedido para "cobrir tudo" recusado: idempotência
  e saldo encaminhados ao financial-correctness-reviewer, sem julgamento aqui.
artifacts: []
evidence:
  - services/api/src/contracts/dto.ts:3 lido
  - services/api/src/contracts/open-contract.ts:12-13 lido
  - services/gateway/src/ws-auth.ts:5 lido
  - bash agents/security-reviewer/scripts/health-check.sh → FAIL "token em query string"
acceptance_criteria_met:
  - { criterion: "DTO rejeita campos desconhecidos", met: true, evidence: "S-05 dto.ts:3 .strict()" }
  - { criterion: "Idempotency-Key gera um único contrato", met: false, evidence: "fora do domínio — financial-correctness-reviewer" }
confidence_score: 0.9
review:
  surface: [POST /contracts, DTO OpenContract, handshake do WebSocket]
  controls:
    S-01: { result: N/A, evidence: "sem mudança de client ou flow" }
    S-02: { result: FAIL, evidence: "ws-auth.ts:5 token lido da URL" }
    S-03: { result: N/A, evidence: "rotas fora do diff" }
    S-04: { result: FAIL, evidence: "open-contract.ts:12 chave de idempotência sem user_id" }
    S-05: { result: PASS, evidence: "dto.ts:3 z.object(...).strict()" }
    S-06: { result: PASS, evidence: "nenhum segredo no diff" }
  findings:
    - severity: CRÍTICO
      location: services/api/src/contracts/open-contract.ts:12-13
      problem: contrato existente buscado só pela Idempotency-Key, sem user_id
      vector: usuário B envia POST /contracts com a mesma chave usada por A e recebe o contrato de A na resposta
      violates: [S-04]
    - severity: ALTO
      location: services/gateway/src/ws-auth.ts:5
      problem: token do WebSocket lido da query string (arquivo da T08)
      vector: token fica em log de proxy, histórico e Referer; quem lê o log reutiliza o token até o exp
      violates: [S-02, SR-10]
  rotations_required: []
  verdict: REPROVADO
decisions_cited: [D-12, S-02, S-04, S-05, SR-10, SR-14]
pending:
  - QA: teste de integração [S-04] usuário B reusa a Idempotency-Key de A → não recebe o contrato de A
handoff_notes:
  - "financial-correctness-reviewer: avaliar I-03 em open-contract.ts:12 (UNIQUE deve ser (user_id, idempotency_key)) e o efeito no saldo"
  - "orquestrador: ws-auth.ts pertence à T08; achado registrado aqui para não se perder"
```

## Não deve aparecer

- `I-03: PASS` ou `I-03: FAIL`, ou qualquer severidade sobre saldo.
- `met: true` para o critério de idempotência.
- Código corrigido da query ou do handshake.
