# Etapa 10 — Celular e tablet (igual à IQ no celular)

**Objetivo:** a sala no celular igual à da IQ no celular, para o lead operar com o polegar sem procurar nada.
**Mexe no código?** Sim — layout responsivo.
**Entrega:** `docs/relatorios/10-celular.md`

> Na América Latina, a maioria dos leads opera pelo celular Android. Esta etapa vale tanto quanto a de desktop.

> **Antes de começar:** salve em `docs/referencias/` prints da IQ no celular, de preferência no navegador do celular (`iq-mobile-sala.png`, `iq-mobile-ativos.png`, `iq-mobile-portfolio.png`) e, se possível, também em tablet. **Esses prints são o molde.** Sem eles, a IA vai parar e pedir.

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos. Descubra se existe app/rota separada para celular ou se é a mesma tela responsiva.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/dashboard-ux.md (seções 2, 3, 4, 5 e 7)
4. Abra TODOS os prints docs/referencias/iq-mobile-*.png. ESTES SÃO OS MOLDES.
   Se não houver nenhum print de celular da IQ, PARE e peça ao dono antes de planejar.
5. docs/identidade-visual.md
6. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA (só com a chave ligada)

CELULAR (até 767px de largura)
- Copie o layout dos prints da IQ no celular: posição do ativo, do saldo, do Depositar, do gráfico, de Monto, de Expiración, de SUBE e BAJA, e do menu.
- Troque só cores, logo e textos (seções 2 e 3 de docs/dashboard-ux.md) e aplique as diferenças D1–D10 que fizerem sentido no celular (saldo verde com DEMO/REAL, SUBE verde / BAJA vermelho do mesmo tamanho, aviso de risco acessível).
- Respeite a área segura do iPhone (notch e barra inferior).

TABLET (768–1199px)
- Se houver print da IQ em tablet, copie. Se não houver, use o layout de desktop, mantendo as mesmas zonas.

REGRAS
- Mesmos componentes, só layout diferente (sem duplicar lógica).
- Nenhum alvo de toque abaixo de 44px; nenhum texto abaixo de 11px.
- Teclado numérico aparece ao tocar no Monto.
- Tocar no gráfico não pode abrir operação por acidente.
- Se não souber como a IQ faz algo no celular, PARE e peça print.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
Como a sala se comporta hoje em 360×800 e 390×844 (tire fotos). O que quebra, some ou fica pequeno.

FASE 2 — CONSELHO DOS AGENTES
- Fidelidade IQ: descreva cada print de celular da IQ, elemento por elemento, e compare com a Binmax. IGUAL / D# / FORA DA IQ.
- Marca Binmax: só cores, logo e textos.
- Compliance e Risco: aviso de risco acessível; DEMO/REAL visível.
- Guardião de Regressão: girar a tela, teclado abrindo e fechando, voltar do segundo plano.
- Mapeador: como fazer com os pontos de quebra (breakpoints) que o projeto já usa.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Desenho em texto do celular (390×844) e tablet (768×1024), mostrando que bate com os prints da IQ, mais arquivos, riscos e testes.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por zona. Fotos em 360×800, 390×844, 768×1024 e 1024×768 depois de cada uma, sempre ao lado do print da IQ.

FASE 5 — RELATÓRIO
Grave docs/relatorios/10-celular.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com as fotos lado a lado com os prints da IQ.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 2 (no celular), 5 e 6 (Chrome Android e Safari iPhone).
````

---

## O que você confere (num celular de verdade, com a IQ aberta no outro)

- [ ] Abro as duas lado a lado: cada coisa está no mesmo lugar.
- [ ] Opero só com o polegar, segurando com uma mão.
- [ ] Ao digitar o monto, aparece o teclado numérico.
- [ ] Saldo e DEMO/REAL sempre visíveis.
- [ ] Girar a tela não quebra nada.
