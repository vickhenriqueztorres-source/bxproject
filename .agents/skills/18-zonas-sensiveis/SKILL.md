---
name: zonas-sensiveis
description: Encontra e classifica (VERMELHO, AMARELO, VERDE) os arquivos que mexem com dinheiro, tempo, conexão, login, pagamento e analytics, e gera docs/zonas-sensiveis.md e docs/zonas-sensiveis.txt para o guardiao bloquear diffs perigosos. Use depois de mapear o projeto e sempre que um passo encostar em lógica.
---

# Zonas sensíveis

## Classificação

| Cor | Significado | Exemplos |
|---|---|---|
| **VERMELHO** | **Não tocar.** Só com aprovação escrita do dono, e nunca junto com mudança visual | Abrir ou liquidar operação, payout, saldo, websocket/API, login/sessão/KYC, depósito/saque/bônus, banco/migrações, `.env*`, CI/deploy, rotas públicas, analytics |
| **AMARELO** | Pode **ler e usar**, não pode alterar a lógica. Mudança só na apresentação | Hooks e stores que entregam dados para a sala, formatação de moeda, sincronização de hora, componente que chama a função de abrir operação |
| **VERDE** | Visual puro | Componentes de apresentação, estilos, ícones, textos |

## Como encontrar (busque em todo o projeto, exceto `node_modules`, `dist` e `build`)

- Operação: `openPosition`, `openOption`, `buy`, `placeTrade`, `createDeal`, `binary-options.open`, `call`/`put` em payload.
- Dinheiro: `payout`, `profit`, `balance`, `amount`, `commission`, `bonus`, `deposit`, `withdraw`, `cashier`, `payment`.
- Conexão: `WebSocket`, `socket`, `subscribe`, `send(`, `emit(`, `reconnect`, `heartbeat`, `ping`.
- Tempo: `serverTime`, `timeSync`, `timeOffset`, `expiration` (no cálculo, não no texto).
- Acesso: `auth`, `login`, `session`, `token`, `jwt`, `kyc`, `verify`.
- Infra: `.env`, `.github/workflows`, `vercel.json`, `netlify.toml`, `Dockerfile`, `migrations/`, `prisma/`, `drizzle/`.
- Analytics: `gtag`, `dataLayer`, `fbq`, `track(`, `pixel`.

Para cada arquivo encontrado, abra e confirme. **Nome parecido não é prova.**

## Sinais de perigo DENTRO de um arquivo VERDE

Mesmo num componente visual, estas mudanças viram VERMELHO:
- Alterar o `onClick` ou `onSubmit` de SUBE, BAJA ou Depositar (a função chamada ou os argumentos).
- Alterar o parse do valor digitado (`parseFloat`, `Number(`, troca de vírgula por ponto, mínimo e máximo).
- Remover ou alterar `debounce`, `throttle`, `disabled`, `isLoading` ou a trava de clique duplo.
- Alterar `id`, `data-testid` ou `data-*` usado por analytics ou testes.
- Calcular no componente um valor que hoje vem do servidor.

## Saída

1. `docs/zonas-sensiveis.md`: tabela `| Arquivo | Cor | Motivo | Evidência |`.
2. `docs/zonas-sensiveis.txt`: **só os caminhos VERMELHOS**, um por linha, para checagem automática:

```
git diff --name-only | grep -F -f docs/zonas-sensiveis.txt
```

Esse comando tem que voltar **vazio** em todo passo visual.

3. Liste à parte as funções AMARELAS que a sala nova vai **reutilizar sem alterar** (ex.: `useBalance`, `openTrade`, `formatMoney`).
