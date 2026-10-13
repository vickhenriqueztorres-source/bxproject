# Etapa 07 — Ticket (Monto, Expiración, Ganancia, SUBE, BAJA)

**Objetivo:** o ticket **igual ao da IQ**: coluna estreita, os mesmos 5 blocos, os mesmos tamanhos. Só mudam cores e textos.
**Mexe no código?** Sim. **ZONA SENSÍVEL**: é aqui que se abre operação com dinheiro.
**Entrega:** `docs/relatorios/07-ticket.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ (principalmente a seção C do relatório 01) e confirme lendo os arquivos.

ATENÇÃO: ESTA É UMA ZONA SENSÍVEL. O ticket abre operações com dinheiro real. A função que abre a operação, o endpoint, os parâmetros enviados e as validações do servidor NÃO podem mudar. Você só muda a interface em volta.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md (principalmente a seção 4 — Dinheiro e tempo)
2. docs/prompts/agentes.md
3. docs/dashboard-ux.md (seção 1, zona D — elementos D1 a D5; seções 2, 3, 4 e 5)
4. Abra docs/referencias/iq-traderoom-desktop.png e olhe com atenção a coluna da direita. ESTE É O MOLDE.
5. docs/identidade-visual.md (seções 3.4, 4 e 8)
6. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA (só com a chave ligada) — coluna direita estreita (~115px), de cima para baixo, IGUAL À IQ:

D1 MONTO
   - Rótulo "Monto ⓘ" pequeno, cinza (Aço).
   - Caixa com "$ 1" digitável (valor em Geist Mono).
   - À direita da caixa, botões + e − PEQUENOS e EMPILHADOS (como na IQ). Área de clique mínima de 24px sem mudar o visual (D10).
   - Mínimo, máximo e passo: os que o sistema já usa.

D2 EXPIRACIÓN
   - Rótulo "Expiración ⓘ".
   - Caixa com ícone de relógio + horário/duração ("02:06"), do jeito que o sistema já calcula.
   - + e − pequenos e empilhados à direita.

D3 GANANCIA
   - Rótulo "Ganancia ⓘ" centralizado.
   - "+85%" MUITO grande (~44px, peso leve, o "%" menor), Verde Ganancia.
   - Embaixo "+$0.85" Verde Ganancia, negrito, ~18px.
   - Payout e ganho vêm do servidor. O navegador só formata. Se hoje o projeto calcula no navegador, NÃO mude a fórmula — só mostre.

D4 SUBE
   - Botão QUASE QUADRADO (~110×110px, como na IQ).
   - Ícone de gráfico subindo em cima, "SUBE" negrito ~15px embaixo.
   - Fundo Verde Ganancia #22C47A, texto Noche.

D5 BAJA
   - Mesmo tamanho, mesma forma, ~8px abaixo de SUBE.
   - Ícone de gráfico descendo, "BAJA".
   - Fundo Rojo Baja #F2545B, texto Noche.

COMPORTAMENTO (igual à IQ)
- Mouse em SUBE: a área do gráfico acima do preço fica verde suave. Em BAJA: abaixo, vermelho suave.
- Depois do horário de compra, SUBE e BAJA ficam desativados como o sistema já faz hoje.
- Proteção contra clique duplo: enquanto a operação está sendo enviada, os dois botões ficam desativados (se já existir, só confirme; se não existir, proponha e peça aprovação, porque toca em lógica).

O QUE NÃO FAZER (seção 5 de docs/dashboard-ux.md)
- NÃO alargar o ticket.
- NÃO colocar chips de valor ($5, $10…), "Recibes $X", "Compra cierra en", dica de atalho ou qualquer texto extra.
- NÃO trocar os botões quase quadrados por botões largos e baixos.
- NÃO criar atalhos de teclado novos.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Componente atual do ticket, de onde vêm monto, expiração, payout, saldo e mínimo/máximo.
- Função exata que abre a operação e o que ela envia. Copie a assinatura no relatório para provar que não mudou.
- Já existe proteção contra clique duplo? Já existem atalhos de teclado?

FASE 2 — CONSELHO DOS AGENTES
- Fidelidade IQ: descreva o ticket da imagem da IQ (largura, ordem, tamanho de cada bloco, + e − empilhados, botões quase quadrados) e compare com o atual. IGUAL / D# / FORA DA IQ.
- Marca Binmax: só cores (SUBE verde, BAJA vermelho, ganância verde) e textos (Monto, Expiración, Ganancia, SUBE, BAJA).
- Compliance e Risco: SUBE e BAJA idênticos em tamanho e destaque; ganho mostrado é exatamente o do servidor.
- Guardião de Regressão: testes obrigatórios (checklist seções 2 e 3) e prova de que a função de abrir operação não mudou.
- Mapeador: como fazer sem tocar na lógica de envio.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
D1–D5 + comportamento, com arquivos, mudanças, riscos e testes. Separe claramente "muda só interface" de "toca em lógica" (o segundo grupo precisa da minha aprovação item por item).
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por item, nesta ordem: D1 → D2 → D3 → D4/D5 → comportamento.
Depois de cada item, rodar os testes da seção 2 do checklist EM CONTA DEMO.
No fim, mostrar o git diff da função de abrir operação: deve estar vazio.

FASE 5 — RELATÓRIO
Grave docs/relatorios/07-ticket.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com: foto do ticket ao lado do ticket da IQ, tabela D1–D5 (IGUAL / D# / fora) e a prova de que a função de envio não mudou.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 2, 3 e 5 + teste de sobreposição. Sempre em conta demo.
````

---

## O que você confere (em conta demo, ao lado da imagem da IQ)

- [ ] O ticket tem a mesma largura e os mesmos blocos que o da IQ, e nada a mais.
- [ ] + e − pequenos e empilhados ao lado de Monto e de Expiración.
- [ ] "+85%" grande e "+$0.85" embaixo, em verde.
- [ ] SUBE (verde) e BAJA (vermelho) quase quadrados e do mesmo tamanho.
- [ ] Clique duplo rápido abre **uma** operação só.
- [ ] Depois do horário de compra os botões ficam desativados.

## Se der errado

- Abriu duas operações: pare tudo, volte o commit, revise a proteção de clique duplo.
- Ganho diferente do que o servidor paga: volte o commit; o navegador está calculando algo que não devia.
- A IA colocou chips, "Recibes" ou outro extra: recuse e mande reler a seção 5 de `docs/dashboard-ux.md`.
