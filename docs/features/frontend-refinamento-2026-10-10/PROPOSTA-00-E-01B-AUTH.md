# 00-E-01B — tratamento delimitado de erro de autenticação

Estado: preparação revisada; autorização funcional específica pendente. Não libera 00-E-02 ou redesign.

## Problema e evidências

Nos catches de register, login e resetPassword, o código anterior acessava message sem verificar o valor rejeitado. A reprodução real anterior à mudança encontrou 50 FAIL e 16 PASS em 66 casos: 30 malformados resolveram pelo caminho local e 20 geraram TypeError. Evidência auth-00E01B-red.json, saída 1. Não é falha causada pelo saneamento 00-E-01A.

Durante a preparação, auth-service.ts mudou fora do lote do orquestrador, em 10/10/2026 12:54:24 local: recebeu três guards que rejeitam valor não objeto ou message não string, e manteve catch(err:any). Autoria não determinada; os dois agentes da revisão/preparação confirmaram não editar produção. Não revertemos nem consideramos essa mudança autorizada por suposição. Snapshot atual em scratch/frontend-refinamento-2026-10-10-00E01B/auth-service-current.ts, SHA256 FDB1FB52732B8C872DF36E57A35FA365060D84AE97B7314BD2CBC30E6706798B.

O oráculo ampliado tem 256 casos: 240 malformados (16 formas × 5 combinações método/origem × 3 estados de armazenamento) e 16 controles de preservação. O armazenamento vazio não pode ser semeado; a sessão anterior deve permanecer; spies exigem zero setItem/removeItem. No código atual concorrente: 256/256 PASS, exit 0, auth-00E01B-checkpoint-concorrente.json. A execução original se chama red-ampliado.json por intenção anterior ao comando, mas seu conteúdo é VERDE. Não apresentar como vermelho.

Typecheck explícito do oráculo: PASS, exit 0, cwd D:/brokerproject/apps/web, comando `pnpm exec tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler --types 'vitest/globals,node' ../../tests/unit/frontend-auth-error-contract.unit.test.ts`. Primeira tentativa sem aspas foi rejeitada pelo parse de argumentos do PowerShell; não houve supressão de erro de tipos. SHA256 do teste: 59CBD2CEC497CD3F357103E869F00CA1B81F7955743B63177E5F9269DFE4C9BE. Hash do AuthService confirmado novamente às 13:01:58 local, inalterado desde o snapshot concorrente.

Os guards atuais atendem ao contrato delimitado na revisão independente; a aprovação não confirma autoria/autorização nem certifica IAM. A cópia auth-service-before.ts no scratch é uma reconstrução contrafactual não verificada por hash contra o original; não foi executada e não serve de baseline.

## Resultado proposto

Incorporar o comportamento delimitado no fluxo de recuperação autorizado: em register/login/reset, rejeição sem message string termina com Error controlado antes de qualquer fallback ou escrita local. Preservar os sucessos oficiais, negativas específicas existentes e fallback anterior de Error/TypeError/objeto com message string. Concluir a tipagem dos catches sem casts cegos; colocar a mensagem nova no dicionário espanhol existente.

Nenhuma mudança em endpoints, payloads, validação de campos, assinatura pública, saldo, hash/salt, formato de sessão, OIDC, requestPasswordRecovery, estilos ou backend. Este contrato restringe alguns erros inesperados; não corrige todos os caminhos de acesso.

## Subpassos completos

1. **01B-T — contrato antes da edição.** Arquivo tests/unit/frontend-auth-error-contract.unit.test.ts, 114 linhas; matriz determinística, fetch/json simulados, sem serviço externo, mocks restaurados após cada caso. Teste original vermelho conservado; versão ampliada verde sobre alteração concorrente. Revisão security-reviewer T13 aprovou a preparação, com limites descritos abaixo. Executado pelo orquestrador; não atribuir a alteração de produção ao autor do teste.
2. **01B-C — correção delimitada após autorização.** Congelar hashes atuais e ler integralmente os três arquivos permitidos: apps/web/src/auth/auth-service.ts, apps/web/src/i18n/locales/es-ES.json e nova fixture apps/web/tests/design/auth-error-fixture.html. Até 5 arquivos/150 linhas por execução; o contrato do subpasso anterior não deve ser reescrito. Trocar os três catch any por unknown, comprovar a propriedade message antes de acessá-la e usar esES.auth.unexpected_error como fonte da mensagem. Manter guards presentes e todos os caminhos conhecidos. Adicionar somente essa chave ao JSON, preservando traduções concorrentes. Se surgir diferença fora do orçamento/contrato, subdividir antes da edição.
3. **Prova local de falha e segurança.** Rodar os 256 casos e os testes auth/cache/lifecycle existentes. Malformados devem sempre rejeitar com Error controlado, zero escritas e sessão preservada. Quatro negativas específicas continuam negativas; nove fallbacks existentes e três sucessos oficiais preservados. Nenhuma regra off/skip/cast ou alteração de limite de tempo.
4. **Browser e caos frontend.** Fixture local, com controles explícitos para login/register/reset e fetch falhando com null/objeto sem message/message número. Registrar escritas, erro e estado da sessão; repetir 50 ciclos e burst de 20 chamadas; exigir zero escrita para malformados e zero sessão nova. Nenhum endpoint real ou clique financeiro. Verificar a mensagem no fluxo de erro e manter a rota/sessão em falha. Fixture não certifica login oficial nem substitui testes montados das páginas.
5. **Regressão integral.** Types de produção e checagem explícita do novo teste; lint dos arquivos de código/teste, suíte apps/web + benchmark + oráculo, e build pelo executável Vite do workspace, saída isolada. Registrar falhas e perfil de execução; não repetir até verde. Lint global ainda deve diminuir, sem editar dívidas alheias silenciosamente.
6. **Revisão e fechamento.** Security-reviewer T13 e guardião somente leitura conferem diff, zero escrita, preservação, orçamento e evidências. Registrar relatório com comandos/cwd/exit/hashes e limites. Somente PASS do contrato delimitado fecha 01B; dívida global e outros critérios continuam bloqueando redesign. Não avançar para 00-E-02 com FAIL no lote 01.
7. **Rollback.** Desfazer somente o diff aplicado após esta autorização usando o snapshot imediato e inspeção das alterações concorrentes. Não remover automaticamente os guards encontrados, não restaurar JSON inteiro e não usar reset/restore amplo. Nenhum deploy/commit nesta execução.

## Microcopy

| Anterior | Fonte proposta | Chave | Arquivo |
|---|---|---|---|
| No se pudo completar la autenticación. Intenta de nuevo. (literal dos guards concorrentes) | Mesma mensagem em espanhol, sem promessa de sucesso | auth.unexpected_error | i18n/locales/es-ES.json |

AuthService não usa hooks React: importar somente o JSON existente como fonte do texto espanhol preserva o padrão atual de mensagens espanholas do serviço. Não alterar locale/provider nem traduzir outros idiomas neste subpasso.

## Limites explícitos

- Getter/Proxy e objetos com traps não pertencem à matriz de rejeições simples; não extrapolar 240 exemplos para todo valor JavaScript.
- Quatro negativas HTTP cobrem mensagens específicas; discriminadores por texto e outros 4xx permanecem dívida anterior. A recuperação de resposta 400 que absorve erro de parsing e requestPasswordRecovery ficam fora.
- Tokens continuam em localStorage, dívida ALTO S-01, indicada pela revisão. Esta correção não certifica autenticação segura integral, PKCE, JWT, RBAC ou servidor.
- Controles de sucesso oficial verificam retorno; não provam todos os efeitos de persistência remota/local.
- O trabalho concorrente impede atribuir verde ampliado a uma implementação deste orquestrador. A validação final deve registrar exatamente a versão e o diff incorporados.

## Por que a autorização é específica

A proposta 00-E aprovada autoriza tipos/declarações **sem mudar comportamento**. A skill [zonas-sensiveis](../../../skills/18-zonas-sensiveis/SKILL.md) estabelece para login/sessão: **“Não tocar. Só com aprovação escrita do dono, e nunca junto com mudança visual”**. A validação pode continuar em leitura; editar/incorporar a correção de runtime e sua mensagem requer essa autorização. O redesign segue separado.
