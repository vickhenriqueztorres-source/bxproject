---
name: mudanca-cirurgica
description: Protocolo para editar um código desconhecido com o menor diff possível, sem efeito colateral. Define o orçamento por passo, o que é proibido, o padrão "duas portas" (sala nova atrás da chave reutilizando o mesmo motor) e como conferir e desfazer. Use em TODA edição.
---

# Mudança cirúrgica

## Antes

1. O arquivo está na lista do passo aprovado? Se não está, **não edite**.
2. Leia o arquivo **inteiro**.
3. Busque o nome exato de cada símbolo que vai mudar e liste quem usa. Se alguém de fora do passo depende do que vai mudar, **pare**.
4. Confira `docs/zonas-sensiveis.txt`.

## Orçamento por passo (padrão; o dono pode mudar)

- Até **5 arquivos** e **150 linhas** alteradas (soma de + e −).
- Arquivo novo conta. Arquivo VERMELHO não entra nunca.
- Passou do orçamento → divida o passo.

## Proibido

- Reformatar um arquivo, reordenar imports, trocar aspas ou ponto e vírgula, mudar indentação de trecho que você não alterou.
- Renomear ou mover arquivo, componente, função, prop, classe, `id` ou `data-testid`.
- Mudar a assinatura pública (props obrigatórias, tipos exportados, retorno de hooks).
- Adicionar, remover ou atualizar dependência.
- Apagar arquivo ou código antigo.
- "Aproveitar para arrumar": refactor, tipagem, lint de código não relacionado.
- Mudança visual e de lógica no mesmo passo.
- Trocar a biblioteca de gráfico, o store ou o cliente de API.

## Padrão "duas portas"

O caminho mais seguro para a sala nova é **não alterar a antiga**:

```
// página da sala (único ponto que muda de comportamento)
flagLigada ? <SalaBinmax {...mesmasProps} /> : <SalaAtual {...mesmasProps} />
```

- `SalaBinmax` e seus filhos usam **os mesmos hooks, stores e funções** que `SalaAtual` (preço, saldo, payout, abrir operação). **Nunca** cópias.
- Se um hook necessário está preso dentro de `SalaAtual`, **extrair** esse hook é um passo próprio, de lógica, com teste, revisado pelo guardião. Não faça isso escondido num passo visual.
- Componentes visuais reaproveitáveis (ícone de ativo, formatação) podem ser importados de `SalaAtual` sem alterar o original.

## Depois

1. `git diff --stat`: confira o número de arquivos e linhas.
2. `git diff`: **releia linha por linha**. Cada linha tem que ter um motivo no plano.
3. Procure `console.log`, `debugger`, `TODO`, `any` novos e valores fixos de dinheiro.
4. Rode a checagem rápida (typecheck ou lint do projeto).
5. Entregue para o `guardiao-regressao`.

## Desfazer

- Passo ainda não commitado: `git restore <arquivos do passo>`.
- Passo commitado: `git revert <hash>`. Nunca `reset --hard` em branch compartilhada.

## Mensagem de commit

`tipo(escopo): o que mudou`, por exemplo `feat(sala): ticket estreito igual à IQ atrás de NEW_TRADEROOM`.
Os tipos são: `feat`, `fix`, `style`, `refactor` (só em passo de lógica aprovado), `test`, `docs`.
