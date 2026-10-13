# Binmax Option — Prompts passo a passo

Esta pasta tem os prompts para uma IA de código (Claude Code, Cursor, Codex, v0 etc.) aplicar a identidade **Turbo Prata** e o novo layout da sala de operação **no código que já existe**, sem quebrar nada.

Os prompts partem do princípio de que **ninguém sabe ainda como o código está hoje**. Por isso a primeira etapa só lê o código e escreve um mapa; todas as etapas seguintes usam esse mapa.

---

## Antes de começar

1. Copie a pasta `docs/` inteira para a raiz do repositório da plataforma.
2. Confirme que o repositório tem Git e que está tudo commitado (`git status` limpo).
3. Tenha um ambiente de teste/staging. **Nunca rode estas etapas direto em produção.**
4. Junte prints da IQ Option e salve em `docs/referencias/` com nomes começando por `iq-`: painel de posições aberto, menu de contas aberto, lista de ativos aberta, aviso de resultado, e a sala no celular (`iq-mobile-*.png`). A IA vai pedir esses prints nas etapas 08 e 10.

---

## Como usar cada prompt

1. Abra o arquivo da etapa e copie o bloco **"Prompt para copiar"** inteiro.
2. Cole numa conversa nova com a IA (uma conversa por etapa evita que ela "lembre errado").
3. A IA vai **ler, chamar os agentes, montar um plano e parar**. Leia o plano.
4. Responda **"aprovado"** ou peça ajustes. Só então ela altera arquivos.
5. No fim, ela grava um relatório em `docs/relatorios/`. A etapa seguinte lê esse relatório.
6. Só avance quando todos os itens de **"Critério de pronto"** estiverem marcados.

> Se a IA pular o plano e sair alterando arquivos, interrompa, rode `git checkout .` e cole o prompt de novo.

---

## Ordem das etapas

| # | Arquivo | O que faz | Mexe no código? |
|---|---|---|---|
| 01 | `01-mapear-sistema.md` | Lê o código e escreve o mapa do sistema | **Não** |
| 02 | `02-rede-de-seguranca.md` | Branch, testes de base, fotos do "antes", chave liga/desliga | Só testes e a chave |
| 03 | `03-cores-fontes-tokens.md` | Cores, fontes, espaçamentos da marca | Sim, isolado |
| 04 | `04-logo-e-arquivos-de-marca.md` | Logo, favicon, ícone do app, título | Sim |
| 05 | `05-estrutura-da-sala.md` | Posição de cada zona (barra, menu, gráfico, ticket, rodapé) | Sim |
| 06 | `06-grafico.md` | Gráfico limpo, linha de preço, linhas de tempo | Sim |
| 07 | `07-ticket-sube-baja.md` | Monto, Expiración, Ganancia, SUBE/BAJA | Sim (**zona sensível**) |
| 08 | `08-operacoes-e-resultados.md` | Portfólio, histórico, avisos de ganho/perda | Sim |
| 09 | `09-textos-em-espanhol.md` | Todo o texto em espanhol com o vocabulário oficial | Sim |
| 10 | `10-celular-e-tablet.md` | Versão para celular e tablet | Sim |
| 11 | `11-acessibilidade-e-desempenho.md` | Leitura, teclado, contraste, velocidade | Sim |
| 12 | `12-revisao-final-e-lancamento.md` | Teste completo, lançamento gradual, plano de volta | Só ajustes |
| 13 | `13-proximas-telas-do-dashboard.md` | Modelo para Home, Depósito, Rendimiento, Torneos | Depois da 12 |

---

## Arquivos de apoio (a IA lê em toda etapa)

| Arquivo | Para quê |
|---|---|
| `../identidade-visual.md` | Manual da marca Turbo Prata (cores, fontes, logo, voz) |
| `../dashboard-ux.md` | Especificação da sala: cópia da IQ elemento por elemento (A1–F), troca de cores e textos, diferenças permitidas e o que não fazer |
| `../referencias/iq-traderoom-desktop.png` | **Molde do layout** (sala da IQ Option) |
| `../referencias/binmax-mockup-marca.png` | Só referência de **marca** (logo, cores, SUBE/BAJA). **Não copiar o layout dele** |
| `agentes.md` | Quem são os agentes, o que cada um checa e quando pode vetar |
| `cuidados-gerais.md` | Regras para não quebrar o sistema |
| `checklist-de-testes.md` | Lista completa de testes |

---

## Regra de ouro

> **A sala da IQ Option com a marca Binmax — e nada quebra no caminho.**
>
> Layout, tamanhos, elementos e comportamento: **iguais à IQ** (`docs/referencias/iq-traderoom-desktop.png`). Só mudam logo, cores, textos em espanhol e a lista fechada de diferenças D1–D10 de `docs/dashboard-ux.md`. Ninguém "melhora" o layout.
>
> Tudo novo fica atrás de uma chave liga/desliga (criada na etapa 02). Com a chave desligada, a plataforma tem que funcionar **exatamente** como hoje.
