# Etapa 09 — Textos em espanhol

**Objetivo:** 100% espanhol neutro latino-americano, com o vocabulário oficial, sem mistura de idiomas.
**Mexe no código?** Sim — só textos.
**Entrega:** `docs/relatorios/09-textos.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ (seção A do relatório 01 diz se existe sistema de tradução) e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/identidade-visual.md (seção 8 — Voz e tom, vocabulário oficial, microcopy e proibições)
4. Todos os relatórios em docs/relatorios/

OBJETIVO DESTA ETAPA
Todos os textos da sala de operação (com a chave ligada) em espanhol neutro, tratamento por "tú", seguindo o vocabulário oficial:
- SUBE / BAJA (nunca Arriba/Abajo, Call/Put, Buy/Sell)
- Monto (nunca Inversión/Invest)
- Expiración (como a IQ; nunca Expiry)
- Use a tabela "Troca de textos (IQ pt → Binmax es)" da seção 3 de docs/dashboard-ux.md e os nomes do menu lateral da seção B. A posição e o tamanho de cada texto ficam iguais aos da IQ.
- Ganancia (nunca Lucro/Profit)
- Depositar / Retirar
- Cuenta demo / Cuenta real

REGRAS
- Se o projeto tem sistema de tradução, use-o: crie/edite as chaves do espanhol. Não mude os nomes das chaves que já existem (outras partes podem usar).
- Se não tem, NÃO crie um sistema de tradução agora sem aprovação. Proponha a opção mais simples (um arquivo de textos da sala) e pergunte.
- Não traduza: nomes de ativos (EUR/USD), códigos técnicos, nomes de eventos de analytics, IDs.
- Formatos: moeda com $ e separadores conforme o país do usuário, se o projeto já tiver isso; senão, $1,234.56. Datas e horas no padrão do país; hora em 24h.
- Nenhum texto promete ganho. Aviso de risco no rodapé:
  "Operar opciones binarias implica un alto riesgo de pérdida. Opera solo con dinero que puedas permitirte perder."

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
Liste TODOS os textos visíveis na sala (botões, rótulos, menus, avisos, erros, estados vazios, dicas, títulos de aba do navegador), com arquivo e o texto atual.

FASE 2 — CONSELHO DOS AGENTES
- Marca Binmax: tabela "texto atual → texto novo", seguindo a seção 3 de docs/dashboard-ux.md e a seção 8 do manual.
- Fidelidade IQ: cada texto ocupa o mesmo lugar e cabe no mesmo espaço do texto equivalente da IQ. Texto em espanhol mais longo não pode alargar botão, aba ou coluna.
- Compliance e Risco: revisar cada texto contra a lista de proibidos.
- Guardião de Regressão: testes que procuram textos (ex.: testes que clicam em "Buy") vão quebrar? Liste e proponha ajuste.
- Mapeador: onde ficam os textos e como trocar com menor risco.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Tabela completa de textos + arquivos + testes afetados.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por zona (barra superior, menu, gráfico, ticket, portfólio, avisos, rodapé). Atualizar testes que dependem de texto.
No fim, procure no código da sala palavras em inglês/português que sobraram (Buy, Sell, Invest, Profit, Lucro, Acima, Abaixo, Expiração) e liste.

FASE 5 — RELATÓRIO
Grave docs/relatorios/09-textos.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com a tabela final de textos.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1 e 5 (conferir textos longos que podem quebrar a linha ou cortar).
````

---

## O que você confere

- [ ] Nenhuma palavra em inglês ou português na sala (exceto nomes de ativos).
- [ ] Textos longos não cortam nem quebram botões.
- [ ] Aviso de risco visível no rodapé.
- [ ] Peça para um nativo (mexicano, colombiano ou argentino) ler a tela por 1 minuto.
