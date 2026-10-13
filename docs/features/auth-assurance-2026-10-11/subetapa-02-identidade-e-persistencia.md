# Subetapa 02 — identidade e persistência real

Responsáveis: `qa-resilience-agent` (oráculos), `backend-implementation-agent` e `frontend-realtime-agent` (cada qual em seus diretórios), `security-reviewer` e `financial-correctness-reviewer`. Skills: 01, 02, 04, 05, 06, 08, 09, 17.

## Passo a passo

1. Subir Keycloak com banco persistente próprio, PostgreSQL da aplicação e Blnk em projeto Compose descartável com versões fixadas. Identificar rede e volumes do teste; nunca usar dados reais.
2. Escrever testes-oráculo que falhem no sistema atual: API indisponível não cadastra usuário; `localStorage` nunca equivale a usuário Keycloak; carteira não nasce por número fixo no cliente. Teste diagnóstico da rota nativa deve fazer `POST` e `SELECT` real em PostgreSQL para quantificar o legado, sem chamá-lo de certificação D-01.
3. Inventariar identidades `users.id`, contratos por `user_id`, contas e referências Blnk e cadastros existentes só no navegador. Registrar snapshot e reconciliação antes de alterar mapeamento.
4. Validar em Keycloak 26, por execução, se a migração preserva o UUID legado como `sub`. **Diagnóstico 2026-10-11:** a criação via Admin REST em Keycloak 26.0.8 substituiu o UUID informado. Criar ADR e mapa imutável `issuer + sub → legacy_principal_id`, com testes de autorização, carteira e contratos. Nunca usar email como chave de identidade nem importar conta apenas local sem verificar posse do email.
5. Registrar clientes sintéticos pelo fluxo autorizado de Keycloak. Consultar por identificador no armazenamento/API de administração de teste e confirmar unicidade, `sub` estável e ausência de senha nova em PostgreSQL da aplicação.
6. Verificar vínculo de identidade canônica → conta Blnk e saldo demo por leitura direta do Blnk. Repetir provisionamento 2× e N× em paralelo: uma conta, um crédito inicial, nenhuma divergência. Falha Blnk deve retornar estado pendente/503, sem saldo fixo HTTP 200.
   **Achado 2026-10-11:** Blnk real rejeita o adaptador atual em `/accounts` (400); seguir [ADR-AUTH-02](ADR-wallet-onboarding-legacy.md) e manter este passo vermelho até reconciliação e prova positiva.
7. Corrigir apenas os componentes responsáveis, em diffs pequenos: remover sucesso falso local e alinhar fluxo com D-01/D-02. Preservar rotas de compatibilidade sem emitir novo JWT/senha nativa; exigir novo login OIDC para sessões antigas. Não executar a migration `down` 0040 sobre dados existentes.
8. Reexecutar casos felizes, legado, duplicado, concorrente, dependência fora e consulta autoritativa. Rodar typecheck, reconciliação e regressão com flag desligada/ligada quando aplicável.

## Critérios de aceite

- AC-AUTH-04: Dado um email novo, quando cadastro é concluído, então a identidade existe uma vez no Keycloak persistente e o `sub` retornado confere.
- AC-AUTH-05: Dado Keycloak/API indisponível, quando cadastro/login é tentado, então a UI informa falha e não cria sessão válida nem usuário local substituto.
- AC-AUTH-06: Dado cadastro repetido/concorrente, quando provisionamento é reentregue, então Blnk registra exatamente um saldo inicial de 1.000.000 minor e PostgreSQL da aplicação guarda só o vínculo permitido.
- AC-AUTH-07: Dado token inválido ou de outro emissor/audience, quando API é chamada, então responde 401 sem leitura de dados privados.
- AC-AUTH-07A: Dado cliente legado com contratos e carteira, quando a identidade passa ao Keycloak, então o mesmo dono acessa os mesmos recursos sem ganho de acesso por outro `sub`.

Gate: todos os critérios verdes em dependências reais, consulta ao banco/Keycloak/Blnk registrada, revisores aprovam. Sem isso, permanecer aqui.
