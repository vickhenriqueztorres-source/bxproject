# Etapa 04 — Logo e arquivos de marca

**Objetivo:** colocar o logo Binmax Option, favicon, ícone do app e título nas páginas.
**Mexe no código?** Sim, pouco.
**Entrega:** `docs/relatorios/04-logo.md`

**Arquivos prontos neste pacote:** `public/brand/binmax-mark.svg`, `public/brand/binmax-app-icon.svg`, `public/icon.svg`. Copie junto com a pasta `docs/` ou entregue à IA.

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md
2. docs/prompts/agentes.md
3. docs/identidade-visual.md (seção 2 e seção 9)
4. Todos os relatórios em docs/relatorios/

Arquivos de marca que eu forneço:
- binmax-mark.svg (símbolo: duas setas, a de cima #DCE1EA e a de baixo #8A92A1)
- binmax-app-icon.svg (símbolo sobre fundo #0D0F14 com cantos de 22%)
- icon.svg (favicon: só a seta superior)

OBJETIVO DESTA ETAPA
1. Criar um componente de logo reutilizável com 4 versões: horizontal (símbolo + BINMAX + OPTION), horizontal curta (símbolo + BINMAX), vertical e só símbolo. Texto em Archivo, conforme a seção 2.2 do manual.
2. Usar a versão horizontal curta na barra superior da sala (só com a chave ligada).
3. Favicon, ícone do app (apple-touch-icon / manifest) e título da página.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Onde está o logo atual, como é carregado e em quais páginas aparece.
- Onde ficam favicon, manifest e título.
- O logo atual é usado em e-mails, PDFs ou outras partes fora da sala?

FASE 2 — CONSELHO DOS AGENTES
- Marca Binmax: área de proteção e tamanho mínimo (seção 2.4) para a barra superior e celular.
- Fidelidade IQ: o logo fica no canto superior esquerdo, no MESMO tamanho do logo da IQ (~150px de largura na barra de ~76px, ver docs/referencias/iq-traderoom-desktop.png).
- Guardião de Regressão: o que acontece com o logo antigo nas páginas que não fazem parte da sala; trocar favicon e título vale para todo o site — isso precisa de aprovação separada?
- Compliance e Risco: o nome legal da empresa continua onde é exigido (rodapé, termos).
- Mapeador: forma de exibir SVG mais leve no framework do projeto.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Liste arquivos, decisões e testes. Deixe claro o que muda só com a chave ligada (logo da sala) e o que muda para todos (favicon, título). Peça minha decisão sobre favicon/título globais.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por passo, testes depois de cada um:
1. Copiar os arquivos de marca para a pasta de arquivos públicos do projeto.
2. Criar o componente de logo com texto alternativo "Binmax Option".
3. Aplicar na barra superior da sala (chave ligada).
4. Favicon, ícone e título (se aprovado).
5. Fotos da barra superior em 1366, 1920 e 390 de largura.

FASE 5 — RELATÓRIO
Grave docs/relatorios/04-logo.md no formato da seção 7 de docs/prompts/cuidados-gerais.md.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seção 1, e conferir o favicon numa aba do navegador e o ícone ao "adicionar à tela inicial" no celular.
````

---

## O que você confere

- [ ] O logo aparece nítido em tela comum e em tela retina.
- [ ] As setas têm pontas retas (não arredondadas) e apontam para cima.
- [ ] No celular, aparece a versão curta ou só o símbolo, sem espremer.
- [ ] Favicon aparece na aba.
