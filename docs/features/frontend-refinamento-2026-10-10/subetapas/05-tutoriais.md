# Subetapa 05 — Tutoriais e aprendizado
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 04 com todos os critérios obrigatórios PASS.
Objetivo: Priorizar conteúdo e habilidade aprendida, com filtros discretos e player honesto.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/TutorialsPage.tsx`
- `apps/web/src/styles/tutorials-refinement.css (novo)`
- `apps/web/src/pages/engagement-pages.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Inventariar mídia disponível: não baixar/improvisar capa externa ou inventar conteúdo.
2. Testar busca, categoria, vazio e seleção antes de editar.
3. Usar destaque16:9 e lista editorial com título/duração/nível; evitar card para cada metadado.
4. Simplificar linguagem técnica mantendo fatos e material existentes.
5. Testar modal e mídia. Se não houver vídeo, declarar indisponibilidade sem falso reproduzindo; correção funcional em passo separado.
6. Executar 100 filtros,50 ciclos de diálogo e falha de mídia; preservar navegação e foco.

## Testes antes de produção
1. Escrever casos de aceitação abaixo e executar o estado anterior.
2. Reproduzir defeito/ausência de contrato antes de implementar correção.
3. Guardião verifica se o teste reprovaria o comportamento errado; SSR só para renderização.
4. Rodar [T-01 a T-07](../CONTRATO-DE-TESTES.md) aplicáveis com browser para comportamento/layout.
5. Executar suíte frontend completa,types,lint e build sem sobrescrever dist.
6. Registrar logs,medidas,contagens,screenshots e falhas efetivamente injetadas.
7. Revisão independente; se houver FAIL, corrigir o mesmo passo e repetir apenas o que a mudança exige.
8. Uma segunda reprovação não autoriza avanço ou remoção de assertions; restaurar só o patch da execução e registrar bloqueio.

## Critérios mensuráveis próprios
- AC-05-1: busca e categorias mantêm conteúdo correto e empty explícito.
- AC-05-2: modal tem nome/foco/Escape/restauração e não aprisiona navegação.
- AC-05-3: sem mídia não exibe falsa confirmação de reprodução.
- AC-05-4: erro de capa/player não esconde título ou próxima ação.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: estado do modal/player misturado à apresentação.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar CSS e restaurar markup local sem alterar coleção de aulas.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

