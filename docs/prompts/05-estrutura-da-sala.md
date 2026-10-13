# Etapa 05 — Estrutura da sala (copiar o layout da IQ)

**Objetivo:** colocar cada zona e cada elemento da sala **exatamente onde está na IQ Option**, no mesmo tamanho.
**Mexe no código?** Sim — layout e estilo. **Não** mexe em dados nem regras.
**Entrega:** `docs/relatorios/05-estrutura.md` + fotos em `docs/relatorios/fotos/05/`

Esta é a etapa em que o agente **Fidelidade IQ** mais trabalha.

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/dashboard-ux.md (INTEIRO — principalmente o mapa da seção 1, a lista fechada de diferenças da seção 4 e "O que NÃO fazer" da seção 5)
4. Abra a imagem docs/referencias/iq-traderoom-desktop.png e olhe com atenção. ESTE É O MOLDE.
5. docs/identidade-visual.md
6. Todos os relatórios em docs/relatorios/

CONTEXTO
O lead já opera na IQ Option. A sala da Binmax tem que ser a sala da IQ com outra marca. Mesmo layout, mesmos tamanhos, mesmos elementos. Só valem as diferenças D1–D10. NÃO "melhore" o layout. NÃO use o layout de docs/referencias/binmax-mockup-marca.png (ele é só referência de cor e logo).

OBJETIVO DESTA ETAPA (só com a chave NEW_TRADEROOM ligada)
Montar as 6 zonas na posição e no tamanho da IQ (seção 1 de docs/dashboard-ux.md):
- A. Barra superior (~76px): A1 logo → A2 botão grade → A3 abas (~136×48, ícone, nome, "Binaria", ✕) → A4 botão + → espaço → A5 avatar → A6 saldo com ▾ e selo DEMO/REAL → A7 Depositar.
- B. Menu lateral (~68px): ícone em cima, texto caixa-alta embaixo, os 10 itens na ordem da IQ. Item sem tela no sistema fica escondido.
- C. Área do gráfico: todo o espaço entre B e D. Nesta etapa só reserve os LUGARES de C1 (botões ✕ ⤡ no canto superior esquerdo), C2 (cabeçalho do ativo ao lado), C3 (sentimento sobreposto à borda esquerda), C4 (ferramentas empilhadas no canto inferior esquerdo) e C5 (OHLC ao lado de C4). O visual detalhado do gráfico é a etapa 06.
- D. Ticket: coluna direita ESTREITA (~115px). Nesta etapa só a coluna e a ordem: Monto → Expiración → Ganancia → SUBE → BAJA. O conteúdo é a etapa 07.
- E. Barra de portfólio (~30px): "Portafolio total" à esquerda, "Mostrar posiciones ⌃" à direita. Fechada por padrão. O painel é a etapa 08.
- F. Rodapé (~30px): SOPORTE neutro + e-mail + "TODOS LOS DÍAS, A TODA HORA" à esquerda; aviso de risco curto no centro; som, configurações, "HORA ACTUAL: …" (hora do servidor) e tela cheia à direita. Sem "Powered by".

REGRAS
- Reaproveite os componentes que já existem. Mude posição e estilo, não a lógica.
- Não altere nenhum dado, chamada ou regra. Se um componente mistura layout com lógica, NÃO separe agora: envolva por fora ou anote em "Fica para depois".
- Se um elemento da IQ não existe no sistema (ex.: alerta de preço, sinais), NÃO crie a funcionalidade. Reserve o espaço, esconda o botão e anote em "Fica para depois".
- Se não souber como a IQ faz algo, PARE e peça um print ao dono. Não invente.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
Para cada elemento A1–F: componente atual, arquivo, posição atual, se é usado em outras páginas, ou "não existe".

FASE 2 — CONSELHO DOS AGENTES
Para CADA zona (A, B, C, D, E, F), escreva um bloco com:
- Fidelidade IQ: descreva o que a imagem da IQ mostra nessa zona (posição, tamanho, elementos, ordem). Marque cada elemento: IGUAL / DIFERENTE PERMITIDO (D#) / FORA DA IQ.
- Marca Binmax: só cores, logo e textos desta zona (seções 2 e 3 de docs/dashboard-ux.md). Nada de layout.
- Compliance e Risco: algum risco nesta zona?
- Guardião de Regressão: o que pode quebrar e qual teste prova que não quebrou.
- Mapeador: como fazer com a menor mudança possível no código.
Em conflito de layout, ganha a Fidelidade IQ. Registre o conflito.

FASE 3 — PLANO (e PARE)
- Desenho em texto do layout final em 1920×1000 e 1366×768, com a largura/altura de cada zona em px, e confirme que bate com a imagem da IQ.
- Para cada zona: arquivos, mudança, risco, teste, como desfazer.
- Ordem dos passos (uma zona por commit).
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Uma zona por commit, na ordem: F → A → B → D (só coluna) → E (só barra) → C (só os lugares).
Depois de cada zona: testes de fumaça + foto em 1920×1000.
No fim: TESTE DE SOBREPOSIÇÃO (seção 8 de docs/dashboard-ux.md) e fotos em todos os tamanhos da seção 5 do checklist, chave ligada e desligada.

FASE 5 — RELATÓRIO
Grave docs/relatorios/05-estrutura.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com:
- Tabela "Elemento (A1…F) → IQ → Binmax → IGUAL / D# / fora do lugar".
- Foto da Binmax lado a lado com a da IQ, e a sobreposta com 50% de transparência.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 2 (só os automáticos) e 5 + teste de sobreposição.
````

---

## O que você confere

Abra a sala da Binmax e a imagem da IQ lado a lado:

- [ ] Cada zona está no mesmo lugar e com a mesma altura/largura.
- [ ] O ticket é estreito, como na IQ (não ficou largo).
- [ ] O menu lateral tem ícone em cima e texto embaixo, na ordem da IQ.
- [ ] Embaixo do gráfico há só a barra fina "Portafolio total / Mostrar posiciones", não uma tabela.
- [ ] Não apareceu nenhum menu de texto no topo (Operar, Mercados…).
- [ ] As únicas diferenças são as da lista D1–D10.

Se alguma coisa "parece outra plataforma", está errado.

## Se der errado

- A IA "melhorou" o layout: recuse e mande reler a seção 5 de `docs/dashboard-ux.md`.
- A IA quer reescrever o componente inteiro: recuse; peça só para mover/envolver.
- Uma zona é usada em outra página e mudou lá também: a mudança não ficou atrás da chave.
