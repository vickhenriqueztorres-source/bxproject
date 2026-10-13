# Relatório 00 — baseline frontend
Data:10/10/2026. Veredito:**REPROVADO — NÃO AVANÇAR**.
A auditoria inicial abaixo ocorreu antes de qualquer edição. Depois dela, a recuperação00-A alterou quatro testes e a correção00-B, autorizada separadamente, alterou modal de retirada demo, tradução e dois testes. Não houve mudança de backend ou dependências. Os resultados da baseline permanecem preservados como evidência histórica.
Arquivos novos: documentação, fixture browser local e capturas. Builds separados em scratch.

## Validação executada
| Verificação | Resultado |
|---|---|
| Typecheck frontend: pnpm exec tsc -p apps/web/tsconfig.json --noEmit --incremental false | PASS,exit0 |
| Vitest frontend,execução inicial | FAIL,104 arquivos:99 PASS/5 FAIL;526 testes:518 PASS/8 FAIL;30,90s |
| Vitest confirmação com relatório JSON em memória | FAIL,517/526 PASS,9 FAIL; apareceu flake HE-04 |
| ESLint frontend | BLOQUEADO:ESLint9 não encontra eslint.config.*;exit1 |
| Vite build isolado | PASS,184 módulos,21,35s;warning chunk960,25kB |
| Browser Análisis390×844 | FAIL:navegação/conta cortadas;Criar cuenta termina x911,14 |
| Browser Análisis1366×768 e Login1366×768 | Capturas feitas,sem certificação funcional |
O guardião usou cache desativado/configLoader runner para leitura sem geração de config bundled.
Não contar tentativa --dir apps/web como suíte: esse comando não encontrou testes e foi corrigido com filtro posicional.
Build não sobrescreveu apps/web/dist; saída:scratch/frontend-design-audit-build.

## Falhas constantes existentes antes das edições
- auth-precision-stress.unit.test.tsx:assertion de superfície#121721 diverge do token atual#101622.
- verification-precision-stress.unit.test.tsx:mesmo contrato cromático obsoleto.
- tokens-precision.unit.test.ts:3 falhas,superfícies,verde e assertion de keyframes shake;contradiz diretriz sem tremor.
- SecondaryLayout.unit.test.tsx:2 falhas,CTA Crear cuenta gratis e frase de risco antigas.
- wallet/binmax-wallet.unit.test.tsx:3.3 espera Transferencia e contrato de KYC/último retiro;triagem funcional necessária.
HE-04(history-expansion.unit.test.ts) falhou somente na confirmação:52,77ms para limite<45ms. Não elevar limiar nem fazer retry até verde.

## Separação de causas
Tokens/copy precisam contrato congelado, não edição cega de testes.
Retirada exige reprodução dos métodos,aviso KYC e estado anterior;renomear a assertion Transferencia para Banco não prova os requisitos restantes.
Benchmark precisa ambiente/repetições controlados;atual amostra isolada é instável.
Lint precisa configuração frontend verificável,sem desativar regras.
Estado ilustrativo de KYC/2FA/histórico é débito preexistente registrado em DIAGNOSTICO.md.

## O que não foi validado
Caos browser com injeção real de rede,estresse de interação,medição performance controlada,zoom150%,teclado em todas as telas,isolamento on/off,segurança de payloads e fluxos financeiros reais.
Nenhuma prova de Blnk/JWT/serviços,fora do pedido.
Nenhuma aprovação visual final da sala.
SSR repetido não é prova destes itens.

## Decisão dos agentes
Mapeador:frontend localizado,estilos individuais e áreas protegidas inventariadas.
Diretor visual:reforma deve melhorar clareza/contraste/hierarquia e honestidade;veto à certificação atual.
Guardião:base reprovada;proibido pintar verde removendo assertions.
Orquestrador:gate00 FAIL,etapas seguintes não iniciadas em respeito à regra do usuário.
Revisão de risco do plano:APROVADO como plano,sem certificar sistema ou liberar gate00.
Guardião:APROVADO após corrigir responsabilidades,opt-in,comandos e lint. RevisãoIQ:APROVADO exclusivamente escopo,preservando sala e exigindo capturas comparáveis. Marca:contrato de precedência/fontes/tokens/logo local aceito em rerevisão; caminho real de tradução corrigido para i18n/locales/es-ES.json. Não declarar aprovação de produto com base nessas revisões.

## Capturas
- [Análisis390](evidencias/antes-analisis-390.png)
- [Análisis1366](evidencias/antes-analisis-1366.png)
- [Login1366](evidencias/antes-login-1366.png)

## Próximo passo e rollback
Recuperação da base conforme00-base-e-recuperacao.md precede qualquer CSS novo.
Patch00-B de produto limitado a BinmaxWithdrawModal.tsx e i18n/locales/es-ES.json; backups locais preservados. Não apagar/restaurar trabalho anterior.
Dev temporário desta auditoria deve ser encerrado ao final;build scratch e documentação identificados.

## Recuperação executada após baseline
00-A: 18/18 testes focados, revisão independente PASS; 49 linhas em quatro testes, sem produção.
00-B: [relatório](RELATORIO-00-B.md), revisão funcional/compliance PASS; suíte completa independente sequencial 104/104 arquivos,528/528 testes,74,94s. Build isolado184módulos19,01s PASS; tipos PASS.
00-C: configuração aprovada; lint executado pela raiz FAIL172erros/79arquivos.00-D:10amostras e28.800velas PASS no perfil sem concorrência; rodada anterior sob pressão FAIL, preservada. Ver RELATORIO-00-CD.md.
Próxima recuperação delimitada em PROPOSTA-00-E-SANEAMENTO.md; nenhuma edição nesses79arquivos autorizada por essa proposta ainda.
**Gate00 global continua bloqueado; nenhuma implementação visual iniciada.**

