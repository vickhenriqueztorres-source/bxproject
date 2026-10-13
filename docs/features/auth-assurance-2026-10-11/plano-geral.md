# Plano geral — autenticação, cadastro e sessão

Data: 2026-10-11. Escopo: `/login`, `/registro`, entrada na sala, botões de saída, recuperação, API de identidade, persistência e vínculo da carteira demo. Ambiente de prova: efêmero/local; nenhuma carga ou injeção de falha em produção.

## Contrato e decisão

- Orquestrador: `tech-lead-orchestrator`. Implementação: `backend-implementation-agent` e `frontend-realtime-agent`; testes: `qa-resilience-agent`; revisão: `security-reviewer`, `financial-correctness-reviewer` e `regression-guardian-agent`.
- Skills: `01-project-context`, `02-financial-invariants`, `04-security-iam`, `05-resilience-patterns`, `06-testing-quality`, `07-production-operations`, `08-database-foundation`, `09-ai-failure-map`, `17-mudanca-cirurgica`.
- D-01 fixa Keycloak como origem de usuários, senha, sessão e MFA. D-02 fixa Blnk como origem do saldo demo. PostgreSQL da aplicação deve guardar somente o vínculo `sub` → conta Blnk, nunca senha ou saldo. A migration 0040 e a autenticação nativa atuais conflitam com essas decisões; toda migração de dados ou remoção exige plano próprio e prova de compatibilidade.
- Cliente cadastrado significa identidade consultável no armazenamento persistente do Keycloak, `sub` estável e vínculo da carteira demo confirmado no Blnk. Um registro no `localStorage` não satisfaz o critério.
- Contratos legados usam `user_id` UUID e contas Blnk identificadas a partir dele; uma troca direta para outro `sub` pode separar o cliente da carteira e dos contratos. A subetapa 02 exige inventário e migração compatível antes de retirar a autenticação antiga.

## Diagnóstico inicial, antes de editar produção

1. `apps/web/src/auth/auth-service.ts` conclui cadastro/login em `localStorage` após falha da API; o cliente pode receber sucesso sem persistência no servidor.
2. `LoginPage.tsx` e `RegisterPage.tsx` ativam modo convidado após autenticar. `apps/web/src/api/client.ts` devolve carteira mock em modo convidado.
3. `services/api/src/services/auth-service.ts` usa senha SHA-256, JWT HS256 com segredo padrão e tabela própria `users`; `services/api/src/plugins/auth.ts` aceita esses tokens e não exige `aud` no caminho OIDC.
4. `services/api/src/routes/auth.ts` devolve token de recuperação na resposta e aceita corpo via `any`; `/me` inventa perfil e saldo se não acha usuário.
5. `services/api/src/routes/wallet.ts` devolve saldo fixo com HTTP 200 quando Blnk falha. Isso também impede que a UI prove o saldo autoritativo.
6. Testes de auth existentes passam com mocks/Map: 11 testes de frontend e 18 de API passaram em 2026-10-11; `tsc --noEmit` passou para web e API. Isso é linha de base, não certificação de PostgreSQL, Keycloak ou Blnk.
7. `infra/compose.yaml` contém PostgreSQL, Keycloak e Blnk, mas não inclui API/web; o frontend local escuta em 5173 e a API não apareceu nas portas verificadas. Portanto ainda não há prova de cadastro real ponta a ponta.

## Ordem e gates

| Ordem | Documento | Entrega obrigatória para avançar |
| --- | --- | --- |
| 01 | [inventário e linha de base](subetapa-01-inventario-e-linha-de-base.md) | Mapa de fluxos, testes executados, riscos e diffs preexistentes registrados. |
| 02 | [identidade e persistência](subetapa-02-identidade-e-persistencia.md) | Cadastro/login Keycloak e vínculo Blnk provados em serviços reais; nenhum sucesso local falso. |
| 03 | [frontend e sessão](subetapa-03-frontend-e-sessao.md) | Botões entrar/criar/sair e renovação testados em navegador real; estado e carteira corretos. |
| 04 | [segurança e recuperação](subetapa-04-seguranca-e-recuperacao.md) | S-01 a S-06 aprovados; ataques negativos e recuperação/replay demonstrados. |
| 05 | [estresse e caos](subetapa-05-estresse-e-caos.md) | Thresholds de latência/erro, falha injetada comprovada, persistência/ledger reconciliados. |
| 06 | [regressão e certificação](subetapa-06-regressao-e-certificacao.md) | Suíte completa, revisão independente e evidências por critério no commit exato. |

**Regra de execução:** testes-oráculo antes da correção, vermelho reproduzido, alteração mínima, verde com dependências reais e revisão independente. Não iniciar uma subetapa enquanto qualquer critério da anterior estiver falso, pendente ou sem evidência. Não modificar testes para esconder falha. Preservar as alterações já existentes no workspace; registrar baseline e limitar cada diff à cadeia causal.

## Evidência exigida por gate

Comando, data, ambiente, versão/commit ou estado do workspace, resultado numérico, consulta direta ao armazenamento autoritativo e pós-condições. Relatório sem execução é `PENDENTE`. Falha de segurança alta/crítica bloqueia a passagem. Para dinheiro demo: nenhuma alteração direta de saldo; provisionamento e leitura devem ser verificados no Blnk.

## Estado atual

Subetapa 01 **CONCLUÍDA para o diagnóstico**; [relatório e linha de base](relatorio-subetapa-01.md). Subetapa 02 **EM EXECUÇÃO**; [relatório parcial](relatorio-subetapa-02-parcial.md) contém oráculos vermelhos/verdes, consulta direta ao PostgreSQL e entrega real no Mailpit. O cadastro ainda depende da tabela legada, e Keycloak/Blnk reais não foram certificados. Subetapas 03–06 **PENDENTES**. Produto **REPROVADO/NÃO CERTIFICADO**.
