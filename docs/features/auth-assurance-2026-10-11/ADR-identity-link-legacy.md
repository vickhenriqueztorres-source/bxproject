# ADR-AUTH-01: vínculo explícito entre `sub` OIDC e principal legado

- **Data:** 2026-10-11
- **Status:** IMPLEMENTAÇÃO ADITIVA EM TESTE; migração de contas reais bloqueada até inventário e revisão financeira/de segurança.
- **Autor:** `tech-lead-orchestrator`, com diagnóstico do `broker-architect-agent`.
- **Revisores pendentes:** `financial-correctness-reviewer`, `security-reviewer`.

## Contexto

Contratos e contas Blnk atuais usam o UUID de `users.id`. O teste em Keycloak 26.0.8 mostrou que `POST /admin/realms/broker-demo/users` gerou um UUID novo mesmo quando recebeu `id` explícito. Trocar diretamente `request.user.id` pelo `sub` OIDC pode tornar contratos e carteira inacessíveis ao dono ou provisionar outra carteira.

## Direcionadores

- Keycloak é origem de credenciais, sessões e `sub` (D-01); Blnk é origem exclusiva de saldo (D-02).
- Um cliente não pode receber acesso a contratos/carteira de outro principal por coincidência de email (S-04).
- O mesmo principal não pode receber segundo crédito demo por migração (I-01/I-03).
- Contas antigas devem ser inventariadas antes de qualquer alteração irreversível.
- O proprietário confirmou em 2026-10-11 que **contas existentes devem ser preservadas**.

## Opções consideradas

1. **Usar `sub` diretamente:** simples para contas novas; quebra vínculo legado quando UUID muda. Rejeitada para contas existentes.
2. **Vincular por email:** conveniente, mas email é mutável e pode ser reciclado; abre tomada de conta. Rejeitada.
3. **Tabela de vínculo auditável:** chave `(issuer, sub)` aponta para um único `principal_id` UUID; conta nova pode usar seu `sub` como principal se for UUID, conta legada mantém UUID anterior. **Proposta.**

## Contrato proposto

1. Migração aditiva cria `identity_subject_links` com `issuer`, `sub`, `principal_id`, `link_method`, `verified_at`, `created_at` e constraints únicas em `(issuer, sub)` e `principal_id`. Não inclui senha, saldo nem email como chave.
2. O backend valida JWT RS256/JWKS, `iss`, `aud`, `exp`, `typ`, roles e `sub` antes de consultar o vínculo. Requisição sem vínculo não recebe carteira/contratos; onboarding de conta nova usa transação idempotente e referência única no Blnk.
3. Para legado, o vínculo só nasce após prova de posse da identidade Keycloak e mecanismo de reivindicação aprovado e auditado. A mera igualdade de email ou existência de `localStorage` não basta.
4. Rollout dual-read limitado: tokens nativos existentes expiram; novas senhas/JWT nativos não são emitidos após a migração. Tabela `users` permanece somente leitura até reconciliação e retenção definidas. Nenhuma migration `down` 0040.
5. O identificador canônico resolvido entra no contexto de autorização de contratos, carteira, histórico e ledger; consultas privadas sempre escopam pelo principal resolvido.

## Provas já executadas em ambiente descartável

- PostgreSQL real: `sub` distinto aponta para UUID legado; perfil e contrato original ficam acessíveis somente ao dono.
- Outro `sub` com o mesmo email recebe 401; outro principal vinculado não lê contrato alheio (404).
- Doze inserções concorrentes do mesmo vínculo produzem uma linha; segundo `sub` para o mesmo principal viola a constraint única.
- Banco de vínculos indisponível responde 503, sem usar `sub` diretamente.

## Provas necessárias antes de ACCEPTED

- Inventário somente leitura do ambiente **autoritativo a identificar**: contagem e amostra redigida de `users.id`, contratos `user_id`, contas/referências Blnk e cadastros somente locais. Não assumir que os contêineres `fase1-test-*` são essa fonte.
- Testes reais para 1 usuário novo, 1 legado com carteira/contratos e 1 atacante com mesmo email: apenas o dono acessa os recursos; nenhum crédito duplicado.
- Concorrência 12× no vínculo/provisionamento: uma linha de vínculo, uma conta e um crédito inicial no Blnk.
- Repetição após falha entre Keycloak, PostgreSQL e Blnk: estado recuperável e reconciliação sem saldo fictício.
- Pareceres financeiro e de segurança independentes, além da regressão com sessão antiga e nova.

## Consequências

Há uma consulta de vínculo no caminho autenticado e um processo de migração com prova de posse. Isso adiciona trabalho operacional, mas preserva o UUID financeiro sem confiar em email. A implementação aditiva não autoriza migrar contas reais até o inventário e os testes acima passarem. Nenhuma linha de cliente existente foi vinculada automaticamente por email.
