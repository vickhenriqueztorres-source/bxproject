# Subetapa 06 — Conta, ajustes e verificação
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 05 com todos os critérios obrigatórios PASS.
Objetivo: Apresentar uma seção/tarefa de cada vez, com requisitos e estados seguros claramente identificados.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/SettingsPage.tsx`
- `apps/web/src/pages/VerificationPage.tsx`
- `apps/web/src/styles/account-refinement.css (novo)`
- `apps/web/src/pages/verification-settings.unit.test.tsx`
- `apps/web/src/pages/verification-precision-stress.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Triar 2FA/sessões locais e upload por timer: bloquear certificação de funcionalidade real enquanto não houver confirmação.
2. Congelar activeSection, handlers e validação de upload; nenhum arquivo/documento real usado em testes.
3. Editar ajustes em passos por seção; navegação reflow no mobile; manter campos e ações existentes.
4. Editar verificação em passos por estado; requisitos ao lado do campo/dropzone, ajuda secundária legível.
5. Testar arquivo vazio,grande,extensão/MIME divergentes,storage negado e pending interrompido usando fixtures locais.
6. Revisar estados vazio/loading/erro/confirmado: aparência não pode garantir verificação/2FA sem servidor.

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
- AC-06-1: layout não altera activeSection, valores, validações ou requests.
- AC-06-2: mensagens de erro/arquivo ficam visíveis no mobile e teclado.
- AC-06-3: nenhum timer gera aprovação real nem remoção local é anunciada como revogação confirmada.
- AC-06-4: payload sensível não vai para log/URL/screenshot.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Alto: handlers KYC/segurança protegidos.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar apresentação e restaurar só trechos autorizados; não tocar estado/serviço protegido.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

