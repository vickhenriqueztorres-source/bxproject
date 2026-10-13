# Relatório 00-E-01A — declarações e bindings

Estado: PASS apenas deste lote, aprovado pelo regression-guardian-agent. Gate 00 global e reforma visual continuam bloqueados. Autorização: resposta humana “continue” após a pergunta específica sobre PROPOSTA-00-E-SANEAMENTO.md.

## Alteração

Quatro arquivos, +14/-9 = 23 linhas, comparados com a cópia imediatamente anterior em scratch/frontend-refinamento-2026-10-10-00E01/base:

- App.tsx: remover bindings sem uso, preservando chamadas e ordem de hooks, argumentos e avaliação da ternária.
- api/client.ts: declaração ambiental local apagada na emissão; remover casts any sem mudar condição de logging; u2 vira const, u1 permanece mutável.
- api/client-cache-invalidation.unit.test.ts: preservar chamada e remover só binding sem uso.
- auth/auth-service.unit.test.ts: contrato ambiental local do mock, mantendo branches e atribuições.

AuthService de produção, CSS, flags e backend não foram editados neste lote. Patch, hashes, emissão e estatística: scratch/frontend-refinamento-2026-10-10-00E01/. Rollback deve desfazer somente esse patch após conferir mudanças concorrentes; nunca restaurar o arquivo inteiro de um backup antigo.

## Validação executada

| Verificação | Resultado | Evidência |
|---|---|---|
| Lint dos quatro arquivos, antes/depois | 11 erros → 0, zero warnings | before-lint.json / after-lint.json no diretório do lote |
| Testes dirigidos, antes/depois | 26/26 em ambas as execuções | before-directed.log / after-directed.log |
| Typecheck produção | PASS | after-production-types.log |
| Typecheck explícito do teste auth, cwd apps/web | PASS; log vazio na execução final | after-auth-test-types-cwd-fixed.log; tentativas de argumentos/resolução anteriores preservadas |
| Emissão e inspeção de chamadas | declarações apagadas; chamadas/argumentos preservados | runtime-emit-proof.json e emit/ |
| Build isolado | PASS, 214 módulos, 15,28 s | saída do comando; scratch/frontend-00E01A-build |
| Suíte frontend + benchmark após patch | 105 arquivos, 529/529 PASS, zero pendentes | evidencias/vitest-pos-00E01A.json |
| Browser 1366×768 | geometria dos quatro elementos idêntica | evidencias/00E01-geometria-antes.json / 00E01-geometria-depois.json; 00E01-sala-antes.png / 00E01-sala-depois.png |
| Revisão independente | APROVADO somente 00-E-01A | resposta do guardião nesta conversa, leitura do diff e evidências, sem alterações |

Comandos a partir de D:/brokerproject:

```powershell
pnpm exec vitest run apps/web tests/unit/frontend-design-benchmark.unit.test.ts --maxWorkers 1 --no-file-parallelism --configLoader runner --no-cache --reporter json --outputFile docs/features/frontend-refinamento-2026-10-10/evidencias/vitest-pos-00E01A.json
pnpm exec eslint apps/web/src --config apps/web/eslint.config.mjs --no-cache --format json --output-file docs/features/frontend-refinamento-2026-10-10/evidencias/lint-pos-00E01A.json
```

A suíte saiu com código 0. O lint integral retorna 1: 190 erros em 76 arquivos, 212 examinados. Os quatro arquivos do lote continuam sem erros. Desde o checkpoint 178, foram corrigidos 11 neste lote, enquanto trabalho concorrente adicionou 9 em i18n/index.tsx e 14 no novo language-selector-persistence.unit.test.tsx. Novo LanguageSelectorDropdown.tsx sem erros. Não revertemos essas alterações. Nenhuma regra desligada, assertion retirada ou limite elevado.

## Limites e próxima etapa

A base combinada pré-patch teve 527/529 PASS e duas reprovações de tempo SSR, preservadas em vitest-pre-00E.json. A execução pós-patch ocorreu com navegador e servidor de desenvolvimento encerrados e sem outro teste simultâneo. O verde desse perfil não certifica estabilidade sob saturação nem apaga as reprovações anteriores.

No browser, o feed estava reconectando e os botões operacionais pausados por staleness. Não houve clique financeiro; a comparação certifica geometria, não operação ou disponibilidade dos serviços. Testes e revisão frontend não certificam IAM, ledger ou pagamentos.

00-E-01B separa os três catches de produção: removê-los de any requer decisão de runtime. Um novo oráculo foi executado depois da suíte acima: 66 casos, 50 FAIL malformados e 16 PASS de preservação. Ele não integra os 529 testes aprovados; a nova combinação permanece vermelha até correção autorizada e validada. Não avançar para 00-E-02 enquanto o lote 01 estiver incompleto.

## Checkpoint adicional de idiomas

As alterações concorrentes acrescentaram cinco testes. Verificação após a descoberta: 106 arquivos e 534/534 PASS em evidencias/vitest-checkpoint-idiomas-00E01A.json; typecheck produção exit 0. Build pelo executável do workspace @broker/web (Vite 6.4.4): 215 módulos, 14,10 s, saída scratch/frontend-00E01A-idiomas-vite6-build. Uma execução anterior pelo executável da raiz usou Vite 7.3.7; também passou, mas não substitui a prova com a versão do frontend. Nenhuma dependência alterada.

O oráculo auth foi ampliado depois desse checkpoint para incluir zero escritas, armazenamento vazio e sessão anterior. Seu resultado é evidência separada, fora dos 534 testes aprovados. A revisão de segurança identifica dívida anterior de token em localStorage; não foi corrigida nem certificada por este lote de declarações.

Atualização: o vermelho real preservado é o oráculo original de 66 casos. Antes da execução ampliada, AuthService recebeu três guards fora do lote, autoria não determinada. O oráculo ampliado resultou em 256/256 PASS sobre esse código concorrente. Não atribuir essa correção ao lote 01A nem considerar sua incorporação autorizada por suposição. A [proposta 01B](PROPOSTA-00-E-01B-AUTH.md) documenta snapshot, resultado e limites; produção não foi revertida.
