# Relatório parcial da subetapa 02 — identidade e persistência

Data: 2026-10-11. Estado: **EM EXECUÇÃO; GATE NÃO APROVADO**. Testes de PostgreSQL e Mailpit usam contêineres descartáveis `auth-*`, com portas dinâmicas em `127.0.0.1`; não usam as instâncias `fase1-test-*` já presentes na máquina.

## Correções com oráculo vermelho antes e verde depois

| Defeito reproduzido | Correção limitada | Evidência verde |
| --- | --- | --- |
| API fora criava cadastro/login local e sessão falsa | `AuthService` do frontend exige confirmação da API | `auth-offline-fail-closed.oracle.test.ts`: rede/503 sem escrita local. |
| Saldo zero da API virava 1.000.000 no cliente; campo ausente também | Aceitar somente inteiro seguro não negativo, sem fallback de saldo | 4 testes vermelhos antes; 7/7 verdes após correção. |
| 12 registros simultâneos geravam 1×201 e 11×5xx | Traduzir conflito único `users_email_key` do PostgreSQL para 409 | PostgreSQL real: 1×201, 11×409, uma linha com UUID da resposta vencedora. |
| Segredo JWT padrão e JWT sem `aud`/`typ` eram aceitos | Segredo nativo explícito; verificação de `iss`, `aud`, `typ`, algoritmo e `sub` | Oráculo JWKS RS256: token válido aceito; variantes sem claims e segredo padrão rejeitadas. |
| `/me` e `/wallet` devolviam perfil/saldo inventados | 404 para usuário ausente; 503 sem Blnk, sem onboarding em erro 503 | Teste HTTP com PostgreSQL e Blnk simulado indisponível. |
| Token de recuperação aparecia na resposta e nenhuma mensagem era enviada | Link por SMTP, resposta uniforme sem token; navegador não cria token/senha local | Mailpit real: link recebido por email, token ausente da resposta. Teste de cliente offline sem escrita local. |
| 12 resets com mesmo token retornavam 200 | Consumo de token e alteração de senha em um comando SQL atômico | PostgreSQL real: 1×200, 11×400, `used_at` preenchido. |
| Compose Keycloak não declarava banco próprio nem importava o realm | Serviço `keycloak-postgres`, volume persistente e `--import-realm`, senha do banco obrigatória por variável | Oráculo de configuração vermelho antes; depois cliente sintético consultado no PostgreSQL e novamente no Keycloak após restart. |
| `sub` Keycloak diferente do UUID legado deixava perfil/contratos inacessíveis | Migration 0041 aditiva e resolução de `(issuer, sub)` para principal legado, sem usar email | Oráculo PostgreSQL real: 3 cenários vermelhos antes; após correção, 8/8 verdes, inclusive mesmo email atacante, BOLA, 12 vínculos concorrentes, rollback protegido e banco de vínculos fora. |
| Login PKCE real emitia access token sem `aud=broker-api` | Mapper de audiência nos clientes `broker-web` e `broker-admin` do realm | Oráculo Keycloak 26.0.8 vermelho antes; depois login pelo formulário, troca de código PKCE e `aud` válido, 2/2 testes verdes. |
| Blnk ignorava 400 ao criar conta e poderia tentar crédito sem conta válida | Adaptador propaga 400, não faz retry de erro permanente nem conta isso como falha do circuito | Oráculo de falha fechada 0/2 antes, depois 3/3 verde; teste positivo Blnk segue vermelho pelo contrato da API. |

## Comandos e resultados mais recentes

| Comando | Resultado | Limite |
| --- | --- | --- |
| `pnpm exec vitest run` nos sete arquivos focais de autenticação/frontend | 284 testes passaram | Mocks de API para fluxo de tela; não prova clique em navegador real. |
| `pnpm --filter @broker/api test` | 18/18 passaram | Testes unitários da API usam armazenamento simulado. |
| `pnpm --filter @broker/web exec tsc --noEmit` e `pnpm --filter @broker/api exec tsc --noEmit` | ambos exit 0 | Compilação apenas. |
| `wsl.exe -d Ubuntu -u phase1runner -- node --experimental-loader ./tests/helpers/api-typescript-loader.mjs --test ./tests/integration/auth-postgres-persistence.oracle.test.mjs` | 2/2 passaram | Prova apenas a persistência **legada** na tabela `users`, que ainda viola D-01/D-02. |
| Mesmo runner para `auth-recovery-jwt-security.oracle.test.mjs` | 11/11 passaram | JWKS é servidor RSA de teste, não Keycloak real. Blnk indisponível é servidor 503, não saldo real. Mailpit é serviço real. |
| `wsl.exe -d Ubuntu -u phase1runner -- node --test ./tests/integration/auth-keycloak-persistence.oracle.test.mjs` | última execução 2/2 passaram | Keycloak 26.0.8 e PostgreSQL 16 descartáveis: cliente sintético criado via Admin REST, linha `user_entity` consultada por UUID e email; login real pelo formulário OIDC e troca PKCE produziram token com `sub` persistido e `aud=broker-api`; mesma identidade lida após restart. Oráculo de audiência falhou antes do mapper e passou depois. A tentativa de impor UUID legado gerou outro UUID. Ainda não é cadastro pelo formulário do cliente. |
| `git diff --check --` nos arquivos rastreados tocados por esta subetapa | exit 0 | O `git diff --check` global aponta espaços preexistentes em arquivos de outras frentes; não foram alterados aqui. Arquivos novos sem rastreamento exigem revisão no gate final. |
| `auth-legacy-identity-link.oracle.test.mjs` com PostgreSQL 16 descartável | 8/8 passaram | Exercita perfil e contratos reais no PostgreSQL, JWT RSA assinado por emissor de teste, e rollback 0041 que recusa apagar vínculos existentes. Não é migração de clientes reais nem prova Blnk. |
| `auth-recovery-jwt-security.oracle.test.mjs` após a migration 0041 | 11/11 passaram | Recuperação SMTP/Mailpit, JWKS e falha Blnk. |
| API `tsc --noEmit` e `pnpm --filter @broker/api test` após vínculo | exit 0 e 18/18 | Regressão técnica da API; frontend e browser ainda pendentes nesta rodada. |
| Blnk real em PostgreSQL/Redis/worker descartáveis, imagem `sha256:60f5faec...` | **0/2; gate vermelho** | Após `blnk migrate up`, `POST /ledgers` retornou 201, mas `POST /accounts` do adaptador retornou 400: `identity_id` obrigatório quando não há `balance_id`. O adaptador ignorou essas falhas, acionou circuit breaker e não creditou usuário. A prova de 12 provisionamentos também falhou. Nenhum Blnk existente foi usado. |
| Oráculo de falha fechada do Blnk, servidor HTTP controlado | 3/3 passaram após correção; vermelho antes | Inicialização/onboarding rejeitam 400 sem `POST /transactions`; 400 permanente não é reenviado e seis tentativas independentes não abrem o circuito. `@broker/wallet-adapter` typecheck e 2 testes unitários passaram. |

## Bloqueios para aprovar o gate

1. **D-01:** cadastro/login atuais continuam usando `users`, senha SHA-256 e JWT nativo HS256 no banco da aplicação. A persistência do Keycloak isolado passou; cadastro pelo formulário e autenticação OIDC end-to-end ainda não foram provados.
2. **D-02:** `users.demo_balance_minor` ainda é emitido pela API como saldo, e as telas de login/cadastro ativam guest mode; o cliente pode enxergar carteira simulada. A prova positiva do Blnk real **falhou**: o adaptador chama `/accounts` sem `identity_id`/`balance_id` e ignora erros; o Blnk respondeu 400 e não houve crédito. Sem `blnk migrate up`, também houve 500 de tabela ausente. `infra/compose.yaml` não declara migration nem worker Blnk; `infra/blnk.json` contém credencial de desenvolvimento versionada. O contrato correto de [saldos e transações](https://docs.blnkfinance.com/ledger/tutorial/internal-balances) e as [regras de indicadores](https://github.com/blnkfinance/blnk-go) exigem redesenho e reconciliação com contas existentes antes de qualquer mudança financeira. Não creditar cliente legado até teste real verde.
3. **Migração:** o usuário confirmou que contas existentes devem ser preservadas. O vínculo aditivo passou no ambiente descartável, mas falta identificar e inventariar o ambiente autoritativo de IDs, contratos, Blnk e cadastros só no navegador; nenhuma conta real foi vinculada. Keycloak 26.0.8 ignorou um `id` UUID solicitado no Admin REST; o mapa `(issuer, sub) → UUID legado` é necessário. [ADR em teste](ADR-identity-link-legacy.md). Não executar migration `down` 0040.
   Também não foi encontrado um runner de migrations no startup/deploy do projeto; a aplicação da 0041 precisa de passo operacional testado e snapshot antes de qualquer ativação OIDC com clientes existentes.
4. **Recuperação transitória:** envio por SMTP e consumo único passaram; a implementação ainda usa credenciais nativas até migração para Keycloak. Restam cenários de SMTP fora, revogação de sessões, rate limiting e inspeção de URL/realm.
5. **Regressão independente e browser real:** ainda pendentes. Subetapas 03–06 continuam bloqueadas pelo gate 02.

Conclusão: melhorias causais foram verificadas, mas o produto **não está certificado para cadastro/login/carteira**. Continuar nos passos 3 a 8 da subetapa 02.
