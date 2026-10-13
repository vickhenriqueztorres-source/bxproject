# Subetapa 08 — Torneios e promoções
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 07 com todos os critérios obrigatórios PASS.
Objetivo: Organizar lista, detalhe e condições com destaque proporcional e sem incentivo financeiro artificial.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/TournamentsPage.tsx`
- `apps/web/src/pages/PromotionsPage.tsx`
- `apps/web/src/styles/engagement-refinement.css (novo)`
- `apps/web/src/pages/engagement-pages.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Identificar fontes de status,tempo,prêmios e elegibilidade; dados estáticos recebem indicação demonstrativa.
2. Testar filtros,seleção do detalhe e ações existentes antes de editar.
3. Editar listas e painel selecionado em passos distintos; status textual e metadados compactos.
4. Apresentar condições/restrições sem esconder requisito em hover ou texto pequeno.
5. Preservar callbacks e não aplicar automaticamente bônus ou participação.
6. Testar deadline já expirado,dado ausente,conteúdo extenso,100 trocas de filtro e 20 cliques pending.

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
- AC-08-1: filtro e seleção corretos com estado vazio.
- AC-08-2: prêmios/ganhos fictícios não parecem ganho real do usuário.
- AC-08-3: condições legíveis a390px e zoom150%.
- AC-08-4: nenhum contador/recompensa/urgência decorativa adicionado.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: conteúdo estático e ações locais podem parecer reais.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar CSS e restaurar apresentação/copys,sem mexer em callbacks.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

