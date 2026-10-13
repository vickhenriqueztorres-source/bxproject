# Subetapa 01 — inventário e linha de base

## Passo a passo

1. Congelar `git status --short` e registrar arquivos preexistentes alterados, sem restaurá-los.
2. Rastrear cada botão `Entrar`, `Criar conta` e `Sair` até handler, serviço, rota, consulta e fonte da carteira; anotar `arquivo:linha`.
3. Identificar fluxos paralelos Keycloak, autenticação nativa e fallback local; marcar onde cada um pode declarar sucesso.
4. Classificar testes como unitário com mock, integração real ou navegador real. Verificar se o teste chamado E2E realmente toca banco.
5. Rodar testes atuais de auth, testes da API e typecheck sem emitir build. Registrar falhas preexistentes.
6. Verificar disponibilidade de Docker e ambiente efêmero. Não conectar nem injetar falhas em produção.
7. Revisores de segurança e financeiro conferem D-01/D-02, S-01 a S-06 e I-01; orquestrador consolida.

## Critérios de aceite

- AC-AUTH-01: Dado o código atual, quando o mapa é auditado, então cada resultado de cadastro/login/logout identifica armazenamento autoritativo e se a UI pode divergir dele.
- AC-AUTH-02: Dado o baseline, quando os comandos são executados, então saída, contagem e exit code são registrados sem chamar mock de integração.
- AC-AUTH-03: Dado o workspace com mudanças prévias, quando se compara o diff, então nenhum arquivo preexistente é restaurado ou sobrescrito nesta etapa.

Gate: documentação e evidência completas. Achados de produto seguem como defeitos para a subetapa 02; esta etapa não aprova a feature.
