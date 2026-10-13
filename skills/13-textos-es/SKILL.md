---
name: textos-es
description: Coloca os textos da sala em espanhol usando o sistema de tradução que o projeto já tem, sem traduzir chaves de lógica e sem deixar o texto alargar botões ou abas. Use na etapa 09 e em todo passo que cria ou muda texto visível.
---

# Textos em espanhol

As fontes são a seção 3 de `docs/dashboard-ux.md` (troca IQ pt → Binmax es), os nomes do menu lateral (seção B) e o vocabulário de `docs/identidade-visual.md`.

## 1. Descobrir o sistema

Confira a seção "Idioma" de `docs/mapa-do-projeto.md`.
- **Tem i18n** (next-intl, i18next, vue-i18n, lingui…) → adicione as chaves no arquivo `es` **no mesmo padrão de nome** das chaves existentes. Se a chave já existir, altere **só o valor em `es`**. Não mexa nos outros idiomas.
- **Não tem i18n** → não introduza biblioteca. Proponha ao dono um único arquivo de textos só da sala nova (ex.: `textos-sala.es.ts`) e espere aprovação.

## 2. Não traduzir

- Valores usados em lógica ou API: `call`, `put`, `higher`, `lower`, nomes de status, enums.
- Nomes de eventos de analytics, `id`, `data-testid`.
- Símbolos de ativos (`EUR/USD`, `NZD/JPY (OTC)`).
- Formato de número e moeda: use a função de formatação que o sistema já usa. Não troque o locale do número só porque o texto virou espanhol.

## 3. Caber no espaço da IQ

- Cada texto ocupa o mesmo lugar e o mesmo espaço do equivalente da IQ.
- Texto mais longo **não** pode alargar o botão, a aba, a coluna do ticket (cerca de 115px) nem o item do menu lateral (cerca de 68px).
- Se não couber, faça nesta ordem: use a forma curta do vocabulário, quebre em 2 linhas como a IQ faz no menu, ou leve ao dono. **Nunca** reduza a fonte abaixo de 11px (D10).

## 4. Conferência

- Tabela no relatório: `| Texto anterior | Texto novo | Chave | Arquivo |`.
- Busca por restos em português ou inglês nos arquivos da sala nova: `Acima`, `Abaixo`, `Lucro`, `Expiração`, `Invest`, `Depositar`, `Higher`, `Lower`, `Profit`, `Expiry`.
- Termos proibidos do manual: zero ocorrências.
