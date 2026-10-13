---
name: chave-sala-nova
description: Como criar e usar a chave liga/desliga (feature flag) da sala nova no sistema de flags que o projeto já tem, com desligada como padrão e estilos escopados para não vazar. Use na etapa 02 e em todo passo que adiciona visual novo.
---

# Chave da sala nova

Nome sugerido: `NEW_TRADEROOM`. Se o projeto tiver outro padrão de nome, siga o padrão.

## 1. Descobrir o que já existe

Confira a seção "Flags" de `docs/mapa-do-projeto.md`.
- **Já tem sistema de flags** (LaunchDarkly, Unleash, GrowthBook, PostHog, Flagsmith, um próprio…) → use ele. Crie a flag **desligada** em todos os ambientes.
- **Não tem** → proponha ao dono o mínimo e espere aprovação:
  - uma variável de ambiente pública do framework (`NEXT_PUBLIC_NEW_TRADEROOM`, `VITE_NEW_TRADEROOM`…), com `false` como padrão;
  - um parâmetro de URL `?sala=nova` para testar, que **só funciona fora de produção**. Para liberar em produção para contas internas, o dono decide.

## 2. Regras

- **Desligada é o padrão.** Se a flag não carregar, der erro ou estiver vazia → sala antiga.
- A flag é lida em **um único lugar** (a página da sala, padrão "duas portas" da skill `mudanca-cirurgica`). Componentes internos não leem a flag.
- Não use a flag para mudar lógica de dinheiro. Ela troca **só a apresentação**.
- A decisão não pode piscar: decida antes do primeiro desenho da sala. No servidor, se o framework permitir; senão, mostre o mesmo carregamento de hoje até a flag resolver.

## 3. Estilo escopado

- Todo estilo novo vive dentro do contêiner da sala nova, por exemplo `<div class="theme-binmax">…</div>`.
- Variáveis CSS da marca são declaradas em `.theme-binmax { … }`, **nunca** em `:root` ou no tema global.
- Fontes novas são aplicadas só dentro de `.theme-binmax`.
- Teste: com a flag desligada, nenhuma página (home, login, depósito, perfil) muda nem um pixel.

## 4. Testar os dois estados (em todo passo)

| Estado | Esperado |
|---|---|
| Desligada | Tela idêntica às fotos do "antes" da etapa 02 |
| Ligada | Sala nova conforme o passo aprovado |
| Flag com erro ou vazia | Sala antiga |

## 5. Remoção (só no fim, em etapa própria)

Quando a sala nova estiver 100% liberada e estável, a remoção da sala antiga e da flag é uma **etapa separada**, aprovada pelo dono. Nunca no meio do trabalho.
