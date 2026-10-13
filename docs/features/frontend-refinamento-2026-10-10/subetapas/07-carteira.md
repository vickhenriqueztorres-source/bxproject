# Subetapa 07 — Depósito, retirada e erro de pagamento
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 06 com todos os critérios obrigatórios PASS.
Objetivo: Melhorar leitura e confiança do fluxo financeiro sem alterar valores, cálculo ou submissão.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/wallet/BinmaxDepositModal.tsx`
- `apps/web/src/wallet/BinmaxWithdrawModal.tsx`
- `apps/web/src/styles/wallet-refinement.css (novo)`
- `apps/web/src/wallet/binmax-wallet.unit.test.tsx`
- `apps/web/src/wallet/wallet-precision-stress.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Gate00 precisa resolver contrato do saque; ler modais inteiros e referências de pagamento antes de editar.
2. Congelar handlers,métodos,mínimos,parse,payload,loading e callbacks; calcular nada novo no browser.
3. Escrever testes com balance recebido,zero,indisponível,valor inválido,pending e falha.
4. Editar método,monto,resumo em passos independentes: condições próximas da ação,seleção prata.
5. Editar apenas aparência de pending/erro/confirmado existentes; nunca gerar QR/status/pagamento fictício.
6. Executar 20 cliques rápidos com adapter controlado,interrupção e retorno: um efeito solicitado,não um pagamento externo.

## Testes antes de produção
Os modais da carteira precisam escopo e opt-in próprios, pois têm root separado do conteúdo da página. OFF mantém estilo/markup atuais e callback existente. Usar helper secundário de01 sem mudar NEW_TRADEROOM; validar modal aberto tanto pela página secundária quanto pela sala principal.
1. Escrever casos de aceitação abaixo e executar o estado anterior.
2. Reproduzir defeito/ausência de contrato antes de implementar correção.
3. Guardião verifica se o teste reprovaria o comportamento errado; SSR só para renderização.
4. Rodar [T-01 a T-07](../CONTRATO-DE-TESTES.md) aplicáveis com browser para comportamento/layout.
5. Executar suíte frontend completa,types,lint e build sem sobrescrever dist.
6. Registrar logs,medidas,contagens,screenshots e falhas efetivamente injetadas.
7. Revisão independente; se houver FAIL, corrigir o mesmo passo e repetir apenas o que a mudança exige.
8. Uma segunda reprovação não autoriza avanço ou remoção de assertions; restaurar só o patch da execução e registrar bloqueio.

## Critérios mensuráveis próprios
- AC-07-1: cada valor exibido é o recebido/formatação existente; nenhum fallback inventado.
- AC-07-2: props,onClose,submit,disabled e dados para o adapter ficam iguais.
- AC-07-3: pendente/erro não anunciam pagamento confirmado.
- AC-07-4: método/condição KYC/estado de retirada correspondem ao contrato validado.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Alto: mesmo alteração visual deve preservar travas e valores.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar estilo novo e restaurar apresentação; nenhum rollback de ledger/serviço.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

