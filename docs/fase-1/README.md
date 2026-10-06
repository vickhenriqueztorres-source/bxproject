# Fase 1 — execução autônoma com IDE

Esta pasta transforma o `ORCHESTRATOR.md`, as 9 skills e os 6 agentes numa **corrida autônoma de até 48 h**.
A IDE trabalha sozinha, uma subtask por sessão. Cada etapa passa por um gate que roda testes de verdade
e só avança com evidência. No fim, você revisa e apresenta.

```text
ANTES  (você)        DURANTE  (IDE sozinha, até 48 h)                       DEPOIS  (você)
Fase 0 → tag  ──▶  run-loop.sh ─▶ sessão ─▶ 1 subtask ─▶ gate ─▶ merge  ──▶  revisão ─▶ apresentação
                        ▲                                    │
                        └──────────── checkpoint ◀───────────┘
```

## Arquivos

| Arquivo | Para quem | O que é |
|---|---|---|
| `00-preparacao-humana.md` | Você, antes | Checklist da Fase 0: máquina, decisões, versões, oráculos, tag de governança |
| `01-prompt-mestre.md` | IDE | Prompt do orquestrador autônomo (o `run-loop.sh` injeta este bloco em cada sessão) |
| `02-ondas-e-dependencias.md` | IDE e você | Ordem T01–T18, dependências, mapa PRD → subtask, zona vermelha |
| `03-templates-de-handoff.md` | IDE | Bloco de guardas, formato dos handoffs, validação das respostas, contexto isolado |
| `04-matriz-de-testes.md` | IDE e você | Testes executados em cada subetapa e contrato dos scripts de teste |
| `05-estado-e-telemetria.md` | IDE | `state.yaml`, checkpoint, fila humana, telemetria e registro de falhas da IA (TCC) |
| `06-revisao-final.md` | Você, depois | Como revisar a entrega antes de aprovar o PR |
| `07-apresentacao.md` | Você, depois | Roteiro da demo para a banca, plano B e perguntas prováveis |
| `08-versoes-fixadas.md` | Todos | Versões fixadas e docs oficiais anexadas (combate a API inventada, F-01) |
| `09-oraculos.md` | Você assina, IDE obedece | 26 testes-oráculo que provam o PRD e a Definição de Pronto |
| `prompts/T01.md` … `T18.md` | IDE | Handoffs prontos por subtask: implementador, QA, revisores, testes e critério de avanço |
| `scripts/gate.sh` | IDE | Portão de cada etapa; grava evidência em `.orchestrator/evidence/` |
| `scripts/run-loop.sh` | Você liga | Relança a IDE em modo headless até `FINISHED` ou `HALTED` |
| `scripts/pin-versions.sh` | Você, na Fase 0 | Resolve versões exatas e digests e gera `versoes.lock.md` |

## Como ligar

1. Cumpra `00-preparacao-humana.md` até o item "Pronto para ligar".
2. No repositório do produto:

```bash
AGENT_CMD='claude -p' bash docs/fase-1/scripts/run-loop.sh      # ou o modo headless da sua IDE
```

3. Para retomar depois de queda de energia ou reinício, rode o mesmo comando. O estado fica em `.orchestrator/`.

## Como acompanhar sem atrapalhar

| Onde olhar | O que significa |
|---|---|
| `.orchestrator/STATUS` | `RUNNING`, `FINISHED: …` ou `HALTED: <motivo>` |
| `.orchestrator/state.yaml` | Subtask atual, passo, tentativas, defeitos |
| `.orchestrator/human-queue.md` | O que só você pode resolver. A corrida **não para** por causa disso |
| `.orchestrator/evidence/Txx/*-latest.json` | Resultado do último gate de cada etapa |
| `git log --oneline fase-1/run` | Subtasks já mergeadas |

Se aparecer algo em `human-queue.md`, resolva, registre a decisão e mude a subtask para `PENDING` no
`state.yaml`. A próxima sessão retoma sozinha.

## O que a IA não faz sozinha (skill 09, L-xx) e como foi tratado

| Limite | Tratamento nesta corrida |
|---|---|
| L-02 subir a stack e rodar caos/carga | A IDE roda na **sua máquina com Docker**. O gate executa os testes; não é a IA que relata |
| L-03 API certa de Blnk/Keycloak | Versões fixadas + doc oficial em `docs/vendor/` + teste contra container real |
| L-04 avaliar a própria entrega | Revisores em contexto isolado + gate. A IA nunca marca DONE sem evidência |
| L-06 regra de negócio pendente | D-16, D-17 e D-19 decididas por você na Fase 0. Novas dúvidas vão para a fila humana |
| L-07 calibrar alertas | Limiares iniciais propostos; calibração após T18 entra na sua revisão |
| L-08 restore/DR/incidente | Fora da corrida. Nada roda contra produção |

Seja realista: 48 h não garantem as 18 subtasks DONE. O desenho garante que **o que estiver DONE está provado**,
e que o que travou está explicado na fila humana. Para a banca, isso vale mais do que 18 itens sem evidência.
