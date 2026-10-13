# ADR-AUTH-02: carteira Blnk e preservação do crédito demo legado

- **Data:** 2026-10-11
- **Status:** PROPOSED; bloqueado por inventário do ambiente autoritativo e prova financeira.
- **Contexto:** cliente existente usa `users.id` em contratos e identificadores lógicos do adaptador. O Blnk real testado em ambiente descartável rejeitou `POST /accounts` sem `identity_id`/`balance_id` (400). O Compose atual também não executa `blnk migrate up` nem worker. Nenhum saldo Blnk real de cliente foi verificado.

## Decisão proposta

1. O UUID canônico preservado pelo ADR-AUTH-01 continua sendo a chave do cliente para contratos e referências idempotentes.
2. O Blnk guarda saldo e transações; PostgreSQL da aplicação guarda somente o mapeamento técnico entre UUID canônico e IDs de saldo Blnk, após reconciliação. Nunca guarda um saldo editável ou transações próprias.
3. Criar saldos disponíveis e reservados com a API de `/balances` da versão Blnk fixada; manter IDs retornados pelo Blnk. Criar conta da casa com origem/destino explícitos. Nunca presumir que `@user_<UUID>` seja uma conta válida em um ledger de clientes.
4. Provisionamento é comando idempotente, acionado após cadastro confirmado, com estado recuperável; `GET /wallet` faz somente leitura. Crédito inicial usa referência fixa `onboarding:<UUID>` e origem da casa. Para legado, reconciliar referência e saldos existentes antes de permitir qualquer crédito.
5. Falhas de cadastro Blnk, worker, fila ou leitura deixam estado pendente/503; não existe número de saldo substituto no cliente ou na API. Correções financeiras usam reversão, não `UPDATE`.

## Critérios de execução antes de ACCEPTED

- Inventário somente leitura de UUIDs, contratos, saldos/contas/referências Blnk do ambiente que contém os clientes reais.
- Em Blnk e PostgreSQL descartáveis, primeiro cadastro cria dois saldos e um crédito de 1.000.000 minor; resposta de leitura é derivada do Blnk.
- Doze comandos concorrentes e reentrega após queda entre saldos, transação e confirmação mantêm um único crédito. Reinício do worker converge sem duplicação.
- Falha 400, 503, timeout, Redis fora e PostgreSQL Blnk fora não retornam sucesso nem emitem crédito parcial invisível; circuit breaker recupera após restabelecimento.
- Auditoria de dupla entrada: débito da casa = crédito do usuário e referência `onboarding:<UUID>` única; nenhum saldo `users.demo_balance_minor` chega à UI.
- Parecer independente financeiro e de segurança antes de aplicar no ambiente com clientes.

## Estado atual

O oráculo positivo `auth-blnk-onboarding.oracle.test.mjs` permanece **vermelho 0/2** em Blnk real. O oráculo de falha fechada está **verde 3/3**; erros 400 agora interrompem o fluxo antes do crédito. Esta ADR não autoriza migrar saldos nem substituir o adaptador até que os critérios acima passem.
