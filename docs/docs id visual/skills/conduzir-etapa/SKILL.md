---
name: conduzir-etapa
description: Roteiro do orquestrador (Engenheiro de Prompt) para rodar UMA etapa de docs/prompts/ do começo ao fim. Chama os agentes na ordem certa, monta o plano, para para aprovação, executa passo a passo com o cirurgiao e o guardiao, e grava o relatório. Use quando o dono pedir "rode a etapa NN" ou qualquer mudança na sala de operação.
---

# Conduzir uma etapa

Você é a **conversa principal** e faz o papel de orquestrador. Subagentes **não chamam outros subagentes**, então é você quem chama cada um, junta as respostas e decide.

## 0. Carregar contexto (sem editar nada)

Leia, nesta ordem:
1. `docs/prompts/README.md` e `docs/prompts/cuidados-gerais.md`.
2. O prompt da etapa: `docs/prompts/NN-*.md`.
3. O relatório da etapa anterior em `docs/relatorios/`. Se não existir e a etapa não for a 01, **pare e avise**.
4. `docs/mapa-do-projeto.md` e `docs/zonas-sensiveis.txt`. Se não existirem e a etapa não for a 01, rode a skill `mapear-projeto` primeiro.
5. `git status`: se tiver mudança não commitada que não é sua, **pare e pergunte**.
6. `git branch --show-current`: se for `main`, `master` ou `production`, **pare e peça para criar uma branch**.

## 1. Perguntar ao Mapeador

Mande ao subagente `mapeador` **no máximo 3 perguntas focadas** sobre o que a etapa vai tocar. Exemplo: "Onde é renderizado o ticket? Quem é dono do estado do valor? Qual função abre a operação?".

## 2. Pareceres (em paralelo)

Mande para `fidelidade-iq`, `marca-binmax` e `compliance-risco` o prompt da etapa e a resposta do mapeador. Cada um devolve o parecer no próprio formato. **Não resuma o parecer antes de ler inteiro.**

## 3. Montar o plano

Use este modelo:

```
## Plano: Etapa NN
Objetivo (1 linha):
Fica fora desta etapa:

### Passo 1: <nome>
- Arquivos (lista FECHADA):
- O que muda:
- O que NÃO muda:
- Risco: baixo / médio / alto + por quê
- Como testar:
- Como desfazer:
- Orçamento: até X arquivos / Y linhas

### Conflitos entre agentes e como foram resolvidos
### Perguntas para o dono
```

Regras do plano:
- Um passo é **uma** preocupação. Visual e lógica nunca no mesmo passo.
- Em conflito de **layout**, ganha `fidelidade-iq`. Em conflito de **dinheiro ou honestidade**, ganha `compliance-risco`. Em conflito de **risco técnico**, ganha `guardiao-regressao`.
- Se faltar um print da IQ, a pergunta vai para "Perguntas para o dono". **Não invente.**

## 4. Revisar o plano

Mande o plano ao `guardiao-regressao` (modo plano). Corrija o que ele reprovar.

## 5. PARAR

Mostre o plano ao dono e **espere aprovação por escrito**. Sem aprovação, nenhum arquivo é editado.

## 6. Executar (repita para cada passo)

1. Mande **só o passo atual** ao `cirurgiao`.
2. Se ele responder `PRECISA AMPLIAR ESCOPO` ou `PASSO GRANDE DEMAIS`, **volte ao dono**. Não amplie por conta própria.
3. Mande o resultado ao `guardiao-regressao` (modo passo).
4. Se o passo é visual: tire os prints (skill `teste-de-sobreposicao`) e mande ao `fidelidade-iq` (modo 2). Se toca em cor ou texto, mande também ao `marca-binmax`.
5. Se o passo toca ticket, saldo, operação ou tempo, mande ao `compliance-risco`.
6. **Todos aprovaram** → faça o commit com a mensagem sugerida.
7. **Alguém reprovou** → **uma** tentativa de correção pelo `cirurgiao`, com a lista exata do que corrigir. Se reprovar de novo: `git restore` nos arquivos do passo (o passo ainda não foi commitado), explique ao dono e pare.

## 7. Fechar a etapa

- Rode a skill `testes-de-regressao` (bloco final), com a chave **desligada** e **ligada**.
- Grave `docs/relatorios/NN-<nome>.md` no formato da seção 7 de `docs/prompts/cuidados-gerais.md`.
- Atualize `docs/mapa-do-projeto.md` **só** com fatos novos que foram verificados.

## Sem subagentes (outras ferramentas)

Faça a mesma sequência na própria conversa. Escreva cada parecer numa seção separada (`### Agente: mapeador` …), **um de cada vez**, relendo o arquivo do agente em `.claude/agents/` antes de cada um. O parecer de um agente não pode citar a conclusão de outro para concordar.
