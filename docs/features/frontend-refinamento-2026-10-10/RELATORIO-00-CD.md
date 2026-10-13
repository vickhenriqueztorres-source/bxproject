# Relatório00-C/00-D — lint e desempenho

Data10/10/2026. **Configuração aprovada; lint FAIL; benchmark final PASS somente no perfil medido. Gate00global REPROVADO.**

## 00-C — configuração de lint

Arquivo novo `apps/web/eslint.config.mjs`,15linhas, dependências existentes. Presets oficiais `@eslint/js` e `typescript-eslint`; globals browser, node somente nos unitários. Sem regras desligadas manualmente ou arquivos excluídos.

Correção de dois padrões antes da revisão final: com `--config`, a base é o cwd. `src/**` não cobria a execução pela raiz; padrões finais `apps/web/src/**` cobrem os arquivos pretendidos. `calculateConfigForFile` confirmou produção e testes, com node somente no teste. Selfprobe browser válido teve0mensagens; código com any/unused teve2erros nas regras previstas.

Comando FINAL em `D:/brokerproject`:
`pnpm exec eslint apps/web/src --config apps/web/eslint.config.mjs --no-cache --format json --output-file docs/features/frontend-refinamento-2026-10-10/evidencias/lint-00C.json`

Exit1.208arquivos examinados,79comerro,172erros,0warning/0fatal.106no-explicit-any,65no-unused-vars,1prefer-const.98erros em44arquivos de teste;74em35arquivos de produção. Imports não utilizados no modal/tokens já existiam nos backups; não são novas violações das correções.

- [JSON completo](evidencias/lint-00C.json)
- [Inventário resumido](evidencias/lint-00C-resumo.json)

Guardião revisou configuração e JSON independentemente. Configuração válida não torna o lint aprovado. Nenhuma violação legada foi corrigida ou escondida neste passo. Typecheck atual exclui testes: não declarar cobertura de tipos dos unitários.

## 00-D — dez amostras e matemática

Arquivo novo `tests/unit/frontend-design-benchmark.unit.test.ts`,68linhas. Um warmup;10gerações BTCUSD_OTC×2880velas. Relógio fixo; performance real. Cada geração mantém limite estrito<45ms. Toda vela valida OHLC finito/positivo, extremos, volume inteiro positivo e timestamps contíguos de60s. Nenhuma produção alterada.

Comando: `pnpm exec vitest run tests/unit/frontend-design-benchmark.unit.test.ts --maxWorkers 1 --no-file-parallelism --configLoader runner --no-cache --reporter verbose`.

Máquina: Windowsx64,Node22.17.0,V8 12.4.254.21-node.26,Intel i5-4460@3.20GHz,4CPUs lógicas,17.097.854.976bytes RAM.

| Execução | Amostras ms | Resultado |
|---|---|---|
| Primeira,ambiente sob pressão |110.1665,87.2143,122.9940,25.0791,59.1540,24.9447,12.6902,48.9972,81.8592,41.7039|6/10FAIL;mediana54.0756,p95122.9940|
| Revisão da ordem matemática,execução independente |7.2858,6.2213,6.7583,5.6339,4.2013,3.7643,3.5677,3.8350,3.6883,8.3734|Latências dentro45ms;testeFAIL pelo overhead de assertions,9.228s>timeout5s|
| Revisão final,sem concorrência |8.8864,5.5465,6.4121,3.9790,3.8653,5.7749,3.9016,5.8838,3.7023,3.6615|PASS exit0;mediana4.76275,p958.8864;1teste143ms,total973ms|

A revisão final substituiu centenas de milhares de chamadas `expect` por predicados equivalentes em CADA uma das28.800velas e uma assertion agregada com amostra/índice do primeiro erro. Não reduziu dados, limite ou cobertura e não ampliou timeout. Zero erro matemático. Guardião revisou essa equivalência. As execuções vermelhas foram preservadas; não houve retry automático para esconder falha.

PASS comprova o perfil sem concorrência medido; não comprova saturação, rendering de browser ou estabilidade universal. O benchmark original HE-04 não foi editado. Suíte frontend existente:528/528PASS na execução independente anterior; benchmark adicional:1/1PASS em execução separada. Não afirmar529testes em uma mesma execução.

## Decisão e próxima ação

As violações de lint e as falhas de UX da base mantêm gate00fechado. O saneamento inclui auth/API/feed/gráfico/ticket; foi autorizado pelo usuário ao pedir "continue" após a pergunta específica da [proposta00-E](PROPOSTA-00-E-SANEAMENTO.md). A execução segue por lote e não libera redesign.

Rollback destes passos remove somente os dois arquivos novos se necessário, preservando evidências e todos os arquivos do dono. Não usar reset/restore amplo.

## Checkpoint após mudança concorrente

O módulo i18n/index.tsx e o dicionário espanhol foram modificados por outro trabalho após as provas acima; modal permanece com hashD7A6F25D59FB594A8E804BAC90A619D26EC98DA65C76E3B56C6E337A35AE8E49. Não revertemos traduções novas. As mensagens demo atuais mantêm a informação de não enviar fundos/confirmar transferência.

Suíte frontend reexecutada:528/528PASS,104arquivos; JSON em evidencias/vitest-concorrencia.json. Typecheck encontrou3exports ausentes nas declarações compiladas de@broker/shared; a fonte já exportava as funções. `pnpm --filter @broker/shared build` recompilou a dependência local sem editar sua fonte; typecheckfrontend passou depois. Buildfrontendisolado PASS214módulos20,02s,chunk979,66kB,saída scratch/frontend-checkpoint-final-build.

Lintatual pela raiz FAIL178erros em79arquivos/210examinados:111any,66unused,1prefer-const; i18n passou de2para8erros. Evidência evidencias/lint-concorrencia.json; a fotografia172 anterior permanece preservada. Base combinadafrontend+benchmark em verificação antes00-E-01.
