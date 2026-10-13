# Subetapa 02: critérios oráculo de identidade

Esses critérios precedem os testes. O PostgreSQL deste teste é um contêiner
`postgres:16-alpine` isolado e descartável. Ele prova persistência do fluxo
Fastify legado; a conformidade final de identidade requer Keycloak (D-01) e
Blnk (D-02), coberta pelos demais critérios AC-AUTH-04/06 da subetapa.

## AC-AUTH-05 / S-01: falha fechada no cliente

- **Dado** um cadastro válido e a API indisponível por erro de rede ou HTTP 503,
  **quando** `AuthService.register` é chamado, **então** a promessa rejeita,
  `binmax_auth_session` permanece ausente, `isAuthenticated()` é falso e
  `binmax_auth_users_db` permanece idêntico, sem novo usuário.
- **Dado** um usuário previamente presente no armazenamento local e a API
  indisponível, **quando** `AuthService.login` recebe credenciais corretas
  para esse registro local, **então** a promessa rejeita, nenhuma sessão é
  criada e o armazenamento não sofre escrita.

## AC-AUTH-04 / DB-02: persistência autoritativa observada

- **Dado** um email único e PostgreSQL 16 real inicializado pela migration 0040,
  **quando** `POST /api/v1/auth/register` do Fastify retorna sucesso,
  **então** uma consulta SQL direta encontra exatamente uma linha com o mesmo
  email normalizado e o mesmo UUID retornado pela API.
- **Dado** o email recém-cadastrado, **quando** o mesmo cadastro é repetido,
  **então** o serviço retorna 409 e a consulta SQL continua encontrando uma
  linha.
- **Dado** outro email único, **quando** 12 requisições de cadastro são feitas
  em paralelo, **então** exatamente uma retorna 201, as outras 11 retornam
  409 (sem 500), e uma consulta SQL direta encontra uma linha cujo UUID é o
  da única resposta 201.

O banco de aplicação atual contém senha e saldo na tabela `users`; isso é
divergência conhecida de D-01/D-02, não autorização para manter essa estrutura.

## AC-AUTH-07A / S-04: preservação do principal legado

- **Dado** `users.id` legado com contrato persistido e um `sub` Keycloak
  diferente, **quando** um vínculo verificado `(issuer, sub) → principal_id`
  existe, **então** `/me` devolve o UUID antigo e o histórico contém apenas
  o contrato desse UUID.
- **Dado** outro `sub` com email igual no token, mas sem vínculo, **quando**
  consulta perfil ou contratos, **então** recebe 401; email não reivindica
  acesso.
- **Dado** um segundo principal vinculado, **quando** consulta contrato alheio,
  **então** recebe 404 e seu histórico contém somente contratos próprios.
- **Dadas** 12 reentregas concorrentes do mesmo vínculo, **então** existe uma
  única linha; outro `sub` apontando para o mesmo principal viola a unicidade.
- **Dado** armazenamento de vínculos indisponível, **então** a API retorna 503
  e jamais usa `sub` como substituto do UUID financeiro.

Esses testes usam PostgreSQL 16 real descartável e JWT RS256 assinado por
emissor de teste. Migração de contas reais exige identificar o ambiente
autoritativo e verificar posse da identidade antes de criar vínculos.
