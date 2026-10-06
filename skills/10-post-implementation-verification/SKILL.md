---
name: 10-post-implementation-verification
description: >
  Trigger: "validar implementação", "pós-implementação", "fechar gate", "pós-condição", "anti-cross", "recalcular candles", "cadeia de hash". Prova por execução que a entrega cumpre as garantias.
version: 1.0.0
---

# 10-post-implementation-verification

Verificação **depois** da implementação na **Plataforma de Índices Sintéticos**.
As skills `02`–`06` dizem o que é certo e como testar. Esta skill diz **como provar, executando**, que o
que foi entregue cumpre essas regras: quais pós-condições consultar, com qual critério numérico e com
qual evidência um gate pode fechar.

Vale para um único índice (Fase 1) e para vários ativos (plano multi-ativos em `docs/multi-ativos/`).

## Mentalidade

| Regra | Pergunta mental |
|-------|-----------------|
| Teste verde não é prova | A consulta de pós-condição no banco confirma o que o teste disse? |
| Ausência de evidência é falha | Existe saída de comando, linha de consulta ou métrica para cada `PASS`? |
| Quem implementou não verifica | O verificador alterou alguma linha de código ou de teste? Se sim, nada vale |
| Recalcular, não confiar | Hash, candle e resultado do contrato foram **recalculados** a partir dos ticks? |
| Pendente continua pendente | Regra `<não definido no contexto>` virou `PENDENTE`, nunca `PASS`? |

## Regras de ativação

**Ativar quando o pedido contém:**

- "validar implementação", "verificação pós-implementação", "fechar o gate", "homologar subetapa"
- "pós-condição", "consulta de verificação", "evidência do gate", "relatório PASS/FAIL"
- "anti-cross", "cruzamento de ativos", "recalcular candles", "verificar cadeia de hash", "sequence contínua"
- Fim de qualquer subetapa do plano multi-ativos ou de qualquer `T01`–`T18`, antes do merge
- Fim de cada degrau ou cenário de carga e caos (E1 a E4, C-01 a C-08)

**Não ativar quando:**

- Escrever ou corrigir testes — usar `06-testing-quality` (`qa-resilience-agent`)
- Definir a regra financeira ou de preço em si — usar `02-financial-invariants` ou `03-synthetic-market-engine`
- Revisar código linha a linha — usar os revisores do §8 (financeiro, segurança, arquiteto)
- Configurar alertas e dashboards permanentes — usar `07-production-operations`

## Garantias verificadas

Critério, consulta e evidência exigida de cada uma: `references/api-guide.md`.

| ID | Garantia | Fonte | Prova |
|----|----------|-------|-------|
| V-01 | Catálogo de ativos igual ao esperado; precisão não muda depois do primeiro tick | Plano multi-ativos, `M-04` | SQL |
| V-02 | `sequence` contínua por ativo, começando em 1; `index_state.last_sequence = max(sequence)` | `M-02` | SQL |
| V-03 | Cadência ≥ 0,9 tick/s por ativo e nenhum intervalo > 3 s entre ticks | `D-13` | SQL |
| V-04 | Cadeia de hash íntegra: gênese, elos e recálculo SHA-256 | `M-04` | SQL |
| V-05 | Outbox publicado em ≤ 5 s; Stream `ticks:{symbol}` em dia com o Postgres | `D-08`, `R-xx` | SQL + Redis |
| V-06 | Candles fechados iguais ao recálculo a partir dos ticks | `M-05` | SQL |
| V-07 | Nenhum contrato liquidado com tick de outro ativo; resultado recalculado bate | `I-xx`, `A-07` | SQL |
| V-08 | Todo contrato vencido liquida em ≤ 10 s; nada preso em estado não terminal | §9.4 | SQL |
| V-09 | Dinheiro fecha: reconciliação `OK` com divergência 0; payout coerente com o resultado | `I-02`, `I-05` | SQL |
| V-10 | Ativo `PAUSED` não recebe contrato novo e continua liquidando os abertos | Plano multi-ativos | SQL |
| V-11 | Limites do WebSocket respeitados (5 conexões/usuário, 10 ativos/conexão, sem buraco de `sequence`) | `S-xx` | Saída do teste |
| V-12 | SLOs do degrau atendidos pelos thresholds do k6 | `Q-04` | Resumo JSON do k6 |
| V-13 | O processo de verificação é íntegro: código e testes do commit sob verificação não mudaram | Skill 09 (`F-xx`) | `git` + `scripts/health-check.sh` |

## Instruções

**Modo gate** (fim de uma subetapa ou `Txx`):

1. Fixar o commit sob verificação (`git rev-parse HEAD`) e confirmar ambiente descartável (`ENVIRONMENT=ephemeral|ci`).
2. Selecionar as garantias da subetapa pela matriz de `references/api-guide.md` ("Garantias por subetapa").
3. Rodar os testes do gate **sem alterar nada**; guardar a saída bruta.
4. Rodar `scripts/verify-postconditions.sh` com a janela do teste (`WINDOW_START`, `WINDOW_END`).
5. Marcar cada garantia selecionada como `PASS`, `FAIL`, `PENDENTE` ou `INCONCLUSIVO`, cada uma com evidência.
6. Rodar `scripts/health-check.sh` para `V-13`. Se falhar, o relatório inteiro vira `INVÁLIDO`.

**Modo carga e caos** (fim de cada degrau E1–E4 ou cenário C-xx):

1. Igual ao modo gate, com a janela do degrau (excluindo os 2 min de estabilização).
2. Somar `V-12` a partir do resumo do k6 (`--summary-export`).
3. Em caos, reportar a janela de troca de líder separada de `V-03`, nunca escondida.

**Modo triagem** (antes de começar, opcional):

1. Rodar `scripts/health-check.sh` no repositório para achar padrões que fazem o teste mentir.
2. Devolver a lista; quem corrige é o `qa-resilience-agent`.

## Formato de saída

```text
SKILL: 10-post-implementation-verification
MODO: GATE | CARGA | CAOS | TRIAGEM
COMMIT: <sha>
AMBIENTE: <ephemeral | ci>
JANELA: <WINDOW_START> → <WINDOW_END>
ESCOPO: <subetapa / Txx / degrau / cenário>

V-01 Catálogo            : PASS | FAIL | PENDENTE | INCONCLUSIVO | N/A — <evidência>
V-02 Sequence            : ...
...
V-13 Integridade         : PASS | FAIL — <fingerprint antes = depois>

FALHAS:
- <V-xx> — <linhas violadoras ou métrica> — reprodução: <comando/consulta> — destino: <agente>

PENDÊNCIAS: <regras <não definido no contexto> ou "nenhuma">
VEREDITO: APROVADO | REPROVADO | INVÁLIDO
```

`APROVADO` só com todas as garantias selecionadas em `PASS` ou `PENDENTE` justificado. Um `FAIL` ou
`INCONCLUSIVO` deixa `REPROVADO`. `V-13` em `FAIL` deixa `INVÁLIDO`.

## Exemplos

Exemplo curto:

```text
Entrada: fim do E3 (pico com dinheiro), janela 14:02–14:10.
verify-postconditions.sh:
  V-07 cross_or_wrong_result ........ 0 linhas
  V-08 stuck_or_late_settlement ..... 312 linhas (status FAILED_RETRYABLE)

V-07 Anti-cross : PASS — 0 de 18.420 contratos SETTLED violam
V-08 Prazo      : FAIL — 312 contratos presos em FAILED_RETRYABLE há > 10 s
FALHAS:
- V-08 — 312 contratos — reprodução: consulta V-08 do api-guide — destino: bug-fix-agent
VEREDITO: REPROVADO
```

Exemplos completos: `examples/example-1.md` e `examples/example-2.md`.

## Edge cases

- **Arredondamento do WIN (`D-19` pendente):** a parte WIN de `V-09` fica `PENDENTE`; LOSS = 0 e DRAW = stake continuam verificados.
- **Precisão do ativo desconhecida:** se `indices.params` não tiver a chave de precisão, `V-04` vira `INCONCLUSIVO`, nunca `PASS`.
- **Redis indisponível para o verificador:** a parte Stream de `V-05` fica `INCONCLUSIVO`; a parte outbox continua.
- **Teste flaky:** uma única reexecução é permitida; as duas saídas entram no relatório e a garantia fica `FAIL` com nota "flaky".
- **Janela de troca de líder (C-01):** o intervalo > 3 s dentro da janela declarada do cenário é reportado à parte; fora dela é `FAIL`.
- **Candle do minuto corrente:** nunca comparar; só buckets fechados há mais de 1 intervalo.
- **Ambiente compartilhado ou produção:** o script recusa rodar; o relatório fica `INVÁLIDO`.
- **Consulta lenta com muitos ativos:** limitar por janela, nunca por amostra silenciosa; amostra precisa ser declarada.

## Modos de falha cobertos

| Modo de falha | Mitigação nesta skill |
|---------------|-----------------------|
| Falha de ativação | Triggers de gate, pós-condição, anti-cross, hash e candles |
| Ativação espúria | Fronteiras com `06` (escrever teste) e revisores (ler código) |
| Execução parcial | Toda garantia selecionada tem status explícito; ausência = `INCONCLUSIVO` |
| Deriva de instrução | Critérios numéricos e consultas fixos em `references/` |
| IA ajusta o teste para passar | `V-13`: fingerprint de código e testes antes e depois |
| Context overflow | Consultas e matriz em `references/`; casos completos em `examples/` |
| Feedback loop negativo | Pendente vira `PENDENTE`; nada é inventado para fechar o gate |

## Recursos

- Critérios, consultas SQL, matriz por subetapa e modelo de relatório: `references/api-guide.md`
- Exemplos completos: `examples/example-1.md`, `examples/example-2.md`
- Casos de teste: `tests/test-case-1.md`, `tests/expected-output-1.md`, `tests/test-case-2.md`, `tests/expected-output-2.md`
- Validação da estrutura: `scripts/validate.sh`
- Triagem de padrões que fazem o teste mentir: `scripts/health-check.sh`
- Execução das pós-condições no banco e no Redis: `scripts/verify-postconditions.sh`
