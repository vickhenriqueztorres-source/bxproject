# Estado, checkpoint, fila humana e telemetria

Tudo em `.orchestrator/`, fora do git (o gate exige). No encerramento, o orquestrador copia o essencial para
`relatorio-fase-1/`, que é commitado.

## Estrutura

```text
.orchestrator/
  STATUS                       RUNNING | FINISHED: … | HALTED: <motivo>
  state.yaml                   estado global (modelo abaixo)
  human-queue.md               o que só o humano resolve
  ai-failures.jsonl            falhas da IA detectadas (dado do TCC)
  telemetry/events.jsonl       ORCHESTRATOR §13, um evento por linha
  sessions/                    log bruto de cada sessão (run-loop)
  tasks/Txx/
    00-risk.md                 saída da skill 09 para a subtask
    10-impl-handoff.yaml       11-impl-result.yaml
    20-qa-handoff.yaml         21-qa-result.yaml
    30-review-<agente>-handoff.yaml   31-review-<agente>-result.yaml
    40-fix-DEF-Txx-n-handoff.yaml     41-fix-DEF-Txx-n-result.yaml
  evidence/Txx/
    <etapa>-<UTC>.log          saída completa de cada gate
    <etapa>-latest.json        {"result":"PASS|FAIL", ...}
    gate.jsonl                 um registro por passo de gate
```

## `state.yaml` (extensão do ORCHESTRATOR §12)

```yaml
run_id: fase1-<AAAAMMDD-HHMM>
issue: "Fase 1 — MVP Demo (PRD)"
started_at: <ISO-8601>
branch: fase-1/run
plan:
  - task_id: T01
    agent: backend-implementation-agent
    reviewers: [security-reviewer]
    depends_on: []
    status: PENDING            # PENDING | RUNNING | DONE | FAILED | BLOCKED
    step: null                 # RISK | IMPL | GATE_IMPL | QA | GATE_QA | REVIEW | FIX | FINAL | MERGE
    attempts: { impl: 0, qa: 0, fix_cycles: 0 }
    defects: []                # [{ id: DEF-T01-1, severity: ALTO, source: qa|financial|security|regression, reopened: 0, status: OPEN|FIXED }]
    open_findings: []          # MÉDIO/BAIXO dos revisores, não bloqueiam
    blocked_reason: null
    summary: ""
    evidence: []               # caminhos de evidence/T01/*-latest.json
    confidence_score: null
    checkpoint_at: null
  # … T02 a T18, com depends_on de 02-ondas-e-dependencias.md
budget_used: { sessions: 0, worker_calls: 0, elapsed_hours: 0 }
consecutive_blocked: 0
definition_of_done:
  - { id: 1, met: false, evidence: [] }
  # … até 14
```

### Transições

```text
PENDING ─▶ RUNNING(RISK) ─▶ IMPL ─▶ GATE_IMPL ─▶ QA ─▶ GATE_QA ─▶ REVIEW ─▶ FINAL ─▶ MERGE ─▶ DONE
                               ▲       │ FAIL ≤3      │ REPROVADO     │ CRÍTICO/ALTO
                               └───────┘              └──▶ FIX ◀──────┘
                                                            │ 3 ciclos ou 2 reaberturas ou E9/data_repair
                                                            ▼
                                                         BLOCKED ─▶ (humano) ─▶ PENDING
```

Retomada: sessão nova encontra `RUNNING` com `step: QA` → refaz o passo QA inteiro (o passo anterior já tem
checkpoint). Nunca pula um passo porque "parece feito".

## `human-queue.md`

```markdown
## T09 — BLOCKED (E9) — 2026-…Z
- Pergunta: <decisão exata necessária>
- Opções vistas: <a> | <b>
- Evidência: .orchestrator/evidence/T09/qa-…log, tasks/T09/31-review-security-result.yaml
- Depois de decidir: registre a decisão em skills/01 (mova a tag), mude T09 para PENDING no state.yaml.
```

## Telemetria (`telemetry/events.jsonl`)

Formato do ORCHESTRATOR §13, um JSON por linha: cada handoff enviado, cada resposta, cada gate.
`content` leva o resumo, nunca segredo ou `.env`.

## Falhas da IA (`ai-failures.jsonl`) — dado do TCC

Uma linha por falha detectada, mesmo que corrigida depois. Alimenta
`skills/09-ai-failure-map/references/tcc-protocol.md` (RQ1–RQ4).

```json
{"run_id":"fase1-…","task_id":"T10","stage":"GATE_QA","agent":"backend-implementation-agent",
 "class":"F-03","detected_by":"P-04","severity":"CRITICA",
 "description":"settlement sem FOR UPDATE SKIP LOCKED; teste [OR-13] liquidou 2×",
 "defect_id":"DEF-T10-1","fixed":true,"escaped_to_human_review":false,"at":"…Z"}
```

| Campo | Valores |
|---|---|
| `class` | `F-01` … `F-12` (skill 09) |
| `detected_by` | `P-01` … `P-09`; gate = `P-05`/`P-07`; oráculo = `P-03`; constraint = `P-04`; revisor = `P-08` |
| `severity` | `CRITICA`, `ALTA`, `MEDIA`, `BAIXA` |
| `escaped_to_human_review` | `true` se só você achou na revisão final (06) |

Esta corrida é a condição **B (com guardas)** do protocolo. Se quiser comparar com A (prompt simples), rode
depois só T03, T05, T09, T10 e T12 sem o bloco de guardas, numa branch separada.
