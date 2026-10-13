# Etapa 01 — Mapear o sistema (só leitura)

**Objetivo:** descobrir como o código está hoje, antes de qualquer mudança.
**Mexe no código?** Não. Nenhum arquivo pode ser alterado nesta etapa.
**Entrega:** `docs/relatorios/01-mapa-do-sistema.md`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes definidos em docs/prompts/agentes.md. Vamos trabalhar no código da plataforma de opções binárias Binmax Option.

IMPORTANTE: você ainda não conhece este código. Não presuma framework, pastas, bibliotecas ou nomes de arquivos. Descubra lendo. Quando não tiver certeza de algo, escreva "não verificado". Nunca escreva "provavelmente".

ESTA ETAPA É SOMENTE LEITURA. Você não pode criar, editar, mover ou apagar nenhum arquivo do projeto, nem instalar nada. A única exceção é o relatório final em docs/relatorios/01-mapa-do-sistema.md.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/identidade-visual.md
4. docs/dashboard-ux.md

Depois, pense passo a passo e investigue o código respondendo:

A. BASE DO PROJETO
- Linguagem, framework e versão (leia o arquivo de dependências).
- Gerenciador de pacotes e comandos disponíveis (dev, build, test, lint, typecheck).
- É um repositório único ou monorepo? Quais pacotes/apps existem?
- Como o estilo é feito: CSS puro, Tailwind, CSS Modules, SCSS, styled-components, outro? Existe tema ou variáveis de cor? Onde?
- Quais fontes são usadas e como são carregadas?
- Existe sistema de tradução (i18n)? Quais idiomas? Onde ficam os textos?
- Existe sistema de feature flags? Qual?

B. SALA DE OPERAÇÃO
Para cada zona do mapa em docs/dashboard-ux.md (A barra superior, B menu lateral, C ticket, gráfico, sentimento, D portfólio, E rodapé), informe:
- Arquivo(s) e componente(s) responsáveis (caminho real).
- Quem usa esse componente (outras páginas também usam?).
- Onde ele está hoje na tela, comparado com o mapa alvo.

C. DADOS E ESTADO
- De onde vêm os preços em tempo real (websocket, polling, biblioteca)? Arquivo e função.
- Onde ficam saldo, conta demo/real, payout, lista de ativos.
- Como uma operação é aberta: qual função, qual endpoint, quais validações existem no navegador.
- Como a operação é liquidada e como o resultado chega na tela.
- Onde fica a hora do servidor (se existir).
- Quem é dono do estado (store global, contexto, componente).

D. GRÁFICO
- Qual biblioteca de gráfico (TradingView, Lightweight Charts, ChartIQ, própria, outra) e versão.
- Onde está a configuração de cores, linhas e marca d'água.

E. TESTES E QUALIDADE
- Existem testes? De que tipo (unidade, componente, ponta a ponta)? Como rodar?
- Rode build, typecheck, lint e testes (só rodar, sem corrigir) e anote o resultado de cada um. Se algo já falha hoje, anote como "falha que já existia".
- Existe CI? O que ele roda?

F. ZONAS PROIBIDAS
Liste os arquivos e pastas que tocam em: regras de payout/liquidação, API/websocket, autenticação, depósito/saque, analytics/rastreamento, rotas públicas. Esta lista será usada em todas as próximas etapas como "não mexer".

G. CONSELHO DOS AGENTES
Cada agente escreve sua leitura do que encontrou:
- Mapeador: resumo técnico e partes que não conseguiu verificar.
- Fidelidade IQ: compare a sala atual com docs/referencias/iq-traderoom-desktop.png, elemento por elemento (A1–F de docs/dashboard-ux.md): o que já está igual à IQ, o que está fora do lugar e o que não existe.
- Marca Binmax: quais cores, logos e textos atuais terão que ser trocados (seções 2 e 3 de docs/dashboard-ux.md).
- Compliance e Risco: riscos que já existem (ex.: SUBE/BAJA com destaques diferentes, aviso de risco ausente).
- Guardião de Regressão: o que hoje NÃO tem teste e é perigoso mexer.
- Engenheiro de Prompt: riscos principais e ajustes recomendados para as etapas 02 a 12.

H. PERGUNTAS
Liste tudo o que você precisa que eu responda antes da etapa 02.

Grave tudo em docs/relatorios/01-mapa-do-sistema.md com estas seções: A até H, mais uma tabela final "Zona → arquivo → situação hoje → mudança alvo → risco (baixo/médio/alto)".

Ao terminar, confirme com git status que nenhum arquivo além do relatório foi alterado.
````

---

## O que você confere

- [ ] `git status` mostra **apenas** o relatório novo.
- [ ] O relatório tem caminhos de arquivo reais, não genéricos.
- [ ] A lista de **zonas proibidas** está preenchida.
- [ ] O resultado de build, typecheck, lint e testes de hoje está anotado.
- [ ] Você respondeu as perguntas da seção H (pode responder no fim do próprio relatório).

## Se der errado

- A IA alterou arquivos: `git checkout .` e rode de novo, reforçando "SOMENTE LEITURA".
- A IA "chutou" coisas: peça para marcar como "não verificado" tudo o que não leu.
