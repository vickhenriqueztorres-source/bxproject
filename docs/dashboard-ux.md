# Binmax Option — Sala de Operação (especificação)

> **Regra principal: a sala da Binmax é uma cópia fiel da sala da IQ Option.**
> Mesmo layout, mesmas zonas, mesmos tamanhos, mesmos elementos, mesmo comportamento.
> Só mudam: **marca (logo e cores), idioma (espanhol)** e a lista fechada de diferenças da seção 4.

O lead já opera na IQ Option. Ele não pode procurar nada. Se ele olhar a sala da Binmax e pensar "é a IQ com outra cor", **acertamos**.

---

## 0. Referências (obrigatórias)

| Arquivo | Para quê | Pode copiar o layout? |
|---|---|---|
| `docs/referencias/iq-traderoom-desktop.png` | **Referência de LAYOUT.** Toda posição, tamanho e elemento sai daqui. | **Sim — é o molde.** |
| `docs/referencias/binmax-mockup-marca.png` | Referência só de **MARCA**: logo, cores, botões SUBE verde / BAJA vermelho, textos em espanhol. | **Não.** O layout desse mockup (menu de texto no topo, menu lateral largo, tabela fixa embaixo, ticket largo) **foge da IQ e não deve ser usado.** |
| `docs/referencias/iq-*.png` (outros) | Prints extras da IQ que o dono do projeto adicionar (celular, menus abertos, portfólio aberto, aviso de resultado). | Sim. |

**Se a IA não souber como a IQ faz alguma coisa, ela NÃO inventa.** Ela para e pede ao dono um print da IQ, que deve ser salvo em `docs/referencias/`.

---

## 1. Mapa da sala (igual à IQ)

Medidas aproximadas, tiradas da referência numa tela de ~1920×1000. Em outras resoluções, manter as **proporções** e a **posição** de cada elemento.

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ A1 LOGO │A2 ⊞│ A3 [✕🇳🇿 NZD/JPY (O… ] [✕🇪🇺 EUR/CAD (O… ] … │A4 +│        A5 (👤)▾  A6 $9,603.75▾  A7 [$ Depositar] │ ~76px
├────┬──────────────────────────────────────────────────────────────────────────────────┬──────┤
│ B  │ C1 ✕   C2 🇳🇿 NZD/JPY (OTC) ▾                           C10 HORA DE    00:34       │ D1   │
│    │ C1 ⤡      Binaria                                          COMPRA                │Monto │
│ ▣  │           (ⓘ Info) (🔔) (☆)                               ┊          ┃           │$ 1 ±│
│Port│                                                            ┊          ┃           │ D2   │
│    │ C3 SUBE                                                    ┊          ┃           │Expir.│
│ ◷  │    50%                    C6 velas                         ┊          ┃           │⏱02:06±│
│Hist│    ▲▲                                                      ┊          ┃           │ D3   │
│    │    ▲▲          ▇                                           ┊          ┃           │Ganan.│
│ ▥  │    ▲▲     ▇    ▇  ▇                                        ┊          ┃           │ +85% │
│Rend│ - - - - - - - - - - - - - - - - - - - - - - - - C9 00:04 - ┊ - - - - -┃- - - -C7◀89.44392│+$0.85│
│    │    ▼▼                                                      ┊          ┃      C8 🔔89.4379│┌────┐│
│ …  │    ▼▼                                                      ┊          ┃           ││ D4 ││
│    │    ▼▼                                                      ┊          ┃           ││SUBE││
│    │ C3 BAJA                                                    ┊          ┃           │└────┘│
│    │    50%                                                     ┊          ┃           │┌────┐│
│    │ C4 [▮▯]                                                    ┊          ┃           ││ D5 ││
│    │    [1m]   C5 Apert. 89.431965                              ┊          ┃           ││BAJA││
│    │    [((·))]   Máx.  89.456255                               ┊          ┃           │└────┘│
│    │    [✎]       Mín.  89.408345                               ┊          ┃           │      │
│    │    [∿]       Cierre 89.443915                              ┊          ┃           │      │
│    │    [5m]                                           C10 (⏱)   C11 (🏁)             │      │
│    │        01:55:00              02:00:00     [2026.10.08 02:04:00]       02:10:00   │      │
├────┴──────────────────────────────────────────────────────────────────────────────────┴──────┤
│ E  Portafolio total                                                       Mostrar posiciones ⌃│ ~30px
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ F  [SOPORTE] ⓘ soporte@…  TODOS LOS DÍAS, A TODA HORA   (aviso de risco)   🔇 ⚙ HORA ACTUAL: 8 OCTUBRE, 02:04:56 (UTC-3) ⛶ │ ~30px
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

### A — Barra superior (~76px de altura)

| ID | Elemento | Posição e tamanho (como na IQ) | Na Binmax |
|---|---|---|---|
| A1 | Logo | Canto esquerdo, ~150px de largura | Logo Binmax (versão horizontal, Prata) |
| A2 | Botão grade ⊞ | Logo depois do logo, quadrado ~44px. Abre a lista de todos os ativos | Igual |
| A3 | Abas de ativos | Em linha, ~136×48px cada. Dentro: ícone do ativo (bandeiras sobrepostas + selo OTC), nome em negrito ~13px na linha 1, tipo ("Binaria") ~11px cinza na linha 2. "✕" pequeno no canto superior esquerdo para fechar. Nome longo corta com "…". **Aba ativa:** sublinhado de ~2px na cor de destaque | Igual. Destaque da aba ativa em **Prata** (no lugar do laranja). Passar o mouse mostra o nome completo |
| A4 | Botão + | Depois da última aba, quadrado ~44px. Abre nova aba de ativo | Igual |
| A5 | Avatar | Lado direito, círculo ~44px + ▾ | Igual |
| A6 | Saldo | À direita do avatar, ~20px negrito + ▾. Clicar abre o menu de contas | Saldo em **Verde Ganancia** (no lugar do laranja) + selo pequeno **DEMO** / **REAL** (diferença D5) |
| A7 | Depositar | Último à direita, ~175×46px, ícone de $ em círculo + texto grande | **Verde cheio** (na IQ é contornado — diferença D6) |

### B — Menu lateral esquerdo (~68px de largura)

Ícone ~24px em cima, texto em caixa-alta embaixo (1 ou 2 linhas, centralizado, cinza). Selo "NUEVO" pequeno quando houver. **Ordem igual à IQ:**

| # | IQ (pt) | Binmax (es) |
|---|---|---|
| 1 | Portfólio total | Portafolio total |
| 2 | Histórico de trading | Historial de trading |
| 3 | Meu desempenho | Mi rendimiento |
| 4 | Chats e suporte | Chat y soporte |
| 5 | Tutoriais | Tutoriales |
| 6 | Promoção | Promociones |
| 7 | Tabela de líderes | Tabla de líderes |
| 8 | Análise de mercado | Análisis de mercado |
| 9 | Torneios | Torneos |
| 10 | Mais | Más |

Se o sistema não tiver alguma dessas telas, **não criar a tela**: o item fica escondido e entra em "Fica para depois".

### C — Área do gráfico (todo o espaço entre o menu e o ticket)

| ID | Elemento | Como na IQ |
|---|---|---|
| C1 | Botões da aba | Canto superior esquerdo do gráfico: dois botões quadrados ~32px empilhados — ✕ (fechar) e ⤡ (minimizar/expandir) |
| C2 | Cabeçalho do ativo | Ao lado de C1: ícone do ativo ~32px com selo OTC, nome "NZD/JPY (OTC) ▾" ~15px negrito (clicar abre a lista), embaixo "Binaria" ~13px cinza. Linha de baixo: três botões redondos/escuros — "ⓘ Info", 🔔 (alerta de preço), ☆ (favorito) |
| C3 | Sentimento | **Sobreposto à borda esquerda do gráfico**, ~45px de largura, entre ~28% e ~65% da altura. Em cima: "SUBE" + "50%". Coluna de chevrons verdes (de cima até o meio), depois chevrons vermelhos (do meio para baixo), na proporção dos traders. Embaixo: "BAJA" + "50%" |
| C4 | Ferramentas | **Canto inferior esquerdo**, botões quadrados ~32px empilhados na vertical: tipo de gráfico, período da vela ("1m"), sinais (com selo NUEVO), desenhos (lápis), indicadores, escala de tempo ("5m") |
| C5 | OHLC | Ao lado de C4, canto inferior esquerdo, texto pequeno: Apert., Máx., Mín., Cierre + valores, com ícone "?" |
| C6 | Velas | Grandes e espaçadas, verde (alta) e vermelha (baixa), grade fina |
| C7 | Preço atual | Linha horizontal **tracejada** atravessando o gráfico inteiro. No eixo direito, etiqueta em formato de **seta apontando para a esquerda** com o preço; os **3 últimos dígitos maiores e em negrito**. Cor: **Prata** com texto Noche (na IQ é laranja) |
| C8 | Alerta de preço | Logo abaixo da etiqueta do preço: etiqueta cinza menor com 🔔 e o preço do alerta |
| C9 | Fechamento da vela | Tempo até a vela atual fechar ("00:04"), escrito em cima da linha de preço, perto da última vela |
| C10 | Fim de compra | Linha **vertical pontilhada branca**. No pé, ícone de cronômetro em círculo branco. No topo, à esquerda da linha: "HORA DE / COMPRA" (2 linhas, pequeno) + contador grande "00:34" |
| C11 | Expiração | Linha **vertical contínua vermelha**. No pé, ícone de bandeira quadriculada em círculo vermelho |
| C12 | Eixos | Eixo de preço à direita (texto pequeno cinza). Eixo de tempo embaixo, com etiqueta de data e hora completa ("2026.10.08 02:04:00") no ponto atual |
| C13 | Fundo | Na IQ tem imagem de patrocinador. **Na Binmax: fundo liso Noche** (diferença D4) |

### D — Ticket (coluna direita ESTREITA, ~115px, igual à IQ)

De cima para baixo, **nada além disto**:

| ID | Elemento | Como na IQ | Na Binmax |
|---|---|---|---|
| D1 | Valor | Rótulo "Invest ⓘ" ~12px cinza. Caixa com "$ 1" (digitável). À direita da caixa, botões **+ e − pequenos, empilhados** | Rótulo **"Monto ⓘ"** |
| D2 | Expiração | Rótulo "Expiração ⓘ". Caixa com ícone de relógio + "02:06". **+ e − empilhados** à direita | Rótulo **"Expiración ⓘ"** |
| D3 | Lucro | Rótulo "Lucro ⓘ" centralizado. **"+85%" muito grande** (~44px, peso leve, "%" menor), verde. Embaixo, **"+$0.85"** verde negrito ~18px | Rótulo **"Ganancia ⓘ"**. Verde Ganancia |
| D4 | Botão de cima | **Quase quadrado** (~110×110px). Ícone de gráfico subindo em cima, texto "ACIMA" ~15px negrito embaixo. Laranja | **"SUBE"**, fundo **Verde Ganancia** |
| D5 | Botão de baixo | Mesmo tamanho, ~8px abaixo. Ícone de gráfico descendo, texto "ABAIXO". Cinza | **"BAJA"**, fundo **Rojo Baja** (diferença D2) |

- Passar o mouse em SUBE/BAJA destaca a área do gráfico acima/abaixo do preço (verde/vermelho suave), como na IQ.
- **Não colocar no ticket:** chips de valor ($5, $10…), "Recibes $X", contagem "Compra cierra en", dica de atalho de teclado, textos extras. Nada disso existe na IQ.

### E — Barra de portfólio (~30px, entre o gráfico e o rodapé)

- Esquerda: **"Portafolio total"** em negrito.
- Direita: **"Mostrar posiciones ⌃"**. Clicar abre o painel de operações para cima; clicar de novo fecha.
- Fechada por padrão. **Não é uma tabela fixa** embaixo do gráfico.

### F — Rodapé (~30px)

- Esquerda: botão **"SOPORTE"** (diferença D7: neutro, não vermelho), "ⓘ" + e-mail de suporte que o sistema já usa, "TODOS LOS DÍAS, A TODA HORA".
- Centro: aviso de risco curto (diferença D8).
- Direita: ícone de som (🔇), ícone de configurações (⚙), **"HORA ACTUAL: 8 OCTUBRE, 02:04:56 (UTC-3)"** (hora do servidor), ícone de tela cheia (⛶).
- **Sem "Powered by…"** (diferença D3).

---

## 2. Troca de cores (IQ → Binmax)

A lógica é a mesma da IQ: onde a IQ usa a cor de destaque dela, a Binmax usa a dela.

| Onde | IQ | Binmax |
|---|---|---|
| Fundo da sala | Cinza muito escuro | **Noche** `#0D0F14` |
| Barras, ticket, menu, caixas | Cinza escuro | **Panel** `#151922` |
| Aba ativa (sublinhado), linha e etiqueta do preço, selo NUEVO, item de menu ativo | Laranja | **Prata** `#DCE1EA` |
| Saldo | Laranja | **Verde Ganancia** `#22C47A` |
| Botão de cima | ACIMA laranja | **SUBE** Verde Ganancia `#22C47A` |
| Botão de baixo | ABAIXO cinza | **BAJA** Rojo Baja `#F2545B` |
| Lucro (+85%, +$0.85), vela de alta, chevrons de alta, Depositar | Verde | **Verde Ganancia** `#22C47A` |
| Vela de baixa, chevrons de baixa, linha de expiração | Vermelho | **Rojo Baja** `#F2545B` |
| Texto principal | Branco | **Blanco** `#F4F5F7` |
| Rótulos, eixos, ícones do menu | Cinza | **Aço** `#8A92A1` |
| Botão Suporte | Vermelho | **Panel** com texto Prata |

---

## 3. Troca de textos (IQ pt → Binmax es)

| IQ | Binmax |
|---|---|
| Binária | Binaria |
| Info | Info |
| ACIMA / ABAIXO | SUBE / BAJA |
| Invest | Monto |
| Expiração | Expiración |
| Lucro | Ganancia |
| HORA DE COMPRA | HORA DE COMPRA |
| Abert. / Máx. / Mín. / Fech. | Apert. / Máx. / Mín. / Cierre |
| Depositar | Depositar |
| Portfólio total | Portafolio total |
| Exibir posições | Mostrar posiciones |
| Suporte | Soporte |
| Todo dia, a toda hora | Todos los días, a toda hora |
| Hora atual | Hora actual |
| NEW | NUEVO |

Menu lateral: ver tabela da seção B.

---

## 4. Diferenças permitidas (lista FECHADA)

Tudo que não está nesta lista tem que ser **igual à IQ**. Para acrescentar uma diferença, só com aprovação escrita do dono do projeto.

| # | Diferença | Motivo |
|---|---|---|
| D1 | Logo e cores da Binmax (seção 2) | Marca |
| D2 | SUBE verde e BAJA vermelho, mesmo tamanho (na IQ: ACIMA laranja e ABAIXO cinza) | Marca + o botão cinza parece desativado |
| D3 | Sem "Powered by…" no rodapé | Marca própria |
| D4 | Gráfico sem imagem de patrocinador no fundo | Marca própria; velas legíveis |
| D5 | Selo DEMO / REAL ao lado do saldo | Não operar na conta errada |
| D6 | Depositar verde cheio (na IQ é contornado) | Regra da marca: dinheiro é verde e cheio |
| D7 | Botão Soporte neutro (na IQ é vermelho) | Vermelho na Binmax significa perda |
| D8 | Aviso de risco curto no rodapé | Obrigatório (compliance) |
| D9 | Todos os textos em espanhol (seção 3) | Mercado |
| D10 | Textos do menu lateral com no mínimo 11px e área de clique dos + e − com no mínimo 24px (sem mudar o visual) | Acessibilidade mínima |

---

## 5. O que NÃO fazer (onde a versão anterior fugiu da IQ)

- **Não** mover período da vela, tipo de gráfico e zoom para o cabeçalho do gráfico. Ficam na **coluna de ferramentas do canto inferior esquerdo (C4)**.
- **Não** tirar o sentimento de cima do gráfico nem criar uma coluna só para ele. Ele fica **sobreposto à borda esquerda (C3)**.
- **Não** mover o OHLC para o topo. Fica no **canto inferior esquerdo (C5)**.
- **Não** alargar o ticket. Ele é **estreito (~115px)** e tem só Monto, Expiración, Ganancia, SUBE e BAJA.
- **Não** colocar chips de valor, "Recibes $X", "Compra cierra en", dicas de atalho ou qualquer texto extra no ticket.
- **Não** trocar os botões quase quadrados por botões largos e baixos.
- **Não** trocar o "HORA DE COMPRA 00:34" do topo do gráfico por outro tipo de contador.
- **Não** usar o layout do mockup de marca: nada de menu de texto no topo (Operar, Mercados, Historial…), nada de menu lateral largo com o texto ao lado do ícone, nada de tabela de operações fixa embaixo do gráfico.
- **Não** criar atalhos de teclado novos. Se o sistema já tiver, eles continuam funcionando.
- **Não** inventar comportamento. Se não souber como a IQ faz, peça um print.

---

## 6. Comportamento (igual à IQ)

Só o que dá para ver na referência. O resto: **perguntar e pedir print**.

- Clicar no ▾ do nome do ativo (C2), no ⊞ (A2) ou no + (A4) abre a lista de ativos.
- Clicar no ✕ de uma aba fecha a aba.
- Clicar no saldo (A6) abre o menu de contas.
- "Mostrar posiciones" abre e fecha o painel de operações.
- Passar o mouse em SUBE/BAJA destaca a área do gráfico acima/abaixo do preço.
- O contador "HORA DE COMPRA", a linha pontilhada (C10), a linha vermelha (C11), o tempo da vela (C9) e a "HORA ACTUAL" do rodapé usam a **hora do servidor**.
- Depois do horário de compra, SUBE e BAJA ficam desativados até a próxima janela (como o sistema já faz hoje).

---

## 7. Celular e tablet

**Antes da etapa 10**, o dono do projeto deve salvar prints do app/site da IQ no celular em `docs/referencias/iq-mobile-*.png` (sala aberta, lista de ativos, portfólio aberto). A versão de celular copia esses prints.

Se não houver print, o padrão é: barra superior compacta (logo símbolo, ativo ▾, saldo verde + DEMO/REAL, Depositar), gráfico ocupando o espaço, e embaixo Monto e Expiración lado a lado e SUBE e BAJA lado a lado (SUBE à esquerda). **Mesmo assim, pedir os prints antes de começar.**

---

## 8. Teste de sobreposição (prova de fidelidade)

Em cada etapa que mexe na tela:

1. Abra a sala da Binmax numa janela de **1920×1000** (o mesmo tamanho da referência).
2. Tire uma foto.
3. Coloque a foto **lado a lado** com `docs/referencias/iq-traderoom-desktop.png` e também **sobreposta com 50% de transparência**.
4. Cada elemento (A1–F) tem que cair no mesmo lugar, com tolerância de mais ou menos 10px.
5. Liste no relatório cada elemento: **igual / diferente (D#) / fora do lugar**. Qualquer "fora do lugar" impede de avançar.

---

## 9. Atalhos de teclado

Não criar atalhos novos nesta fase. Se o sistema já tiver, eles continuam funcionando e são testados.

---

## 10. Métricas para validar

| Métrica | Meta |
|---|---|
| Tempo até a 1ª operação de quem vem da IQ (teste com 5 traders) | < 10 s, sem perguntar nada |
| "Onde fica X?" no teste com traders | Zero perguntas |
| Operações por sessão | Acompanhar contra a sala atual |
| Conversão demo → depósito | Acompanhar por coorte semanal |
| Operações na conta errada (tickets de suporte) | Tendência a zero |

---

## Status

Este documento é **especificação**, não código. A implementação é feita no código existente da plataforma, etapa por etapa, com os prompts de `docs/prompts/` (comece pelo `README.md` dessa pasta).
