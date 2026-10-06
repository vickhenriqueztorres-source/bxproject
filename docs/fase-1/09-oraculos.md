# Testes-oráculo (P-03)

Especificação humana do que **tem** de ser verdade. A IA escreve o código do teste; não pode mudar o que
ele exige. O gate reprova a subtask se nenhum teste com `[OR-xx]` no título existir e passar.

Valores em centavos de USD (D-18). Símbolo `SYNTH_VOL_50`.

## Mercado (T05, T07, T08)

| ID | Subtask | Dado | Quando | Então | Prova |
|---|---|---|---|---|---|
| OR-01 | T05 | Duas instâncias do Tick Engine para `SYNTH_VOL_50` | Rodam juntas por 30 s | Só uma grava ticks; `sequence` contínua, sem buraco e sem repetição | DoD 1 |
| OR-02 | T05 | Commit da transação do tick forçado a falhar | O engine tenta gravar | Nada no outbox, nada no Stream, nada no Pub/Sub | DoD 2 |
| OR-03 | T05 | Tick `n` já gravado | Insert direto de outro tick com o mesmo `(symbol, sequence)` usando a role do engine | Postgres recusa | DoD 3 |
| OR-04 | T07 | 10 min de ticks gravados | Apagar candles e reprocessar | Candles idênticos campo a campo; reprocessar 2× não duplica | DoD 4 |
| OR-05 | T08 | Cliente conectado recebeu até `sequence = N` | Conexão cai, k ticks são gerados, cliente reconecta com `lastSequence = N` | Recebe `N+1 … N+k` em ordem, sem buraco e sem duplicata, e depois o fluxo ao vivo | DoD 5 |

## Contrato (T09)

| ID | Dado | Quando | Então | Prova |
|---|---|---|---|---|
| OR-06 | USER com saldo | 20 `POST /contracts` paralelos com a mesma `Idempotency-Key` e o mesmo corpo | 1 contrato, 1 reserva no Blnk, 20 respostas iguais | DoD 6 |
| OR-07 | Contrato criado com a chave K | `POST` com K e corpo diferente | `422`; nenhum contrato novo | US-05 |
| OR-08 | Contrato do usuário A | Usuário B faz `GET /contracts/{id}` | `404` (não revela existência) | BOLA |
| OR-09 | USER com saldo | `stake_minor` = 99, 10001, `"100"` (string), `100.5`, ou corpo com `user_id`/`payout`/`entry_price` | `400`; nenhum contrato; preço de entrada vem do último tick do servidor | US-05 |
| OR-10 | Contrato aberto em `SYNTH_VOL_50` | ADMIN pausa o índice | Novos `POST /contracts` recusados (`409`); ticks continuam; o contrato aberto liquida normalmente; ao retomar, aceita de novo | US-10 |

## Settlement (T10)

| ID | Dado | Quando | Então | Prova |
|---|---|---|---|---|
| OR-11 | Stakes 1000 e 101; regra D-19 | WIN, LOSS e DRAW forçados por ticks controlados | WIN 1000 → crédito 1850; WIN 101 → crédito 186 (lucro 85); LOSS → 0; DRAW → stake devolvido; saldo final exato | US-06 |
| OR-12 | Contrato expira em `t`; ticks em `t-0,4 s`, `t+0,6 s`, `t+1,6 s` | Settlement roda depois de `t+2 s` | Preço de saída = tick de `t+0,6 s` (primeiro com `ts ≥ expires_at`) | US-06 |
| OR-13 | 50 contratos vencidos | 2 settlement workers rodam ao mesmo tempo | Cada contrato liquidado 1×; 1 transação no Blnk por contrato | DoD 7 |
| OR-14 | Contrato vencido e nenhum tick depois de `expires_at` | Settlement roda | Contrato não liquida (fica `EXPIRING`); liquida quando o tick chega | US-06 |

## Carteira, ledger e reconciliação (T03, T04, T11)

| ID | Subtask | Dado | Quando | Então | Prova |
|---|---|---|---|---|---|
| OR-15 | T04 | Usuário novo | 1º login, depois 2º login, depois 5 chamadas paralelas de "garantir carteira" | Saldo `1_000_000` exatamente 1×; nenhum crédito extra | US-03 |
| OR-16 | T04 | Roles do banco aplicadas | `UPDATE`/`DELETE` em `ticks`, `audit_logs` e tabelas de evento com a role da API | Negado pelo banco | DoD 8 |
| OR-17 | T11 | Divergência plantada (reserva ausente para um contrato `OPEN`) | Reconciliação roda | Detecta em ≤ 1 min, grava em `reconciliation_runs`, incrementa a métrica; **nenhum** `UPDATE` de saldo | DoD 9 |
| OR-18 | T03 | Tokens forjados | Token expirado, `aud` errado, `iss` errado, `alg: none`, `HS256` com a chave pública | `401` em todos | S-02 |
| OR-19 | T03 | Token válido de USER | Qualquer `/admin/*` | `403` | S-03 |

## Resiliência e carga (T15, T17, T18)

| ID | Subtask | Dado | Quando | Então | Prova |
|---|---|---|---|---|---|
| OR-20 | T17 | 20 contratos abertos | Redis reiniciado | Todos liquidam; saldos finais = calculados dos ticks; reconciliação 0 divergência | DoD 10 |
| OR-21 | T17 | 50 contratos vencendo | `kill -9` no settlement worker no meio do lote | Todos liquidados 1× após o restart | DoD 11 |
| OR-22 | T17 | Usuário logado com contrato aberto | Keycloak parado | Contrato liquida; token já emitido segue aceito até `exp`; login novo falha sem `500` | DoD 12 |
| OR-23 | T15 | Stack de pé | Plantar: tick parado, Stream com pendentes velhos, contrato `OPEN` vencido, 5xx, divergência | Cada alerta crítico dispara dentro da janela configurada | DoD 13 |
| OR-24 | T18 | Stack limpa | 300 WebSockets + 50 contratos/min por 10 min | p95 de `POST /contracts` < 200 ms; 5xx < 0,1 %; 0 settlement duplicado; 0 divergência | DoD 14 |

## Jornadas de tela (T13, T14)

| ID | Subtask | Jornada (Playwright) | Prova |
|---|---|---|---|
| OR-25 | T13 | Cadastro → link do e-mail no Mailpit → login → header mostra `US$ 10.000,00` → gráfico com 100 candles atualizando → abrir UP de US$ 10 → resultado aparece em ≤ 65 s e o saldo do header muda sem recarregar → histórico filtrado por WIN/LOSS/DRAW → derrubar o WebSocket e ver o gráfico retomar sem buraco | US-01..07 |
| OR-26 | T14 | ADMIN (com TOTP) → usuários com saldo e busca por e-mail → contratos filtrados por status → pausar índice e ver a boleta do usuário bloquear → retomar → bloquear usuário e ver o usuário receber `403` → AUDITOR vê as mesmas listas **sem** botões de escrita | US-08..10 |

## Assinatura

Li os 26 oráculos e concordo que, se passarem, a Fase 1 cumpre o PRD e a Definição de Pronto.

- Nome: `<preencher>`
- Data: `<preencher>`
