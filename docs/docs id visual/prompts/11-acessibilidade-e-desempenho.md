# Etapa 11 — Acessibilidade e desempenho

**Objetivo:** rápido como a referência (ou mais) e usável por todos — inclusive só com teclado.
**Mexe no código?** Sim — ajustes pontuais.
**Entrega:** `docs/relatorios/11-acessibilidade-desempenho.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/prompts/checklist-de-testes.md (seções 7 e 8)
4. docs/identidade-visual.md (seções 3.3 e 7)
5. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA (só com a chave ligada)

ACESSIBILIDADE
1. Rodar ferramenta automática (axe, Lighthouse ou a que o projeto usar) na sala e listar problemas.
2. Contraste: conferir todos os pares de cor contra a seção 3.3 do manual (mínimo 4.5:1 para texto, 3:1 para ícones e bordas de campo).
3. Teclado: ordem do Tab lógica (barra superior → menu → gráfico → ticket → portfólio → rodapé); foco sempre visível com contorno Prata; Esc fecha menus e listas.
4. Leitor de tela: botões com nome claro ("Abrir operación SUBE de $25 en EUR/USD"), preço atual anunciado só sob demanda (não a cada tick), resultado da operação anunciado.
5. Movimento: com prefers-reduced-motion, sem deslizamentos.
6. Cor não é o único sinal: SUBE/BAJA e ganho/perda também têm seta e sinal (+/−).

DESEMPENHO
1. Medir antes de mudar (use as medições da etapa 06 como base): tempo de carregamento da sala, quadros por segundo do gráfico, memória após 30 min, quantos componentes re-renderizam a cada tick.
2. Só otimizar o que a medição mostrar como problema. Nada de otimização "por precaução".
3. O tick de preço deve atualizar só o preço, o gráfico e o ticket — não a página inteira.
4. Fontes e ícones não podem bloquear o primeiro desenho da tela.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
Rode as medições e a ferramenta de acessibilidade. Liste tudo com prioridade (grave, médio, leve).

FASE 2 — CONSELHO DOS AGENTES
- Marca Binmax: problemas visuais de acessibilidade (contraste, foco). Correções só por cor, contorno de foco ou área de clique invisível — sem mudar o layout da IQ (diferença D10).
- Fidelidade IQ: nenhuma correção de acessibilidade pode mudar posição, tamanho visível ou elemento da sala. A ordem de foco segue a leitura da tela da IQ.
- Compliance e Risco: o leitor de tela informa claramente valor, direção e conta (demo/real) antes de abrir operação.
- Guardião de Regressão: cada otimização tem medição antes/depois; nenhuma otimização muda comportamento.
- Mapeador: causa real de cada problema de desempenho (arquivo e motivo).
- Engenheiro de Prompt: consolida e prioriza.

FASE 3 — PLANO (e PARE)
Só itens graves e médios. Para cada um: causa, correção, risco, como medir.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por correção, medindo depois de cada uma. Se a medição não melhorou, desfaça.

FASE 5 — RELATÓRIO
Grave docs/relatorios/11-acessibilidade-desempenho.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com tabela "métrica → antes → depois".

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1, 7 e 8.
````

---

## O que você confere

- [ ] Consigo abrir uma operação só com o teclado.
- [ ] O contorno de foco aparece sempre.
- [ ] A sala não ficou mais lenta do que estava no "antes".
- [ ] Depois de 30 min aberta, a aba não trava.
