# Subetapa 06 — regressão e certificação

Responsáveis: `regression-guardian-agent`, `post-implementation-verifier`, `security-reviewer`, `financial-correctness-reviewer`, orquestrador. Skills: 01, 02, 04, 06, 09, 10, 17, 19.

## Passo a passo

1. Fixar commit/diff de entrega e comparar com baseline preexistente. Cada arquivo alterado deve pertencer à cadeia causal aprovada; não reverter edições anteriores de terceiros.
2. Rodar lint, typechecks, unitários, integração real, E2E de navegador, segurança, carga e caos. Registrar exit code e contagem de testes, sem inferir verde de um script que usa mocks.
3. Reexecutar fluxos vizinhos: carteira, contratos, gráficos, WS, páginas secundárias e modo convidado, com `NEW_TRADEROOM` desligada e ligada.
4. Verificar manualmente botões Entrar/Criar/Sair, foco/teclado, feedback de falha, reload e troca de conta. Capturar evidência visual quando o layout tiver sido tocado.
5. Conferir no Keycloak persistente, PostgreSQL de vínculo e Blnk o cliente de teste e os valores esperados; apagar somente dados sintéticos do ambiente efêmero após registrar evidência.
6. Consolidar AC-AUTH-01 a AC-AUTH-18 e pareceres independentes; qualquer falha reabre a subetapa que a causou.

## Critérios de aceite

- AC-AUTH-19: Todas as suítes relevantes passam no commit exato, sem regressão nova comparada ao baseline.
- AC-AUTH-20: Cada cenário de usuário possui evidência de UI, resposta HTTP e armazenamento autoritativo coerentes.
- AC-AUTH-21: Nenhum achado alto/crítico permanece aberto; testes de carga/caos e reconciliação estão verdes.

Gate final: somente após os três critérios e AC-AUTH-01 a 18 satisfeitos a feature pode ser chamada de certificada.
