# Etapa 06 — Gráfico (igual ao da IQ)

**Objetivo:** gráfico com os mesmos elementos, nos mesmos lugares, que o gráfico da IQ — só com as cores da Binmax e sem imagem de patrocinador.
**Mexe no código?** Sim — configuração visual do gráfico. **Não troca a biblioteca.**
**Entrega:** `docs/relatorios/06-grafico.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ (principalmente a seção D do relatório 01) e confirme lendo os arquivos e a documentação da biblioteca de gráfico NA VERSÃO INSTALADA.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/dashboard-ux.md (seção 1, zona C — elementos C1 a C13; seções 2, 4 e 5)
4. Abra docs/referencias/iq-traderoom-desktop.png e olhe com atenção o gráfico. ESTE É O MOLDE.
5. docs/identidade-visual.md (seções 3 e 7)
6. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA (só com a chave ligada) — elemento por elemento, igual à IQ:
C1  Canto superior esquerdo: botões quadrados ✕ e ⤡ empilhados.
C2  Ao lado: ícone do ativo com selo OTC, "NOME (OTC) ▾" em negrito, "Binaria" embaixo; linha com "ⓘ Info", 🔔 e ☆.
C3  Sentimento SOBREPOSTO à borda esquerda do gráfico: "SUBE xx%" em cima, chevrons verdes, chevrons vermelhos, "BAJA xx%" embaixo. A porcentagem vem do sistema; se o sistema não tiver sentimento, esconda e anote.
C4  Canto inferior esquerdo, botões empilhados: tipo de gráfico, período da vela ("1m"), sinais, desenhos, indicadores, escala de tempo ("5m"). Use as funções que o sistema JÁ tem; botão sem função fica escondido.
C5  Ao lado de C4: Apert., Máx., Mín., Cierre com valores, texto pequeno.
C6  Velas grandes: alta #22C47A, baixa #F2545B. Grade fina (Blanco 6–8%).
C7  Linha do preço atual TRACEJADA atravessando o gráfico, cor Prata #DCE1EA. Etiqueta no eixo direito em forma de seta apontando para a esquerda, fundo Prata, texto Noche, últimos 3 dígitos maiores e em negrito.
C8  Abaixo da etiqueta do preço: etiqueta cinza com 🔔 e o preço do alerta (só se o sistema tiver alertas).
C9  Tempo até a vela fechar ("00:04") escrito em cima da linha de preço, perto da última vela.
C10 Linha vertical PONTILHADA branca de fim de compra, ícone de cronômetro em círculo no pé, e no topo "HORA DE / COMPRA" + contador grande "00:34".
C11 Linha vertical CONTÍNUA vermelha (#F2545B) de expiração, ícone de bandeira quadriculada em círculo vermelho no pé.
C12 Eixo de preço à direita, eixo de tempo embaixo, etiqueta de data e hora completa no ponto atual.
C13 Fundo liso Noche #0D0F14. Sem imagem de patrocinador, sem marca d'água.
Mais: linha horizontal de entrada de cada operação aberta, como a IQ mostra (se não souber como é, peça print).

O QUE NÃO FAZER (seção 5 de docs/dashboard-ux.md)
- NÃO mover período/tipo/zoom para o topo do gráfico.
- NÃO tirar o sentimento de cima do gráfico.
- NÃO mover o OHLC para o topo.
- NÃO trocar o contador "HORA DE COMPRA" por outro modelo.

REGRAS
- Use as opções que a biblioteca oferece. Se algo não for possível sem gambiarra, pare e explique as alternativas.
- Não mude como os dados chegam no gráfico. Não mude a frequência de atualização.
- Todos os tempos (C9, C10, C11) usam a hora do SERVIDOR.
- O gráfico não pode ficar mais lento (checklist seção 8).

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Biblioteca e versão, onde a instância é criada, onde ficam as opções de cor, como as linhas atuais (preço, compra, expiração) são desenhadas.
- Quais dos elementos C1–C13 já existem, com arquivo, e quais não existem.
- Como o gráfico recebe a hora do servidor e o sentimento.

FASE 2 — CONSELHO DOS AGENTES
- Fidelidade IQ: para cada C1–C13, descreva o que a imagem da IQ mostra (posição, forma, tamanho) e compare com o que existe. IGUAL / D# / FORA DA IQ.
- Marca Binmax: só as trocas de cor (laranja → Prata na linha e etiqueta de preço; verde/vermelho da marca nas velas e chevrons).
- Compliance e Risco: nada no gráfico sugere direção; o sentimento mostra o número real.
- Guardião de Regressão: medir desempenho antes e depois; testar trocar período, trocar ativo, redimensionar a janela.
- Mapeador: lugares exatos para mudar.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Cada elemento C1–C13 com: arquivo, mudança, se a biblioteca suporta, risco, teste.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por grupo: cores e fundo (C6, C13) → linha e etiqueta de preço (C7, C8, C9) → linhas de tempo (C10, C11, C12) → cabeçalho (C1, C2) → sentimento (C3) → ferramentas e OHLC (C4, C5) → linha de entrada.
Testes e foto depois de cada grupo. Meça antes e depois: quadros por segundo com 3 abas abertas e memória após 10 minutos.

FASE 5 — RELATÓRIO
Grave docs/relatorios/06-grafico.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com a tabela C1–C13 (IGUAL / D# / fora), foto ao lado da IQ e as medições de desempenho.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 5 e 8 + teste de sobreposição (seção 8 de docs/dashboard-ux.md); trocar período, trocar ativo, redimensionar janela, abrir 3 abas.
````

---

## O que você confere (ao lado da imagem da IQ)

- [ ] Ferramentas empilhadas no canto **inferior** esquerdo, como na IQ.
- [ ] Sentimento em cima da borda esquerda do gráfico, com SUBE em cima e BAJA embaixo.
- [ ] OHLC embaixo à esquerda.
- [ ] Etiqueta do preço em forma de seta, com os últimos dígitos maiores.
- [ ] "HORA DE COMPRA 00:34" no topo, linha pontilhada branca e linha vermelha com os ícones no pé.
- [ ] Os tempos batem com a "HORA ACTUAL" do rodapé.
- [ ] Não ficou mais lento.
