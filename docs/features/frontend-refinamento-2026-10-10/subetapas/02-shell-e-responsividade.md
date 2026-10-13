# Subetapa 02 — Shell, navegação e responsividade
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 01 com todos os critérios obrigatórios PASS.
Objetivo: Manter todas as ações acessíveis em desktop e celular com cabeçalho claro e acabamento institucional.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/components/layout/SecondaryLayout.tsx`
- `apps/web/src/styles/secondary-refinement.css`
- `apps/web/src/components/layout/secondary-refinement.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Escrever regressão browser que falha com botão Criar cuenta terminando em x=911 no viewport390.
2. Adicionar classes locais aos blocos existentes preservando handlers e IDs; resolver header por reflow e navegação rolável acessível.
3. Separar desktop/mobile por CSS explícito; não ocultar controles essenciais para eliminar overflow.
4. Aplicar foco prata, alvo de toque, aria-current e labels de navegação em passo próprio.
5. Reduzir ruído do footer e aumentar legibilidade do aviso sem omitir conteúdo.
6. Validar todas as rotas consumidoras e screenshots off/on; executar 100 alternâncias e 50 navegações.

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
- AC-02-1: todos os botões de conta/idioma visíveis e alcançáveis a390,768,1366,1920.
- AC-02-2: foco e teclado chegam a cada rota sem botão coberto.
- AC-02-3: um callback de depósito por clique; prop onDepositClick preservada.
- AC-02-4: legal legível e sem corte a zoom150%; sala permanece idêntica.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: estilo inline e layout compartilhado.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desligar tema secundário e reaplicar backup apenas do passo.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

