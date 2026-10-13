# Subetapa 03 — Login, registro e recuperação
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 02 com todos os critérios obrigatórios PASS.
Objetivo: Formulários simples e confiáveis com contexto discreto, preservando todos os handlers.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/LoginPage.tsx`
- `apps/web/src/pages/RegisterPage.tsx`
- `apps/web/src/pages/PasswordRecoveryPage.tsx`
- `apps/web/src/styles/access-refinement.css (novo)`
- `apps/web/src/pages/auth-pages.unit.test.tsx`
- `apps/web/src/pages/auth-full-lifecycle-e2e.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Mapear inputs, required, submit, validações e loading; tratá-los como trechos protegidos.
2. Testar submit pending, erro e recuperação com fixture frontend. Não testar contas reais ou alterar credenciais.
3. Editar uma página por passo: hierarquia, espaçamento e labels, mantendo um formulário protagonista.
4. No mobile preservar logo e tarefa de acesso; coluna contextual não deve deslocar o formulário.
5. Rever copy de promessa 16ms/pagamento e identificar gráfico demonstrativo em passo de texto separado; não tocar motor do mini-gráfico.
6. Validar senha mascarada, botão Ver, foco e erro sem shake. Recuperação mantém sigilo da existência da conta conforme contrato atual.

## Testes antes de produção
Cada root de Login/Register/Recovery recebe opt-in estável e classe exclusiva via helper secundário de01. Com opt-in ausente ou erro, manter markup/estilos atuais. CSS novo não usa theme-binmax genérica como seletor de reforma. Adicionar helper à lista do passo se precisar de ajuste, com gate próprio.
1. Escrever casos de aceitação abaixo e executar o estado anterior.
2. Reproduzir defeito/ausência de contrato antes de implementar correção.
3. Guardião verifica se o teste reprovaria o comportamento errado; SSR só para renderização.
4. Rodar [T-01 a T-07](../CONTRATO-DE-TESTES.md) aplicáveis com browser para comportamento/layout.
5. Executar suíte frontend completa,types,lint e build sem sobrescrever dist.
6. Registrar logs,medidas,contagens,screenshots e falhas efetivamente injetadas.
7. Revisão independente; se houver FAIL, corrigir o mesmo passo e repetir apenas o que a mudança exige.
8. Uma segunda reprovação não autoriza avanço ou remoção de assertions; restaurar só o patch da execução e registrar bloqueio.

## Critérios mensuráveis próprios
- AC-03-1: payload e chamada AuthService idênticos antes/depois.
- AC-03-2: teclado completa o formulário e erro é perceptível sem cor exclusiva.
- AC-03-3: 20 submits rápidos pending não produzem repetição; se falhar, correção própria antes de avançar.
- AC-03-4: falha/timeout/401 não produz navegação de sucesso nem armazena senha.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Alto por proximidade com auth; cosmética estritamente separada.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar apresentação nova e restaurar atributos/estilos/copys do passo, preservando auth anterior.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

