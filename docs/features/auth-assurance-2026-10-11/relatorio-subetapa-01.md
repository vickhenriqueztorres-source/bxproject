# Relatório da subetapa 01 — inventário e linha de base

Data: 2026-10-11. Base Git: `d67aeaf926588e4acac63aa106a0c40593183aca`. O inventário registrou 473 entradas em `git status --porcelain=v1`, incluindo documentos criados nesta execução; arquivos centrais de auth já estavam modificados ou sem rastreamento. Nenhum deles foi restaurado nesta subetapa.

## Fluxo rastreado

| Ação | Caminho observado | Consequência |
| --- | --- | --- |
| Entrar | `LoginPage.tsx:33-44` → `AuthService.login` em `apps/web/src/auth/auth-service.ts:252-349` → `/api/v1/auth/login` em `services/api/src/routes/auth.ts:34-50` | Após resposta ou fallback local, ativa guest mode e navega `/operar`. |
| Criar conta | `RegisterPage.tsx:44-66` → `AuthService.register` em `apps/web/src/auth/auth-service.ts:148-246` → `/api/v1/auth/register` em `services/api/src/routes/auth.ts:10-32` | Falha de rede/5xx pode criar usuário somente em `localStorage`; UI avança como sucesso. |
| Persistir pela API | `services/api/src/services/auth-service.ts:107-140` → tabela `users` em `db/migrations/0040_users_and_auth.up.sql:7` | Há `INSERT` no código, mas nenhum teste existente consulta PostgreSQL real depois do formulário. |
| Entrar na sala | `apps/web/src/App.tsx:304-367` → guest mode / sessão local → `apps/web/src/api/client.ts:136-141` | Carteira da sala passa a vir da store mock; US$ 10.000 mostrados não comprovam Blnk. |
| Sair | `apps/web/src/App.tsx:185` → `TerminalHeader.tsx:845,961` → `apps/web/src/auth/oidc.ts:87-99` | Limpa uma chave local; em guest mode recarrega e a sala pode voltar como convidado. Logout de sessão nativa não foi provado no servidor. |
| OIDC | `apps/web/src/auth/oidc.ts:10-20,84-99` → `services/api/src/plugins/auth.ts:55-72` | Convive com JWT nativo HS256; callback e audience ainda requerem prova integrada. |

O frontend usa três regimes de identidade: Keycloak OIDC, JWT nativo da API e sessão local `local_session_*`. A migration 0040 guarda senha e saldo na aplicação, contrariando D-01 e D-02. O fluxo de tela ativa `setGuestMode(true)` após cadastro/login, reforçando a divergência entre identidade real e carteira exibida.

## Linha de base executada

| Comando | Resultado | Limite da evidência |
| --- | --- | --- |
| `pnpm exec vitest run apps/web/src/auth/auth-service.unit.test.ts apps/web/src/pages/auth-full-lifecycle-e2e.unit.test.tsx` | 2 arquivos, 11 testes passaram, exit 0 | `Map`/`localStorage` simulado; não é E2E nem consulta banco. |
| `pnpm --filter @broker/api test` | 18 testes passaram, exit 0 | `auth-routes.unit.test.ts` injeta PostgreSQL simulado. |
| `pnpm exec tsc --noEmit -p apps/web/tsconfig.json` | exit 0 | Compilação não prova comportamento. |
| `pnpm exec tsc --noEmit -p services/api/tsconfig.json` | exit 0 | Compilação não prova segurança. |
| `docker compose -f infra/compose.yaml ps --format json` | vazio | Nenhum serviço do Compose rodava na verificação. |
| `curl.exe -sS -i --max-time 5 http://127.0.0.1:5173/api/v1/auth/me` | HTTP 500 | Proxy local não entregou perfil da API nesse momento. |

`tests/test-auth-login-registration-wallet-db.mjs` lê texto SQL e usa `Map`; seu nome e mensagem de certificação não constituem consulta ao PostgreSQL. `vitest.config.ts` exclui `services/api/**` da suíte raiz, então um `pnpm test:int` isolado tampouco certifica a API de auth.

O `qa-resilience-agent` registrou 10 falhas estáticas preexistentes em testes de caos/carga fora do escopo deste handoff. Elas permanecem separadas dos resultados AC-AUTH e não serão ocultadas por alteração de runner ou asserção.

## Defeitos abertos e gate

1. **Crítico — sucesso falso de cadastro/login:** `apps/web/src/auth/auth-service.ts:208-246,302-349` cria usuário e sessão locais se a API falha. Oráculo da subetapa 02 deve falhar antes da correção.
2. **Crítico — fontes de verdade conflitantes:** `services/api/src/services/auth-service.ts:35-65,107-140` mantém credencial/JWT e saldo na aplicação; `apps/web/src/api/client.ts:136-141` exibe saldo mock após login. D-01/D-02 exigem Keycloak/Blnk.
3. **Crítico — recuperação expõe token:** `services/api/src/routes/auth.ts:61-67` inclui token de recuperação na resposta pública.
4. **Alto — validação de token insuficiente:** `services/api/src/plugins/auth.ts:38-72` aceita HS256 com segredo padrão e OIDC sem `aud` explícita.
5. **Alto — carteira fabricada sob falha:** `services/api/src/routes/wallet.ts:38-46` responde com saldo fixo quando Blnk falha; o usuário pode ver crédito inexistente no ledger.
6. **Risco de migração:** `contracts.user_id` e IDs de contas Blnk derivam do UUID legado; trocar o `sub` sem mapa/compatibilidade separa carteira e contratos de seu dono.
7. **Lacuna de prova:** não houve cadastro de cliente em ambiente descartável nem `SELECT` no banco autoritativo, clique real em botão ou teste de carga/caos nesta subetapa.

Parecer independente `security-reviewer` T13: **REPROVADO**. S-01, S-02, S-03, S-05 e S-06 falham; S-04 passa somente sob a hipótese de um `request.user` confiável, ainda negada por S-02. O realm exportado em `infra/keycloak/broker-realm.json:5,46-55,74-83` também tem retorno amplo e HTTP permitido. O revisor requer prova real de JWT inválido, roles, BOLA, corpo estrito, recuperação e logout. Credenciais padrão eventualmente usadas exigem rotação sem divulgar seus valores.

Parecer independente `financial-correctness-reviewer` T09: **REPROVADO**. I-01 e I-03 falham; I-02 tem estrutura de dupla entrada no adapter, ainda sem prova em Blnk real. O cadastro guarda e devolve saldo fora do Blnk, a sala troca para carteira mock e a API responde saldo fixo sob falha do Blnk. O mesmo cliente pode receber duas referências de onboarding caso a migração altere seu identificador sem vínculo canônico. Exigir contagem direta de contas/transações Blnk e reconciliação antes de avançar.

AC-AUTH-01 e 02: **atendidos para o inventário** pelos caminhos e comandos acima. AC-AUTH-03: **atendido**; alterações originais preservadas. A subetapa 01 certifica apenas o diagnóstico. O produto permanece **REPROVADO** e a subetapa 02 deve abrir com testes-oráculo vermelhos, seguidos de correções causais e revisão independente.
