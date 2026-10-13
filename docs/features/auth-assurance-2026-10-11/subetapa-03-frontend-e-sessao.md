# Subetapa 03 — telas, botões e sessão

Responsáveis: `frontend-realtime-agent` em `apps/web/**`, `qa-resilience-agent` em `tests/**`, `security-reviewer` e `regression-guardian-agent`. Skills: 01, 04, 06, 09, 17.

## Passo a passo

1. Criar testes de componente que cliquem nas abas Entrar/Criar conta, preencham os formulários, disparem erro e confirmem bloqueio de duplo envio.
2. Criar E2E de navegador com Keycloak e API reais: cadastro, confirmação persistente, saída, nova entrada, recarga, expiração e renovação da sessão.
3. Provar que `/callback` conclui PKCE e volta ao destino correto, sem token em URL, `localStorage` ou log.
4. Corrigir o roteamento e os handlers para que o usuário autenticado permaneça autenticado; modo convidado deve ser escolha explícita e só usar dados simulados quando indicado.
5. Acionar cada botão Sair (cabeçalho compacto, cabeçalho amplo e menus) e confirmar limpeza de estado privado, sessão no provedor e retorno à tela de entrada.
6. Confirmar que novo usuário vê sua própria identidade e carteira Blnk; recarregar, abrir outra aba e tentar outro usuário no mesmo navegador.
7. Rodar testes de UI, typecheck, revisão de acessibilidade básica e regressão visual da sala com a flag desligada e ligada.

## Critérios de aceite

- AC-AUTH-08: Dado cadastro válido, quando o botão é acionado uma vez ou duas rapidamente, então ocorre no máximo um cadastro e a tela só avança após confirmação do servidor.
- AC-AUTH-09: Dado usuário autenticado, quando qualquer botão Sair é acionado, então requisição privada subsequente falha com 401 e o navegador não reaproveita identidade anterior.
- AC-AUTH-10: Dado usuário A e depois B, quando a sessão troca, então perfil e carteira mostrados pertencem somente ao `sub` ativo, inclusive após recarga.
- AC-AUTH-11: Dado usuário convidado, quando a sala abre, então a UI declara modo demo e nunca o apresenta como conta persistida.

Gate: E2E real e testes de componente verdes, identidade/carteira consultadas no servidor, nenhum vazamento entre sessões.
