# Subetapa 00 — Base, recuperação e rede de segurança
Estado: BLOQUEADA — diagnóstico executado; recuperação00-A e correção autorizada00-B aprovadas. Lint e demais critérios globais ainda pendentes.
Pré-condição: autorização já dada pelo usuário para diagnóstico/frontend; nenhuma edição de produção durante baseline.
Objetivo: Comprovar a base e corrigir somente causas explicitamente delimitadas antes de qualquer reforma visual.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/components/layout/SecondaryLayout.unit.test.tsx`
- `apps/web/src/pages/auth-precision-stress.unit.test.tsx`
- `apps/web/src/pages/verification-precision-stress.unit.test.tsx`
- `apps/web/src/styles/tokens-precision.unit.test.ts`
- `apps/web/src/wallet/binmax-wallet.unit.test.tsx`
- `apps/web/src/trade/history-expansion.unit.test.ts`
- `apps/web/eslint.config.mjs (novo; passo próprio de configuração de testes/lint)`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Registrar SHA, branch, estado sujo, hashes e cópias dos arquivos que serão tocados. Não restaurar do HEAD uma base com alterações locais.
2. Executar a suíte frontend completa, tipos, lint e build isolado; capturar telas existentes. Diagnóstico executado: ver RELATORIO-00.md.
3. Separar contratos obsoletos de defeitos reais. Congelar paleta e copy aprovadas antes de alinhar testes; manter assertions de risco, navegação e comportamento.
4. Reproduzir o fluxo de retirada e decidir contrato de KYC/métodos/último retiro. Não eliminar assertions nem reintroduzir dados financeiros fictícios para satisfazê-las. Abrir passo causal protegido separado se exigir mudança funcional.
5. Corrigir o mecanismo do benchmark HE-04 em perfil controlado preservando correção matemática; não aumentar o limite para esconder instabilidade.
6. Preparar lint exclusivamente frontend em apps/web/eslint.config.mjs, usando versões já instaladas e comando --config explícito. Esse é um passo próprio, com regras congeladas e baseline de violações; não desativar regras nem declarar dívida como PASS. Preparar testes de comportamento browser sem acrescentar dependências silenciosamente.
7. Executar T-01 a T-07 da base e revisão independente. Só liberar 01 com zero falha obrigatória.

## Testes antes de produção
Contrato baseline00-A congelado somente para teste do comportamento atual (não certifica honestidade das demais informações):
| Texto anterior esperado pelo teste | Texto atual exato | Proteção mantida |
|---|---|---|
| Crear cuenta gratis | Crear cuenta | CTA de cadastro junto de Iniciar sesión,marca econteúdo |
| El trading de opciones binarias conlleva un alto nivel de riesgo | Los contratos de índices sintéticos y derivados implican un riesgo sustancial de pérdida de capital y no son adecuados para todos los perfiles. | Heading Advertencia de riesgo,links legais e texto completo |
Também exigir texto atual exato: Los rendimientos simulados o pasados no constituyen garantía de rentabilidad futura.
Este passo não altera copy de produção nem afirma que16ms ou saldo de fallback são verdadeiros. Copy nova de produto será i18n em passo posterior.
1. Escrever casos de aceitação abaixo e executar o estado anterior.
2. Reproduzir defeito/ausência de contrato antes de implementar correção.
3. Guardião verifica se o teste reprovaria o comportamento errado; SSR só para renderização.
4. Rodar [T-01 a T-07](../CONTRATO-DE-TESTES.md) aplicáveis com browser para comportamento/layout.
5. Executar suíte frontend completa,types,lint e build sem sobrescrever dist.
6. Registrar logs,medidas,contagens,screenshots e falhas efetivamente injetadas.
7. Revisão independente; se houver FAIL, corrigir o mesmo passo e repetir apenas o que a mudança exige.
8. Uma segunda reprovação não autoriza avanço ou remoção de assertions; restaurar só o patch da execução e registrar bloqueio.

## Critérios mensuráveis próprios
- AC-00-1: todos os 526 testes atuais passam após causa comprovada; nenhuma retirada/skip para pintar verde. O número de assertions não foi contado.
- AC-00-2: benchmark controlado reproduzível em 10 amostras; limites e hardware registrados.
- AC-00-3: lint executa e reporta zero erro no escopo frontend, com configuração versionada e sem desativar regras.
- AC-00-4: screenshots e controles principais identificados nos quatro viewports; base legada e nova capturadas.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Alto no fluxo de retirada e contratos de testes; a auditoria em si é leitura.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Restaurar somente arquivos do passo a partir das cópias desta execução. Nunca git restore amplo: removeria trabalho anterior.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

