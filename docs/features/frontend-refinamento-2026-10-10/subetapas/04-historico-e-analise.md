# Subetapa 04 — Histórico e análise
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 03 com todos os critérios obrigatórios PASS.
Objetivo: Tornar dados e filtros compreensíveis sem fabricar resultado pessoal.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/HistoryPage.tsx`
- `apps/web/src/pages/AnalysisPage.tsx`
- `apps/web/src/styles/results-refinement.css (novo)`
- `apps/web/src/pages/history-portfolio.unit.test.tsx`
- `apps/web/src/pages/engagement-pages.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Bloquear execução se mistura de amostras/contratos API não estiver triada; não alterar consulta/calculadores no passo visual.
2. Testar filtros, ordenação, perdas negativas, zero e dados indisponíveis antes da mudança.
3. Simplificar título e resumo; consolidar metadados numa régua, alinhar dinheiro/tempo tabular.
4. Editar tabela e análise em passos distintos; tabela rola localmente; grades usam mínimos que cabem no viewport.
5. Distinguir exemplos de dados pessoais sem inventar integração; termos auditado/comprobado exigem evidência.
6. Preservar exportação e sanitização; executar lote de1.000 linhas com strings hostis, CSV e filtros reais no harness.

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
- AC-04-1: seleção de período/resultado/ativo conserva resultado e valores da base autorizada.
- AC-04-2: quantidade e identidade dos contratos não mudam no passo visual.
- AC-04-3: sinais de perda e zero do gráfico legíveis, sem ganho inventado.
- AC-04-4: CSV não cria fórmula executável a partir de input hostil; falha vira correção separada.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Alto: histórico tem origem e cálculos misturados à UI.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Restaurar só a apresentação do passo e desativar estilo local.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

