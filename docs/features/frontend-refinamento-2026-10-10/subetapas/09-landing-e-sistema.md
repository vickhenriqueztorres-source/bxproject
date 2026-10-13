# Subetapa 09 — Landing, manutenção e 404
Estado: BLOQUEADA até a etapa anterior passar.
Pré-condição: relatório 08 com todos os critérios obrigatórios PASS.
Objetivo: Dar uma entrada simples à plataforma com marca oficial e estados de sistema claros.
Agentes: orquestrador prepara; frontend-realtime escreve testes em apps/web; QA escreve somente tests/** e executa evidências; cirurgião executa só o passo; guardião revisa; design/marca/compliance/segurança conforme o conteúdo.

## Arquivos candidatos
- `apps/web/src/i18n/locales/es-ES.json` (somente passo próprio de texto; chaves estáveis e tabela anterior→novo→chave→arquivo)
- `apps/web/src/pages/LandingPage.tsx`
- `apps/web/src/pages/MaintenancePage.tsx`
- `apps/web/src/pages/NotFoundPage.tsx`
- `apps/web/src/styles/public-refinement.css (novo)`
- `apps/web/src/pages/landing-page.unit.test.tsx`
A lista é candidata para a subetapa; cada handoff congela uma lista menor de até5 arquivos e150 linhas de código/testes.
Arquivo inexistente deve ser confirmado antes do handoff; não inventar caminho/API.
Nenhum trecho protegido é autorizado por estar nesta lista.

## Passo a passo
1. Inventariar links/CTAs e consumidores; não alterar /, guest mode ou regras do router.
2. Testar navegação de entrada e recuperação da404 antes de editar.
3. Trocar marca improvisada por SVG oficial existente em public/brand em passo local de marca delimitado; não editar BinmaxLogo compartilhado nem consumidores da sala. Validar variante/tamanho/alt e área de proteção conforme contrato de tokens/marca do plano.
4. Editar hero com uma ação principal e contexto curto; produto real/preview claramente ilustrativo.
5. Editar manutenção e404 em passos separados; horários/previsões somente quando confirmados.
6. Testar fontes/imagens ausentes,teclado,mobile e loop50 vezes de voltar/início; nenhuma ação financeira.

## Testes antes de produção
Landing tem root próprio: aplicar helper secundário de01 e classe exclusiva com opt-in estável, preservando markup/estilos em OFF. Manutenção/404 usam SecondaryLayout. Não usar seletores globais nem tema genérico para alcançar esses roots.
1. Escrever casos de aceitação abaixo e executar o estado anterior.
2. Reproduzir defeito/ausência de contrato antes de implementar correção.
3. Guardião verifica se o teste reprovaria o comportamento errado; SSR só para renderização.
4. Rodar [T-01 a T-07](../CONTRATO-DE-TESTES.md) aplicáveis com browser para comportamento/layout.
5. Executar suíte frontend completa,types,lint e build sem sobrescrever dist.
6. Registrar logs,medidas,contagens,screenshots e falhas efetivamente injetadas.
7. Revisão independente; se houver FAIL, corrigir o mesmo passo e repetir apenas o que a mudança exige.
8. Uma segunda reprovação não autoriza avanço ou remoção de assertions; restaurar só o patch da execução e registrar bloqueio.

## Critérios mensuráveis próprios
- AC-09-1: links mantêm URLs/eventos/IDs; router não muda.
- AC-09-2: logo oficial prata e texto/cabeçalho acessíveis.
- AC-09-3: manutenção não inventa conclusão/latência/previsão.
- AC-09-4: entrada a390px sem conteúdo ouCTA cortado.
Estresse: T-02 e T-06. Caos: T-03. Segurança: T-04. Acessibilidade/visual: T-05. Isolamento/regressão: T-07.
Casos N/A exigem motivo específico; cenário obrigatório não executado mantém gate bloqueado.

## Risco e limites
Médio: landing tem estilos globais e roteamento de entrada indireto.
Fora: backend,ledger,contratos de API,auth/rotas/feed e novas dependências.
Não misturar refactor/lógica com cosmética. Estados realmente ausentes exigem correção causal separada,teste vermelho/verde e autorização de trecho protegido.

## Evidências e checkpoint
Relatório deve conter: resumo,arquivos/passo,diff a partir da base local,comandos+exitcodes,asserções,screenshots off/on,medidas de layout,caos injetado,riscos pendentes,revisões e rollback.
Estados: PENDING → RUNNING → PASS ou FAIL/BLOQUEADO.
**Somente PASS permite próxima subetapa.**

## Como desfazer
Desativar estilo e restaurar somente markup/copys/marca do passo.
Guardar cópia/hash antes do patch. Não usar git reset --hard,git restore amplo ou apagar arquivos do dono.
Não commitar arquivos previamente modificados por outro trabalho junto deste passo.

