# Etapa 03 — Cores, fontes e tokens da marca

**Objetivo:** cadastrar a base visual da Turbo Prata (cores, fontes, raio, espaçamento) num lugar só, sem ainda mudar a posição de nada.
**Mexe no código?** Sim, só estilo e só com a chave ligada.
**Entrega:** `docs/relatorios/03-tokens.md` + fotos em `docs/relatorios/fotos/03/`

---

## Prompt para copiar

````text
Você é o Engenheiro de Prompt coordenando os agentes de docs/prompts/agentes.md, no código da plataforma Binmax Option.

IMPORTANTE: não presuma nada sobre o código. Use os relatórios em docs/relatorios/ e confirme lendo os arquivos.

Leia primeiro, nesta ordem:
1. docs/prompts/cuidados-gerais.md (regras obrigatórias)
2. docs/prompts/agentes.md
3. docs/identidade-visual.md (seções 3, 4, 5, 6 e 7)
4. docs/relatorios/01-mapa-do-sistema.md
5. docs/relatorios/02-rede-de-seguranca.md

OBJETIVO DESTA ETAPA
Criar os tokens da marca Turbo Prata no sistema de estilo QUE O PROJETO JÁ USA (não troque de sistema) e aplicá-los às cores, fontes e cantos da sala de operação, SEM mudar posição, tamanho de layout ou comportamento. Tudo só vale com a chave NEW_TRADEROOM ligada, dentro de .theme-binmax.

TOKENS (valores exatos do manual):
- Fundo: Noche #0D0F14
- Superfícies: Panel #151922
- Marca e foco: Prata #DCE1EA
- Texto principal: Blanco #F4F5F7
- Texto secundário e ícones: Aço #8A92A1
- Dinheiro / SUBE / Depositar / vela de alta: Verde Ganancia #22C47A
- Perda / BAJA / vela de baixa: Rojo Baja #F2545B
- Linhas: Blanco com 8% de opacidade
- Raio: 6px (campos, chips) e 10px (cards, botões grandes)
- Grade de espaçamento: 4px
- Fontes: Archivo (interface, títulos, logo) e Geist Mono (preços, saldo, contadores, horários)
- Escala de texto: seção 4 do manual

Trabalhe em 5 fases e não pule nenhuma. Pense passo a passo e mostre o raciocínio.

FASE 1 — ENTENDER
- Onde as cores e fontes atuais estão definidas (relatório 01, seção A). Confirme lendo.
- Como as cores atuais chegam aos componentes da sala (variáveis, classes, valores soltos no código?).
- Liste todos os valores de cor soltos (hex/rgb) nos componentes da sala.

FASE 2 — CONSELHO DOS AGENTES
- Marca Binmax: mapeie cada cor atual da sala para o token novo (tabela "cor atual → token novo → onde aparece"), seguindo a tabela "Troca de cores (IQ → Binmax)" da seção 2 de docs/dashboard-ux.md: onde a IQ usa laranja de destaque vira Prata; saldo vira verde; botão de cima vira SUBE verde; botão de baixo vira BAJA vermelho.
- Fidelidade IQ: confirme que a troca de cor não muda tamanho, espaçamento nem posição de nada, e que o significado continua o mesmo da IQ (verde = alta, vermelho = baixa).
- Compliance e Risco: confirme que SUBE e BAJA terão o mesmo destaque.
- Guardião de Regressão: como garantir que os tokens novos não vazam para fora de .theme-binmax (outras páginas, modais, e-mails).
- Mapeador: a forma de carregar Archivo e Geist Mono que menos impacta o carregamento no framework do projeto.
- Engenheiro de Prompt: consolida.

FASE 3 — PLANO (e PARE)
- Onde os tokens vão ficar (um arquivo só).
- Como as fontes serão carregadas (com fallback e sem bloquear a página).
- Tabela de substituição de cores por componente.
- Testes que vai rodar e criar, incluindo um teste que confirma contraste mínimo 4.5:1 para texto (os valores estão na seção 3.3 do manual).
- Arquivos que vai alterar. Nenhum da lista de zonas proibidas.
Escreva "Aguardando aprovação" e NÃO altere nenhum arquivo até eu responder "aprovado".

FASE 4 — EXECUTAR (depois da aprovação)
Um commit por passo, rodando os testes depois de cada um:
1. Criar os tokens (escopados em .theme-binmax).
2. Carregar as fontes.
3. Trocar as cores da sala para os tokens, componente por componente. Não alterar tamanhos nem posições.
4. Fotos com a chave ligada e desligada nos tamanhos da seção 5 do checklist, salvas em docs/relatorios/fotos/03/.
5. Comparar com as fotos do "antes": chave desligada tem que ser idêntica.

FASE 5 — RELATÓRIO
Grave docs/relatorios/03-tokens.md no formato da seção 7 de docs/prompts/cuidados-gerais.md, com a tabela de substituição de cores.

TESTES OBRIGATÓRIOS: checklist-de-testes.md seções 1 e 5.
````

---

## O que você confere

- [ ] Chave desligada: idêntico ao "antes".
- [ ] Chave ligada: fundo quase preto, tudo cinza/prata, verde só em saldo, ganho, SUBE e Depositar.
- [ ] Outras páginas (login, depósito, perfil) **não mudaram**.
- [ ] Números (preço, saldo) em fonte mono, sem "pular" quando mudam.

## Se der errado

- Cor vazou para outra página: o token não ficou escopado; peça para corrigir só o escopo.
- Fonte demora para aparecer: peça fallback com tamanho parecido para evitar o texto "pular".
