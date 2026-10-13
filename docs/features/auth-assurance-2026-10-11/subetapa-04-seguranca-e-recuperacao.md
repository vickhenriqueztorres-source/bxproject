# Subetapa 04 — segurança e recuperação

Responsáveis: `qa-resilience-agent` (testes), `security-reviewer` (veto) e implementador proprietário do arquivo. Skills: 01, 04, 05, 06, 08, 09, 17.

## Passo a passo

1. Testar tokens ausentes, expirados, assinatura falsa, `alg` diferente, `iss` diferente, `aud` diferente, `sub` ausente e token de ID usado como access token. Todos devem falhar fechados.
2. Testar PKCE S256, URIs de retorno exatas, roles USER/ADMIN/AUDITOR e MFA nas rotas admin. Verificar proteção contra enumeração e força bruta no Keycloak real.
3. Enviar IDs de outro usuário e campos proibidos (`user_id`, `balance`, `role`, `status`) para rotas relevantes; esperar 404/400 e estado do banco inalterado.
4. Testar recuperação pelo mecanismo Keycloak: pedido não revela existência, token expira, uso único, senha antiga falha e nova autentica. Resposta HTTP nunca inclui token de recuperação.
5. Revisar `git ls-files`, Compose, variáveis `VITE_*`, bundles e logs sem imprimir valores de segredo; abrir achado de rotação se houver exposição.
6. Corrigir cada falha mínima na camada dona e executar teste vermelho/verde, typecheck e regressão.

## Critérios de aceite

- AC-AUTH-12: Dado cada token inválido, quando API/WebSocket recebem a credencial, então recusam acesso sem consultar recursos privados.
- AC-AUTH-13: Dado usuário B, quando consulta recurso de A, então resposta é 404 indistinguível do ID inexistente.
- AC-AUTH-14: Dado corpo com campo privilegiado, quando é enviado, então responde 400 e não altera banco/Blnk.
- AC-AUTH-15: Dado recuperação, quando token é usado/reusado/expira, então somente o primeiro uso válido muda a credencial; token não aparece na resposta pública.

Gate: S-01 a S-06 com evidência e parecer `APROVADO`, sem achado alto/crítico em aberto.
