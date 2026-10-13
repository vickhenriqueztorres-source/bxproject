# Subetapa 10 — Certificação cruzada e rollback
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 09 com todos os critérios obrigatórios PASS.
Objetivo: Provar todas as etapas sem regressão e documentar limites antes de qualquer publicação.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `docs/features/frontend-refinamento-2026-10-10/relatorios/ (novos)`
- `docs/features/frontend-refinamento-2026-10-10/evidencias/ (novas capturas)`
- `apps/web/src/**/*.test.{ts,tsx} (somente lista congelada de testes afetados)`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Verificar todos os relatórios00–09; qualquer pendência/FAIL impede este gate.
2. Executar suíte completa sem retries,tipos,lint e build isolado; comparar contagens com o contrato congelado.
3. Executar matriz browser em todas as rotas afetadas,quatro viewports,teclado,zoom e reduced motion.
4. Executar estresse/caos de T-02/T-03 com falha comprovada e recuperação; revisar segurança frontend e origem de estados.
5. Comparar sala principal antes/depois em ambos estados existentes da flag; conferir geometria IQ onde houver referência adequada.
6. Testar rollback da apresentação em ambiente local descartável e comprovar volta à base.
7. Registrar hashes,screenshots,logs,veto/aprovação independente e limites. Publicação não faz parte desta autorização.

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
- AC-10-1: todos os critérios obrigatórios00–09 PASS com evidência.
- AC-10-2: zero teste removido,skip,config relaxada ou flake não resolvido.
- AC-10-3: desligar visual novo restaura base sem perder estado funcional.
- AC-10-4: nenhuma modificação backend/auth/feed/ledger/infra e nenhum segredo nos artefatos.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: falsa certificação por evidência incompleta.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desligar apresentação e aplicar backups somente desta execução; não resetar checkout compartilhado.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

