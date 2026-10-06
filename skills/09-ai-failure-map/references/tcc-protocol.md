# Protocolo de medição para o TCC

Objetivo: transformar a construção da Fase 1 com IA em **dado comparável**, não em relato.

## Perguntas de pesquisa

| ID | Pergunta |
|----|----------|
| RQ1 | Quais classes de falha (`F-xx`) as IDEs com IA cometem com mais frequência, e em que tipo de subtask? |
| RQ2 | Qual camada de prevenção (`P-xx`) detecta cada classe, e quantos defeitos escapam de todas? |
| RQ3 | As guardas (prompt + oráculos + regras estáticas) reduzem defeitos e iterações em relação ao prompt simples? |
| RQ4 | Quais atividades da Fase 1 não são delegáveis à IA (`L-xx`) e quanto esforço humano elas exigem? |

## Hipóteses

| ID | Hipótese | Como refutar |
|----|----------|--------------|
| H1 | Subtasks de dinheiro e concorrência (T05, T09, T10) concentram a maioria dos defeitos graves | Distribuição de defeitos por subtask |
| H2 | Sem guardas, ao menos uma falha F-03 aparece em toda implementação de T10 | Contagem na condição A |
| H3 | Com guardas, os defeitos que chegam à revisão humana caem, mas não chegam a zero | Comparação A × B |
| H4 | F-06 (remover a proteção) aparece principalmente quando a IA recebe um erro para "consertar" | Defeitos F-06 por tipo de prompt |

## Desenho experimental

- **Subtasks avaliadas:** T03 (segurança), T05 (concorrência + aleatoriedade), T09 (idempotência), T10 (dinheiro + tempo) e **T12 como controle** (baixa complexidade).
- **Condições:**
  - **A — prompt simples:** descrição da subtask como um desenvolvedor faria.
  - **B — com guardas:** template de `references/guardrails.md` + oráculos + regras estáticas.
- **Fixos entre condições:** ferramenta, modelo, versão da ferramenta, repositório de partida (mesmo commit), oráculos.
- **Repetições:** ao menos 3 execuções por subtask e condição — a saída do modelo não é determinística.
- **Limite de iterações:** 5 ciclos de feedback por execução; ao atingir, registrar como `ESGOTADO`.
- **Ferramentas comparadas (opcional):** repetir o desenho em 2 IDEs (ex.: Cursor e Claude Code) para separar falha do modelo de falha da ferramenta.

## Unidade de registro

Um registro por execução, versionado em `research/runs/<data>-<T-xx>-<condição>-<n>.yaml`:

```yaml
run_id: 2026-03-12-T10-B-2
subtask: T10
condition: B                    # A | B
tool: <IDE>
tool_version: <versão>
model: <modelo>
start_commit: <sha>
prompt_file: research/prompts/T10-B.md
iterations: 3                   # ciclos até CI verde ou esgotar
outcome: CI_GREEN               # CI_GREEN | ESGOTADO | ABANDONADO
human_minutes: 42               # tempo humano de revisão e correção
lines_generated: 310
lines_kept_unchanged: 241
mutation_score: 0.86
failures:
  - id: 1
    class: F-03
    description: dois workers liquidaram o mesmo contrato
    detected_by: P-03           # camada que detectou
    iteration: 1
    severity: CRITICA           # CRITICA | ALTA | MEDIA | BAIXA
    fixed_by: IA                # IA | HUMANO
  - id: 2
    class: F-06
    description: removeu CHECK de status para o teste passar
    detected_by: P-04
    iteration: 2
    severity: ALTA
    fixed_by: HUMANO
escaped:                        # defeitos achados depois (caos, carga, revisão final)
  - class: F-09
    description: marcava SETTLED com Blnk fora
    found_in: T17
limits_hit: [L-01, L-02]
notes: ""
```

Severidade:

| Nível | Critério |
|-------|----------|
| CRITICA | Move ou cria dinheiro errado, permite acesso a dado de outro usuário ou corrompe tick |
| ALTA | Quebra invariante sem efeito financeiro imediato (ex.: perde mensagem, desliga verificação) |
| MEDIA | Falha funcional visível (ex.: gráfico não atualiza) |
| BAIXA | Estilo, desempenho não crítico |

## Métricas

| Métrica | Fórmula | Responde |
|---------|---------|----------|
| Taxa de sucesso na 1ª iteração | execuções com CI verde na iteração 1 ÷ execuções | RQ3 |
| Iterações até CI verde | média de `iterations` com `outcome = CI_GREEN` | RQ3 |
| Defeitos por classe | contagem de `failures.class` | RQ1 |
| Defeitos críticos por subtask | contagem com `severity = CRITICA` | RQ1, H1 |
| Detecção por camada | contagem de `detected_by` por `class` | RQ2 |
| Taxa de escape | `escaped` ÷ (`failures` + `escaped`) | RQ2 |
| Aproveitamento | `lines_kept_unchanged` ÷ `lines_generated` | RQ3 |
| Esforço humano | soma de `human_minutes` por subtask | RQ4 |
| Mutation score | do relatório do Stryker | qualidade dos testes (F-07) |

## Experimento complementar: defeitos semeados

Mede se **revisores com IA** encontram defeitos conhecidos.

1. Partir de uma implementação correta de T09/T10.
2. Injetar um defeito por classe (lista abaixo), um por branch.
3. Pedir revisão ao `financial-correctness-reviewer` / `security-reviewer` (IA) sem dizer que há defeito.
4. Registrar: encontrou? classificou certo? propôs correção certa?

| # | Defeito semeado | Classe |
|---|-----------------|--------|
| 1 | Tick de saída = último tick em vez do primeiro `>= expires_at` | F-03 |
| 2 | Checagem de idempotência antes do insert (sem `UNIQUE`) | F-03 |
| 3 | `stake * 1.85` em `number` | F-02 |
| 4 | `catch` retorna saldo 10.000 | F-09 |
| 5 | `aud` não verificado | F-06 |
| 6 | `user_id` lido do body | F-10 |
| 7 | Snapshot antes de assinar no WebSocket | F-03 |
| 8 | Teste de settlement com Blnk mockado sempre OK | F-07 |
| 9 | `BEGIN` via `pool.query` | F-03 |
| 10 | Endpoint inexistente do Blnk | F-01 |

Métrica: taxa de detecção por classe. Resultado esperado a testar: revisores com IA detectam bem F-02 e F-10 (padrões visíveis no texto) e mal F-03 (depende de execução concorrente).

## Ameaças à validade

| Ameaça | Mitigação |
|--------|-----------|
| Modelo muda de versão durante o estudo | Registrar `model` e `tool_version`; concentrar coletas em janela curta |
| Sensibilidade ao texto do prompt | Prompts versionados em `research/prompts/`; mesmo texto entre repetições |
| Viés do pesquisador ao classificar | Taxonomia fechada (`F-xx`); segunda classificação por outra pessoa em amostra; medir concordância |
| Aprendizado do pesquisador entre execuções | Alternar ordem A/B entre subtasks |
| Generalização | Declarar que o resultado vale para este tipo de sistema (financeiro, distribuído, tempo real) |
| Não determinismo | Repetições ≥ 3 e reportar dispersão, não só média |

## Estrutura sugerida para o capítulo de resultados

1. Taxonomia (`F-xx`) e por que cada classe nasce do funcionamento do modelo.
2. Distribuição de defeitos por subtask e severidade (RQ1).
3. Matriz classe × camada de detecção e taxa de escape (RQ2).
4. Comparação A × B: sucesso na 1ª iteração, iterações, defeitos críticos, esforço humano (RQ3).
5. Limites não delegáveis e custo humano associado (RQ4).
6. Defeitos semeados: o que revisores com IA enxergam e o que não enxergam.
7. Recomendações: quais guardas têm melhor relação custo × defeitos evitados.
