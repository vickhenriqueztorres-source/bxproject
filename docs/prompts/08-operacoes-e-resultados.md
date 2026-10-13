# Etapa 08 — Portafolio total, operações e resultados

**Objetivo:** a barra "Portafolio total / Mostrar posiciones" e o painel de operações **iguais aos da IQ**, mais o aviso de resultado.
**Mexe no código?** Sim — interface do portfólio e avisos.
**Entrega:** `docs/relatorios/08-operacoes.md`

> **Antes de começar:** salve em `docs/referencias/` prints da IQ com (1) o painel "Exibir posições" aberto, (2) o item "Portfólio total" do menu lateral aberto e (3) o aviso que aparece quando uma operação termina. Sem esses prints, a IA vai parar e pedir.

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/dashboard-ux.md (zona E, seções 4, 5 e 6)
4. Abra docs/referencias/iq-traderoom-desktop.png e TODOS os prints docs/referencias/iq-*.png de portfólio e resultado. ESTES SÃO OS MOLDES.
   Se não houver print do painel aberto e do aviso de resultado, PARE e peça ao dono antes de planejar.
5. docs/identidade-visual.md (seções 3.4, 7 e 8 — microcopy)
6. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA (só com a chave ligada)

1. BARRA (zona E, ~30px, entre o gráfico e o rodapé) — igual à IQ
   - Esquerda: "Portafolio total" em negrito.
   - Direita: "Mostrar posiciones ⌃".
   - Fechada por padrão. NÃO é uma tabela fixa.

2. PAINEL (abre ao clicar em "Mostrar posiciones" e no item "Portafolio total" do menu lateral)
   - Copie o painel da IQ dos prints: posição, altura, colunas, ordem e como fecha.
   - Dados: os que o sistema já tem (ativo, direção, monto, preço de entrada, tempo restante ou horário de fechamento, resultado).
   - Cores: ganho em Verde Ganancia com "+", perda em Rojo Baja com "−". Preços e valores em Geist Mono.
   - Vazio: "Aún no tienes operaciones abiertas. Elige SUBE o BAJA para empezar."

3. AVISO DE RESULTADO
   - Na mesma posição, tamanho e duração em que a IQ mostra (ver print).
   - Textos: ganho "¡Ganaste! +$23.00" (verde); perda "No esta vez · −$25.00" (tom neutro, valor em vermelho); empate (se existir) "Empate · se devolvió $25.00".
   - Leitor de tela anuncia o resultado.
   - Com "reduzir movimento" ligado, só aparece e some (sem deslizar).

4. NO GRÁFICO
   - A linha de entrada de cada operação (etapa 06) some quando a operação termina, como na IQ.

5. SALDO
   - Depois do resultado, o saldo da barra superior atualiza com o valor que o SERVIDOR mandou (nunca somar no navegador).

O QUE NÃO FAZER
- NÃO colocar tabela de operações fixa embaixo do gráfico (como no mockup de marca).
- NÃO criar painel com layout próprio se a IQ tem um: copie o da IQ.
- NÃO colocar textos que empurram a operar mais ("¡Opera otra vez!", contadores de pressão).

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Componente atual de portfólio/histórico e de onde vêm os dados.
- Como o sistema avisa que uma operação terminou (evento, websocket, consulta periódica).
- Existe sistema de avisos (toast) no projeto? Use o que existir.
- Como o saldo é atualizado hoje depois do resultado.

FASE 2 — CONSELHO DOS AGENTES
- Fidelidade IQ: descreva a barra, o painel e o aviso dos prints da IQ e compare com o atual. IGUAL / D# / FORA DA IQ.
- Marca Binmax: só cores e textos.
- Compliance e Risco: o resultado do dia e o painel mostram perdas com a mesma clareza que ganhos.
- Guardião de Regressão: testes de liquidação, várias operações terminando no mesmo segundo, aba em segundo plano, reconexão (não duplicar avisos).
- Mapeador: onde ligar o aviso sem mudar o fluxo de dados.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Itens 1–5 com arquivos, mudanças, riscos e testes.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por item. Testar em conta demo: 1 operação, 3 operações terminando juntas, aba em segundo plano, perda de conexão no meio.

FASE 5 — RELATÓRIO
Grave docs/relatorios/08-operacoes.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com fotos ao lado dos prints da IQ.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 2, 4, 5 e o item "leitor de tela anuncia o resultado" da seção 7.
````

---

## O que você confere (em conta demo, ao lado dos prints da IQ)

- [ ] Embaixo do gráfico só a barra fina "Portafolio total / Mostrar posiciones".
- [ ] O painel abre no mesmo lugar e do mesmo jeito que na IQ.
- [ ] Ganhei: aparece "¡Ganaste!" verde e o saldo sobe certo.
- [ ] Perdi: aparece "No esta vez", sem drama.
- [ ] Nenhum aviso aparece duas vezes.
