---
name: mapear-projeto
description: Roteiro para descobrir, só lendo, como um projeto desconhecido funciona (stack, scripts, estilo, i18n, rotas, sala de operação, dados em tempo real, hora do servidor, testes, flags, analytics) e gravar docs/mapa-do-projeto.md. Use na etapa 01 e sempre que o mapa estiver desatualizado.
---

# Mapear o projeto

Regra de ouro: **evidência ou "não verificado"**. Para cada item, anote o arquivo:linha ou os termos que buscou sem achar.

Use Glob e Grep (ou `git grep -n` / `git ls-files`). **Não** rode instalação nem build nesta skill.

## 1. Identidade

- Manifestos: `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lockb`, `composer.json`, `requirements*.txt`, `pyproject.toml`, `go.mod`.
- Monorepo: `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, pastas `apps/` e `packages/`. **Em qual pacote fica a sala?**
- Framework e versão: `next.config.*`, `vite.config.*`, `nuxt.config.*`, `angular.json`, `svelte.config.*`, `remix.config.*`, `astro.config.*`. Leia a versão no manifesto.
- Linguagem: há `tsconfig.json`? O `strict` está ligado?

## 2. Comandos (copie EXATAMENTE como estão)

Dos `scripts` do manifesto: dev, build, test, test:e2e, lint, typecheck/tsc, format. Se não existir, escreva **não existe**. Nunca invente comando.

## 3. Estilo

Busque: `tailwind.config.*`, `@import "tailwindcss"`, `@tailwind base`, `*.module.css`, `*.scss`, `styled-components`, `@emotion`, `@mui/material`, `createTheme`, `chakra`, `antd`, `vanilla-extract`, `stitches`, `:root {`.
Anote **onde ficam as variáveis de tema** e se o tema é global.

## 4. Textos e idioma

Busque: `next-intl`, `react-i18next`, `i18next`, `vue-i18n`, `@lingui`, `formatjs`, pastas `locales/`, `messages/`, `i18n/`, arquivos `es.json`, `pt.json`, `en.json`. Qual é o idioma padrão?

## 5. Rotas e onde está a sala

Busque nos nomes de arquivo e no conteúdo: `traderoom`, `trade-room`, `trading`, `terminal`, `sala`, `room`, `trade`, `operar`.
Anote a rota (URL) e o componente de página.

## 6. Elementos da sala (A1–F de docs/dashboard-ux.md)

Para cada elemento, ache o componente **ou** registre "não existe". Termos úteis:
- Saldo e contas: `balance`, `saldo`, `account`, `demo`, `real`, `practice`.
- Ticket: `amount`, `invest`, `monto`, `expiration`, `expiry`, `expiración`, `duration`, `profit`, `payout`, `ganancia`, `call`, `put`, `higher`, `lower`, `up`, `down`, `buy`.
- Gráfico (biblioteca): `lightweight-charts`, `tradingview`, `charting_library`, `highcharts`, `echarts`, `apexcharts`, `chart.js`, `klinecharts`, `amcharts`, `d3`, `recharts`, `canvas`.
- Sentimento: `sentiment`, `traders`, `percent`.
- Posições: `positions`, `portfolio`, `deals`, `orders`, `history`.
- Abas de ativos: `tabs`, `asset`, `instrument`, `symbol`, `active`.

## 7. Dados em tempo real e estado

- Conexão: `new WebSocket(`, `socket.io`, `ws://`, `wss://`, `centrifuge`, `pusher`, `signalr`, `EventSource`.
- API: `axios`, `fetch(`, `graphql`, `trpc`, `react-query`, `@tanstack/query`, `swr`.
- Estado: `redux`, `@reduxjs/toolkit`, `zustand`, `mobx`, `jotai`, `recoil`, `pinia`, `vuex`, `createContext`.
- Para cada dado da sala (preço, saldo, payout, sentimento, posições): **quem busca, quem guarda, quem mostra**.
- **Qual função abre uma operação?** Arquivo, nome e payload exato.

## 8. Tempo

Busque: `serverTime`, `server_time`, `timeSync`, `timeOffset`, `timeDiff`, `Date.now(`, `new Date(`, `dayjs`, `moment`, `date-fns`.
O contador de compra e a expiração usam a hora do servidor? Com evidência.

## 9. Testes

Configs: `jest.config.*`, `vitest.config.*`, `playwright.config.*`, `cypress.config.*`, `cypress/`, `e2e/`, `__tests__/`, `*.test.*`, `*.spec.*`.
Quantos testes existem? Algum cobre a sala?

## 10. Flags

Busque: `launchdarkly`, `unleash`, `growthbook`, `flagsmith`, `posthog`, `optimizely`, `statsig`, `featureFlag`, `isEnabled(`, `flags.`, e variáveis `NEXT_PUBLIC_*` / `VITE_*` usadas como chave.

## 11. Analytics

Busque: `gtag(`, `dataLayer`, `fbq(`, `mixpanel`, `amplitude`, `segment`, `analytics.track`, `ttq`, `hotjar`, `clarity`.
Liste os `id` e `data-*` usados por eles na sala. **Esses não podem mudar.**

## Saída: `docs/mapa-do-projeto.md`

```
# Mapa do projeto (atualizado em AAAA-MM-DD, commit <hash>)
## Stack            | item | valor | evidência |
## Comandos         | ação | comando exato | existe? |
## Estilo           ...
## Idioma           ...
## Sala             rota + componente de página
## Elementos A1–F   | id | componente | arquivo | existe? |
## Dados            | dado | origem | dono do estado | evidência |
## Abrir operação   função, arquivo:linha, payload
## Tempo            ...
## Testes           ...
## Flags            ...
## Analytics        ids/eventos que não podem mudar
## Não verificado
```

Depois rode a skill `zonas-sensiveis` para gerar a lista de arquivos protegidos.
