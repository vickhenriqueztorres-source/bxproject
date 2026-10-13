---
name: testes-de-regressao
description: Como provar que nada quebrou num projeto desconhecido. Grava a base (falhas que já existiam e fotos do antes), roda as verificações do próprio projeto e executa o roteiro manual de dinheiro e tempo com a chave desligada e ligada. Use na etapa 02 (base), depois de cada passo (rápido) e no fim de cada etapa (completo).
---

# Testes de regressão

Use **só** as ferramentas que o projeto já tem (seção "Testes" e "Comandos" de `docs/mapa-do-projeto.md`). Instalar framework de teste novo exige aprovação do dono e é uma etapa à parte.

## A. Base (uma vez, na etapa 02, antes de qualquer mudança)

1. Rode typecheck, lint, testes unitários, e2e e build. Para cada um, grave o comando, o tempo e o resultado em `docs/relatorios/02-*.md`.
2. **Liste as falhas que já existem.** Elas não são culpa da etapa, mas ficam registradas para ninguém confundir com regressão.
3. Fotos do "antes" em `docs/fotos/antes/`: sala (desktop 1920×993, 1366×768, 390×844), home, login, depósito, perfil e histórico.
4. Anote o commit da base (`git rev-parse HEAD`).

## B. Rápido (depois de cada passo)

1. Typecheck e lint (se existirem).
2. Testes unitários dos arquivos tocados, se o runner permitir filtrar. Senão, todos.
3. `git diff --name-only | grep -F -f docs/zonas-sensiveis.txt` precisa voltar vazio.

## C. Completo (fim de cada etapa)

1. Tudo do bloco A de novo e comparado com a base: **só conta falha nova**.
2. Flag **desligada**: as fotos têm que ser iguais às de `docs/fotos/antes/`.
3. Flag **ligada**: o roteiro manual abaixo, primeiro na conta **DEMO**.

## Roteiro manual (sala nova, flag ligada, conta DEMO)

Para cada item, marque `[A]` automatizado, `[M]` manual ou `[N]` não deu, com o motivo.

### Operar
- [ ] SUBE abre uma operação com o valor e a expiração mostrados. Ela aparece no gráfico e no portfólio.
- [ ] BAJA abre uma operação, idem.
- [ ] Clique duplo rápido em SUBE abre **uma** operação só.
- [ ] Toque duplo no celular abre **uma** operação só.
- [ ] Com a internet caindo no meio do clique: nenhuma operação fantasma. O estado volta certo ao reconectar.
- [ ] Depois do fim de compra, SUBE e BAJA ficam desativados e mostram o motivo.
- [ ] A operação liquida no horário certo e o saldo atualiza com o valor do servidor.

### Valores
- [ ] Valor mínimo, valor máximo e acima do máximo (mensagem igual à atual).
- [ ] Valor com vírgula e com ponto, como o sistema aceita hoje.
- [ ] O "+$X" de ganho bate com o cálculo atual para 3 valores diferentes.
- [ ] Trocar de ativo atualiza payout e ganho.
- [ ] Ativo fechado ou sem payout: o comportamento é igual ao atual.

### Contas
- [ ] Trocar DEMO ↔ REAL atualiza saldo e selo. As operações vão para a conta certa.
- [ ] Depositar abre o mesmo fluxo de hoje.

### Tempo e conexão
- [ ] Com o relógio do computador adiantado 2 min, o contador continua certo (hora do servidor).
- [ ] Deixar a aba em segundo plano 5 min e voltar: o gráfico e o contador se recuperam.

### Resto da plataforma
- [ ] Login, logout, cadastro, depósito, saque, perfil e histórico iguais aos de antes.
- [ ] Os eventos de analytics da sala continuam disparando (ver o console de rede ou a ferramenta de analytics).

## Relatório

Por item: comando ou ação, resultado, evidência (log ou print). Nunca escreva "passou" para algo que não rodou.
