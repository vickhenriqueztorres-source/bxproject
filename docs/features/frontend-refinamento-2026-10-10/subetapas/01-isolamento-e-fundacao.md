# Subetapa 01 — Isolamento visual e fundação
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 00 com todos os critérios obrigatórios PASS.
Objetivo: Criar uma porta de apresentação secundária reversível sem alterar tema, dados ou flag da sala.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/components/layout/SecondaryLayout.tsx`
- `apps/web/src/styles/secondary-refinement.css (novo)`
- `apps/web/src/lib/secondary-presentation.ts (novo)`
- `apps/web/src/components/layout/secondary-refinement.unit.test.tsx (novo)`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Ler SecondaryLayout inteiro e todos os consumidores; congelar props, callbacks e marcação original.
2. Escrever testes para tema ausente/desligado/inválido/storage negado e para comparação da árvore original.
3. Implementar opt-in visual secundário em ponto único; decidir antes do primeiro render, sem fonte remota ou nova dependência.
4. Adicionar import CSS com seletores exclusivos do contêiner; zero :root, body, seletor global ou alteração de tokens compartilhados.
5. Declarar aliases locais das superfícies, texto e motion atuais. Não mudar medidas neste passo de cores.
6. Registrar screenshot off idêntico; medir contraste on; guardião/marca aprovam antes de 02.

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
- AC-01-1: off produz a mesma árvore/estilos da base secundária e sala.
- AC-01-2: nenhum seletor/variável novo alcança TerminalLayout/PriceChart.
- AC-01-3: erro de leitura da opção mantém apresentação base e não quebra navegação.
- AC-01-4: texto normal >=4,5:1 nas novas combinações.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: shell compartilhado por 11 rotas.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desligar opção secundária; restaurar patch do import/contêiner e novos arquivos com backup sem tocar flag NEW_TRADEROOM.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

