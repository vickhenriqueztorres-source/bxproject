# Etapa 02 — Rede de segurança

**Objetivo:** antes de mudar o visual, criar o que garante que nada vai quebrar: branch, testes de base, fotos do "antes" e a chave liga/desliga.
**Mexe no código?** Só para adicionar testes e a chave. Nenhuma mudança visual.
**Entrega:** `docs/relatorios/02-rede-de-seguranca.md` + fotos em `docs/relatorios/fotos/antes/`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use o que foi descoberto em docs/relatorios/01-mapa-do-sistema.md e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md (regras obrigatórias)
2. docs/prompts/agentes.md
3. docs/prompts/checklist-de-testes.md
4. docs/relatorios/01-mapa-do-sistema.md

OBJETIVO DESTA ETAPA
Criar a rede de segurança. NENHUMA mudança visual nesta etapa.

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Confirme os comandos de build, typecheck, lint e testes.
- Confirme se já existe ferramenta de teste ponta a ponta (Playwright, Cypress). Se não existir, anote.
- Confirme se já existe sistema de feature flags.

FASE 2 — CONSELHO DOS AGENTES
- Guardião de Regressão: quais fluxos críticos precisam de teste de fumaça antes de qualquer mudança visual (no mínimo: abrir SUBE, abrir BAJA, trocar ativo, trocar conta demo/real, ver portfólio, botão Depositar leva à tela certa).
- Mapeador: onde e como colocar a chave liga/desliga com o mínimo de código, usando o que o projeto já tem.
- Compliance e Risco: garantir que testes rodem só em conta demo / ambiente de teste, nunca com dinheiro real.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
Escreva o plano com:
1. Nome da branch (ex.: feat/binmax-turbo-prata).
2. Como a chave liga/desliga vai funcionar:
   - Nome: NEW_TRADEROOM (ou o padrão do projeto).
   - Desligada por padrão em produção.
   - Como ligar para testar (ex.: variável de ambiente e/ou parâmetro ?ui=binmax na URL em ambiente de teste).
   - Onde ela é lida (um único ponto) e como os componentes consultam.
   - Os estilos novos vão ficar escopados dentro de um contêiner com classe (ex.: .theme-binmax) só quando a chave estiver ligada.
3. Testes de fumaça que vai criar (lista, com o que cada um verifica). Se precisar instalar ferramenta de teste, diga qual, por quê, e peça aprovação.
4. Lista de fotos do "antes": a sala de operação em cada tamanho de docs/prompts/checklist-de-testes.md seção 5, mais o ticket de perto, o menu de conta aberto e o seletor de ativos aberto.
5. Arquivos que vai criar/alterar. Nenhum pode estar na lista de zonas proibidas do relatório 01.

Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Passo a passo, um commit por passo:
1. Criar a branch.
2. Rodar build, typecheck, lint e testes e anotar o resultado de BASE (falhas que já existiam continuam anotadas, não corrija agora).
3. Criar os testes de fumaça e garantir que passam no código ATUAL.
4. Tirar as fotos do "antes" e salvar em docs/relatorios/fotos/antes/ com nomes claros (ex.: sala-1366x768.png).
5. Criar a chave liga/desliga. Com ela ligada, por enquanto nada muda visualmente (ainda não há visual novo) — apenas confirme que a classe .theme-binmax aparece no contêiner da sala.
6. Rodar tudo de novo e confirmar que nada mudou com a chave desligada.

FASE 5 — RELATÓRIO
Grave docs/relatorios/02-rede-de-seguranca.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, incluindo:
- Resultado de base de cada comando.
- Lista dos testes de fumaça e como rodar.
- Como ligar e desligar a chave.
- Lista das fotos do "antes".
````

---

## O que você confere

- [ ] Está numa branch nova.
- [ ] Os testes de fumaça passam no código atual.
- [ ] As fotos do "antes" existem e mostram a sala como ela é hoje.
- [ ] Você sabe ligar e desligar a chave.
- [ ] Com a chave desligada, nada mudou.

## Se der errado

- Testes não rodam por falta de ferramenta: aprove a instalação de **uma** ferramenta (Playwright é o padrão mais simples) ou peça só testes manuais documentados.
- A IA quer refatorar algo "para facilitar o teste": recuse. Teste o que existe como está.
