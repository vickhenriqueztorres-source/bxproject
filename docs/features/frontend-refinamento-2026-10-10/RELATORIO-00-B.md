# Relatório 00-B — retirada demonstrativa

Data: 10/10/2026. Escopo funcional autorizado pelo usuário nesta conversa. Veredito: **verificação funcional APROVADA; liberação do gate00 BLOQUEADA**. A aprovação funcional não substitui lint e demais verificações obrigatórias da base.

## Alteração e preservação

O modal identifica a simulação e deixa explícito que ela não envia fundos nem confirma transferência. Saldo ausente e último retiro ficam indisponíveis. O aviso KYC não afirma identidade aprovada. A trava síncrona impede duplicação; fechar/desmontar cancela o timer; exceção síncrona do callback mostra erro sem concluir.

Preservados: props, IDs, métodos BANK/PIX/CRYPTO, mínimo50, destino obrigatório, conversão existente, argumentos do callback e rota de retorno. Nenhuma API, serviço, ledger ou dependência alterada.

Quatro arquivos: `apps/web/src/wallet/BinmaxWithdrawModal.tsx`, `apps/web/src/i18n/locales/es-ES.json`, `apps/web/src/wallet/binmax-wallet.unit.test.tsx`, `apps/web/src/wallet/wallet-precision-stress.unit.test.tsx`. Diff contra cópias locais:97 adições+23 remoções=120 linhas. Fixture adicional, preparada antes do patch: `apps/web/tests/design/withdraw-fixture.html`; monta componente real em StrictMode e registra chamadas apenas localmente.

## Reprodução e provas executadas

Antes: contrato aprovado9testes,4FAIL/5PASS; log `scratch/frontend-refinamento-2026-10-10-backup/00B-red-before.log`. Browser anterior confirmou falsa transferência após timer,20callbacks simultâneos, callback tardio após fechar/desmontar e sucesso mesmo com callback lançando erro.

| Prova depois do patch | Resultado observado |
|---|---|
| Mesmos testes focados | 9/9 PASS |
| Typecheck frontend | PASS,exit0 |
| Suíte independente sequencial | 104/104 arquivos,528/528 testes PASS;74,94s |
| Build Vite isolado | PASS,184módulos,19,01s;warning chunk961,20kB |
| Rajada20submits no mesmo evento | 1callback;payload100/destino-demo preservado |
| Enviar e fechar / desmontar antes600ms | 0callbacks após deadline; reabertura habilitada |
| Callback lança erro síncrono | Mensagem de falha;0sucesso;0callbacks completados |
| Valor49 / destino em branco | Rejeitados;0callbacks |
| Valor50 com endereçoHTMLhostil | Payload preservado como texto;0nós img/onerror injetados |
| Saldo ausente / saldo informado | Indisponível / $123.45 exato |
| 50ciclos reais abrir/fechar | 0callbacks,1modal,ação habilitada |
| Modal390×844 | Controles dentro do viewport |
| Rota real /retiro | Aviso demo e indisponibilidade visíveis; simulação navega para /operar |

Comando independente: `pnpm exec vitest run apps/web --maxWorkers=1 --no-file-parallelism --configLoader runner --no-cache --reporter=dot`.
Build: `pnpm --filter @broker/web exec vite build --outDir ../../scratch/frontend-withdraw-00B-build`; não sobrescreve dist.

## Revisões e limites

Guardião: diff e528testes aprovados; provas browser realizadas pelo orquestrador. Compliance e segurança: revisão estática aprovada no escopo demo. Nenhuma destas aprovações libera reforma visual.

Callback continua void: trata exceção síncrona, sem contrato de pagamento ou Promise financeira. Na rota real, o consumidor navega imediatamente; a conclusão visual completa foi verificada na fixture. Prazos preexistentes dos métodos, saldo de fallback no cabeçalho, foco/trap de teclado e acessibilidade global permanecem débitos da base. Motion/CSS e autenticação não foram alterados. Não alegar certificação de backend, fundos ou segurança absoluta.

## Evidências e rollback

- [Antes: falsa confirmação](evidencias/saque-antes-falsa-confirmacao.png)
- [Depois: conclusão demonstrativa](evidencias/saque-depois-simulacao.png)
- [Depois: modal390](evidencias/saque-depois-390.png)

Backups dos quatro arquivos em `scratch/frontend-refinamento-2026-10-10-backup/`, mantendo caminhos. Nunca restore/reset amplo. Os arquivos já continham trabalho local anterior. Após alteração concorrente do dicionário, restaurar integralmente o backup antigo apagaria trabalho novo: o rollback deve remover somente o patch00-B e preservar as traduções posteriores, com diff revisado.
