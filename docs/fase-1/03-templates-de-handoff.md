# Templates de handoff e validação

Todo handoff é **Bloco de guardas (§1) + YAML da subtask** (de `prompts/Txx.md`). O orquestrador nunca
manda só o YAML.

## 1. Bloco de guardas (sempre no topo do handoff)

Adaptado de `skills/09-ai-failure-map` ("Bloco de guardas"). Troque `{{…}}` pelos valores da subtask.

```text
CONTEXTO: Plataforma de Índices Sintéticos, Fase 1, subtask {{Txx}} — {{nome}}. Skills: {{skills}}.
VOCÊ É: {{agente}}. Siga o seu AGENT.md: contrato de entrada, regras, fronteira de escrita e formato de saída.
VERSÕES FIXADAS: docs/fase-1/versoes.lock.md. Use só APIs da doc em docs/vendor/. Se a API não estiver lá,
  PARE e devolva BLOCKED com a pergunta exata.
DECISÕES: D-01 a D-19 de skills/01-project-context/SKILL.md. Valor não decidido = "<não definido no contexto>", nunca inventado.
PROIBIDO: Math.random; number, parseFloat ou toFixed para dinheiro; publicar antes de persistir;
  remover ou afrouxar verificação, teste, constraint, grant, healthcheck ou tipo; "as any"; @ts-ignore;
  .skip/.only; "|| true"; continue-on-error; valor substituto quando dependência falhar;
  criar ledger ou login próprio; editar ORCHESTRATOR.md, agents/, skills/ ou docs/fase-1/; sair do escopo da subtask.
SE UMA VERIFICAÇÃO FALHAR: pare, mostre o erro e a hipótese. Não altere a verificação.
TESTES-ORÁCULO: docs/fase-1/09-oraculos.md, IDs {{OR-xx}}. Somente leitura. O título do teste leva "[OR-xx]".
ENTREGA: YAML do contrato 2.2 do ORCHESTRATOR.md + os campos extras do "Formato de saída" do seu AGENT.md.
  Não declare "testes passaram": o gate (docs/fase-1/scripts/gate.sh) decide.
```

## 2. Implementador (backend-implementation-agent ou frontend-realtime-agent)

```yaml
task_id: Txx
agent: backend-implementation-agent      # T13 e T14: frontend-realtime-agent
objective: >
  <o que entregar, verificável>
context:
  - <seções do ORCHESTRATOR.md e referências de skill>
  - <diretórios do código já existente que a subtask toca>
  - docs/fase-1/versoes.lock.md
  - docs/vendor/<lib>/                   # só as libs da subtask
skills: [<lista da subtask>]
acceptance_criteria:
  - <critério testável>
budget: { max_steps: 3, max_tokens: 400000, timeout: 90m }
```

## 3. QA (qa-resilience-agent)

O objetivo é **testar**. Nunca escreva "faça passar" ou "corrija": o QA ignora e registra (contrato de entrada).

```yaml
task_id: Txx
agent: qa-resilience-agent
objective: >
  Testar a Txx nos níveis indicados, incluindo os oráculos {{OR-xx}}, e devolver veredito com defeitos reproduzíveis.
context:
  - diff: git diff fase-1/run...fase-1/Txx
  - .orchestrator/tasks/Txx/11-impl-result.yaml   # summary + artifacts + evidence do implementador
  - agents/qa-resilience-agent/references/api-guide.md   # "Plano por subtask", linha Txx
  - docs/fase-1/04-matriz-de-testes.md                    # contrato dos scripts e nomes de teste
  - docs/fase-1/09-oraculos.md
  - ambiente: stack efêmera (pnpm run stack:up)
skills: [01-project-context, 05-resilience-patterns, 06-testing-quality, 07-production-operations, <02/03/04 conforme a regra>]
acceptance_criteria:
  - <critérios da subtask>
budget: { max_steps: 3, max_tokens: 400000, timeout: 90m }
```

## 4. Bug-fix (bug-fix-agent)

```yaml
task_id: Txx                              # a subtask DONE ou em andamento onde o defeito foi achado
agent: bug-fix-agent
defect_ref: DEF-Txx-n                     # ou arquivo:linha do revisor, ou nome do alerta
reproduction: >
  <comando ou teste que falha> → observado: <...> / esperado: <...>
owner: backend-implementation-agent       # route_to do QA ou handoff_notes do revisor
environment: local
context:
  - <arquivo:linha apontado>
  - .orchestrator/tasks/Txx/21-qa-result.yaml ou 31-review-<agente>-result.yaml
  - .orchestrator/evidence/Txx/<log do gate que falhou>
skills: [<skills do domínio do owner>]
acceptance_criteria:
  - "o teste <arquivo::[ID] título> deixa de falhar"
  - "regressão [DEF-Txx-n] adicionada e falhava antes da correção"
budget: { max_steps: 3, max_tokens: 400000, timeout: 60m }
```

## 5. Pacote de contexto de cada worker (isolamento, ORCHESTRATOR §1.7)

| Entra | Não entra |
|---|---|
| `agents/<agente>/AGENT.md` | Histórico do orquestrador |
| `SKILL.md` de cada skill listada (references sob demanda) | Transcript de outros workers |
| Bloco de guardas + YAML da subtask | Skills que a subtask não lista |
| Arquivos em `context` | O repositório inteiro |
| `summary`, `artifacts`, `evidence` de etapas anteriores | `.env`, segredos, tokens |

## 6. Revisores (financial-correctness-reviewer, security-reviewer)

O objetivo é **revisar**. Pedido de correção é ignorado e registrado pelo revisor.

```yaml
task_id: Txx
agent: financial-correctness-reviewer     # ou security-reviewer
objective: >
  Revisar a Txx contra <invariantes I-01..I-06 | controles S-01..S-06> e devolver veredito com arquivo:linha.
context:
  - diff: git diff fase-1/run...fase-1/Txx
  - .orchestrator/tasks/Txx/11-impl-result.yaml
  - .orchestrator/tasks/Txx/21-qa-result.yaml
  - .orchestrator/evidence/Txx/qa-latest.json
  - <para T02: realm exportado; para T01/T16: compose e workflows>
skills: [<financeiro: 01, 02, 05, 08 (+03 em T05/T07) | segurança: 01, 04, 08 (+07 em T01/T16)>]
acceptance_criteria:
  - <critérios da subtask original>
budget: { max_steps: 1, max_tokens: 300000, timeout: 30m }
```

## 7. Validação da resposta do worker (Trust Boundary, ORCHESTRATOR §1.8)

Rejeite, não coaja. Resposta malformada volta **uma vez** ao mesmo worker com a lista de erros; na segunda,
`FAILED` (conta como tentativa).

| Checagem | Todos |
|---|---|
| YAML válido | ✔ |
| `task_id` e `agent` iguais aos do handoff | ✔ |
| `status` ∈ `DONE`, `FAILED`, `BLOCKED` | ✔ |
| `summary` com até 8 linhas, sem transcript | ✔ |
| `acceptance_criteria_met` cobre **todos** os critérios do handoff | ✔ |
| `evidence` com comando → resultado (não "testes passaram") | ✔ |
| `confidence_score` entre 0 e 1 | ✔ |
| Campos extras do "Formato de saída" do `AGENT.md` do agente | ✔ |

| Agente | Também exige |
|---|---|
| Implementadores | `artifacts` não vazio quando `DONE`; riscos e decisões listados |
| QA | `verdict`, `test_results`, `coverage_gaps`; cada defeito com `id`, `reproduction` e `route_to` |
| Revisores | bloco `review` com cada invariante/controle `PASS`/`FAIL`/`N/A` e `findings` com `location: arquivo:linha` |
| Bug-fix | causa raiz, regressão `[DEF-…]` e classificação (`E8`, `E9`, `E10`, `data_repair`) quando houver |

**O gate vence a palavra do worker.** Worker diz `DONE` e o gate dá `FAIL`: vale o gate. Registre
`F-08` (evidência inventada) em `ai-failures.jsonl` com `detected_by: P-07`.
